/**
 * LocationMarketEnrichmentService.applyEnrichmentPacket tests — sprint plan
 * H1 merge contract + __location__ sentinel.
 * docs/LocalBiz/DIRECTORY_ENRICHMENT_CAMPAIGNS_SPRINT_PLAN.md
 *
 * Covers:
 * - The ('__location__', city, state) row is written literally.
 * - trigger_source='campaign_run' + campaign/execution lineage.
 * - Merge contract: AI wins when non-empty; deterministic aggregates fill
 *   gaps; AI top_categories fill secondary_categories before aggregates.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockAudit } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockAudit: vi.fn(),
}));

const sqlCalls: { text: string; values: any[] }[] = [];

vi.mock('../../prisma', () => ({
  prisma: { $queryRaw: mockQueryRaw },
}));

vi.mock('../../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../audit', () => ({
  audit: mockAudit,
}));

vi.mock('../../lib/id-generator', () => ({
  generateCategoryMarketEnrichmentId: () => 'dce-loc-001',
}));

vi.mock('../intelligence/IntelligenceProfileService', () => ({
  IntelligenceProfileService: { getInstance: () => ({}) },
  normalizeReferenceCity: (s?: string | null) => {
    const t = (s ?? '').trim();
    return t || null;
  },
  normalizeReferenceState: (s?: string | null) => {
    const t = (s ?? '').trim();
    return t ? t.toUpperCase() : null;
  },
}));

import LocationMarketEnrichmentService from '../LocationMarketEnrichmentService';

const service = LocationMarketEnrichmentService;

const appliedRow = {
  id: 'dce-loc-001',
  category_key: '__location__',
  category_name: 'Columbus, OH',
  city: 'Columbus',
  state: 'OH',
  meta_title: 'Local Businesses in Columbus, OH',
  description: 'Browse local businesses in Columbus.',
  keywords: ['columbus businesses'],
  secondary_categories: ['restaurants'],
  schema_type_hint: 'WebPage',
  body_copy: 'Columbus has a diverse local business scene.',
  intelligence_profile_id: null,
  gold_standard_profile_id: null,
  composer_version: 2,
  enriched_at: new Date('2026-09-12T00:00:00Z'),
  enriched_by: 'user-1',
  trigger_source: 'campaign_run',
  operator_override_description: null,
  operator_override_meta_title: null,
  operator_override_keywords: null,
  override_by: null,
  override_at: null,
};

/**
 * Dispatch $queryRaw: upsert → [appliedRow]; listing aggregates →
 * listingAggregates; national coverage rollups → coverageRows; everything
 * else (category enrichments, findRow) → categoryRows.
 *
 * $queryRaw is called in two forms: tagged-template (`$queryRaw`...`` →
 * (strings, ...values)) and Prisma.sql objects (`.strings`/`.values`) — the
 * dispatcher must normalize both or tagged queries record empty text.
 */
function mockQueries(
  listingAggregates: any[] = [],
  categoryRows: any[] = [],
  coverageRows: { states?: any[]; cities?: any[] } = {},
) {
  mockQueryRaw.mockImplementation((...args: any[]) => {
    const sql = args[0];
    const tagged = Array.isArray(sql);
    const text = tagged ? sql.join(' ') : (sql?.strings ?? []).join(' ');
    const values = tagged ? args.slice(1) : (sql?.values ?? []);
    sqlCalls.push({ text, values });
    if (text.includes('INSERT INTO directory_category_enrichment')) {
      return Promise.resolve([appliedRow]);
    }
    if (text.includes('GROUP BY primary_category')) {
      return Promise.resolve(listingAggregates);
    }
    if (text.includes('COUNT(DISTINCT city)')) {
      return Promise.resolve(coverageRows.states ?? []);
    }
    if (text.includes('GROUP BY city, state')) {
      return Promise.resolve(coverageRows.cities ?? []);
    }
    return Promise.resolve(categoryRows);
  });
}

function findUpsert() {
  return sqlCalls.find((c) => c.text.includes('INSERT INTO directory_category_enrichment'));
}

describe('applyEnrichmentPacket — location row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlCalls.length = 0;
    mockQueries();
  });

  it('writes the literal __location__ sentinel key with campaign lineage', async () => {
    const result = await service.applyEnrichmentPacket({
      campaign: { id: 'mcamp-loc-1', city: 'Columbus', state: 'OH' },
      packet: {
        meta_title: 'Local Businesses in Columbus, OH',
        description: 'Browse local businesses in Columbus.',
        keywords: ['columbus businesses'],
      } as any,
      executionId: 'mpexec-9',
      enrichedBy: 'user-1',
    });

    expect(result).not.toBeNull();
    expect(result!.categoryKey).toBe('__location__');
    expect(result!.city).toBe('Columbus');
    expect(result!.state).toBe('OH');
    expect(result!.triggerSource).toBe('campaign_run');

    const upsert = findUpsert();
    expect(upsert).toBeDefined();
    expect(upsert!.values).toContain('__location__');
    expect(upsert!.values).toContain('Columbus');
    expect(upsert!.values).toContain('OH');
    expect(upsert!.values).toContain('campaign_run');
    expect(upsert!.values).toContain('mcamp-loc-1');
    expect(upsert!.values).toContain('mpexec-9');
  });

  it('fills secondary_categories from AI top_categories when secondary is empty', async () => {
    await service.applyEnrichmentPacket({
      campaign: { id: 'mcamp-loc-2', city: 'Columbus', state: 'OH' },
      packet: {
        meta_title: 'Local Businesses in Columbus, OH',
        description: 'Browse local businesses in Columbus.',
        keywords: ['columbus businesses'],
        top_categories: ['restaurants', 'auto repair'],
      } as any,
    });

    const upsert = findUpsert();
    expect(upsert!.values).toContain('restaurants');
    expect(upsert!.values).toContain('auto repair');
  });

  it('returns null for an invalid campaign city/state', async () => {
    const result = await service.applyEnrichmentPacket({
      campaign: { id: 'mcamp-loc-3', city: '', state: '' },
      packet: {
        meta_title: 'x',
        description: 'x',
        keywords: ['x'],
      } as any,
    });

    expect(result).toBeNull();
    expect(findUpsert()).toBeUndefined();
  });
});

describe('applyEnrichmentPacket — national (__all__) location row', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlCalls.length = 0;
    mockQueries();
  });

  it('writes the literal sentinel row, not the normalized __All__ phantom', async () => {
    await service.applyEnrichmentPacket({
      campaign: { id: 'mcamp-loc-nat', city: '__all__', state: '__all__' },
      packet: {
        meta_title: 'Local Businesses Across the US — VisibleShelf Directory',
        description: 'Browse local businesses across covered markets.',
        keywords: ['local businesses'],
        context: { market_summary: 'Coverage spans two states.' },
      } as any,
      executionId: 'mpexec-nat',
      enrichedBy: 'user-1',
    });

    const upsert = findUpsert();
    expect(upsert).toBeDefined();
    expect(upsert!.values).toContain('__location__');
    // Literal sentinels on the row — never the normalized forms.
    expect(upsert!.values).toContain('__all__');
    expect(upsert!.values).not.toContain('__All__');
    expect(upsert!.values).not.toContain('__ALL__');
    expect(upsert!.values).toContain('United States');
    expect(upsert!.values).toContain('campaign_run');
    expect(upsert!.values).toContain('mcamp-loc-nat');

    // The measured coverage grid is stamped into context alongside the AI
    // packet's context — the deterministic fact layer rides the row.
    const ctxVal = upsert!.values.find(
      (v) => v && typeof v === 'object' && 'national_coverage' in v,
    );
    expect(ctxVal).toBeDefined();
    expect((ctxVal as any).market_summary).toBe('Coverage spans two states.');

    // The literal sentinel never reaches the row in normalized form — not
    // even inside the nested Prisma.sql text[] fragments.
    expect(JSON.stringify(upsert!.values)).not.toContain('__ALL__');
    expect(JSON.stringify(upsert!.values)).not.toContain('__All__');
  });

  it('national category aggregates + listing aggregates feed the fallback packet', async () => {
    mockQueries(
      [{ primary_category: 'restaurants', cnt: 40n }], // national listing aggregates
      [{ category_key: 'restaurants', category_name: 'Restaurants', city: '__all__', state: '__all__', meta_title: '', description: '', keywords: ['restaurants near me'], secondary_categories: ['diners'] }],
    );

    await service.applyEnrichmentPacket({
      campaign: { id: 'mcamp-loc-nat2', city: '__all__', state: '__all__' },
      packet: { meta_title: 'x', description: 'x' } as any,
    });

    const upsert = findUpsert();
    expect(upsert).toBeDefined();
    // Aggregate-derived keyword/category material reached the row (the
    // text[] fragments serialize their values inside nested Prisma.sql).
    expect(JSON.stringify(upsert!.values)).toContain('restaurants');
  });
});

describe('enrichLocation — national (__all__) deterministic sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlCalls.length = 0;
  });

  it('preserves campaign-applied head copy and refreshes national_coverage', async () => {
    // findRow falls through to categoryRows in the dispatcher — the v2 row
    // doubles as the "existing" national location row.
    mockQueries([], [{
      ...appliedRow,
      category_name: 'United States',
      city: '__all__',
      state: '__all__',
      meta_title: 'Campaign Title',
      description: 'Campaign description.',
      keywords: ['campaign kw'],
      secondary_categories: ['campaign secondary'],
      schema_type_hint: 'CollectionPage',
      composer_version: 2,
      context: { market_summary: 'prior context' },
    }]);

    await service.enrichLocation('__all__', '__all__', { triggerSource: 'pg_sweep' });

    const upsert = findUpsert();
    expect(upsert).toBeDefined();
    // Campaign head copy survives the sync — the composer never reverts it.
    expect(upsert!.values).toContain('Campaign Title');
    expect(upsert!.values).toContain('Campaign description.');
    expect(JSON.stringify(upsert!.values)).toContain('campaign kw');
    expect(upsert!.values).toContain('CollectionPage');
    expect(upsert!.values).toContain(2); // composer_version stays campaign
    // Prior AI context survives; the coverage grid is restamped.
    const ctxVal = upsert!.values.find(
      (v) => v && typeof v === 'object' && 'national_coverage' in v,
    );
    expect(ctxVal).toBeDefined();
    expect((ctxVal as any).market_summary).toBe('prior context');
    expect(upsert!.values).toContain('pg_sweep');
  });

  it('writes the deterministic baseline packet when no campaign row exists', async () => {
    mockQueries();
    await service.enrichLocation('__all__', '__all__', { triggerSource: 'pg_sweep' });

    const upsert = findUpsert();
    expect(upsert).toBeDefined();
    expect(upsert!.values).toContain('__location__');
    // The sentinels are inlined literally in the SQL, not bound params.
    expect(upsert!.text).toContain("'__all__', '__all__'");
    expect(upsert!.values).toContain('United States');
    expect(upsert!.values).toContain(1); // COMPOSER_VERSION — deterministic baseline
    expect(upsert!.values).not.toContain('Campaign Title');
  });
});

describe('getLocation — national (__all__) phantom-write guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sqlCalls.length = 0;
    mockQueries();
  });

  it('returns null on miss and never on-demand-writes a national row', async () => {
    const result = await service.getLocation('__all__', '__all__');

    expect(result).toBeNull();
    // A literal lookup ran, and no INSERT was issued — the phantom-write
    // path (normalize '__all__' → miss → enrichLocation) is closed.
    const select = sqlCalls.find((c) => c.text.includes('SELECT * FROM directory_category_enrichment'));
    expect(select).toBeDefined();
    expect(select!.values).toContain('__all__');
    expect(findUpsert()).toBeUndefined();
  });

  it('returns the literal national row when it exists', async () => {
    mockQueryRaw.mockImplementation((...args: any[]) => {
      const sql = args[0];
      const tagged = Array.isArray(sql);
      const text = tagged ? sql.join(' ') : (sql?.strings ?? []).join(' ');
      sqlCalls.push({ text, values: tagged ? args.slice(1) : (sql?.values ?? []) });
      if (text.includes('SELECT * FROM directory_category_enrichment')) {
        return Promise.resolve([{
          ...appliedRow,
          category_name: 'United States',
          city: '__all__',
          state: '__all__',
        }]);
      }
      return Promise.resolve([]);
    });

    const result = await service.getLocation('__all__', '__all__');

    expect(result).not.toBeNull();
    expect(result!.city).toBe('__all__');
    expect(result!.locationName).toBe('United States');
    expect(findUpsert()).toBeUndefined();
  });
});
