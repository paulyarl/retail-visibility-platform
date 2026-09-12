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

/** Dispatch $queryRaw: aggregates/categories → [], upsert → [appliedRow]. */
function mockQueries(listingAggregates: any[] = [], categoryRows: any[] = []) {
  mockQueryRaw.mockImplementation((sql: any) => {
    const text = (sql.strings ?? []).join(' ');
    sqlCalls.push({ text, values: sql.values ?? [] });
    if (text.includes('INSERT INTO directory_category_enrichment')) {
      return Promise.resolve([appliedRow]);
    }
    if (text.includes('GROUP BY primary_category')) {
      return Promise.resolve(listingAggregates);
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
