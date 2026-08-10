/**
 * Smoke test for the city_category_opportunity V2 schema.
 *
 * Runs as a standalone script (not a vitest test) so you can see the full
 * parsed/normalized output that the frontend would receive. Validates a
 * realistic V2-shaped JSON payload against the updated Zod schema and
 * prints a summary of the key V2 fields.
 *
 * Run from apps/api:
 *   npx tsx scripts/smoke-test-city-category-v2.ts
 *
 * Or via the repo root:
 *   npx tsx apps/api/scripts/smoke-test-city-category-v2.ts
 */

import { cityCategoryOpportunitySchema } from '../src/validators/city-category-opportunity.schema';

const v2Payload = {
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
    competitive_summary: 'Acme HVAC dominates review volume but has a dated website.',
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

// ---- Also test a legacy V1 payload to confirm backward compatibility ----

const v1Payload = {
  ...v2Payload,
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
  prospect_discovery: undefined,
};

function runSmokeTest(label: string, payload: unknown) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`SMOKE TEST: ${label}`);
  console.log('='.repeat(70));

  const result = cityCategoryOpportunitySchema.safeParse(payload);

  if (!result.success) {
    console.error('❌ VALIDATION FAILED');
    console.error('');
    console.error('Zod issues:');
    for (const issue of result.error.issues) {
      console.error(`  - [${issue.path.join('.')}] ${issue.message} (code: ${issue.code})`);
    }
    process.exitCode = 1;
    return;
  }

  const d = result.data;
  console.log('✅ Validation passed');
  console.log('');

  // Geographic scope
  const gs = d.audit_metadata?.geographic_scope;
  console.log('Geographic scope:');
  console.log(`  scope_mode:        ${gs?.scope_mode ?? '(not set — legacy V1)'}`);
  console.log(`  market_center:     ${gs?.market_center ?? '(not set)'}`);
  console.log(`  adjacent_cities:   ${gs?.adjacent_cities_included?.join(', ') ?? '(none)'}`);
  console.log(`  metro_areas:       ${gs?.metro_areas_included?.join(', ') ?? '(none)'}`);
  console.log('');

  // Market size
  const ms = d.market_size;
  console.log('Market size:');
  if (ms?.core_city) {
    console.log(`  core_city.verified:        ${ms.core_city.verified_business_count}`);
    console.log(`  core_city.approximate:     ${ms.core_city.approximate_business_count}`);
  } else {
    console.log(`  (legacy flat) verified:    ${ms?.verified_business_count}`);
    console.log(`  (legacy flat) approximate:  ${ms?.approximate_business_count}`);
  }
  if (ms?.prospect_universe) {
    const pu = ms.prospect_universe;
    console.log(`  prospect_universe.verified: ${pu.verified_business_count}`);
    console.log(`  prospect_universe.approx:   ${pu.approximate_business_count}`);
    console.log(`    inside_city:   ${pu.inside_city_count}`);
    console.log(`    adjacent_city: ${pu.adjacent_city_count}`);
    console.log(`    metro_area:    ${pu.metro_area_count}`);
  }
  console.log(`  detailed_sample_size: ${ms?.detailed_sample_size}`);
  console.log('');

  // Sampled businesses
  const sampled = d.sampled_businesses ?? [];
  console.log(`Sampled businesses (${sampled.length}):`);
  for (const b of sampled) {
    const signals = b.detected_signals ?? [];
    const sc = b.signal_count ?? signals.length;
    console.log(`  - ${b.business_name}`);
    console.log(`      location_status:   ${b.location_status}`);
    console.log(`      city:              ${b.city ?? '(not set)'}`);
    console.log(`      distance (mi):     ${b.distance_from_market_center_miles ?? '(not set)'}`);
    console.log(`      prospect_priority: ${b.prospect_priority ?? '(not set)'}`);
    console.log(`      signal_count:      ${sc}`);
    if (signals.length > 0) {
      console.log(`      signals:           ${signals.join(', ')}`);
    }
  }
  console.log('');

  // Prospect discovery
  const pd = d.prospect_discovery;
  if (pd) {
    console.log('Prospect discovery:');
    console.log(`  total_qualifying_prospects: ${pd.total_qualifying_prospects}`);
    console.log(`  high_priority:     ${pd.high_priority_count}`);
    console.log(`  medium_priority:   ${pd.medium_priority_count}`);
    console.log(`  low_priority:      ${pd.low_priority_count}`);
    console.log(`  insufficient:      ${pd.insufficient_evidence_count}`);
    console.log(`  inside_city:       ${pd.inside_city_prospect_count}`);
    console.log(`  adjacent_city:     ${pd.adjacent_city_prospect_count}`);
    console.log(`  metro_area:        ${pd.metro_area_prospect_count}`);
    if (pd.recommended_for_business_audit && pd.recommended_for_business_audit.length > 0) {
      console.log('  recommended_for_business_audit:');
      for (const r of pd.recommended_for_business_audit) {
        console.log(`    - ${r.business_name} (${r.city}, ${r.location_status}) [${r.prospect_priority}]`);
        console.log(`        reason: ${r.reason}`);
      }
    }
    if (pd.highest_signal_businesses && pd.highest_signal_businesses.length > 0) {
      console.log('  highest_signal_businesses:');
      for (const h of pd.highest_signal_businesses) {
        console.log(`    - ${h.business_name} (${h.city}) — ${h.signal_count} signals [${h.prospect_priority}]`);
      }
    }
  } else {
    console.log('Prospect discovery: (not present — legacy V1 output)');
  }
  console.log('');
}

runSmokeTest('V2 payload (prospect-discovery variant)', v2Payload);
runSmokeTest('Legacy V1 payload (backward compatibility)', v1Payload);

console.log('='.repeat(70));
console.log('Smoke test complete.');
console.log('='.repeat(70));
