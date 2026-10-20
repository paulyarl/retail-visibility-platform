/**
 * CampaignCascadeService tests — campaign → primary seed → cascade summary.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockQueryRaw, mockGetSummary } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockGetSummary: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}));

vi.mock('../SeedCascadeService', () => ({
  default: { getSummary: mockGetSummary },
}));

import campaignCascadeService from '../CampaignCascadeService';

const summary = (overrides: Record<string, any> = {}) => ({
  seedId: 'seed-1',
  businessName: 'Maria’s Market',
  seedStatus: 'published',
  outreachState: 'outreach_scheduled',
  publishedAt: '2026-10-01T00:00:00.000Z',
  announceScheduledAt: '2026-10-01T00:00:00.000Z',
  announceDeliveredAt: null,
  announceChannel: 'call',
  acts: [],
  gate: { act1Cleared: false, act3Cleared: false, gateCleared: false, reason: '', missing: [] },
  linkedCampaigns: [],
  timeline: [],
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryRaw.mockImplementation((sql: any) => {
    const s = Array.isArray(sql) ? sql.join('?') : String(sql);
    if (s.includes('FROM directory_seed_campaign_links')) {
      return Promise.resolve([{ seed_id: 'seed-1' }]);
    }
    if (s.includes('FROM directory_presence_seeds')) {
      return Promise.resolve([{
        seed_batch: 'cohort-1',
        status: 'published',
        published_at: new Date('2026-10-01T00:00:00Z'),
      }]);
    }
    return Promise.resolve([]);
  });
  mockGetSummary.mockResolvedValue(summary());
});

describe('CampaignCascadeService', () => {
  it('returns the cascade summary and announce queue state', async () => {
    const result = await campaignCascadeService.getForCampaign('camp-1');

    expect(result.seedId).toBe('seed-1');
    expect(result.seed?.seedBatch).toBe('cohort-1');
    expect(result.cascade?.announceScheduledAt).toBe('2026-10-01T00:00:00.000Z');
    expect(result.announce.inQueue).toBe(true);
    expect(result.announce.deliveredAt).toBeNull();
  });

  it('is not in the queue once delivered', async () => {
    mockGetSummary.mockResolvedValue(summary({ announceDeliveredAt: '2026-10-02T00:00:00.000Z' }));

    const result = await campaignCascadeService.getForCampaign('camp-1');
    expect(result.announce.inQueue).toBe(false);
    expect(result.announce.deliveredAt).toBe('2026-10-02T00:00:00.000Z');
  });

  it('returns no_primary_seed when the campaign has no primary link', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);

    const result = await campaignCascadeService.getForCampaign('camp-1');
    expect(result.seedId).toBeNull();
    expect(result.cascade).toBeNull();
    expect(result.reason).toBe('no_primary_seed');
    expect(result.announce.inQueue).toBe(false);
  });

  it('is not in the queue for a draft seed', async () => {
    mockQueryRaw.mockImplementation((sql: any) => {
      const s = Array.isArray(sql) ? sql.join('?') : String(sql);
      if (s.includes('FROM directory_seed_campaign_links')) {
        return Promise.resolve([{ seed_id: 'seed-1' }]);
      }
      if (s.includes('FROM directory_presence_seeds')) {
        return Promise.resolve([{ seed_batch: 'cohort-1', status: 'draft', published_at: null }]);
      }
      return Promise.resolve([]);
    });

    const result = await campaignCascadeService.getForCampaign('camp-1');
    expect(result.announce.inQueue).toBe(false);
  });

  it('batches campaign cascades for the PG VAST board', async () => {
    const result = await campaignCascadeService.getForCampaigns(['camp-1', 'camp-2']);
    expect(Object.keys(result).sort()).toEqual(['camp-1', 'camp-2']);
    expect(result['camp-1'].seedId).toBe('seed-1');
    expect(result['camp-2'].seedId).toBe('seed-1');
  });
});
