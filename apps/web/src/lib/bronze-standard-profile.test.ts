import { describe, it, expect } from 'vitest';
import {
  bronzeDiscoveryFillCandidates,
  bronzeScopeLabel,
  bronzeSlotKey,
  bronzeStandardSummary,
  isBronzeStandardProfile,
  slugifyReasonKey,
  BRONZE_MAX_SLOTS_PER_REASON,
  type BronzeProfileConfig,
} from './bronze-standard-profile';
import type { IntelligenceProfile } from '@/services/MarketingOpsService';

function profile(overrides: Partial<IntelligenceProfile> = {}): IntelligenceProfile {
  return {
    id: 'mip-gco5kyzp',
    category_key: 'african grocery store',
    category_name: 'African Grocery Store',
    version: 1,
    intelligence_focus: 'bronze_standards',
    reference_city: null,
    reference_state: null,
    reference_platform: null,
    configuration_json: {},
    status: 'draft',
    created_at: '2026-09-21T00:42:36.933Z',
    updated_at: '2026-09-21T00:42:36.933Z',
    ...overrides,
  } as IntelligenceProfile;
}

const BRONZE_CONFIG = {
  category_key: 'african grocery store',
  category_name: 'African Grocery Store',
  catalog_revision: 1,
  reason_coverage: [
    {
      reason_key: 'absent_from_platform',
      status: 'filled',
      slots: [
        { business_name: 'Berekum African Market', digital_quality: 'low' },
        { business_name: 'Senay Habesha Store', digital_quality: 'low' },
      ],
    },
    {
      reason_key: 'trade_manifest_only',
      status: 'filled',
      slots: [{ business_name: 'Arsema G Food Mart LLC', digital_quality: 'very_low' }],
    },
    { reason_key: 'community_only_no_reviews', status: 'empty_unproven', empty_slot_note: 'Vector not executed.' },
    { reason_key: 'corridor_absent_from_guides', status: 'empty_proven_elsewhere', empty_slot_note: 'Proven nationally.' },
  ],
  not_applicable_reasons: ['wholesale_or_hybrid_role'],
  scope_mix: { universal: 17, category: 0, location: 0, category_location: 0, platform_bound: 0 },
  vector_execution_log: [
    { vector: 'platform-presence audit', executed: true, returned: 4 },
    { vector: 'Street View sweep', executed: false, returned: null },
  ],
  catalog_snapshot: [{ reason_key: 'absent_from_platform', label: 'Confirmed operating, no profile', priority: 1 }],
  prohibited_inferences: ['Low digital quality describes observable online fields only.'],
};

describe('isBronzeStandardProfile', () => {
  it('detects a profile declared by focus', () => {
    expect(isBronzeStandardProfile(profile({ configuration_json: {} }))).toBe(true);
  });

  it('detects the bronze_standard_scan shape even without the focus value', () => {
    expect(
      isBronzeStandardProfile(profile({ intelligence_focus: 'emerging', configuration_json: BRONZE_CONFIG })),
    ).toBe(true);
    expect(
      isBronzeStandardProfile(
        profile({ intelligence_focus: 'emerging', configuration_json: { catalog_snapshot: [] } }),
      ),
    ).toBe(true);
  });

  it('does not claim gold-standard or category-intelligence shapes', () => {
    expect(
      isBronzeStandardProfile(
        profile({
          intelligence_focus: 'gold_standards',
          configuration_json: { expected_fields: { platforms: { google: {} } } },
        }),
      ),
    ).toBe(false);
    expect(
      isBronzeStandardProfile(
        profile({
          intelligence_focus: 'emerging',
          configuration_json: { terminology: {}, specialized_sources: [] },
        }),
      ),
    ).toBe(false);
    expect(
      isBronzeStandardProfile(profile({ intelligence_focus: 'competitive', configuration_json: {} })),
    ).toBe(false);
  });
});

describe('bronzeStandardSummary', () => {
  it('counts coverage, slots, vectors, and the catalog revision', () => {
    const summary = bronzeStandardSummary(profile({ configuration_json: BRONZE_CONFIG }));
    expect(summary).not.toBeNull();
    expect(summary).toMatchObject({
      reasonCount: 4,
      filledCount: 2,
      emptyUnprovenCount: 1,
      emptyProvenElsewhereCount: 1,
      slotCount: 3,
      catalogSnapshotCount: 1,
      vectorCount: 2,
      executedVectorCount: 1,
      catalogRevision: 1,
    });
  });

  it('returns null for a non-bronze profile', () => {
    expect(
      bronzeStandardSummary(
        profile({ intelligence_focus: 'emerging', configuration_json: { terminology: {} } }),
      ),
    ).toBeNull();
  });

  it('reports a missing catalog revision as null', () => {
    const summary = bronzeStandardSummary(
      profile({ configuration_json: { ...BRONZE_CONFIG, catalog_revision: undefined } }),
    );
    expect(summary?.catalogRevision).toBeNull();
  });
});

describe('bronzeScopeLabel', () => {
  it('labels universal scope', () => {
    expect(bronzeScopeLabel({ reason_key: 'x' })).toBe('universal');
  });

  it('labels category, location, and platform scope', () => {
    expect(bronzeScopeLabel({ reason_key: 'x', scope_category_key: 'african grocery store' })).toBe(
      'cat:african grocery store',
    );
    expect(bronzeScopeLabel({ reason_key: 'x', scope_city: 'Indianapolis', scope_state: 'IN' })).toBe(
      'Indianapolis, IN',
    );
    expect(bronzeScopeLabel({ reason_key: 'x', scope_platform: 'yelp' })).toBe('@yelp');
  });
});

describe('slugifyReasonKey', () => {
  it('converts label to valid snake_case reason key', () => {
    expect(slugifyReasonKey('Exclusively visible on community-specific classifieds')).toBe(
      'exclusively_visible_on_community_specific_classifieds',
    );
    expect(slugifyReasonKey('123 Numbers First')).toBe('reason_123_numbers_first');
    expect(slugifyReasonKey('Special chars & symbols! %')).toBe('special_chars_symbols');
  });
});

// ─── Discovery slot candidates (BronzeStandardDiscoveryPanel) ───────────
// A discovery scan's draft carries candidate slots; the active profile
// carries committed slots; candidates = draft slots not already occupying
// the active board (the bronze mirror of gold's promote list).

describe('bronzeSlotKey', () => {
  it('normalizes case and whitespace, tolerates missing address', () => {
    expect(bronzeSlotKey({ business_name: '  Cedar MARKET ', address: '123 Main' })).toBe(
      'cedar market|123 main',
    );
    expect(bronzeSlotKey({ business_name: 'Cedar Market' })).toBe('cedar market|');
  });
});

describe('bronzeDiscoveryFillCandidates', () => {
  const coverageConfig = (
    coverage: BronzeProfileConfig['reason_coverage'],
    snapshot?: BronzeProfileConfig['catalog_snapshot'],
  ): BronzeProfileConfig => ({
    reason_coverage: coverage,
    catalog_snapshot: snapshot,
  });

  it('returns draft slots not already on the active board', () => {
    const active = coverageConfig([
      { reason_key: 'absent_from_platform', status: 'filled', slots: [{ business_name: 'Existing Biz', address: '1 St' }] },
    ]);
    const draft = coverageConfig([
      {
        reason_key: 'absent_from_platform',
        status: 'filled',
        slots: [{ business_name: 'Existing Biz', address: '1 st' }, { business_name: 'New Find', address: '9 Ave' }],
      },
    ]);
    const out = bronzeDiscoveryFillCandidates(active, draft);
    expect(out).toHaveLength(2);
    const existing = out.find((c) => c.slot.business_name === 'Existing Biz');
    const fresh = out.find((c) => c.slot.business_name === 'New Find');
    expect(existing?.alreadyInSlot).toBe(true);
    expect(fresh?.alreadyInSlot).toBe(false);
  });

  it('marks candidates for reasons absent from active coverage as fillable', () => {
    const draft = coverageConfig([
      { reason_key: 'community_only_presence', status: 'filled', slots: [{ business_name: 'Find' }] },
    ]);
    const out = bronzeDiscoveryFillCandidates(coverageConfig([]), draft);
    expect(out).toHaveLength(1);
    expect(out[0].alreadyInSlot).toBe(false);
    expect(out[0].slotFull).toBe(false);
    expect(out[0].activeSlotCount).toBe(0);
  });

  it('marks candidates slotFull when the active reason is at cap', () => {
    const active = coverageConfig([
      {
        reason_key: 'absent_from_platform',
        status: 'filled',
        slots: [{ business_name: 'A' }, { business_name: 'B' }],
      },
    ]);
    const draft = coverageConfig([
      { reason_key: 'absent_from_platform', status: 'filled', slots: [{ business_name: 'C' }] },
    ]);
    const out = bronzeDiscoveryFillCandidates(active, draft);
    expect(out[0].slotFull).toBe(true);
    expect(out[0].activeSlotCount).toBe(BRONZE_MAX_SLOTS_PER_REASON);
  });

  it('pulls the reason label from the draft catalog snapshot', () => {
    const draft = coverageConfig(
      [{ reason_key: 'absent_from_platform', status: 'filled', slots: [{ business_name: 'Find' }] }],
      [{ reason_key: 'absent_from_platform', label: 'Absent from platform' }],
    );
    const out = bronzeDiscoveryFillCandidates(null, draft);
    expect(out[0].reason_label).toBe('Absent from platform');
  });

  it('skips reasons with no slots and tolerates null configs', () => {
    const draft = coverageConfig([
      { reason_key: 'absent_from_platform', status: 'empty_unproven', slots: [], empty_slot_note: 'None found' },
    ]);
    expect(bronzeDiscoveryFillCandidates(null, draft)).toHaveLength(0);
    expect(bronzeDiscoveryFillCandidates(null, null)).toHaveLength(0);
    expect(bronzeDiscoveryFillCandidates(undefined, {})).toHaveLength(0);
  });
});
