/**
 * CategoryMarketEnrichmentService.applyEnrichmentPacket tests — sprint plan
 * C1/C2 sentinel + fan-out contract.
 * docs/LocalBiz/DIRECTORY_ENRICHMENT_CAMPAIGNS_SPRINT_PLAN.md
 *
 * Covers:
 * - National ('__all__') packet stores literal city='__all__' / state='__all__'
 *   — normalizers are bypassed (normalizeReferenceState('__all__') would
 *   produce '__ALL__').
 * - trigger_source='campaign_run' + source_campaign_id/source_execution_id
 *   lineage are written.
 * - National packets skip listing fan-out and the location recompute.
 * - City-scope packets write the normalized market row and fan out.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockListingsFindMany, mockAudit, mockEnrichLocation } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockListingsFindMany: vi.fn(),
  mockAudit: vi.fn(),
  mockEnrichLocation: vi.fn(),
}));

const sqlCalls: { text: string; values: any[] }[] = [];

vi.mock('../../prisma', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    directory_listings_list: { findMany: mockListingsFindMany },
    directory_field_provenance: { findMany: vi.fn().mockResolvedValue([]) },
    directory_listing_enrichment_log: { create: vi.fn() },
  },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({
  audit: mockAudit,
}));

vi.mock('../../lib/id-generator', () => ({
  generateCategoryMarketEnrichmentId: () => 'dce-test-001',
  generateListingEnrichmentLogId: () => 'dlel-test-001',
}));

// Stub the intelligence-profile module — the apply path only needs the pure
// normalizers. normalizeReferenceState mirrors the real passthrough:
// '__all__' would come back '__ALL__', which is exactly why the apply path
// must bypass it for sentinels.
vi.mock('../intelligence/IntelligenceProfileService', () => ({
  IntelligenceProfileService: { getInstance: () => ({ resolveGoldStandard: vi.fn() }) },
  normalizeCategoryKey: (s?: string | null) => (s ?? '').toLowerCase().trim().replace(/\s+/g, ' '),
  normalizeReferenceCity: (s?: string | null) => {
    const t = (s ?? '').trim();
    return t || null;
  },
  normalizeReferenceState: (s?: string | null) => {
    const t = (s ?? '').trim();
    return t ? t.toUpperCase() : null;
  },
}));

// The tail-of-apply location recompute is stubbed — covered separately in
// directoryEnrichment.apply.location.test.ts.
vi.mock('../LocationMarketEnrichmentService', () => ({
  default: { enrichLocation: mockEnrichLocation },
}));

import CategoryMarketEnrichmentService from '../CategoryMarketEnrichmentService';

const service = CategoryMarketEnrichmentService.getInstance();

const validPacket = {
  meta_title: 'Halal Grocery — VisibleShelf Places',
  description: 'Browse halal grocery stores listed from public information.',
  keywords: ['halal grocery', 'halal market'],
  secondary_categories: ['International Grocery'],
  schema_type_hint: 'CollectionPage',
  body_copy: 'Halal grocery stores carry zabiha meats and imported staples.',
};

function findUpsert() {
  return sqlCalls.find((c) => c.text.includes('INSERT INTO directory_category_enrichment'));
}

describe('applyEnrichmentPacket — national (__all__) packet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlCalls.length = 0;
    mockQueryRaw.mockImplementation((sql: any) => {
      sqlCalls.push({ text: (sql.strings ?? []).join(' '), values: sql.values ?? [] });
      return Promise.resolve([]);
    });
    mockEnrichLocation.mockResolvedValue(null);
  });

  it('writes literal __all__ sentinels and skips fan-out', async () => {
    const result = await service.applyEnrichmentPacket({
      campaign: { id: 'mcamp-enr-1', category: 'Halal Grocery', city: '__all__', state: 'OH' },
      packet: validPacket as any,
      executionId: 'mpexec-1',
      enrichedBy: 'user-1',
    });

    expect(result.categoryEnrichmentId).toBe('dce-test-001');
    expect(result.marketKey).toEqual({ categoryKey: 'halal grocery', city: '__all__', state: '__all__' });

    const upsert = findUpsert();
    expect(upsert).toBeDefined();
    // Literal sentinels — '__ALL__' must never reach the row.
    expect(upsert!.values).toContain('__all__');
    expect(upsert!.values).not.toContain('__ALL__');
    // Lineage + trigger source.
    expect(upsert!.values).toContain('campaign_run');
    expect(upsert!.values).toContain('mcamp-enr-1');
    expect(upsert!.values).toContain('mpexec-1');
    expect(upsert!.values).toContain(2); // CAMPAIGN_COMPOSER_VERSION

    // National packets have no city to match listings on — no fan-out, and
    // no location recompute.
    expect(mockListingsFindMany).not.toHaveBeenCalled();
    expect(mockEnrichLocation).not.toHaveBeenCalled();
    expect(result.listingsEnriched).toBe(0);
  });
});

describe('applyEnrichmentPacket — city-scope packet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlCalls.length = 0;
    mockQueryRaw.mockImplementation((sql: any) => {
      sqlCalls.push({ text: (sql.strings ?? []).join(' '), values: sql.values ?? [] });
      return Promise.resolve([]);
    });
    mockListingsFindMany.mockResolvedValue([]);
    mockEnrichLocation.mockResolvedValue(null);
  });

  it('writes the normalized market row, fans out, and resyncs the location', async () => {
    const result = await service.applyEnrichmentPacket({
      campaign: { id: 'mcamp-enr-2', category: 'Halal Grocery', city: 'Columbus', state: 'OH' },
      packet: validPacket as any,
      executionId: 'mpexec-2',
      enrichedBy: 'user-1',
    });

    expect(result.categoryEnrichmentId).toBe('dce-test-001');
    expect(result.marketKey).toEqual({ categoryKey: 'halal grocery', city: 'Columbus', state: 'OH' });

    const upsert = findUpsert();
    expect(upsert!.values).toContain('Columbus');
    expect(upsert!.values).toContain('OH');
    expect(upsert!.values).toContain('campaign_run');
    expect(upsert!.values).toContain('mcamp-enr-2');

    // Fan-out ran (published listings query) and the location row resynced
    // with trigger_source='campaign_run'.
    expect(mockListingsFindMany).toHaveBeenCalled();
    expect(mockEnrichLocation).toHaveBeenCalledWith(
      'Columbus',
      'OH',
      expect.objectContaining({ triggerSource: 'campaign_run' }),
      undefined,
    );
  });

  it('returns a no-op result for an empty campaign city', async () => {
    const result = await service.applyEnrichmentPacket({
      campaign: { id: 'mcamp-enr-3', category: 'Halal Grocery', city: '', state: '' },
      packet: validPacket as any,
    });

    expect(result.categoryEnrichmentId).toBeNull();
    expect(result.skipReasons).toEqual({ invalid_market: 1 });
    expect(findUpsert()).toBeUndefined();
  });
});
