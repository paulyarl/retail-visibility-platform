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

  it('coerces "one_leader_with_moderate_challengers_and_weak_remainder" concentration to dominated_by_one', () => {
    const input = {
      ...validV2Output,
      competitive_landscape: {
        ...validV2Output.competitive_landscape,
        concentration: 'one_leader_with_moderate_challengers_and_weak_remainder',
      },
    };
    const result = cityCategoryOpportunitySchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.competitive_landscape?.concentration).toBe('dominated_by_one');
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

// ---- V3 (Emerging-Discovery variant) fixture ----

const validV3Output = {
  audit_metadata: {
    audit_date: '2026-08-10',
    requested_market: {
      category: 'African Grocery Store',
      city: 'Kansas City',
      state: 'Missouri',
      zip_codes: [],
      search_radius_miles: null,
    },
    category_definition: {
      working_definition: 'Independent specialty grocery businesses with African grocery identity.',
      included_subcategories: ['African grocery stores', 'West African grocery stores'],
      excluded_subcategories: ['National grocery chains', 'General international supermarkets'],
    },
    geographic_scope: {
      scope_description: 'Kansas City + adjacent municipalities',
      market_center: 'Kansas City, Missouri',
      scope_mode: 'prospect_market',
      explicit_radius_supplied: false,
      search_radius_miles: null,
      automatic_market_scope_description: 'Practical market included Kansas City, Gladstone, Raytown, Independence.',
      businesses_inside_city_only: false,
      adjacent_cities_included: ['Gladstone', 'Raytown', 'Independence'],
      metro_areas_included: ['Olathe'],
      service_area_businesses_included: false,
    },
    research_method: {
      sources_reviewed: ['Google', 'RefugeKC', 'Northeast Kansas City Chamber'],
      emerging_discovery_sources_prioritized: ['RefugeKC', 'WIC retailer listings', 'Low-review records'],
      deduplication_method: 'Name + address + phone comparison.',
      sampling_method: 'Ten emerging-tier businesses selected from three visible reference anchors.',
    },
    limitations: ['Sparse public records for emerging businesses.'],
  },
  summary: 'V3 emerging-discovery scan found 10 emerging businesses with average Foundational Presence score 28.2.',
  market_size: {
    core_city: { verified_business_count: 9, approximate_business_count: 11 },
    prospect_universe: {
      verified_business_count: 13,
      approximate_business_count: 17,
      inside_city_count: 9,
      adjacent_city_count: 3,
      metro_area_count: 1,
      already_visible_count: 3,
      emerging_count: 10,
    },
    count_unit: 'business_locations',
    detailed_sample_size: 10,
    estimate_confidence: 'medium',
    estimation_method: 'Direct enumeration plus community directories.',
    counts_complete: false,
  },
  // V3 does NOT include category_benchmarks, competitive_landscape, top_competitors,
  // or category_digital_opportunity_score — those are V2 competitive fields.
  reference_anchors: [
    {
      business_name: 'Arada Market',
      visibility_note: 'Owned website with 4.8 stars from 36 Google reviews.',
      contrast_note: 'Demonstrates the digital foundation missing from the emerging sample.',
    },
  ],
  foundational_presence_benchmarks: {
    valid_business_count: 10,
    average_score: 28.2,
    median_score: 30.0,
    lowest_score: 9,
    highest_score: 40,
    average_component_scores: {
      any_discoverable_profile: 9.1,
      contactability: 8.0,
      category_clarity: 9.0,
      trust_signal_presence: 2.1,
    },
  },
  archetype_distribution: [
    { archetype: 'SINGLE_PLATFORM', observed_count: 3, sample_percentage: 30.0 },
    { archetype: 'DIRECTORY_GHOST', observed_count: 3, sample_percentage: 30.0 },
  ],
  growth_readiness_distribution: [
    { readiness: 'high_readiness', observed_count: 4, sample_percentage: 40.0 },
    { readiness: 'moderate_readiness', observed_count: 4, sample_percentage: 40.0 },
  ],
  sampled_businesses: [
    {
      business_name: 'Aboom Tropical Market',
      ownership_type: 'independent',
      location_status: 'inside_city',
      city: 'Kansas City',
      state: 'Missouri',
      distance_from_market_center_miles: null,
      address: '6408 N Oak Trafficway, Kansas City, MO 64118',
      phone: '(816) 420-0336',
      website: null,
      detected_signals: ['WC_MISSING_WEBSITE', 'EF_STRONG_HIDDEN_TRUST'],
      signal_count: 2,
      emerging_archetype: 'SINGLE_PLATFORM',
      growth_readiness: 'high_readiness',
      suggested_growth_playbook: 'trust_amplification',
      foundational_presence_inventory: {
        score: 40,
        components: {
          any_discoverable_profile: 10,
          contactability: 10,
          category_clarity: 10,
          trust_signal_presence: 10,
        },
      },
      google: {
        profile_status: 'unable_to_verify',
        rating: 4.5,
        review_count: 18,
        hours_status: 'current',
        photo_activity: 'unable_to_verify',
        recent_owner_responses_observed: null,
      },
      yelp: { rating: null, review_count: null },
      facebook: { rating_or_recommendation: null, review_count: 3 },
      website_assessment: {
        status: 'none_found',
        mobile_friendly: 'unable_to_verify',
        clear_call_to_action: 'unable_to_verify',
        issues: ['No owned official website was verified.'],
      },
      nap_status: 'consistent',
      observed_opportunities: ['Create an owned website', 'Expand beyond directory dependence.'],
      data_confidence: 'high',
    },
  ],
  common_digital_issues: [
    {
      issue: 'Weak visible customer-trust footprint',
      observed_business_count: 8,
      valid_sample_size: 10,
      observed_percent: 80.0,
      severity: 'high',
      evidence_summary: 'Eight of ten emerging businesses had no verifiable review footprint.',
      data_confidence: 'high',
    },
  ],
  opportunity_gaps: {
    geographic: [
      {
        area: 'Historic Northeast Kansas City',
        gap: 'Community-level presence stronger than mainstream digital visibility.',
        evidence_status: 'verified',
        evidence_summary: 'RefugeKC identifies multiple immigrant grocery businesses.',
      },
    ],
    services: [
      {
        service: 'Foundational business-profile establishment',
        gap: 'Several emerging prospects lack a robust mainstream digital foundation.',
        evidence_status: 'verified',
        evidence_summary: 'Mogadisho Market and Somali Star Shop are more visible through community directories.',
      },
    ],
    digital: [
      {
        gap: 'Review and testimonial establishment',
        observed_business_count: 8,
        evidence_status: 'verified',
        evidence_summary: 'Eight of ten emerging businesses have fewer than 15 visible reviews.',
      },
    ],
  },
  prospect_discovery: {
    total_qualifying_prospects: 13,
    emerging_prospect_count: 10,
    already_visible_reference_count: 3,
    high_readiness_count: 4,
    moderate_readiness_count: 4,
    foundation_needed_count: 1,
    insufficient_evidence_count: 1,
    hidden_trust_signal_count: 3,
    inside_city_prospect_count: 9,
    adjacent_city_prospect_count: 3,
    metro_area_prospect_count: 1,
    highest_opportunity_businesses: [
      {
        business_name: 'African International Market',
        city: 'Kansas City',
        location_status: 'inside_city',
        signal_count: 3,
        detected_signals: ['WC_MISSING_WEBSITE', 'CP_NAP_ADDRESS_DRIFT', 'EF_STRONG_HIDDEN_TRUST'],
        emerging_archetype: 'MISCATEGORIZED_OR_MISLABELED',
        growth_readiness: 'high_readiness',
      },
    ],
    recommended_for_business_audit: [
      {
        business_name: 'African International Market',
        city: 'Kansas City',
        location_status: 'inside_city',
        growth_readiness: 'high_readiness',
        suggested_growth_playbook: 'recategorization_and_cleanup',
        reason: 'Strong category evidence but conflicting address records and no owned website.',
      },
    ],
  },
  outreach_recommendation: {
    primary_angle: 'Help established but thinly visible African specialty markets.',
    opportunity_to_reference: 'The V3 scan found businesses verifiable through community directories but weakly represented in mainstream search.',
    suggested_service_package: ['GBP optimization', 'Website build', 'Review management'],
    recommended_proof_or_demonstration: 'Show the prospect where it is discoverable and where it is absent.',
    suggested_call_to_action: 'Offer an individual Business Audit.',
    claims_to_avoid: ['Claims that weak digital visibility means the business is unsuccessful.'],
    ideal_prospect_profile: 'Verified independent African grocery business with active location but limited mainstream reviews.',
  },
  recommended_tier: 'tier_foundation_plus',
  tier_rationale: 'Average Foundational Presence Inventory score is 28.2, sitting at the top of the tier_foundation_plus range.',
  estimated_monthly_service_fee: { minimum: 500, maximum: 1000, currency: 'USD' },
  data_quality: {
    confidence: 'medium',
    verified_fields: ['Kansas City market center', 'Aboom Tropical Market identity'],
    estimated_fields: ['Complete emerging-business count'],
    unavailable_fields: ['Direct Google profile ownership status'],
    small_sample_warnings: ['V3 sample intentionally overrepresents thinly visible businesses.'],
    limitations: ['V3 targets businesses with little mainstream visibility.'],
  },
  sources: [
    { source_name: 'RefugeKC Groceries', source_type: 'community grocery directory', url: 'https://www.refugekc.org/groceries.html', accessed_date: '2026-08-10' },
  ],
};

describe('cityCategoryOpportunitySchema — V3 (Emerging-Discovery variant)', () => {
  it('accepts valid V3 JSON without V2 competitive fields', () => {
    const result = cityCategoryOpportunitySchema.safeParse(validV3Output);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category_benchmarks).toBeUndefined();
      expect(result.data.competitive_landscape).toBeUndefined();
      expect(result.data.top_competitors).toBeUndefined();
      expect(result.data.category_digital_opportunity_score).toBeUndefined();
      expect(result.data.recommended_tier).toBe('tier_foundation_plus');
      expect(result.data.reference_anchors?.[0]?.business_name).toBe('Arada Market');
      expect(result.data.foundational_presence_benchmarks?.average_score).toBe(28.2);
      expect(result.data.archetype_distribution?.[0]?.archetype).toBe('SINGLE_PLATFORM');
      expect(result.data.growth_readiness_distribution?.[0]?.readiness).toBe('high_readiness');
    }
  });

  it('accepts V3 outreach_recommendation with opportunity_to_reference instead of problem_to_reference', () => {
    const result = cityCategoryOpportunitySchema.safeParse(validV3Output);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.outreach_recommendation?.opportunity_to_reference).toBeDefined();
      expect(result.data.outreach_recommendation?.problem_to_reference).toBeUndefined();
    }
  });

  it('accepts V3 prospect_discovery with growth_readiness counts and highest_opportunity_businesses', () => {
    const result = cityCategoryOpportunitySchema.safeParse(validV3Output);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.prospect_discovery?.emerging_prospect_count).toBe(10);
      expect(result.data.prospect_discovery?.high_readiness_count).toBe(4);
      expect(result.data.prospect_discovery?.hidden_trust_signal_count).toBe(3);
      expect(result.data.prospect_discovery?.highest_opportunity_businesses?.[0]?.business_name).toBe('African International Market');
      expect(result.data.prospect_discovery?.highest_opportunity_businesses?.[0]?.emerging_archetype).toBe('MISCATEGORIZED_OR_MISLABELED');
      expect(result.data.prospect_discovery?.highest_opportunity_businesses?.[0]?.growth_readiness).toBe('high_readiness');
    }
  });

  it('accepts V3 recommended_for_business_audit with growth_readiness instead of prospect_priority', () => {
    const result = cityCategoryOpportunitySchema.safeParse(validV3Output);
    expect(result.success).toBe(true);
    if (result.success) {
      const rec = result.data.prospect_discovery?.recommended_for_business_audit?.[0];
      expect(rec?.growth_readiness).toBe('high_readiness');
      expect(rec?.suggested_growth_playbook).toBe('recategorization_and_cleanup');
      expect(rec?.prospect_priority).toBeUndefined();
    }
  });

  it('accepts V3 tier_foundation and tier_growth_ready values', () => {
    const tierFoundation = { ...validV3Output, recommended_tier: 'tier_foundation' };
    const tierGrowthReady = { ...validV3Output, recommended_tier: 'tier_growth_ready' };
    expect(cityCategoryOpportunitySchema.safeParse(tierFoundation).success).toBe(true);
    expect(cityCategoryOpportunitySchema.safeParse(tierGrowthReady).success).toBe(true);
  });

  it('still accepts V2 output alongside V3 changes (backward compatibility)', () => {
    const result = cityCategoryOpportunitySchema.safeParse(validV2Output);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category_benchmarks?.google?.average_rating).toBe(4.1);
      expect(result.data.competitive_landscape?.concentration).toBe('moderately_concentrated');
      expect(result.data.top_competitors?.[0]?.business_name).toBe('Acme HVAC');
      expect(result.data.category_digital_opportunity_score?.score).toBe(7);
      expect(result.data.recommended_tier).toBe('tier_2');
      expect(result.data.outreach_recommendation?.problem_to_reference).toBeDefined();
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
    expect(resolved!.promptSuffix).toContain('tier_foundation_plus');
    expect(resolved!.promptSuffix).toContain('opportunity_to_reference');
    expect(resolved!.promptSuffix).toContain('reference_anchors');
    expect(resolved!.promptSuffix).toContain('foundational_presence_benchmarks');
  });

  it('registry contains city_category_opportunity entry', () => {
    expect(OUTPUT_SCHEMA_REGISTRY[CITY_CATEGORY_OPPORTUNITY_SCHEMA_NAME]).toBeDefined();
  });
});
