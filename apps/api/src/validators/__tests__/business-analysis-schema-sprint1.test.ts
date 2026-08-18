/**
 * Business analysis schema tests — Sprint 1 (Universal Recalibration)
 *
 * Verifies the Zod schema accepts audits with the new product-visibility
 * fields (website.has_product_browsing, google.photo_types, business_type,
 * etc.) and rejects malformed values.
 *
 * Spec: docs/LocalBiz/marketing_ops_universal_recalibration_sprint_plan.md
 */

import { describe, it, expect } from 'vitest';
import { businessAnalysisSchema } from '../../validators/business-analysis.schema';

// ─── Minimal valid audit (passes schema) ─────────────────────────────────

function baseAudit(): any {
  return {
    audit_metadata: {
      audit_date: '2024-06-01',
      requested_business: {
        business_name: 'Indy African Market',
        city: 'Indianapolis',
        state: 'IN',
        category: 'African grocery store',
      },
      identity_status: 'confirmed',
      identity_confidence: 'high',
    },
    summary: 'Test audit',
    platforms: {
      google: {
        profile_status: 'claimed',
        rating: 4.2,
        total_reviews: 12,
        reviews_with_observable_response: 8,
        observable_unanswered_reviews: 4,
        observable_unanswered_negative_reviews: 1,
        observable_unanswered_positive_reviews: 3,
        observable_response_rate_percent: 67,
      },
    },
    website: {
      url: 'https://example.com',
      status: 'working',
      mobile_friendly: 'yes',
    },
    nap_consistency: { overall_status: 'consistent' },
    digital_opportunity_score: { score: 5 },
    high_attention: false,
    recommended_tier: 'tier_2',
    data_quality: { confidence: 'high' },
  };
}

describe('Sprint 1 — business_analysis schema: new product-visibility fields', () => {
  it('accepts audit with business_type="product"', () => {
    const audit = baseAudit();
    audit.business_type = 'product';
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.business_type).toBe('product');
    }
  });

  it('accepts audit with business_type="hybrid"', () => {
    const audit = baseAudit();
    audit.business_type = 'hybrid';
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('accepts audit with business_type="service"', () => {
    const audit = baseAudit();
    audit.business_type = 'service';
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('accepts audit with business_type="unable_to_verify"', () => {
    const audit = baseAudit();
    audit.business_type = 'unable_to_verify';
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('accepts audit with business_type=null', () => {
    const audit = baseAudit();
    audit.business_type = null;
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('accepts audit without business_type (optional)', () => {
    const audit = baseAudit();
    // business_type not set
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('rejects audit with invalid business_type', () => {
    const audit = baseAudit();
    audit.business_type = 'restaurant';
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(false);
  });
});

describe('Sprint 1 — website product-visibility fields', () => {
  it('accepts website with has_product_browsing boolean', () => {
    const audit = baseAudit();
    audit.website.has_product_browsing = false;
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
  });

  it('accepts website with has_availability_inquiry, has_pickup_ordering, has_delivery_option', () => {
    const audit = baseAudit();
    audit.website.has_availability_inquiry = true;
    audit.website.has_pickup_ordering = false;
    audit.website.has_delivery_option = true;
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('accepts website with product_categories_visible array', () => {
    const audit = baseAudit();
    audit.website.product_categories_visible = ['Grains', 'Spices', 'Sauces'];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('accepts "yes"/"no" string for has_product_browsing (coercedBooleanNullableTolerant)', () => {
    const audit = baseAudit();
    audit.website.has_product_browsing = 'no';
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website?.has_product_browsing).toBe(false);
    }
  });
});

describe('website.status vocabulary drift — "working"/"broken" synonyms', () => {
  // Agents (e.g. Gemini Flash) frequently reuse the website.status enum values
  // ("working"/"broken") for the per-field website assessments because the
  // prompt documents those values first. The schema coerces them so a
  // structurally-correct audit is not rejected solely for this drift.
  it('coerces mobile_friendly="working" -> "yes"', () => {
    const audit = baseAudit();
    audit.website.mobile_friendly = 'working';
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website?.mobile_friendly).toBe('yes');
    }
  });

  it('coerces mobile_friendly="broken" -> "no"', () => {
    const audit = baseAudit();
    audit.website.mobile_friendly = 'broken';
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website?.mobile_friendly).toBe('no');
    }
  });

  it('coerces boolean website fields from "working" -> true', () => {
    const audit = baseAudit();
    audit.website.https = 'working';
    audit.website.contact_information_visible = 'working';
    audit.website.click_to_call_available = 'working';
    audit.website.service_information_present = 'working';
    audit.website.location_information_present = 'working';
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website?.https).toBe(true);
      expect(result.data.website?.contact_information_visible).toBe(true);
      expect(result.data.website?.click_to_call_available).toBe(true);
      expect(result.data.website?.service_information_present).toBe(true);
      expect(result.data.website?.location_information_present).toBe(true);
    }
  });

  it('coerces boolean website fields from "broken" -> false', () => {
    const audit = baseAudit();
    audit.website.https = 'broken';
    audit.website.call_to_action_present = 'broken';
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.website?.https).toBe(false);
      expect(result.data.website?.call_to_action_present).toBe(false);
    }
  });

  it('accepts the full Gemini-style website block from the field report', () => {
    // Reproduces the exact shape that triggered the 400 validation_error on
    // POST /api/admin/marketing-ops/prompts/executions/external.
    const audit = baseAudit();
    audit.website = {
      url: 'https://jaysgrocery.com',
      status: 'working',
      mobile_friendly: 'working',
      https: 'working',
      contact_information_visible: 'working',
      click_to_call_available: 'working',
      call_to_action_present: 'broken',
      service_information_present: 'working',
      location_information_present: 'working',
      category_specific_content_present: 'working',
      ordering_or_pickup_info_present: 'working',
      issues: [],
      conversion_opportunities: [],
    };
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
  });
});

describe('Sprint 1 — google platform product-visibility fields', () => {
  it('accepts google with photo_count number', () => {
    const audit = baseAudit();
    audit.platforms.google.photo_count = 3;
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('accepts google with photo_types array', () => {
    const audit = baseAudit();
    audit.platforms.google.photo_types = ['storefront', 'product', 'team'];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('accepts google with special_hours_present boolean', () => {
    const audit = baseAudit();
    audit.platforms.google.special_hours_present = false;
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('accepts google with special_hours_present=null (unable to verify)', () => {
    const audit = baseAudit();
    audit.platforms.google.special_hours_present = null;
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });
});

describe('Sprint 1 — schema is additive (non-breaking)', () => {
  it('audit without any new fields still passes (legacy audits)', () => {
    const audit = baseAudit();
    // No business_type, no product-visibility website fields, no google photo fields
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });
});

describe('identity_corroboration_sources — string vs object elements', () => {
  // The prompt documents `["<string>", ...]`, but some agents (e.g. GPT-5.6
  // Luna) emit richer objects `{ source, matched_identifiers, url }`. The
  // schema accepts both via a union so the richer representation is preserved.
  it('accepts an array of strings (legacy/documented shape)', () => {
    const audit = baseAudit();
    audit.audit_metadata.identity_corroboration_sources = [
      'City of Kansas City Finance Department Business License Database',
      'Official Business Website',
    ];
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
  });

  it('accepts an array of objects with source/matched_identifiers/url', () => {
    const audit = baseAudit();
    audit.audit_metadata.identity_corroboration_sources = [
      {
        source: 'Northeast Kansas City Chamber of Commerce',
        matched_identifiers: 'Exact business name, address, and phone numbers',
        url: 'https://nekcchamber.com/directory/mogadisho-market-llc/',
      },
      {
        source: 'Kansas City business license directory',
        matched_identifiers: 'Exact business name and address',
        url: 'https://opengovus.com/kansas-city-business/225601792',
      },
    ];
    const result = businessAnalysisSchema.safeParse(audit);
    expect(result.success).toBe(true);
    if (result.success) {
      const sources = result.data.audit_metadata?.identity_corroboration_sources;
      expect(Array.isArray(sources)).toBe(true);
      expect(sources).toHaveLength(2);
    }
  });

  it('accepts a mixed array of strings and objects', () => {
    const audit = baseAudit();
    audit.audit_metadata.identity_corroboration_sources = [
      'Official Business Website',
      { source: 'Chamber of Commerce', url: 'https://example.com/' },
    ];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('accepts object elements with extra keys (passthrough)', () => {
    const audit = baseAudit();
    audit.audit_metadata.identity_corroboration_sources = [
      { source: 'Chamber', accessed_date: '2026-08-18', confidence: 'high' },
    ];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('accepts object elements with null/missing optional fields', () => {
    const audit = baseAudit();
    audit.audit_metadata.identity_corroboration_sources = [
      { source: null, matched_identifiers: null, url: null },
      {},
    ];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(true);
  });

  it('rejects array elements that are neither string nor object', () => {
    const audit = baseAudit();
    audit.audit_metadata.identity_corroboration_sources = [123];
    expect(businessAnalysisSchema.safeParse(audit).success).toBe(false);
  });
});
