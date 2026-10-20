/**
 * SeedCascadeCohortService tests — cohort funnel counts + organic claims.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  mockSeedsFindMany,
  mockClaimsFindMany,
  mockGetSummary,
} = vi.hoisted(() => ({
  mockSeedsFindMany: vi.fn(),
  mockClaimsFindMany: vi.fn(),
  mockGetSummary: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    directory_presence_seeds: { findMany: mockSeedsFindMany },
    directory_claim_requests: { findMany: mockClaimsFindMany },
  },
}));

vi.mock('../SeedCascadeService', () => ({
  default: { getSummary: mockGetSummary },
}));

import cohortService from '../SeedCascadeCohortService';

const seed = (overrides: Record<string, any> = {}) => ({
  id: 'seed-1',
  seed_batch: 'cohort-1',
  status: 'published',
  claimed_at: null,
  published_at: new Date(Date.now() - 10 * 86_400_000),
  directory_listings_list: { business_name: 'Maria’s Market' },
  ...overrides,
});

function summary(overrides: Record<string, any> = {}) {
  return {
    announceScheduledAt: '2026-10-01T00:00:00.000Z',
    announceDeliveredAt: '2026-10-02T00:00:00.000Z',
    gate: { act1Cleared: true, act3Cleared: true, gateCleared: true },
    acts: [
      { act: 1, status: 'done' },
      { act: 2, status: 'done' },
      { act: 3, status: 'done' },
      { act: 4, status: 'done' },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSeedsFindMany.mockResolvedValue([
    seed({ id: 'seed-1', claimed_at: new Date('2026-10-01T12:00:00Z') }),
    seed({
      id: 'seed-2',
      directory_listings_list: { business_name: 'Second Market' },
    }),
  ]);
  mockClaimsFindMany.mockResolvedValue([
    { seed_id: 'seed-1', submitted_at: new Date('2026-10-01T12:00:00Z'), status: 'pending' },
  ]);
  mockGetSummary.mockImplementation((seedId: string) =>
    Promise.resolve(
      seedId === 'seed-1'
        ? summary()
        : summary({
            announceDeliveredAt: null,
            gate: { act1Cleared: false, act3Cleared: false, gateCleared: false },
            acts: [
              { act: 1, status: 'in_progress' },
              { act: 2, status: 'not_started' },
              { act: 3, status: 'not_started' },
              { act: 4, status: 'blocked' },
            ],
          }),
    ),
  );
});

describe('SeedCascadeCohortService', () => {
  it('computes the funnel totals, rates, and organic claims', async () => {
    const result = await cohortService.getCohortSummary({ seedBatch: 'cohort-1' });

    expect(result.totals).toEqual({
      seeds: 2,
      act1Verified: 1,
      act2Aware: 1,
      act3Cleared: 1,
      act4Scheduled: 1,
      act4Done: 1,
      claimed: 1,
      organicClaims: 1,
    });
    expect(result.rates.act1Verified).toBe(0.5);
    expect(result.rates.act3Cleared).toBe(0.5);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].organicClaim).toBe(true);
    expect(result.rows[1].organicClaim).toBe(false);
  });

  it('passes the seed batch and id filters through', async () => {
    await cohortService.getCohortSummary({ seedBatch: 'cohort-1', seedIds: ['seed-1'] });

    expect(mockSeedsFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ seed_batch: 'cohort-1', id: { in: ['seed-1'] } }),
      }),
    );
  });

  it('returns zero rates for an empty cohort', async () => {
    mockSeedsFindMany.mockResolvedValue([]);
    mockClaimsFindMany.mockResolvedValue([]);

    const result = await cohortService.getCohortSummary();
    expect(result.totals.seeds).toBe(0);
    expect(result.rates.act1Verified).toBe(0);
  });
});
