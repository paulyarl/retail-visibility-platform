import { describe, it, expect } from 'vitest';
import {
  bronzeScopeLabel,
  bronzeStandardSummary,
  isBronzeStandardProfile,
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
