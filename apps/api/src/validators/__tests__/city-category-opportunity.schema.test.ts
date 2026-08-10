/**
 * Unit tests for the city_category_opportunity output schema — V2
 * (Prospect-Discovery / Signal-Aligned Variant).
 *
 * Verifies:
 *   - Valid V2 JSON with nested market_size, new location_status values,
 *     prospect_discovery, and V2 sampled_businesses fields passes.
 *   - Legacy V1 JSON (flat market_size, outside_city_serving_city) still
 *     validates (backward compatibility for already-stored audits).
 *   - V2 location_status coercion maps outside_city_serving_city → metro_area.
 *   - prospect_discovery is optional (V1 output without it still passes).
 *   - Invalid prospect_priority is rejected.
 *   - The registry resolves city_category_opportunity correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  cityCategoryOpportunitySchema,
  CITY_CATEGORY_OPPORTUNITY_SCHEMA_NAME,
} from '../city-category-opportunity.schema';
import {
  resolveOutputSchema,
  OUTPUT_SCHEMA_REGISTRY,
} from '../market-analysis.schema';

// ---- Minimal valid V2 fixture ----

const validV2Output = {
  audit_metadata: {
    audit_date: '2026-08-09',
    requested_market: {
      category: 'HVAC',
      city: 'Plainfield',
      state: 'IL',
      zip_codes: ['60544'],
      search_radius_miles: null,
    },
    category_definition: {
      working_definition: 'Heating and cooling contractors serving residential and light commercial customers.',
      included_subcategories: ['Heating contractors', 'Air-conditioning contractors'],
      excluded_subcategories: ['Refrigeration-only'],
    },
    geographic_scope: {
      scope_description: 'Plainfield + adjacent Joliet/Romeoville + broader Will County metro',
      market_center: 'Plainfield, IL',
      scope_mode: 'prospect_market',
      explicit_radius_supplied: false,
      search_radius_miles: null,
      automatic_market_scope_description: 'Conservative 15-mile radius covering Will County suburbs',
      businesses_inside_city_only: false,
      adjacent_cities_included: ['Joliet', 'Romeoville'],
      metro_areas_included: ['Will County'],
      service_area_businesses_included: true,
    },
    research_method: {
      sources_reviewed: ['Google Business Profile', 'Yelp', 'BBB'],
      deduplication_method: 'Name + address + phone + website domain',
      sampling_method: 'Mixed: highest-review, highest-rated, weak-presence, strong-presence, inside-city, adjacent, metro',
    },
    limitations: ['Some adjacent municipalities may have been under-covered.'],
  },
  summary: 'Plainfield has 12 verified HVAC businesses; the broader prospect universe contains ~45 qualifying businesses across Plainfield, Joliet, and Romeoville. Average Google rating is 4.1 with 38 average reviews. 52% have claimed profiles; 61% have working websites. The market is moderately concentrated with Acme HVAC as the leader. 4 high-priority prospects were identified.',
  market_size: {
    core_city: {
      verified_business_count: 12,
      approximate_business_count: 14,
    },
    prospect_universe: {
      verified_business_count: 38,
      approximate_business_count: 45,
      inside_city_count: 12,
      adjacent_city_count: 15,
      metro_area_count: 11,
    },
    count_unit: 'business_locations',
    detailed_sample_size: 22,
    estimate_confidence: 'medium',
    estimation_method: 'Direct enumeration inside city + radius-based estimate for broader market',
    counts_complete: false,
  },
  category_benchmarks: {
    google: {
      valid_business_count: 22,
      average_rating: 4.1,
      median_rating: 4.2,
      average_review_count: 38,
      median_review_count: 24,
      lowest_rating: 2.8,
      highest_rating: 4.9,
      claimed_or_likely_claimed_count: 11,
      verifiable_profile_count: 22,
      claimed_or_likely_claimed_percent: 52,
    },
    website: {
      verifiable_business_count: 22,
      working_website_count: 13,
      working_website_percent: 61,
      no_website_count: 7,
      no_website_percent: 32,
      social_media_only_count: 2,
      social_media_only_percent: 9,
    },
  },
  competitive_landscape: {
    concentration: 'moderately_concentrated',
    highest_google_review_count: 215,
    top_five_share_of_sample_reviews_percent: 48,
    market_leader: 'Acme HVAC',
    competitive_summary: 'Acme HVAC dominates review volume but has a dated website. The remainder is fragmented with several under-managed profiles.',
  },
  top_competitors: [
    {
      rank: 1,
      business_name: 'Acme HVAC',
      ownership_type: 'local_chain',
      address: '123 Main St, Plainfield, IL',
      website: 'https://acmehvac.example',
      google: {
        profile_status: 'claimed',
        rating: 4.8,
        review_count: 215,
        photo_activity: 'recent',
      },
      website_assessment: {
        status: 'working',
        mobile_friendly: 'likely',
        clear_call_to_action: 'yes',
      },
      competitive_visibility_score: {
        score: 8.5,
        components: {
          review_volume: 9,
          rating_strength: 8,
          website_quality: 7,
          profile_maintenance: 9,
          cross_platform_presence: 8,
        },
      },
      strengths: ['High review volume', 'Claimed GBP'],
      weaknesses: ['Dated website design'],
      ranking_rationale: 'Dominant review volume and strong profile maintenance.',
    },
  ],
  sampled_businesses: [
    {
      business_name: 'Beta Heating & Cooling',
      ownership_type: 'independent',
      location_status: 'inside_city',
      city: 'Plainfield',
      state: 'IL',
      distance_from_market_center_miles: 1.2,
      address: '456 Oak Ave, Plainfield, IL',
      phone: '+1-555-123-4567',
      website: null,
      detected_signals: ['WC_MISSING_WEBSITE', 'DS_CLAIMED_STATUS', 'RA_LOW_REVIEW_VOLUME'],
      signal_count: 3,
      prospect_priority: 'high',
      google: {
        profile_status: 'unclaimed',
        rating: 3.9,
        review_count: 8,
        hours_status: 'current',
        photo_activity: 'none_visible',
        recent_owner_responses_observed: false,
      },
      nap_status: 'minor_variations',
      observed_opportunities: ['No website', 'Unclaimed GBP'],
      data_confidence: 'high',
    },
    {
      business_name: 'Gamma Air Conditioning',
      ownership_type: 'independent',
      location_status: 'adjacent_city',
      city: 'Joliet',
      state: 'IL',
      distance_from_market_center_miles: 6.5,
      address: '789 Industrial Dr, Joliet, IL',
      phone: '+1-555-987-6543',
      website: 'https://gammaac.example',
      detected_signals: ['WC_MISSING_CTA'],
      signal_count: 1,
      prospect_priority: 'medium',
      google: {
        profile_status: 'claimed',
        rating: 4.5,
        review_count: 42,
        hours_status: 'current',
        photo_activity: 'recent',
        recent_owner_responses_observed: true,
      },
      website_assessment: {
        status: 'working',
        mobile_friendly: 'yes',
        clear_call_to_action: 'no',
        issues: ['No clear CTA on homepage'],
      },
      nap_status: 'consistent',
      data_confidence: 'medium',
    },
    {
      business_name: 'Delta Climate Solutions',
      ownership_type: 'independent',
      location_status: 'metro_area',
      city: 'Romeoville',
      state: 'IL',
      distance_from_market_center_miles: 11.3,
      address: '321 Commerce Way, Romeoville, IL',
      phone: '+1-555-456-7890',
      website: 'https://deltaclimate.example',
      detected_signals: [],
      signal_count: 0,
      prospect_priority: 'insufficient_evidence',
      google: {
        profile_status: 'likely_claimed',
        rating: 4.3,
        review_count: 31,
        hours_status: 'current',
        photo_activity: 'recent',
        recent_owner_responses_observed: true,
      },
      website_assessment: {
        status: 'working',
        mobile_friendly: 'yes',
        clear_call_to_action: 'yes',
      },
      nap_status: 'consistent',
      data_confidence: 'low',
    },
  ],
  category_digital_opportunity_score: {
    score: 7,
    classification: 'high',
    components: {
      review_management_opportunity: 7,
      website_opportunity: 8,
      google_profile_opportunity: 6,
      nap_and_directory_opportunity: 5,
      competitive_accessibility: 7,
    },
    rationale: 'High website gap and unclaimed-profile rate create substantial opportunity.',
  },
  outreach_recommendation: {
    primary_angle: 'Lead with GBP optimization — 48% unclaimed in a market where the leader has 215 reviews.',
    problem_to_reference: 'Unclaimed Google Business Profiles and missing websites',
    suggested_service_package: ['GBP optimization', 'Website build', 'Review management'],
    recommended_proof_or_demonstration: 'Diagnostic gallery of competitor vs prospect GBP',
    suggested_call_to_action: 'Free 5-minute visibility scan',
    claims_to_avoid: ['Guaranteed page-one ranking'],
    ideal_prospect_profile: 'Independent HVAC contractor with 5-50 reviews, unclaimed GBP, and no website.',
  },
  recommended_tier: 'tier_2',
  tier_rationale: 'Moderate competition with clear digital gaps justifies tier 2.',
  estimated_monthly_service_fee: { minimum: 1200, maximum: 2500, currency: 'USD' },
  data_quality: {
    confidence: 'medium',
    verified_fields: ['business_name', 'address', 'google_rating'],
    estimated_fields: ['approximate_business_count'],
    unavailable_fields: ['yelp_benchmarks'],
    small_sample_warnings: ['Adjacent-city sample is small (n=8)'],
    limitations: ['Some adjacent municipalities may have been under-covered.'],
  },
  sources: [
    { source_name: 'Google Business Profile', source_type: 'directory', url: 'https://google.com', accessed_date: '2026-08-09' },
  ],
  prospect_discovery: {
    total_qualifying_prospects: 38,
    high_priority_count: 4,
    medium_priority_count: 11,
    low_priority_count: 8,
    insufficient_evidence_count: 15,
    inside_city_prospect_count: 12,
    adjacent_city_prospect_count: 15,
    metro_area_prospect_count: 11,
    highest_signal_businesses: [
      {
        business_name: 'Beta Heating & Cooling',
        city: 'Plainfield',
        location_status: 'inside_city',
        signal_count: 3,
        detected_signals: ['WC_MISSING_WEBSITE', 'DS_CLAIMED_STATUS', 'RA_LOW_REVIEW_VOLUME'],
        prospect_priority: 'high',
      },
    ],
    recommended_for_business_audit: [
      {
        business_name: 'Beta Heating & Cooling',
        city: 'Plainfield',
        location_status: 'inside_city',
        prospect_priority: 'high',
        reason: '3 verified signals including missing website and unclaimed GBP in a high-review-volume market.',
      },
    ],
  },
};

// ---- Minimal legacy V1 fixture (flat market_size, old location_status) ----

const validV1Output = {
  ...validV2Output,
  market_size: {
    verified_business_count: 12,
    approximate_business_count: 14,
    count_unit: 'businesses',
    detailed_sample_size: 22,
    estimate_confidence: 'medium',
    estimation_method: 'Direct enumeration',
    counts_complete: false,
  },
  geographic_scope: {
    scope_description: 'Plainfield only',
    businesses_inside_city_only: true,
    service_area_businesses_included: false,
  },
  sampled_businesses: [
    {
      business_name: 'Legacy HVAC Co',
      ownership_type: 'independent',
      location_status: 'outside_city_serving_city',
      address: '100 Old Rd, Joliet, IL',
      phone: '+1-555-000-0000',
      website: 'https://legacy.example',
      google: {
        profile_status: 'claimed',
        rating: 4.0,
        review_count: 15,
        hours_status: 'current',
        photo_activity: 'stale',
        recent_owner_responses_observed: false,
      },
      nap_status: 'consistent',
      data_confidence: 'medium',
    },
  ],
  // No prospect_discovery — V1 didn't have it
  prospect_discovery: undefined,
};

describe('cityCategoryOpportunitySchema — V2', () => {
  it('accepts valid V2 JSON with nested market_size, prospect_discovery, and V2 location_status values', () => {
    const result = cityCategoryOpportunitySchema.safeParse(validV2Output);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.market_size?.core_city?.verified_business_count).toBe(12);
      expect(result.data.market_size?.prospect_universe?.adjacent_city_count).toBe(15);
      expect(result.data.sampled_businesses?.[0]?.location_status).toBe('inside_city');
      expect(result.data.sampled_businesses?.[1]?.location_status).toBe('adjacent_city');
      expect(result.data.sampled_businesses?.[2]?.location_status).toBe('metro_area');
      expect(result.data.sampled_businesses?.[0]?.prospect_priority).toBe('high');
      expect(result.data.prospect_discovery?.high_priority_count).toBe(4);
      expect(result.data.prospect_discovery?.recommended_for_business_audit?.[0]?.business_name).toBe('Beta Heating & Cooling');
    }
  });

  it('coerces legacy V1 outside_city_serving_city to metro_area', () => {
    const result = cityCategoryOpportunitySchema.safeParse(validV1Output);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sampled_businesses?.[0]?.location_status).toBe('metro_area');
    }
  });

  it('accepts legacy V1 flat market_size without core_city/prospect_universe', () => {
    const result = cityCategoryOpportunitySchema.safeParse(validV1Output);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.market_size?.verified_business_count).toBe(12);
      expect(result.data.market_size?.core_city).toBeUndefined();
      expect(result.data.market_size?.prospect_universe).toBeUndefined();
    }
  });

  it('accepts V1 output without prospect_discovery (optional)', () => {
    const result = cityCategoryOpportunitySchema.safeParse(validV1Output);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prospect_discovery).toBeUndefined();
    }
  });

  it('rejects invalid prospect_priority value', () => {
    const input = {
      ...validV2Output,
      sampled_businesses: [
        {
          ...validV2Output.sampled_businesses[0],
          prospect_priority: 'very_high',
        },
      ],
    };
    const result = cityCategoryOpportunitySchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths.some((p) => p.includes('prospect_priority'))).toBe(true);
    }
  });

  it('rejects invalid scope_mode value', () => {
    const input = {
      ...validV2Output,
      audit_metadata: {
        ...validV2Output.audit_metadata,
        geographic_scope: {
          ...validV2Output.audit_metadata.geographic_scope,
          scope_mode: 'global',
        },
      },
    };
    const result = cityCategoryOpportunitySchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join('.'));
      expect(paths.some((p) => p.includes('scope_mode'))).toBe(true);
    }
  });

  it('accepts string-encoded numbers in V2 market_size (coercion)', () => {
    const input = {
      ...validV2Output,
      market_size: {
        ...validV2Output.market_size,
        core_city: { verified_business_count: '12', approximate_business_count: '14' },
        prospect_universe: {
          verified_business_count: '38',
          approximate_business_count: '45',
          inside_city_count: '12',
          adjacent_city_count: '15',
          metro_area_count: '11',
        },
        detailed_sample_size: '22',
      },
    };
    const result = cityCategoryOpportunitySchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.market_size?.core_city?.verified_business_count).toBe(12);
      expect(result.data.market_size?.prospect_universe?.metro_area_count).toBe(11);
      expect(result.data.market_size?.detailed_sample_size).toBe(22);
    }
  });

  it('accepts prospect_discovery with null total_qualifying_prospects', () => {
    const input = {
      ...validV2Output,
      prospect_discovery: {
        ...validV2Output.prospect_discovery,
        total_qualifying_prospects: null,
      },
    };
    const result = cityCategoryOpportunitySchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prospect_discovery?.total_qualifying_prospects).toBeNull();
    }
  });

  it('coerces "low" concentration to fragmented', () => {
    const input = {
      ...validV2Output,
      competitive_landscape: {
        ...validV2Output.competitive_landscape,
        concentration: 'low',
      },
    };
    const result = cityCategoryOpportunitySchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.competitive_landscape?.concentration).toBe('fragmented');
    }
  });

  it('coerces "weak" photo_activity to stale (top_competitors + sampled_businesses)', () => {
    const input = {
      ...validV2Output,
      top_competitors: validV2Output.top_competitors.map((c: any, i: number) =>
        i === 0 ? { ...c, google: { ...c.google, photo_activity: 'weak' } } : c,
      ),
      sampled_businesses: validV2Output.sampled_businesses.map((b: any, i: number) =>
        i === 1 ? { ...b, google: { ...b.google, photo_activity: 'weak' } } : b,
      ),
    };
    const result = cityCategoryOpportunitySchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.top_competitors?.[0]?.google?.photo_activity).toBe('stale');
      expect(result.data.sampled_businesses?.[1]?.google?.photo_activity).toBe('stale');
    }
  });
});

describe('OUTPUT_SCHEMA_REGISTRY / resolveOutputSchema — city_category_opportunity', () => {
  it('resolves city_category_opportunity with validator, auditPlatform, and promptSuffix', () => {
    const resolved = resolveOutputSchema(CITY_CATEGORY_OPPORTUNITY_SCHEMA_NAME);
    expect(resolved).not.toBeNull();
    expect(resolved!.auditPlatform).toBe('city_category_analysis');
    expect(resolved!.promptSuffix).toContain('prospect_discovery');
    expect(resolved!.promptSuffix).toContain('core_city');
    expect(resolved!.promptSuffix).toContain('adjacent_city');
    expect(resolved!.promptSuffix).toContain('prospect_priority');
  });

  it('registry contains city_category_opportunity entry', () => {
    expect(OUTPUT_SCHEMA_REGISTRY[CITY_CATEGORY_OPPORTUNITY_SCHEMA_NAME]).toBeDefined();
  });
});
