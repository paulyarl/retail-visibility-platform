/**
 * Signal extractor tests — Sprint 1 (Universal Recalibration)
 *
 * Verifies extraction logic for the 7 new product-visibility signal codes
 * and the business-type-sensitive DS_PHOTO_DEFICIT threshold.
 *
 * Spec: docs/LocalBiz/marketing_ops_universal_recalibration_sprint_plan.md
 */

import { describe, it, expect } from 'vitest';
import { extractSignals } from '../signal-extractor';
import type { SignalExtractorInput } from '../types';
import type { BusinessAnalysisAuditData } from '../../outreach-openers/archetype-selection';

// ─── Fixtures ────────────────────────────────────────────────────────────

function baseCampaign(): SignalExtractorInput['campaign'] {
  return {
    last_review_date: new Date('2024-01-15'),
    unaddressed_reviews: 0,
    nap_consistent: true,
    has_website: 'yes',
    website_url: 'https://example.com',
    gbp_claimed: true,
  };
}

function baseAuditData(overrides: Partial<BusinessAnalysisAuditData> = {}): BusinessAnalysisAuditData {
  return {
    summary: 'test audit',
    platforms: {
      google: {
        profile_status: 'claimed',
        rating: 4.5,
        total_reviews: 50,
        reviews_with_observable_response: 40,
        observable_unanswered_reviews: 10,
        observable_unanswered_negative_reviews: 2,
        observable_unanswered_positive_reviews: 8,
        observable_response_rate_percent: 80,
      },
    },
    combined_review_metrics: {
      observable_unanswered_reviews: 10,
      observable_unanswered_rate_percent: 20,
      observable_unanswered_negative_reviews: 2,
    },
    website: {
      url: 'https://example.com',
      status: 'working',
      mobile_friendly: 'yes',
      call_to_action_present: 'yes',
      click_to_call_available: 'yes',
      has_booking: true,
      conversion_opportunities: ['booking'],
    },
    nap_consistency: {
      overall_status: 'consistent',
    },
    digital_opportunity_score: { score: 5 },
    high_attention: false,
    recommended_tier: 'tier_2',
    data_quality: { confidence: 'high' },
    ...overrides,
  };
}

function input(auditOverrides: Partial<BusinessAnalysisAuditData> = {}, campaignOverrides: Partial<SignalExtractorInput['campaign']> = {}): SignalExtractorInput {
  return {
    campaign: { ...baseCampaign(), ...campaignOverrides },
    auditData: baseAuditData(auditOverrides),
  };
}

// ─── DS_MISSING_PRODUCT_CATALOG ──────────────────────────────────────────

describe('Sprint 1 — DS_MISSING_PRODUCT_CATALOG', () => {
  it('fires for product business with no website', () => {
    const i = input(
      { business_type: 'product', website: undefined },
      { has_website: 'no', website_url: null },
    );
    const signals = extractSignals(i);
    expect(signals).toContain('DS_MISSING_PRODUCT_CATALOG');
  });

  it('fires for hybrid business with website but no product browsing', () => {
    const i = input({
      business_type: 'hybrid',
      website: { url: 'https://example.com', status: 'working', has_product_browsing: false } as any,
    });
    const signals = extractSignals(i);
    expect(signals).toContain('DS_MISSING_PRODUCT_CATALOG');
  });

  it('does NOT fire for service business with no website', () => {
    const i = input(
      { business_type: 'service', website: undefined },
      { has_website: 'no', website_url: null },
    );
    const signals = extractSignals(i);
    expect(signals).not.toContain('DS_MISSING_PRODUCT_CATALOG');
  });

  it('does NOT fire for product business with website + product browsing', () => {
    const i = input({
      business_type: 'product',
      website: { url: 'https://example.com', status: 'working', has_product_browsing: true } as any,
    });
    const signals = extractSignals(i);
    expect(signals).not.toContain('DS_MISSING_PRODUCT_CATALOG');
  });

  it('does NOT fire when business_type is absent (null-safe)', () => {
    const i = input({}, { has_website: 'no', website_url: null });
    const signals = extractSignals(i);
    expect(signals).not.toContain('DS_MISSING_PRODUCT_CATALOG');
  });
});

// ─── DS_OUTDATED_HOLIDAY_HOURS ───────────────────────────────────────────

describe('Sprint 1 — DS_OUTDATED_HOLIDAY_HOURS', () => {
  it('fires when special_hours_present is explicitly false', () => {
    const i = input({
      platforms: {
        google: { ...baseAuditData().platforms!.google!, special_hours_present: false } as any,
      },
    });
    expect(extractSignals(i)).toContain('DS_OUTDATED_HOLIDAY_HOURS');
  });

  it('does NOT fire when special_hours_present is true', () => {
    const i = input({
      platforms: {
        google: { ...baseAuditData().platforms!.google!, special_hours_present: true } as any,
      },
    });
    expect(extractSignals(i)).not.toContain('DS_OUTDATED_HOLIDAY_HOURS');
  });

  it('does NOT fire when special_hours_present is absent (agent did not assess)', () => {
    const i = input();
    expect(extractSignals(i)).not.toContain('DS_OUTDATED_HOLIDAY_HOURS');
  });
});

// ─── WC_MISSING_PRODUCT_BROWSING ─────────────────────────────────────────

describe('Sprint 1 — WC_MISSING_PRODUCT_BROWSING', () => {
  it('fires when has_product_browsing is false', () => {
    const i = input({
      website: { ...baseAuditData().website!, has_product_browsing: false } as any,
    });
    expect(extractSignals(i)).toContain('WC_MISSING_PRODUCT_BROWSING');
  });

  it('does NOT fire when has_product_browsing is true', () => {
    const i = input({
      website: { ...baseAuditData().website!, has_product_browsing: true } as any,
    });
    expect(extractSignals(i)).not.toContain('WC_MISSING_PRODUCT_BROWSING');
  });

  it('does NOT fire when has_product_browsing is absent', () => {
    const i = input();
    expect(extractSignals(i)).not.toContain('WC_MISSING_PRODUCT_BROWSING');
  });
});

// ─── WC_MISSING_AVAILABILITY_INQUIRY ─────────────────────────────────────

describe('Sprint 1 — WC_MISSING_AVAILABILITY_INQUIRY', () => {
  it('fires when has_availability_inquiry is false', () => {
    const i = input({
      website: { ...baseAuditData().website!, has_availability_inquiry: false } as any,
    });
    expect(extractSignals(i)).toContain('WC_MISSING_AVAILABILITY_INQUIRY');
  });

  it('does NOT fire when has_availability_inquiry is true', () => {
    const i = input({
      website: { ...baseAuditData().website!, has_availability_inquiry: true } as any,
    });
    expect(extractSignals(i)).not.toContain('WC_MISSING_AVAILABILITY_INQUIRY');
  });
});

// ─── WC_MISSING_PICKUP_DELIVERY ──────────────────────────────────────────

describe('Sprint 1 — WC_MISSING_PICKUP_DELIVERY', () => {
  it('fires when both pickup and delivery are false', () => {
    const i = input({
      website: {
        ...baseAuditData().website!,
        has_pickup_ordering: false,
        has_delivery_option: false,
      } as any,
    });
    expect(extractSignals(i)).toContain('WC_MISSING_PICKUP_DELIVERY');
  });

  it('does NOT fire when pickup is true (even if delivery is false)', () => {
    const i = input({
      website: {
        ...baseAuditData().website!,
        has_pickup_ordering: true,
        has_delivery_option: false,
      } as any,
    });
    expect(extractSignals(i)).not.toContain('WC_MISSING_PICKUP_DELIVERY');
  });

  it('does NOT fire when delivery is true (even if pickup is false)', () => {
    const i = input({
      website: {
        ...baseAuditData().website!,
        has_pickup_ordering: false,
        has_delivery_option: true,
      } as any,
    });
    expect(extractSignals(i)).not.toContain('WC_MISSING_PICKUP_DELIVERY');
  });
});

// ─── VP_MISSING_STOREFRONT_PHOTOS ────────────────────────────────────────

describe('Sprint 1 — VP_MISSING_STOREFRONT_PHOTOS', () => {
  it('fires when photo_types has no storefront/exterior/interior', () => {
    const i = input({
      platforms: {
        google: { ...baseAuditData().platforms!.google!, photo_types: ['product', 'team'] } as any,
      },
    });
    expect(extractSignals(i)).toContain('VP_MISSING_STOREFRONT_PHOTOS');
  });

  it('does NOT fire when photo_types includes "storefront"', () => {
    const i = input({
      platforms: {
        google: { ...baseAuditData().platforms!.google!, photo_types: ['storefront', 'product'] } as any,
      },
    });
    expect(extractSignals(i)).not.toContain('VP_MISSING_STOREFRONT_PHOTOS');
  });

  it('does NOT fire when photo_types includes "exterior"', () => {
    const i = input({
      platforms: {
        google: { ...baseAuditData().platforms!.google!, photo_types: ['exterior'] } as any,
      },
    });
    expect(extractSignals(i)).not.toContain('VP_MISSING_STOREFRONT_PHOTOS');
  });

  it('does NOT fire when photo_types is absent', () => {
    const i = input();
    expect(extractSignals(i)).not.toContain('VP_MISSING_STOREFRONT_PHOTOS');
  });
});

// ─── VP_MISSING_PRODUCT_PHOTOS ───────────────────────────────────────────

describe('Sprint 1 — VP_MISSING_PRODUCT_PHOTOS', () => {
  it('fires when photo_types has no "product" type', () => {
    const i = input({
      platforms: {
        google: { ...baseAuditData().platforms!.google!, photo_types: ['storefront', 'team'] } as any,
      },
    });
    expect(extractSignals(i)).toContain('VP_MISSING_PRODUCT_PHOTOS');
  });

  it('does NOT fire when photo_types includes "product"', () => {
    const i = input({
      platforms: {
        google: { ...baseAuditData().platforms!.google!, photo_types: ['product', 'storefront'] } as any,
      },
    });
    expect(extractSignals(i)).not.toContain('VP_MISSING_PRODUCT_PHOTOS');
  });
});

// ─── DS_PHOTO_DEFICIT — business-type-sensitive threshold ────────────────

describe('Sprint 1 — DS_PHOTO_DEFICIT business-type-sensitive threshold', () => {
  it('fires for service business with <5 photos (threshold=5)', () => {
    const i = input({
      business_type: 'service',
      platforms: {
        google: { ...baseAuditData().platforms!.google!, photo_count: 4 } as any,
      },
    });
    expect(extractSignals(i)).toContain('DS_PHOTO_DEFICIT');
  });

  it('does NOT fire for service business with 5 photos (meets threshold=5)', () => {
    const i = input({
      business_type: 'service',
      platforms: {
        google: { ...baseAuditData().platforms!.google!, photo_count: 5 } as any,
      },
    });
    expect(extractSignals(i)).not.toContain('DS_PHOTO_DEFICIT');
  });

  it('fires for product business with 7 photos (below threshold=10)', () => {
    const i = input({
      business_type: 'product',
      platforms: {
        google: { ...baseAuditData().platforms!.google!, photo_count: 7 } as any,
      },
    });
    expect(extractSignals(i)).toContain('DS_PHOTO_DEFICIT');
  });

  it('does NOT fire for product business with 10 photos (meets threshold=10)', () => {
    const i = input({
      business_type: 'product',
      platforms: {
        google: { ...baseAuditData().platforms!.google!, photo_count: 10 } as any,
      },
    });
    expect(extractSignals(i)).not.toContain('DS_PHOTO_DEFICIT');
  });

  it('fires for hybrid business with 9 photos (below threshold=10)', () => {
    const i = input({
      business_type: 'hybrid',
      platforms: {
        google: { ...baseAuditData().platforms!.google!, photo_count: 9 } as any,
      },
    });
    expect(extractSignals(i)).toContain('DS_PHOTO_DEFICIT');
  });

  it('uses service threshold (5) when business_type is absent', () => {
    const i = input({
      platforms: {
        google: { ...baseAuditData().platforms!.google!, photo_count: 7 } as any,
      },
    });
    // 7 >= 5 (service threshold) → no deficit
    expect(extractSignals(i)).not.toContain('DS_PHOTO_DEFICIT');
  });
});
