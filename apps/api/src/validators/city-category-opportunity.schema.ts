/**
 * City Category Opportunity Output Schema
 *
 * Single source of truth for the shape of the "City Category Digital Audit"
 * prompt's output — a single-category, single-city market scan with business
 * discovery, deduplication, sampling, per-platform benchmarks, competitive
 * landscape, top competitor rankings, sampled business details, common
 * digital-presence issues, opportunity gaps, category digital opportunity
 * score, outreach recommendation, recommended tier + fee, data quality, and
 * structured sources.
 *
 * Imported by:
 *   - The render/copy/download flow (to append the expected shape to the
 *     prompt text sent to external agents).
 *   - The external-import endpoint (to validate pasted JSON before storing
 *     an execution + audit).
 *
 * Audit creation is keyed off `template.output_schema->>'name' === 'city_category_opportunity'`,
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

/**
 * Coerce common truthy/falsy string forms to boolean.
 * Accepts true/false, "yes"/"no", "true"/"false", "1"/"0" (case-insensitive).
 * Real booleans pass through. Anything else falls back to the original value
 * so Zod's boolean check reports a clear error for genuinely bad input.
 */
const coercedBoolean = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'yes' || s === 'true' || s === '1') return true;
    if (s === 'no' || s === 'false' || s === '0') return false;
  }
  return val;
}, z.boolean());

// ---- Shared enums (kept in sync with the prompt's enum values) ----

const profileStatusEnum = z.enum([
  'claimed',
  'unclaimed',
  'likely_claimed',
  'unable_to_verify',
]);
const websiteStatusEnum = z.enum([
  'working',
  'broken',
  'none_found',
  'social_media_only',
  'unable_to_verify',
]);

/**
 * Tolerant coercion for mobile_friendly: maps common agent synonyms to the
 * canonical enum values. Agents sometimes emit "likely_good", "verified",
 * "yes_verified", "mobile_optimized", etc.
 */
const mobileFriendlyCoerced = z.preprocess((val) => {
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'likely_good' || s === 'verified' || s === 'yes_verified' || s === 'mobile_optimized' || s === 'mobile_friendly') return 'yes';
    if (s === 'probably' || s === 'appears_yes') return 'likely';
    if (s === 'not_mobile_friendly' || s === 'poor') return 'no';
  }
  return val;
}, z.enum(['yes', 'likely', 'no', 'unable_to_verify']));

/**
 * Tolerant coercion for competitive concentration.
 * Agents sometimes emit "mixed" or "balanced" instead of "moderately_concentrated".
 */
const concentrationCoerced = z.preprocess((val) => {
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'mixed' || s === 'balanced' || s === 'moderate') return 'moderately_concentrated';
    if (s === 'high' || s === 'concentrated' || s === 'high_concentration') return 'highly_concentrated';
    if (s === 'monopoly' || s === 'single_dominant') return 'dominated_by_one';
    if (s === 'dispersed' || s === 'very_fragmented') return 'fragmented';
  }
  return val;
}, z.enum([
  'fragmented',
  'moderately_concentrated',
  'highly_concentrated',
  'dominated_by_one',
  'unable_to_verify',
]));

const ownershipTypeEnum = z.enum([
  'independent',
  'local_chain',
  'regional_chain',
  'national_chain',
  'franchise',
  'unknown',
]);
const locationStatusEnum = z.enum([
  'inside_city',
  'outside_city_serving_city',
  'unable_to_verify',
]);

/**
 * Tolerant coercion for hours_status.
 * Agents sometimes emit "likely_current" or "appears_current" instead of "current",
 * or "conflicting"/"inconsistent" when hours differ across aggregators (treat as
 * incomplete — the data is present but unreliable).
 */
const hoursStatusCoerced = z.preprocess((val) => {
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'likely_current' || s === 'appears_current' || s === 'probably_current') return 'current';
    if (s === 'likely_outdated' || s === 'appears_outdated') return 'outdated';
    if (s === 'partial' || s === 'missing_some' || s === 'conflicting' || s === 'inconsistent' || s === 'mismatched' || s === 'malformed') return 'incomplete';
  }
  return val;
}, z.enum([
  'current',
  'outdated',
  'incomplete',
  'unable_to_verify',
]));

/**
 * Tolerant coercion for photo_activity.
 * Agents sometimes emit "recent_activity", "active", or "current" instead of "recent".
 */
const photoActivityCoerced = z.preprocess((val) => {
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'recent_activity' || s === 'active' || s === 'current' || s === 'updated') return 'recent';
    if (s === 'old' || s === 'outdated_photos') return 'stale';
    if (s === 'no_photos' || s === 'missing') return 'none_visible';
  }
  return val;
}, z.enum([
  'recent',
  'stale',
  'none_visible',
  'unable_to_verify',
]));

const napStatusEnum = z.enum([
  'consistent',
  'minor_variations',
  'major_inconsistencies',
  'name_drift',
  'unable_to_verify',
]);
const severityEnum = z.enum(['low', 'medium', 'high']);
const confidenceEnum = z.enum(['low', 'medium', 'high']);
const evidenceStatusEnum = z.enum([
  'verified',
  'directional',
  'insufficient_evidence',
]);
const opportunityClassificationEnum = z.enum(['low', 'medium', 'high', 'very_high']);
const tierEnum = z.enum(['tier_1', 'tier_2', 'tier_3']);
const estimateConfidenceEnum = z.enum(['low', 'medium', 'high']);
const countUnitEnum = z.enum(['businesses', 'business_locations', 'listings']);

/**
 * Tolerant coercion for clear_call_to_action.
 * Agents sometimes emit "present", "visible", or "clear" instead of "yes",
 * and "absent", "missing", or "none" instead of "no".
 */
const clearCallToActionCoerced = z.preprocess((val) => {
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'present' || s === 'visible' || s === 'clear' || s === 'yes_present' || s === 'verified' || s === 'confirmed') return 'yes';
    if (s === 'absent' || s === 'missing' || s === 'none' || s === 'weak' || s === 'unclear') return 'no';
  }
  return val;
}, z.enum(['yes', 'no', 'unable_to_verify']));

// ---- Nested object schemas ----

const requestedMarketSchema = z.object({
  category: z.string(),
  city: z.string(),
  state: z.string(),
  zip_codes: z.array(z.string()).optional(),
  search_radius_miles: coercedNumberNullable.optional(),
}).passthrough();

const categoryDefinitionSchema = z.object({
  working_definition: z.string(),
  included_subcategories: z.array(z.string()).optional(),
  excluded_subcategories: z.array(z.string()).optional(),
}).passthrough();

const geographicScopeSchema = z.object({
  scope_description: z.string(),
  businesses_inside_city_only: coercedBoolean,
  service_area_businesses_included: coercedBoolean,
}).passthrough();

const researchMethodSchema = z.object({
  sources_reviewed: z.array(z.string()).optional(),
  deduplication_method: z.string(),
  sampling_method: z.string(),
}).passthrough();

const auditMetadataSchema = z.object({
  audit_date: z.string(),
  requested_market: requestedMarketSchema,
  category_definition: categoryDefinitionSchema,
  geographic_scope: geographicScopeSchema,
  research_method: researchMethodSchema,
  limitations: z.array(z.string()).optional(),
}).passthrough();

const marketSizeSchema = z.object({
  verified_business_count: coercedNumberNullable,
  approximate_business_count: coercedNumberNullable,
  count_unit: countUnitEnum,
  detailed_sample_size: coercedNumber,
  estimate_confidence: estimateConfidenceEnum,
  estimation_method: z.string(),
  counts_complete: coercedBoolean.optional(),
}).passthrough();

const googleBenchmarksSchema = z.object({
  valid_business_count: coercedNumber,
  average_rating: coercedNumberNullable,
  median_rating: coercedNumberNullable,
  average_review_count: coercedNumberNullable,
  median_review_count: coercedNumberNullable,
  lowest_rating: coercedNumberNullable,
  highest_rating: coercedNumberNullable,
  percentage_below_4_rating: percentOrNumber.nullable().optional(),
  percentage_at_or_above_4_5_rating: percentOrNumber.nullable().optional(),
  percentage_below_10_reviews: percentOrNumber.nullable().optional(),
  percentage_above_100_reviews: percentOrNumber.nullable().optional(),
  claimed_or_likely_claimed_count: coercedNumberNullable.optional(),
  verifiable_profile_count: coercedNumber,
  claimed_or_likely_claimed_percent: percentOrNumber.nullable().optional(),
  recent_owner_response_percent: percentOrNumber.nullable().optional(),
  hours_issue_percent: percentOrNumber.nullable().optional(),
  weak_photo_coverage_percent: percentOrNumber.nullable().optional(),
}).passthrough();

const yelpBenchmarksSchema = z.object({
  valid_business_count: coercedNumber,
  average_rating: coercedNumberNullable,
  median_rating: coercedNumberNullable,
  average_review_count: coercedNumberNullable,
  median_review_count: coercedNumberNullable,
}).passthrough();

const facebookBenchmarksSchema = z.object({
  valid_business_count: coercedNumber,
  average_rating_or_recommendation: coercedNumberNullable,
  median_rating_or_recommendation: coercedNumberNullable,
  average_review_count: coercedNumberNullable,
  median_review_count: coercedNumberNullable,
}).passthrough();

const websiteBenchmarksSchema = z.object({
  verifiable_business_count: coercedNumber,
  working_website_count: coercedNumber,
  working_website_percent: percentOrNumber.nullable().optional(),
  no_website_count: coercedNumber,
  no_website_percent: percentOrNumber.nullable().optional(),
  social_media_only_count: coercedNumber,
  social_media_only_percent: percentOrNumber.nullable().optional(),
  mobile_friendly_count: coercedNumberNullable.optional(),
  mobile_friendly_percent: percentOrNumber.nullable().optional(),
  clear_conversion_action_count: coercedNumberNullable.optional(),
  clear_conversion_action_percent: percentOrNumber.nullable().optional(),
}).passthrough();

const categoryBenchmarksSchema = z.object({
  google: googleBenchmarksSchema,
  yelp: yelpBenchmarksSchema.optional(),
  facebook: facebookBenchmarksSchema.optional(),
  website: websiteBenchmarksSchema,
}).passthrough();

const competitiveLandscapeSchema = z.object({
  concentration: concentrationCoerced,
  highest_google_review_count: coercedNumberNullable,
  top_five_share_of_sample_reviews_percent: percentOrNumber.nullable().optional(),
  market_leader: z.string().nullable().optional(),
  competitive_summary: z.string(),
}).passthrough();

const competitorGoogleSchema = z.object({
  profile_status: profileStatusEnum,
  rating: coercedNumberNullable,
  review_count: coercedNumberNullable,
  primary_category: z.string().nullable().optional(),
  recent_owner_responses_observed: coercedBoolean.nullable().optional(),
  hours_issue_observed: coercedBoolean.nullable().optional(),
  photo_activity: photoActivityCoerced,
}).passthrough();

const competitorYelpSchema = z.object({
  rating: coercedNumberNullable,
  review_count: coercedNumberNullable,
}).passthrough();

const competitorFacebookSchema = z.object({
  rating_or_recommendation: coercedNumberNullable,
  review_count: coercedNumberNullable,
}).passthrough();

const competitorWebsiteAssessmentSchema = z.object({
  status: websiteStatusEnum,
  mobile_friendly: mobileFriendlyCoerced.nullable().optional(),
  clear_call_to_action: clearCallToActionCoerced.nullable().optional(),
}).passthrough();

const competitiveVisibilityScoreSchema = z.object({
  score: coercedNumber,
  components: z.object({
    review_volume: coercedNumber,
    rating_strength: coercedNumber,
    website_quality: coercedNumber,
    profile_maintenance: coercedNumber,
    cross_platform_presence: coercedNumber,
  }).passthrough(),
}).passthrough();

const topCompetitorSchema = z.object({
  rank: coercedNumber,
  business_name: z.string(),
  ownership_type: ownershipTypeEnum,
  address: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  detected_signals: z.array(z.string()).optional(),
  google: competitorGoogleSchema.optional(),
  yelp: competitorYelpSchema.optional(),
  facebook: competitorFacebookSchema.optional(),
  website_assessment: competitorWebsiteAssessmentSchema.optional(),
  competitive_visibility_score: competitiveVisibilityScoreSchema,
  strengths: z.array(z.string()).optional(),
  weaknesses: z.array(z.string()).optional(),
  ranking_rationale: z.string(),
}).passthrough();

const sampledBusinessGoogleSchema = z.object({
  profile_status: profileStatusEnum,
  rating: coercedNumberNullable,
  review_count: coercedNumberNullable,
  hours_status: hoursStatusCoerced,
  photo_activity: photoActivityCoerced,
  recent_owner_responses_observed: coercedBoolean.nullable().optional(),
}).passthrough();

const sampledBusinessWebsiteSchema = z.object({
  status: websiteStatusEnum,
  mobile_friendly: mobileFriendlyCoerced.nullable().optional(),
  clear_call_to_action: clearCallToActionCoerced.nullable().optional(),
  issues: z.array(z.string()).optional(),
}).passthrough();

const sampledBusinessSchema = z.object({
  business_name: z.string(),
  ownership_type: ownershipTypeEnum,
  location_status: locationStatusEnum,
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  detected_signals: z.array(z.string()).optional(),
  google: sampledBusinessGoogleSchema.optional(),
  yelp: competitorYelpSchema.optional(),
  facebook: competitorFacebookSchema.optional(),
  website_assessment: sampledBusinessWebsiteSchema.optional(),
  nap_status: napStatusEnum,
  observed_opportunities: z.array(z.string()).optional(),
  data_confidence: confidenceEnum,
}).passthrough();

const commonDigitalIssueSchema = z.object({
  issue: z.string(),
  observed_business_count: coercedNumber,
  valid_sample_size: coercedNumber,
  observed_percent: percentOrNumber,
  severity: severityEnum,
  evidence_summary: z.string(),
  data_confidence: confidenceEnum,
}).passthrough();

const geographicGapSchema = z.object({
  area: z.string(),
  gap: z.string(),
  evidence_status: evidenceStatusEnum,
  evidence_summary: z.string(),
}).passthrough();

const serviceGapSchema = z.object({
  service: z.string(),
  gap: z.string(),
  evidence_status: evidenceStatusEnum,
  evidence_summary: z.string(),
}).passthrough();

const digitalGapSchema = z.object({
  gap: z.string(),
  observed_business_count: coercedNumberNullable.optional(),
  evidence_status: evidenceStatusEnum,
  evidence_summary: z.string(),
}).passthrough();

const opportunityGapsSchema = z.object({
  geographic: z.array(geographicGapSchema).optional(),
  services: z.array(serviceGapSchema).optional(),
  digital: z.array(digitalGapSchema).optional(),
}).passthrough();

const categoryDigitalOpportunityScoreSchema = z.object({
  score: coercedNumber,
  classification: opportunityClassificationEnum,
  components: z.object({
    review_management_opportunity: coercedNumber,
    website_opportunity: coercedNumber,
    google_profile_opportunity: coercedNumber,
    nap_and_directory_opportunity: coercedNumber,
    competitive_accessibility: coercedNumber,
  }).passthrough(),
  rationale: z.string(),
}).passthrough();

const outreachRecommendationSchema = z.object({
  primary_angle: z.string(),
  problem_to_reference: z.string(),
  suggested_service_package: z.array(z.string()).optional(),
  recommended_proof_or_demonstration: z.string(),
  suggested_call_to_action: z.string(),
  claims_to_avoid: z.array(z.string()).optional(),
  ideal_prospect_profile: z.string(),
}).passthrough();

const estimatedFeeSchema = z.object({
  minimum: coercedNumberNullable,
  maximum: coercedNumberNullable,
  currency: z.string().optional(),
}).passthrough();

const dataQualitySchema = z.object({
  confidence: confidenceEnum,
  verified_fields: z.array(z.string()).optional(),
  estimated_fields: z.array(z.string()).optional(),
  unavailable_fields: z.array(z.string()).optional(),
  small_sample_warnings: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),
}).passthrough();

const sourceSchema = z.object({
  source_name: z.string(),
  source_type: z.string(),
  url: z.string().nullable().optional(),
  accessed_date: z.string(),
}).passthrough();

// ---- Top-level schema ----

export const cityCategoryOpportunitySchema = z.object({
  audit_metadata: auditMetadataSchema,
  summary: z.string(),
  market_size: marketSizeSchema,
  category_benchmarks: categoryBenchmarksSchema,
  competitive_landscape: competitiveLandscapeSchema,
  top_competitors: z.array(topCompetitorSchema),
  sampled_businesses: z.array(sampledBusinessSchema).optional(),
  common_digital_issues: z.array(commonDigitalIssueSchema).optional(),
  opportunity_gaps: opportunityGapsSchema.optional(),
  category_digital_opportunity_score: categoryDigitalOpportunityScoreSchema,
  outreach_recommendation: outreachRecommendationSchema,
  recommended_tier: tierEnum,
  tier_rationale: z.string().nullable().optional(),
  estimated_monthly_service_fee: estimatedFeeSchema.optional(),
  data_quality: dataQualitySchema,
  sources: z.array(sourceSchema).optional(),
}).passthrough();

export type CityCategoryOpportunityOutput = z.infer<typeof cityCategoryOpportunitySchema>;

export const CITY_CATEGORY_OPPORTUNITY_SCHEMA_NAME = 'city_category_opportunity' as const;

/**
 * Human-readable description of the city_category_opportunity output shape,
 * suitable for appending to a prompt sent to an external agent.
 * Kept in sync with `cityCategoryOpportunitySchema` above.
 */
export const CITY_CATEGORY_OPPORTUNITY_PROMPT_SUFFIX = `

Return your response as JSON matching this exact schema:
{
  "audit_metadata": {
    "audit_date": "<YYYY-MM-DD>",
    "requested_market": {
      "category": "<string>",
      "city": "<string>",
      "state": "<string>",
      "zip_codes": ["<string>"],
      "search_radius_miles": <number|null>
    },
    "category_definition": {
      "working_definition": "<string>",
      "included_subcategories": ["<string>"],
      "excluded_subcategories": ["<string>"]
    },
    "geographic_scope": {
      "scope_description": "<string>",
      "businesses_inside_city_only": <boolean>,
      "service_area_businesses_included": <boolean>
    },
    "research_method": {
      "sources_reviewed": ["<string>"],
      "deduplication_method": "<string>",
      "sampling_method": "<string>"
    },
    "limitations": ["<string>"]
  },
  "summary": "<one concise paragraph>",
  "market_size": {
    "verified_business_count": <number|null>,
    "approximate_business_count": <number|null>,
    "count_unit": "businesses|business_locations|listings",
    "detailed_sample_size": <number>,
    "estimate_confidence": "low|medium|high",
    "estimation_method": "<string>",
    "counts_complete": <boolean>
  },
  "category_benchmarks": {
    "google": {
      "valid_business_count": <number>,
      "average_rating": <number|null>,
      "median_rating": <number|null>,
      "average_review_count": <number|null>,
      "median_review_count": <number|null>,
      "lowest_rating": <number|null>,
      "highest_rating": <number|null>,
      "percentage_below_4_rating": <number|null>,
      "percentage_at_or_above_4_5_rating": <number|null>,
      "percentage_below_10_reviews": <number|null>,
      "percentage_above_100_reviews": <number|null>,
      "claimed_or_likely_claimed_count": <number|null>,
      "verifiable_profile_count": <number>,
      "claimed_or_likely_claimed_percent": <number|null>,
      "recent_owner_response_percent": <number|null>,
      "hours_issue_percent": <number|null>,
      "weak_photo_coverage_percent": <number|null>
    },
    "yelp": { "valid_business_count": <number>, "average_rating": <number|null>, "median_rating": <number|null>, "average_review_count": <number|null>, "median_review_count": <number|null> },
    "facebook": { "valid_business_count": <number>, "average_rating_or_recommendation": <number|null>, "median_rating_or_recommendation": <number|null>, "average_review_count": <number|null>, "median_review_count": <number|null> },
    "website": {
      "verifiable_business_count": <number>,
      "working_website_count": <number>,
      "working_website_percent": <number|null>,
      "no_website_count": <number>,
      "no_website_percent": <number|null>,
      "social_media_only_count": <number>,
      "social_media_only_percent": <number|null>,
      "mobile_friendly_count": <number|null>,
      "mobile_friendly_percent": <number|null>,
      "clear_conversion_action_count": <number|null>,
      "clear_conversion_action_percent": <number|null>
    }
  },
  "competitive_landscape": {
    "concentration": "fragmented|moderately_concentrated|highly_concentrated|dominated_by_one|unable_to_verify",
    "highest_google_review_count": <number|null>,
    "top_five_share_of_sample_reviews_percent": <number|null>,
    "market_leader": "<string|null>",
    "competitive_summary": "<string>"
  },
  "top_competitors": [
    {
      "rank": <number>,
      "business_name": "<string>",
      "ownership_type": "independent|local_chain|regional_chain|national_chain|franchise|unknown",
      "address": "<string|null>",
      "website": "<string|null>",
      "google": {
        "profile_status": "claimed|unclaimed|likely_claimed|unable_to_verify",
        "rating": <number|null>,
        "review_count": <number|null>,
        "primary_category": "<string|null>",
        "recent_owner_responses_observed": <boolean|null>,
        "hours_issue_observed": <boolean|null>,
        "photo_activity": "recent|stale|none_visible|unable_to_verify"
      },
      "yelp": { "rating": <number|null>, "review_count": <number|null> },
      "facebook": { "rating_or_recommendation": <number|null>, "review_count": <number|null> },
      "website_assessment": {
        "status": "working|broken|none_found|social_media_only|unable_to_verify",
        "mobile_friendly": "yes|likely|no|unable_to_verify",
        "clear_call_to_action": "yes|no|unable_to_verify"
      },
      "competitive_visibility_score": {
        "score": <number>,
        "components": {
          "review_volume": <number>,
          "rating_strength": <number>,
          "website_quality": <number>,
          "profile_maintenance": <number>,
          "cross_platform_presence": <number>
        }
      },
      "strengths": ["<string>"],
      "weaknesses": ["<string>"],
      "ranking_rationale": "<string>"
    }
  ],
  "sampled_businesses": [
    {
      "business_name": "<string>",
      "ownership_type": "independent|local_chain|regional_chain|national_chain|franchise|unknown",
      "location_status": "inside_city|outside_city_serving_city|unable_to_verify",
      "address": "<string|null>",
      "phone": "<string|null>",
      "website": "<string|null>",
      "google": {
        "profile_status": "claimed|unclaimed|likely_claimed|unable_to_verify",
        "rating": <number|null>,
        "review_count": <number|null>,
        "hours_status": "current|outdated|incomplete|unable_to_verify",
        "photo_activity": "recent|stale|none_visible|unable_to_verify",
        "recent_owner_responses_observed": <boolean|null>
      },
      "yelp": { "rating": <number|null>, "review_count": <number|null> },
      "facebook": { "rating_or_recommendation": <number|null>, "review_count": <number|null> },
      "website_assessment": {
        "status": "working|broken|none_found|social_media_only|unable_to_verify",
        "mobile_friendly": "yes|likely|no|unable_to_verify",
        "clear_call_to_action": "yes|no|unable_to_verify",
        "issues": ["<string>"]
      },
      "nap_status": "consistent|minor_variations|major_inconsistencies|name_drift|unable_to_verify",
      "observed_opportunities": ["<string>"],
      "data_confidence": "low|medium|high"
    }
  ],
  "common_digital_issues": [
    {
      "issue": "<string>",
      "observed_business_count": <number>,
      "valid_sample_size": <number>,
      "observed_percent": <number>,
      "severity": "low|medium|high",
      "evidence_summary": "<string>",
      "data_confidence": "low|medium|high"
    }
  ],
  "opportunity_gaps": {
    "geographic": [
      { "area": "<string>", "gap": "<string>", "evidence_status": "verified|directional|insufficient_evidence", "evidence_summary": "<string>" }
    ],
    "services": [
      { "service": "<string>", "gap": "<string>", "evidence_status": "verified|directional|insufficient_evidence", "evidence_summary": "<string>" }
    ],
    "digital": [
      { "gap": "<string>", "observed_business_count": <number|null>, "evidence_status": "verified|directional|insufficient_evidence", "evidence_summary": "<string>" }
    ]
  },
  "category_digital_opportunity_score": {
    "score": <integer 0-10>,
    "classification": "low|medium|high|very_high",
    "components": {
      "review_management_opportunity": <number>,
      "website_opportunity": <number>,
      "google_profile_opportunity": <number>,
      "nap_and_directory_opportunity": <number>,
      "competitive_accessibility": <number>
    },
    "rationale": "<string>"
  },
  "outreach_recommendation": {
    "primary_angle": "<string>",
    "problem_to_reference": "<string>",
    "suggested_service_package": ["<string>"],
    "recommended_proof_or_demonstration": "<string>",
    "suggested_call_to_action": "<string>",
    "claims_to_avoid": ["<string>"],
    "ideal_prospect_profile": "<string>"
  },
  "recommended_tier": "tier_1|tier_2|tier_3",
  "tier_rationale": "<string>",
  "estimated_monthly_service_fee": { "minimum": <number>, "maximum": <number>, "currency": "<string>" },
  "data_quality": {
    "confidence": "low|medium|high",
    "verified_fields": ["<string>"],
    "estimated_fields": ["<string>"],
    "unavailable_fields": ["<string>"],
    "small_sample_warnings": ["<string>"],
    "limitations": ["<string>"]
  },
  "sources": [
    { "source_name": "<string>", "source_type": "<string>", "url": "<string|null>", "accessed_date": "<string>" }
  ]
}

CRITICAL JSON RULES:
- Every element of a JSON array MUST be a bare JSON object "{ ... }" or bare value, separated from the previous element by a comma.
- NEVER prefix an array element with a label, key name, identifier, or comment.
- Do not wrap the JSON in Markdown code fences.
- Do not include any text before or after the JSON object.

Return ONLY the JSON object, no markdown fences, no commentary.`;
