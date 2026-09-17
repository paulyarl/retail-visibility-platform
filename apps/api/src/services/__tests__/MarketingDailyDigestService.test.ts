/**
 * MarketingDailyDigestService tests — derived daily module activity.
 *
 * The digest composes the automated motions (funnel/seeds via
 * GrowthEngineAnalyticsService, plus direct queries for batches, queue,
 * seed outreach, report outcomes, campaign outreach, proving grounds, and
 * canonical revenue) into one read-only payload. These tests pin the
 * aggregation/parsing (Postgres returns COUNT/SUM as strings) and the day
 * window handed to the funnel source.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQuery, mockGetFunnel } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockGetFunnel: vi.fn(),
}));

vi.mock('../../utils/db-pool', () => ({
  getDirectPool: () => ({ query: mockQuery }),
}));

vi.mock('../GrowthEngineAnalyticsService', () => ({
  default: { getFunnel: mockGetFunnel },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import digestService from '../MarketingDailyDigestService';

const FUNNEL = {
  stages: [{ label: 'Seeks Run', count: 4, conversionFromPrevious: null, conversionFromFirst: 1 }],
  raw: {
    seeksRun: 4,
    prospectsQueued: 4,
    seedsCreated: 10,
    seedsContactable: 8,
    seedsPublished: 6,
    seedsInvited: 3,
    seedsClaimed: 2,
    seedsUpgraded: 1,
    seedsPgLinked: 7,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetFunnel.mockResolvedValue(FUNNEL);
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes('FROM mkt_prospect_queue')) {
      return Promise.resolve({ rows: [{ status: 'queued', count: '3' }, { status: 'contacted', count: '1' }] });
    }
    if (sql.includes('FROM mkt_seek_batches')) {
      return Promise.resolve({ rows: [{ launched: '2', completed: '1', running: '4' }] });
    }
    if (sql.includes('FROM directory_seed_outreach_touches')) {
      return Promise.resolve({
        rows: [
          { channel: 'email', outcome: 'sent', count: '3' },
          { channel: 'email', outcome: 'report_delivered', count: '2' },
          { channel: 'call', outcome: 'report_claimed', count: '1' },
        ],
      });
    }
    if (sql.includes('FROM mkt_outreach_log')) {
      return Promise.resolve({ rows: [{ outcome: 'replied', count: '2' }] });
    }
    if (sql.includes('FROM directory_seed_campaign_links')) {
      return Promise.resolve({
        rows: [
          {
            proving_ground_id: 'pg-1',
            display_id: 'PG-001',
            category: 'Halal Market',
            city: 'Fort Wayne',
            state: 'IN',
            seeds: '6',
            published: '4',
            claimed: '2',
          },
        ],
      });
    }
    if (sql.includes('FROM mkt_campaigns_list')) {
      return Promise.resolve({ rows: [{ workspaces: '5' }] });
    }
    if (sql.includes('FROM marketing_revenue')) {
      return Promise.resolve({ rows: [{ cents: '150000', count: '2' }] });
    }
    if (sql.includes('FROM mkt_scorecards_list')) {
      return Promise.resolve({ rows: [{ cents: '50000' }] });
    }
    return Promise.resolve({ rows: [] });
  });
});

describe('MarketingDailyDigestService.getDailyDigest', () => {
  it('composes all motion sources and parses string counts', async () => {
    const digest = await digestService.getDailyDigest('2026-09-17');

    expect(digest.date).toBe('2026-09-17');
    expect(digest.seeks.runs).toBe(4);
    expect(digest.queue).toEqual({ created: 4, byStatus: { queued: 3, contacted: 1 } });
    expect(digest.seeds).toEqual({
      created: 10,
      contactable: 8,
      published: 6,
      invited: 3,
      claimed: 2,
      upgraded: 1,
      pgLinked: 7,
    });
    expect(digest.provingGrounds.workspaces).toBe(5);
    expect(digest.provingGrounds.linkedSeeds).toBe(7);
    expect(digest.provingGrounds.byWorkspace).toEqual([
      {
        provingGroundId: 'pg-1',
        displayId: 'PG-001',
        category: 'Halal Market',
        city: 'Fort Wayne',
        state: 'IN',
        seeds: 6,
        published: 4,
        claimed: 2,
      },
    ]);
    expect(digest.batches).toEqual({ launched: 2, completed: 1, running: 4 });
    expect(digest.outreach.seedTouches).toBe(6);
    expect(digest.outreach.byChannel).toEqual({ email: 5, call: 1 });
    expect(digest.outreach.campaignTouches).toBe(2);
    expect(digest.outreach.byOutcome).toEqual({ replied: 2 });
    expect(digest.reports).toEqual({ delivered: 2, viewed: 0, claimed: 1, declined: 0 });
    expect(digest.revenue).toEqual({ canonicalCents: 150000, loggedCents: 50000, varianceCents: 100000, count: 2 });
    expect(digest.funnel).toEqual(FUNNEL.stages);
  });

  it('hands the funnel source an inclusive UTC day window', async () => {
    await digestService.getDailyDigest('2026-09-17');
    expect(mockGetFunnel).toHaveBeenCalledWith({
      startDate: '2026-09-17T00:00:00.000Z',
      endDate: '2026-09-17T23:59:59.999Z',
    });
  });

  it('falls back to today for an invalid date string', async () => {
    const digest = await digestService.getDailyDigest('not-a-date');
    expect(digest.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
