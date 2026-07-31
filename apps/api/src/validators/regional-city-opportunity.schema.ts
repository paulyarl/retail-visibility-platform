/**
 * Regional City Opportunity Discovery Output Schema
 *
 * Single source of truth for the shape of the "Seek: City REGION Review
 * Response V1" prompt template (regional city opportunity discovery scan).
 *
 * Imported by:
 *   - The render/copy/download flow (to append the expected shape to the
 *     prompt text sent to external agents).
 *   - The external-import endpoint (to validate pasted JSON before storing
 *     an execution + audit).
 *
 * Audit creation is keyed off `template.output_schema->>'name' === 'regional_city_opportunity'`,
 * NOT `prompt_type` (which encodes pipeline stage: seek/fulfill/filter/retainer,
 * not output shape).
 *
 * The schema is intentionally permissive about extra object properties
 * (`.passthrough()`) so minor additions in agent output do not cause false
 * validation failures, while still enforcing the required structure, enums,
 * and numeric coercions documented in the prompt.
 */

import { z } from 'zod';

/**
 * Strip a trailing `%` and coerce to number.
 * Accepts "85%", "85", 85, "4.2", 4.2 — all become numbers.
 */
const percentOrNumber = z.preprocess((val) => {
  if (typeof val === 'string') {
    const trimmed = val.trim().replace(/%$/, '');
    const n = Number(trimmed);
    return Number.isNaN(n) ? val : n;
  }
  return val;
}, z.number());

/** Coerce string-or-number values to number. */
const coercedNumber = z.coerce.number();
const coercedNumberNullable = z.union([z.coerce.number(), z.null()]);

// ---- Shared enums (kept in sync with the prompt's enum values) ----

const distanceMethodEnum = z.enum(['straight_line', 'driving_distance', 'approximate']);
const growthDirectionEnum = z.enum(['declining', 'stable', 'growing', 'rapidly_growing', 'unable_to_verify']);
const businessDensityEnum = z.enum(['low', 'medium', 'high', 'very_high', 'unable_to_verify']);
const opportunityClassificationEnum = z.enum(['low', 'medium', 'high', 'very_high']);
const severityEnum = z.enum(['low', 'medium', 'high']);
const confidenceEnum = z.enum(['low', 'medium', 'high']);
const outreachPriorityEnum = z.enum(['high', 'medium', 'low']);
const recommendedNextActionEnum = z.enum([
  'run_city_scan',
  'run_category_scan',
  'run_business_audits',
  'monitor_only',
  'insufficient_data',
]);

// ---- Nested object schemas ----

const referenceMarketSchema = z.object({
  city: z.string(),
  state: z.string(),
  radius_miles: coercedNumber,
  include_reference_city: z.boolean(),
  cross_state_results_allowed: z.boolean(),
}).passthrough();

const requestedLimitsSchema = z.object({
  maximum_cities: coercedNumber,
  minimum_population: coercedNumberNullable,
  maximum_population: coercedNumberNullable,
  excluded_cities: z.array(z.string()),
  preferred_categories: z.array(z.string()),
}).passthrough();

const researchMethodSchema = z.object({
  geographic_sources: z.array(z.string()),
  business_sources: z.array(z.string()),
  sampling_method: z.string(),
  deduplication_method: z.string(),
}).passthrough();

const auditMetadataSchema = z.object({
  audit_date: z.string(),
  reference_market: referenceMarketSchema,
  requested_limits: requestedLimitsSchema,
  distance_method: distanceMethodEnum,
  cities_considered: coercedNumber,
  cities_included: coercedNumber,
  research_method: researchMethodSchema,
  limitations: z.array(z.string()),
}).passthrough();

const regionalMetricsSchema = z.object({
  total_approximate_population: coercedNumberNullable,
  total_approximate_local_businesses: coercedNumberNullable,
  total_sampled_businesses: coercedNumber,
  average_city_digital_opportunity_score: coercedNumberNullable,
  high_opportunity_cities: coercedNumber,
  very_high_opportunity_cities: coercedNumber,
  largest_addressable_market_city: z.string().nullable(),
  highest_digital_opportunity_city: z.string().nullable(),
  recommended_next_scan_city: z.string().nullable(),
}).passthrough();

const populationSchema = z.object({
  approximate_population: coercedNumberNullable,
  population_year: coercedNumberNullable,
  growth_direction: growthDirectionEnum,
  growth_rate_percent: coercedNumberNullable,
  household_count: coercedNumberNullable,
  median_household_income: coercedNumberNullable,
}).passthrough();

const commercialContextSchema = z.object({
  approximate_active_businesses: coercedNumberNullable,
  verified_sampled_businesses: coercedNumber,
  categories_represented: coercedNumber,
  estimated_independent_business_percent: coercedNumberNullable,
  estimated_service_business_percent: coercedNumberNullable,
  business_density: businessDensityEnum,
  commercial_corridors: z.array(z.string()),
  major_employment_sectors: z.array(z.string()),
  development_signals: z.array(z.string()),
  nearby_competing_commercial_centers: z.array(z.string()),
}).passthrough();

const reviewBenchmarksSchema = z.object({
  valid_google_business_count: coercedNumber,
  average_google_rating: coercedNumberNullable,
  median_google_rating: coercedNumberNullable,
  average_google_review_count: coercedNumberNullable,
  median_google_review_count: coercedNumberNullable,
  percent_below_10_google_reviews: percentOrNumber.nullable(),
  percent_above_100_google_reviews: percentOrNumber.nullable(),
  percent_below_4_rating: percentOrNumber.nullable(),
  percent_at_or_above_4_5_rating: percentOrNumber.nullable(),
  percent_with_recent_owner_responses: percentOrNumber.nullable(),
  percent_with_visible_unanswered_negative_reviews: percentOrNumber.nullable(),
  percent_with_weak_review_response_activity: percentOrNumber.nullable(),
}).passthrough();

const googleProfileMetricsSchema = z.object({
  verifiable_profile_count: coercedNumber,
  claimed_or_likely_claimed_percent: percentOrNumber.nullable(),
  unable_to_verify_percent: percentOrNumber.nullable(),
  incomplete_profile_percent: percentOrNumber.nullable(),
  hours_issue_percent: percentOrNumber.nullable(),
  weak_photo_coverage_percent: percentOrNumber.nullable(),
  duplicate_or_conflicting_listing_percent: percentOrNumber.nullable(),
}).passthrough();

const websiteMetricsSchema = z.object({
  verifiable_business_count: coercedNumber,
  working_website_percent: percentOrNumber.nullable(),
  no_website_percent: percentOrNumber.nullable(),
  social_media_only_percent: percentOrNumber.nullable(),
  mobile_friendly_percent: percentOrNumber.nullable(),
  clear_conversion_action_percent: percentOrNumber.nullable(),
  material_website_issue_percent: percentOrNumber.nullable(),
}).passthrough();

const napMetricsSchema = z.object({
  verifiable_business_count: coercedNumber,
  consistent_percent: percentOrNumber.nullable(),
  minor_variation_percent: percentOrNumber.nullable(),
  material_inconsistency_percent: percentOrNumber.nullable(),
  possible_duplicate_listing_percent: percentOrNumber.nullable(),
}).passthrough();

const commonOpportunityThemeSchema = z.object({
  theme: z.string(),
  observed_business_count: coercedNumber,
  valid_sample_size: coercedNumber,
  observed_percent: percentOrNumber,
  severity: severityEnum,
  evidence_summary: z.string(),
  confidence: confidenceEnum,
}).passthrough();

const representativeCategorySchema = z.object({
  rank: coercedNumber,
  category: z.string(),
  approximate_business_count: coercedNumberNullable,
  digital_opportunity_level: opportunityClassificationEnum,
  most_common_weakness: z.string(),
  outreach_priority: outreachPriorityEnum,
  recommended_next_analysis: z.string(),
}).passthrough();

const digitalOpportunityScoreSchema = z.object({
  score: coercedNumber,
  classification: opportunityClassificationEnum,
  components: z.object({
    review_management_opportunity: coercedNumber,
    website_opportunity: coercedNumber,
    google_profile_opportunity: coercedNumber,
    nap_and_listing_opportunity: coercedNumber,
    market_depth: coercedNumber,
    regional_accessibility: coercedNumber,
  }).passthrough(),
  rationale: z.string(),
}).passthrough();

const cityPriorityScoreSchema = z.object({
  score: coercedNumber,
  components: z.object({
    digital_opportunity: coercedNumber,
    addressable_business_base: coercedNumber,
    independent_business_presence: coercedNumber,
    commercial_growth_signals: coercedNumber,
    category_diversity: coercedNumber,
    accessibility: coercedNumber,
  }).passthrough(),
  ranking_rationale: z.string(),
}).passthrough();

const dataQualitySchema = z.object({
  confidence: confidenceEnum,
  verified_fields: z.array(z.string()),
  estimated_fields: z.array(z.string()),
  unavailable_fields: z.array(z.string()),
  small_sample_warnings: z.array(z.string()),
  limitations: z.array(z.string()),
}).passthrough();

const sourceSchema = z.object({
  source_name: z.string(),
  source_type: z.string(),
  url: z.string().nullable(),
  accessed_date: z.string(),
}).passthrough();

const cityRankingSchema = z.object({
  rank: coercedNumber,
  city: z.string(),
  state: z.string(),
  county_names: z.array(z.string()),
  place_type: z.string(),
  distance_from_reference_miles: coercedNumber,
  direction_from_reference: z.string(),
  inside_requested_radius: z.boolean(),
  representative_zip_codes: z.array(z.string()),
  zip_code_count: coercedNumber,
  zip_code_count_complete: z.boolean(),
  population: populationSchema,
  commercial_context: commercialContextSchema,
  review_benchmarks: reviewBenchmarksSchema,
  google_profile_metrics: googleProfileMetricsSchema,
  website_metrics: websiteMetricsSchema,
  nap_metrics: napMetricsSchema,
  common_opportunity_themes: z.array(commonOpportunityThemeSchema),
  representative_categories: z.array(representativeCategorySchema),
  digital_opportunity_score: digitalOpportunityScoreSchema,
  city_priority_score: cityPriorityScoreSchema,
  recommended_next_action: recommendedNextActionEnum,
  recommended_next_action_rationale: z.string(),
  data_quality: dataQualitySchema,
  sources: z.array(sourceSchema),
}).passthrough();

const topCityOpportunitySchema = z.object({
  rank: coercedNumber,
  city: z.string(),
  state: z.string(),
  distance_from_reference_miles: coercedNumber,
  representative_zip_codes: z.array(z.string()),
  digital_opportunity_score: coercedNumber,
  city_priority_score: coercedNumber,
  primary_opportunity: z.string(),
  strongest_category: z.string(),
  recommended_next_action: recommendedNextActionEnum,
}).passthrough();

const regionalCategoryOpportunitySchema = z.object({
  rank: coercedNumber,
  category: z.string(),
  cities_where_prominent: z.array(z.string()),
  common_weakness: z.string(),
  regional_outreach_priority: outreachPriorityEnum,
  recommended_follow_up: z.string(),
}).passthrough();

const regionalDataQualitySchema = z.object({
  overall_confidence: confidenceEnum,
  verified_fields: z.array(z.string()),
  estimated_fields: z.array(z.string()),
  unavailable_fields: z.array(z.string()),
  limitations: z.array(z.string()),
}).passthrough();

export const regionalCityOpportunitySchema = z.object({
  audit_metadata: auditMetadataSchema,
  summary: z.string(),
  regional_metrics: regionalMetricsSchema,
  city_rankings: z.array(cityRankingSchema),
  top_city_opportunities: z.array(topCityOpportunitySchema),
  regional_category_opportunities: z.array(regionalCategoryOpportunitySchema),
  data_quality: regionalDataQualitySchema,
}).passthrough();

export type RegionalCityOpportunityOutput = z.infer<typeof regionalCityOpportunitySchema>;

/**
 * The schema name used to identify regional-city-opportunity-shaped templates
 * and audits. Stored in `mkt_prompt_templates_list.output_schema->>'name'`
 * and used as `mkt_audits_list.platform` for imported regional scans.
 */
export const REGIONAL_CITY_OPPORTUNITY_SCHEMA_NAME = 'regional_city_opportunity' as const;

/**
 * Human-readable description of the regional_city_opportunity output shape,
 * suitable for appending to a prompt sent to an external agent.
 * Kept in sync with `regionalCityOpportunitySchema` above.
 */
export const REGIONAL_CITY_OPPORTUNITY_PROMPT_SUFFIX = `

Return your response as JSON matching the Regional City Opportunity Discovery
schema with these top-level keys:

{
  "audit_metadata": {
    "audit_date": "<YYYY-MM-DD>",
    "reference_market": {
      "city": "<string>",
      "state": "<string>",
      "radius_miles": <number>,
      "include_reference_city": <boolean>,
      "cross_state_results_allowed": <boolean>
    },
    "requested_limits": {
      "maximum_cities": <number>,
      "minimum_population": <number|null>,
      "maximum_population": <number|null>,
      "excluded_cities": ["<string>"],
      "preferred_categories": ["<string>"]
    },
    "distance_method": "straight_line" | "driving_distance" | "approximate",
    "cities_considered": <number>,
    "cities_included": <number>,
    "research_method": {
      "geographic_sources": ["<string>"],
      "business_sources": ["<string>"],
      "sampling_method": "<string>",
      "deduplication_method": "<string>"
    },
    "limitations": ["<string>"]
  },
  "summary": "<string>",
  "regional_metrics": {
    "total_approximate_population": <number|null>,
    "total_approximate_local_businesses": <number|null>,
    "total_sampled_businesses": <number>,
    "average_city_digital_opportunity_score": <number|null>,
    "high_opportunity_cities": <number>,
    "very_high_opportunity_cities": <number>,
    "largest_addressable_market_city": "<string|null>",
    "highest_digital_opportunity_city": "<string|null>",
    "recommended_next_scan_city": "<string|null>"
  },
  "city_rankings": [
    {
      "rank": <number>,
      "city": "<string>",
      "state": "<string>",
      "county_names": ["<string>"],
      "place_type": "<string>",
      "distance_from_reference_miles": <number>,
      "direction_from_reference": "<string>",
      "inside_requested_radius": <boolean>,
      "representative_zip_codes": ["<5-digit-string>"],
      "zip_code_count": <number>,
      "zip_code_count_complete": <boolean>,
      "population": {
        "approximate_population": <number|null>,
        "population_year": <number|null>,
        "growth_direction": "declining" | "stable" | "growing" | "rapidly_growing" | "unable_to_verify",
        "growth_rate_percent": <number|null>,
        "household_count": <number|null>,
        "median_household_income": <number|null>
      },
      "commercial_context": {
        "approximate_active_businesses": <number|null>,
        "verified_sampled_businesses": <number>,
        "categories_represented": <number>,
        "estimated_independent_business_percent": <number|null>,
        "estimated_service_business_percent": <number|null>,
        "business_density": "low" | "medium" | "high" | "very_high" | "unable_to_verify",
        "commercial_corridors": ["<string>"],
        "major_employment_sectors": ["<string>"],
        "development_signals": ["<string>"],
        "nearby_competing_commercial_centers": ["<string>"]
      },
      "review_benchmarks": {
        "valid_google_business_count": <number>,
        "average_google_rating": <number|null>,
        "median_google_rating": <number|null>,
        "average_google_review_count": <number|null>,
        "median_google_review_count": <number|null>,
        "percent_below_10_google_reviews": <number|null>,
        "percent_above_100_google_reviews": <number|null>,
        "percent_below_4_rating": <number|null>,
        "percent_at_or_above_4_5_rating": <number|null>,
        "percent_with_recent_owner_responses": <number|null>,
        "percent_with_visible_unanswered_negative_reviews": <number|null>,
        "percent_with_weak_review_response_activity": <number|null>
      },
      "google_profile_metrics": {
        "verifiable_profile_count": <number>,
        "claimed_or_likely_claimed_percent": <number|null>,
        "unable_to_verify_percent": <number|null>,
        "incomplete_profile_percent": <number|null>,
        "hours_issue_percent": <number|null>,
        "weak_photo_coverage_percent": <number|null>,
        "duplicate_or_conflicting_listing_percent": <number|null>
      },
      "website_metrics": {
        "verifiable_business_count": <number>,
        "working_website_percent": <number|null>,
        "no_website_percent": <number|null>,
        "social_media_only_percent": <number|null>,
        "mobile_friendly_percent": <number|null>,
        "clear_conversion_action_percent": <number|null>,
        "material_website_issue_percent": <number|null>
      },
      "nap_metrics": {
        "verifiable_business_count": <number>,
        "consistent_percent": <number|null>,
        "minor_variation_percent": <number|null>,
        "material_inconsistency_percent": <number|null>,
        "possible_duplicate_listing_percent": <number|null>
      },
      "common_opportunity_themes": [
        {
          "theme": "<string>",
          "observed_business_count": <number>,
          "valid_sample_size": <number>,
          "observed_percent": <number>,
          "severity": "low" | "medium" | "high",
          "evidence_summary": "<string>",
          "confidence": "low" | "medium" | "high"
        }
      ],
      "representative_categories": [
        {
          "rank": <number>,
          "category": "<string>",
          "approximate_business_count": <number|null>,
          "digital_opportunity_level": "low" | "medium" | "high" | "very_high",
          "most_common_weakness": "<string>",
          "outreach_priority": "high" | "medium" | "low",
          "recommended_next_analysis": "<string>"
        }
      ],
      "digital_opportunity_score": {
        "score": <number 0-10>,
        "classification": "low" | "medium" | "high" | "very_high",
        "components": {
          "review_management_opportunity": <number 0-2>,
          "website_opportunity": <number 0-2>,
          "google_profile_opportunity": <number 0-2>,
          "nap_and_listing_opportunity": <number 0-1>,
          "market_depth": <number 0-2>,
          "regional_accessibility": <number 0-1>
        },
        "rationale": "<string>"
      },
      "city_priority_score": {
        "score": <number 0-100>,
        "components": {
          "digital_opportunity": <number>,
          "addressable_business_base": <number>,
          "independent_business_presence": <number>,
          "commercial_growth_signals": <number>,
          "category_diversity": <number>,
          "accessibility": <number>
        },
        "ranking_rationale": "<string>"
      },
      "recommended_next_action": "run_city_scan" | "run_category_scan" | "run_business_audits" | "monitor_only" | "insufficient_data",
      "recommended_next_action_rationale": "<string>",
      "data_quality": {
        "confidence": "low" | "medium" | "high",
        "verified_fields": ["<string>"],
        "estimated_fields": ["<string>"],
        "unavailable_fields": ["<string>"],
        "small_sample_warnings": ["<string>"],
        "limitations": ["<string>"]
      },
      "sources": [
        {
          "source_name": "<string>",
          "source_type": "<string>",
          "url": "<string|null>",
          "accessed_date": "<YYYY-MM-DD>"
        }
      ]
    }
  ],
  "top_city_opportunities": [
    {
      "rank": <number>,
      "city": "<string>",
      "state": "<string>",
      "distance_from_reference_miles": <number>,
      "representative_zip_codes": ["<5-digit-string>"],
      "digital_opportunity_score": <number>,
      "city_priority_score": <number>,
      "primary_opportunity": "<string>",
      "strongest_category": "<string>",
      "recommended_next_action": "run_city_scan" | "run_category_scan" | "run_business_audits" | "monitor_only" | "insufficient_data"
    }
  ],
  "regional_category_opportunities": [
    {
      "rank": <number>,
      "category": "<string>",
      "cities_where_prominent": ["<string>"],
      "common_weakness": "<string>",
      "regional_outreach_priority": "high" | "medium" | "low",
      "recommended_follow_up": "<string>"
    }
  ],
  "data_quality": {
    "overall_confidence": "low" | "medium" | "high",
    "verified_fields": ["<string>"],
    "estimated_fields": ["<string>"],
    "unavailable_fields": ["<string>"],
    "limitations": ["<string>"]
  }
}

Return ONLY the JSON object, no markdown fences, no commentary.`;
