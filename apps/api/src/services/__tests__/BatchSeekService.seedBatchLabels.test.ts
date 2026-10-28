/**
 * BatchSeekService.listSeedBatches — modal city/shelf for batch labels.
 *
 * The seed-batch selectors (presence seeds filter, cascade cohort, batch
 * operations) render a human label instead of the raw convention slug. The
 * representative city/shelf must be the MODAL one — `ARRAY_AGG(DISTINCT …)`
 * sorts alphabetically, so a mostly-Indianapolis cohort would otherwise lead
 * with "Avon, IN". This pins both the SQL and the passthrough.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockQueryRawUnsafe: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $queryRawUnsafe: mockQueryRawUnsafe,
    $executeRaw: vi.fn(),
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({ audit: vi.fn() }));

vi.mock('../../lib/id-generator', () => ({
  generateSeekBatchId: vi.fn(() => 'sb-test'),
  generateSeekBatchSlug: vi.fn(() => 'slug-test'),
  generateSeekBatchEntryId: vi.fn(() => 'sbe-test'),
}));

import BatchSeekService from '../BatchSeekService';

const sqlText = (a: any) => (Array.isArray(a) ? a.join('') : String(a));

const BATCH_ROW = {
  seed_batch: 'pg-mcamp-mdjvk2bu-20261023',
  total_seeds: '53',
  published_seeds: '40',
  claimed_seeds: '2',
  invited_seeds: '12',
  cities: ['Avon', 'Indianapolis'],
  categories: ['African Grocery Store', 'Caribbean Grocery Store'],
  top_city: 'Indianapolis, IN',
  top_category: 'African Grocery Store',
  created_at: new Date('2026-10-23T19:28:21.952Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryRawUnsafe.mockImplementation(async (sql: string) => {
    if (sql.includes('GROUP BY dps.seed_batch')) return [BATCH_ROW];
    return [];
  });
  mockQueryRaw.mockImplementation(async (strings: any) => {
    const sql = sqlText(strings);
    if (sql.includes('campaign_category = ')) return [];
    if (sql.includes('JOIN mkt_seek_batches sb')) return [];
    if (sql.includes('JOIN LATERAL')) return [];
    return [];
  });
});

describe('listSeedBatches batch labels', () => {
  it('returns the modal city and shelf alongside the distinct sets', async () => {
    const [batch] = await BatchSeekService.listSeedBatches();

    expect(batch.topCity).toBe('Indianapolis, IN');
    expect(batch.topCategory).toBe('African Grocery Store');
    expect(batch.cities).toEqual(['Avon', 'Indianapolis']);
    expect(batch.categories).toEqual(['African Grocery Store', 'Caribbean Grocery Store']);
    expect(batch.totalSeeds).toBe(53);
  });

  it('aggregates the modal values with city + state inside SQL', async () => {
    await BatchSeekService.listSeedBatches();

    const batchSql = mockQueryRawUnsafe.mock.calls
      .map((c) => String(c[0]))
      .find((sql) => sql.includes('GROUP BY dps.seed_batch'));

    expect(batchSql).toContain('MODE() WITHIN GROUP');
    expect(batchSql).toContain("CONCAT_WS(', ', NULLIF(dps.city, ''), NULLIF(dps.state, ''))");
  });

  it('defaults missing modal values to null', async () => {
    mockQueryRawUnsafe.mockImplementation(async (sql: string) =>
      sql.includes('GROUP BY dps.seed_batch')
        ? [{ ...BATCH_ROW, top_city: null, top_category: null }]
        : [],
    );

    const [batch] = await BatchSeekService.listSeedBatches();

    expect(batch.topCity).toBeNull();
    expect(batch.topCategory).toBeNull();
  });
});
