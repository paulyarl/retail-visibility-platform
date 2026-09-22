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

const { mockQueryRaw, mockListingsFindMany, mockAudit, mockEnrichLocation, mockProfileResolve } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockListingsFindMany: vi.fn(),
  mockAudit: vi.fn(),
  mockEnrichLocation: vi.fn(),
  mockProfileResolve: vi.fn(async () => null),
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
  IntelligenceProfileService: { getInstance: () => ({ resolveGoldStandard: vi.fn(), resolve: mockProfileResolve }) },
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
    mockQueryRaw.mockImplementation((...args: any[]) => {
      const [first, ...rest] = args;
      if (Array.isArray(first)) {
        sqlCalls.push({ text: first.join(' '), values: rest });
      } else {
        sqlCalls.push({ text: (first.strings ?? []).join(' '), values: first.values ?? [] });
      }
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

  it('resolves the national profile slot (null city) and stamps intelligence_profile_id', async () => {
    mockProfileResolve.mockResolvedValueOnce({
      id: 'mip-national-1',
      category_name: 'Halal Grocery',
      configuration_json: { synonyms: ['halal market'], subcategories: ['halal butcher'] },
    });

    await service.applyEnrichmentPacket({
      campaign: { id: 'mcamp-enr-6', category: 'Halal Grocery', city: '__all__', state: '__all__' },
      packet: validPacket as any,
      executionId: 'mpexec-6',
      enrichedBy: 'user-1',
    });

    // The national slot is probed with a null city — competitive first —
    // never the literal '__all__' sentinel.
    const cityArgs = mockProfileResolve.mock.calls.map((c) => c[2]);
    expect(cityArgs.length).toBeGreaterThan(0);
    expect(cityArgs[0]).toBeNull();
    expect(cityArgs).not.toContain('__all__');
    expect(mockProfileResolve.mock.calls[0][1]).toBe('competitive');

    const upsert = findUpsert();
    expect(upsert).toBeDefined();
    expect(upsert!.values).toContain('mip-national-1');
    // Still no listing fan-out for a national packet.
    expect(mockListingsFindMany).not.toHaveBeenCalled();
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

  it('stamps intelligence_profile_id when an established profile exists for the market', async () => {
    mockProfileResolve.mockResolvedValueOnce({
      id: 'mip-african-1',
      category_name: 'Halal Grocery',
      configuration_json: {
        synonyms: ['halal market', 'zabiha market'],
        subcategories: ['halal butcher'],
      },
    });

    await service.applyEnrichmentPacket({
      campaign: { id: 'mcamp-enr-4', category: 'Halal Grocery', city: 'Columbus', state: 'OH' },
      packet: validPacket as any,
      executionId: 'mpexec-4',
      enrichedBy: 'user-1',
    });

    // Competitive tried first, then emerging — same order as enrichMarket.
    const focusCalls = mockProfileResolve.mock.calls.map((c) => c[1]);
    expect(focusCalls[0]).toBe('competitive');

    const upsert = findUpsert();
    expect(upsert).toBeDefined();
    expect(upsert!.values).toContain('mip-african-1');
    expect(upsert!.text).toContain('intelligence_profile_id = EXCLUDED.intelligence_profile_id');
  });

  it('writes null intelligence_profile_id when no profile exists', async () => {
    await service.applyEnrichmentPacket({
      campaign: { id: 'mcamp-enr-5', category: 'Halal Grocery', city: 'Columbus', state: 'OH' },
      packet: validPacket as any,
      executionId: 'mpexec-5',
      enrichedBy: 'user-1',
    });

    const upsert = findUpsert();
    expect(upsert).toBeDefined();
    expect(upsert!.values).not.toContain('mip-african-1');
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

describe('getNationalRoster — home-page national category packets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlCalls.length = 0;
    mockQueryRaw.mockImplementation((...args: any[]) => {
      const [first, ...rest] = args;
      let text = '';
      let values: any[] = [];
      if (Array.isArray(first)) {
        text = first.join(' ');
        values = rest;
      } else {
        text = (first.strings ?? []).join(' ');
        values = first.values ?? [];
      }
      sqlCalls.push({ text, values });
      if (text.includes('FROM directory_category_enrichment')) {
        return Promise.resolve([
          {
            id: 'dce-nat-1',
            category_key: 'halal grocery',
            category_name: 'Halal Grocery',
            city: '__all__',
            state: '__all__',
            meta_title: 'Halal Grocery Stores Nationwide',
            description: 'National halal grocery coverage.',
            keywords: ['halal grocery'],
            secondary_categories: [],
            schema_type_hint: 'CollectionPage',
            intelligence_profile_id: null,
            gold_standard_profile_id: null,
            enriched_at: new Date('2026-01-01T00:00:00Z'),
            trigger_source: 'campaign_run',
            composer_version: 2,
            body_copy: 'National body copy.',
            context: { category_overview: 'National overview text.' },
          },
        ]);
      }
      return Promise.resolve([]);
    });
  });

  it('selects the literal __all__ rows and maps them to MarketState', async () => {
    const roster = await service.getNationalRoster();

    const select = sqlCalls.find((c) =>
      c.text.includes('FROM directory_category_enrichment'),
    );
    expect(select).toBeDefined();
    // The national sentinels are inlined literally — never normalized params.
    expect(select!.text).toContain("city = '__all__'");
    expect(select!.text).toContain("state = '__all__'");
    // Location rows never leak into the category roster.
    expect(select!.text).toContain("category_key != '__location__'");

    expect(roster).toHaveLength(1);
    expect(roster[0].city).toBe('__all__');
    expect(roster[0].state).toBe('__all__');
    expect(roster[0].effective.description).toBe('National halal grocery coverage.');
    expect(roster[0].bodyCopy).toBe('National body copy.');
    expect(roster[0].context.category_overview).toBe('National overview text.');
  });

  it('returns an empty roster when no national packets exist', async () => {
    mockQueryRaw.mockImplementation(() => Promise.resolve([]));
    const roster = await service.getNationalRoster();
    expect(roster).toEqual([]);
  });
});
