/**
 * DirectorySeedCleanupService.getCleanupReport — batch selector metadata.
 *
 * The cleanup page's batch dropdown used to render raw convention slugs
 * (`pg-mcamp-fv4svcsx-20261028`), which say nothing about the cohort. The
 * report's `batches` rows now carry the cohort's birth date, dominant shelf
 * and dominant city so the web side can compose a readable label; this pins
 * the shape and the SQL-level aggregation contract (MODE, not the
 * alphabetically-first value — a multi-city cohort must lead with the city
 * that holds most of its seeds).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockMemberships } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockMemberships: vi.fn(),
}));

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $executeRaw: vi.fn(),
    mkt_audits_list: { findMany: vi.fn() },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({ audit: vi.fn() }));

vi.mock('../../lib/id-generator', () => ({
  generateDirectoryFieldProvenanceId: vi.fn(() => 'dfp-test'),
}));

vi.mock('../DirectoryPresenceSeedService', () => ({ default: {} }));
vi.mock('../ProvingGroundDedupService', () => ({ default: {} }));
vi.mock('../DirectoryChainService', () => ({
  default: { membershipsForSeeds: mockMemberships },
  computeChainSignals: vi.fn(() => null),
}));
vi.mock('../directory/listingAttributes', () => ({
  normalizeAttributeEntry: vi.fn((a: any) => a),
}));
vi.mock('../directory/SeedSeoComposer', () => ({
  buildSeoEnrichmentJson: vi.fn(() => ({})),
  DISCLOSURE_SENTENCE: '',
}));

import DirectorySeedCleanupService from '../DirectorySeedCleanupService';

const sqlText = (a: any) => (Array.isArray(a) ? a.join('') : String(a));

const SEED_ROW = {
  id: 'seed-1',
  tenant_id: 'ten-1',
  listing_id: 'list-1',
  status: 'published',
  seed_batch: 'pg-mcamp-fv4svcsx-20261028',
  category: 'African Grocery Store',
  seed_city: 'Kansas City',
  seed_state: 'MO',
  identity_confidence: 'high',
  seo_enrichment: null,
  owner_email: null,
  owner_phone: null,
  business_name: 'Juba Food Market Llc',
  address: '1234 Prospect Ave',
  zip_code: '64127',
  city: 'Kansas City',
  state: 'MO',
  phone: null,
  website: null,
  slug: 'juba-food-market',
  is_published: true,
  description: null,
  keywords: null,
  same_as: null,
  secondary_categories: null,
  business_hours: null,
  attributes: null,
  has_active_claim_token: false,
  primary_campaign_id: null,
  queue_status: null,
};

const BATCH_ROWS = [
  {
    seed_batch: 'pg-mcamp-fv4svcsx-20261028',
    seed_count: 10,
    created_at: new Date('2026-10-28T11:20:08.783Z'),
    top_category: 'African Grocery Store',
    category_count: 1,
    top_place: 'Milwaukee, WI',
    place_count: 1,
  },
  {
    seed_batch: 'from-campaign-mcamp-7esxljzt',
    seed_count: 1,
    created_at: null,
    top_category: null,
    category_count: 0,
    top_place: null,
    place_count: 0,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockMemberships.mockResolvedValue(new Map());
  mockQueryRaw.mockImplementation(async (strings: any) => {
    const sql = sqlText(strings);
    if (sql.includes('GROUP BY seed_batch')) return BATCH_ROWS;
    if (sql.includes('FROM directory_presence_seeds')) return [SEED_ROW];
    if (sql.includes('mkt_prospect_dedup_verdicts')) return [];
    if (sql.includes('directory_field_provenance')) return [];
    return [];
  });
});

describe('getCleanupReport batch options', () => {
  it('aggregates birth date, dominant shelf and dominant place per batch', async () => {
    const report = await DirectorySeedCleanupService.getCleanupReport(
      'pg-mcamp-fv4svcsx-20261028',
    );

    expect(report.batches).toEqual([
      {
        seedBatch: 'pg-mcamp-fv4svcsx-20261028',
        seedCount: 10,
        isPgBatch: true,
        createdAt: '2026-10-28T11:20:08.783Z',
        topCategory: 'African Grocery Store',
        categoryCount: 1,
        topPlace: 'Milwaukee, WI',
        placeCount: 1,
      },
      {
        seedBatch: 'from-campaign-mcamp-7esxljzt',
        seedCount: 1,
        isPgBatch: false,
        createdAt: null,
        topCategory: null,
        categoryCount: 0,
        topPlace: null,
        placeCount: 0,
      },
    ]);
  });

  it('aggregates places as city + state inside SQL and picks the modal value', async () => {
    await DirectorySeedCleanupService.getCleanupReport();

    const batchSql = mockQueryRaw.mock.calls
      .map((c) => sqlText(c[0]))
      .find((sql) => sql.includes('GROUP BY seed_batch'));

    expect(batchSql).toContain("CONCAT_WS(', ', NULLIF(city, ''), NULLIF(state, ''))");
    expect(batchSql).toContain('MODE() WITHIN GROUP');
    expect(batchSql).toContain('MIN(created_at)');
  });

  it('defaults missing aggregate columns instead of surfacing null counts', async () => {
    mockQueryRaw.mockImplementation(async (strings: any) => {
      const sql = sqlText(strings);
      if (sql.includes('GROUP BY seed_batch')) {
        return [{ seed_batch: 'hand-stamped-batch', seed_count: 2, created_at: null }];
      }
      if (sql.includes('FROM directory_presence_seeds')) return [SEED_ROW];
      return [];
    });

    const report = await DirectorySeedCleanupService.getCleanupReport();

    expect(report.batches[0]).toEqual({
      seedBatch: 'hand-stamped-batch',
      seedCount: 2,
      isPgBatch: false,
      createdAt: null,
      topCategory: null,
      categoryCount: 0,
      topPlace: null,
      placeCount: 0,
    });
  });
});
