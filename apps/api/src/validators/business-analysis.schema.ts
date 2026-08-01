/**
 * Business Analysis Output Schema (Sprint 4)
 *
 * Single source of truth for the shape of the production `seek` prompt's
 * `business_analysis` output — a single-business deep-dive audit with
 * identity verification, per-platform review metrics, website assessment,
 * NAP consistency, digital opportunity score, high-attention flag,
 * recommended tier + fee, data quality block, and structured sources.
 *
 * Imported by:
 *   - The render/copy/download flow (to append the expected shape to the
 *     prompt text sent to external agents).
 *   - The external-import endpoint (to validate pasted JSON before storing
 *     an execution + audit).
 *
 * Audit creation is keyed off `template.output_schema->>'name' === 'business_analysis'`,
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

const coercedBooleanNullable = z.union([coercedBoolean, z.null()]);

/**
 * Like `coercedBooleanNullable`, but also accepts the sentinel strings agents
 * commonly emit for the tri-state website assessment fields:
 *   - "verified" / "present" / "yes" / "true" / "1"  -> true
 *   - "not_verified" / "absent" / "missing" / "no" / "false" / "0" -> false
 *   - "unable_to_verify" / "unverified" / "unknown" / "n/a" / "na" -> null
 *
 * The schema stores unable-to-verify as null. Some prompt templates and
 * agents emit "verified" (meaning "confirmed present") or "unable_to_verify"
 * for these boolean fields instead of true/false/null; this preprocessor
 * accepts all three forms so validation does not fail on otherwise-correct
 * audits.
 */
const coercedBooleanNullableTolerant = z.preprocess((val) => {
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'verified' || s === 'present' || s === 'yes' || s === 'true' || s === '1') return true;
    if (s === 'not_verified' || s === 'not present' || s === 'absent' || s === 'missing' || s === 'no' || s === 'false' || s === '0') return false;
    if (s === 'unable_to_verify' || s === 'unverified' || s === 'unknown' || s === 'n/a' || s === 'na') return null;
  }
  return val;
}, coercedBooleanNullable);

/**
 * Coerce a string-or-number to a string (e.g. Facebook rating emitted as 4.8
 * instead of "4.8"). Booleans/objects are left alone so Zod reports them.
 */
const coercedString = z.preprocess((val) => {
  if (typeof val === 'number') return String(val);
  return val;
}, z.string());

const coercedStringNullable = z.union([coercedString, z.null()]);

// ---- Shared enums (kept in sync with the prompt's enum values) ----

const identityStatusEnum = z.enum(['confirmed', 'ambiguous', 'mismatched']);
const identityConfidenceEnum = z.enum(['high', 'medium', 'low']);
const profileStatusEnum = z.enum([
  'claimed',
  'likely_claimed',
  'unclaimed',
  'likely_unclaimed',
  'unable_to_verify',
]);
const websiteStatusEnum = z.enum([
  'working',
  'broken',
  'none_found',
  'social_media_only',
  'unable_to_verify',
]);
const mobileFriendlyEnum = z.enum(['yes', 'likely', 'no', 'unable_to_verify']);
const napStatusEnum = z.enum([
  'consistent',
  'minor_variations',
  'major_inconsistencies',
  'unable_to_verify',
]);
const tierEnum = z.enum(['tier_1', 'tier_2', 'tier_3']);
const confidenceEnum = z.enum(['high', 'medium', 'low']);
const dataStatusEnum = z.enum(['complete', 'partial', 'unavailable', 'unable_to_verify']);

/**
 * Normalize `data_status` synonyms agents commonly emit. "verified" and
 * "confirmed" map to "complete"; unknown strings fall through to the enum
 * check so genuine typos still surface as validation errors.
 */
const dataStatusCoerced = z.preprocess((val) => {
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'verified' || s === 'confirmed') return 'complete';
  }
  return val;
}, dataStatusEnum);

// ---- Nested object schemas ----

const requestedBusinessSchema = z.object({
  business_name: z.string(),
  city: z.string(),
  state: z.string(),
  category: z.string(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
}).passthrough();

const matchedBusinessSchema = z.object({
  business_name: z.string(),
  category: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
}).passthrough();

const auditMetadataSchema = z.object({
  audit_date: z.string(),
  requested_business: requestedBusinessSchema,
  matched_business: matchedBusinessSchema.nullable().optional(),
  identity_status: identityStatusEnum,
  identity_confidence: identityConfidenceEnum,
  limitations: z.array(z.string()).optional(),
}).passthrough();

const platformSchema = z.object({
  profile_status: profileStatusEnum,
  rating: coercedNumberNullable,
  total_reviews: coercedNumberNullable,
  reviews_with_observable_response: coercedNumberNullable,
  observable_unanswered_reviews: coercedNumberNullable,
  observable_unanswered_negative_reviews: coercedNumberNullable,
  observable_unanswered_positive_reviews: coercedNumberNullable,
  observable_response_rate_percent: percentOrNumber.nullable(),
  oldest_observable_unanswered_review: z.string().nullable().optional(),
  newest_observable_unanswered_review: z.string().nullable().optional(),
  data_status: dataStatusCoerced.optional(),
}).passthrough();

const googlePlatformSchema = platformSchema.extend({
  primary_category: z.string().nullable().optional(),
  additional_categories: z.array(z.string()).optional(),
  displayed_name: z.string().nullable().optional(),
  displayed_address: z.string().nullable().optional(),
  displayed_phone: z.string().nullable().optional(),
  displayed_website: z.string().nullable().optional(),
  profile_issues: z.array(z.string()).optional(),
}).passthrough();

const platformsSchema = z.object({
  google: googlePlatformSchema.nullable().optional(),
  yelp: platformSchema.nullable().optional(),
  facebook: z.object({
    profile_status: profileStatusEnum,
    rating_or_recommendation: coercedStringNullable.optional(),
    rating: coercedNumberNullable.optional(),
    total_reviews: coercedNumberNullable.optional(),
    reviews_with_observable_response: coercedNumberNullable.optional(),
    observable_unanswered_reviews: coercedNumberNullable.optional(),
    observable_unanswered_negative_reviews: coercedNumberNullable.optional(),
    observable_unanswered_positive_reviews: coercedNumberNullable.optional(),
    observable_response_rate_percent: percentOrNumber.nullable().optional(),
    oldest_observable_unanswered_review: z.string().nullable().optional(),
    newest_observable_unanswered_review: z.string().nullable().optional(),
    data_status: dataStatusCoerced.optional(),
  }).nullable().optional(),
}).passthrough();

const combinedReviewMetricsSchema = z.object({
  observable_total_reviews: coercedNumberNullable,
  observable_reviews_with_response: coercedNumberNullable.optional(),
  observable_unanswered_reviews: coercedNumberNullable,
  observable_unanswered_negative_reviews: coercedNumberNullable,
  observable_unanswered_positive_reviews: coercedNumberNullable,
  observable_response_rate_percent: percentOrNumber.nullable().optional(),
  observable_unanswered_rate_percent: percentOrNumber.nullable().optional(),
  oldest_unanswered_review: z.string().nullable().optional(),
  newest_unanswered_review: z.string().nullable().optional(),
  counts_complete: z.boolean().optional(),
}).passthrough();

const websiteSchema = z.object({
  url: z.string().nullable().optional(),
  status: websiteStatusEnum,
  mobile_friendly: mobileFriendlyEnum.nullable().optional(),
  https: coercedBooleanNullableTolerant.optional(),
  contact_information_visible: coercedBooleanNullableTolerant.optional(),
  click_to_call_available: coercedBooleanNullableTolerant.optional(),
  call_to_action_present: coercedBooleanNullableTolerant.optional(),
  service_information_present: coercedBooleanNullableTolerant.optional(),
  location_information_present: coercedBooleanNullableTolerant.optional(),
  issues: z.array(z.string()).optional(),
  conversion_opportunities: z.array(z.string()).optional(),
}).passthrough();

const napConsistencySchema = z.object({
  overall_status: napStatusEnum,
  canonical_name: z.string().nullable().optional(),
  canonical_address: z.string().nullable().optional(),
  canonical_phone: z.string().nullable().optional(),
  name_variations: z.array(z.string()).optional(),
  address_variations: z.array(z.string()).optional(),
  phone_variations: z.array(z.string()).optional(),
  material_issues: z.array(z.string()).optional(),
}).passthrough();

const reviewExampleSchema = z.object({
  platform: z.string(),
  rating: coercedNumberNullable,
  date: z.string().nullable().optional(),
  complaint_summary: z.string(),
  response_status: z.string().nullable().optional(),
  verification_status: z.string().nullable().optional(),
}).passthrough();

const reviewThemeSchema = z.object({
  theme: z.string(),
  observed_frequency: z.string().nullable().optional(),
  supporting_review_count: coercedNumberNullable.optional(),
  summary: z.string().nullable().optional(),
}).passthrough();

const digitalOpportunityScoreSchema = z.object({
  score: coercedNumber,
  classification: z.string().optional(),
  components: z.object({
    google_profile_maintenance: coercedNumberNullable.optional(),
    review_response_opportunity: coercedNumberNullable.optional(),
    unanswered_negative_reviews: coercedNumberNullable.optional(),
    website_opportunity: coercedNumberNullable.optional(),
    nap_consistency: coercedNumberNullable.optional(),
  }).passthrough().optional(),
  rationale: z.string().nullable().optional(),
}).passthrough();

const estimatedFeeSchema = z.object({
  minimum: coercedNumberNullable,
  maximum: coercedNumberNullable,
  currency: z.string().optional(),
}).passthrough();

const dataQualitySchema = z.object({
  confidence: confidenceEnum,
  verified_fields: z.array(z.string()).optional(),
  unavailable_fields: z.array(z.string()).optional(),
  conflicts: z.array(z.string()).optional(),
  limitations: z.array(z.string()).optional(),
}).passthrough();

const sourceSchema = z.object({
  platform: z.string(),
  source_type: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  accessed_date: z.string().nullable().optional(),
}).passthrough();

// ---- Top-level schema ----

export const businessAnalysisSchema = z.object({
  audit_metadata: auditMetadataSchema,
  summary: z.string(),
  platforms: platformsSchema,
  combined_review_metrics: combinedReviewMetricsSchema.optional(),
  website: websiteSchema,
  nap_consistency: napConsistencySchema,
  unanswered_negative_review_examples: z.array(reviewExampleSchema).optional(),
  negative_review_themes: z.array(reviewThemeSchema).optional(),
  digital_opportunity_score: digitalOpportunityScoreSchema,
  high_attention: z.boolean(),
  high_attention_reasons: z.array(z.string()).optional(),
  recommended_tier: tierEnum,
  tier_rationale: z.string().nullable().optional(),
  estimated_monthly_service_fee: estimatedFeeSchema.optional(),
  recommended_services: z.array(z.string()).optional(),
  data_quality: dataQualitySchema,
  sources: z.array(sourceSchema).optional(),
}).passthrough();

export type BusinessAnalysisOutput = z.infer<typeof businessAnalysisSchema>;

export const BUSINESS_ANALYSIS_SCHEMA_NAME = 'business_analysis' as const;

/**
 * Human-readable description of the business_analysis output shape,
 * suitable for appending to a prompt sent to an external agent.
 * Kept in sync with `businessAnalysisSchema` above.
 */
export const BUSINESS_ANALYSIS_PROMPT_SUFFIX = `

Return your response as JSON matching this exact schema:
{
  "audit_metadata": {
    "audit_date": "<ISO date>",
    "requested_business": {
      "business_name": "<string>",
      "city": "<string>",
      "state": "<string>",
      "category": "<string>",
      "address": "<string|null>",
      "phone": "<string|null>"
    },
    "matched_business": {
      "business_name": "<string>",
      "category": "<string|null>",
      "address": "<string|null>",
      "phone": "<string|null>",
      "website": "<string|null>"
    },
    "identity_status": "confirmed|ambiguous|mismatched",
    "identity_confidence": "high|medium|low",
    "limitations": ["<string>", ...]
  },
  "summary": "<one concise paragraph>",
  "platforms": {
    "google": {
      "profile_status": "claimed|likely_claimed|unclaimed|likely_unclaimed|unable_to_verify",
      "rating": <number|null>,
      "total_reviews": <number|null>,
      "reviews_with_observable_response": <number|null>,
      "observable_unanswered_reviews": <number|null>,
      "observable_unanswered_negative_reviews": <number|null>,
      "observable_unanswered_positive_reviews": <number|null>,
      "observable_response_rate_percent": <number|null>,
      "oldest_observable_unanswered_review": "<string|null>",
      "newest_observable_unanswered_review": "<string|null>",
      "primary_category": "<string|null>",
      "additional_categories": ["<string>", ...],
      "displayed_name": "<string|null>",
      "displayed_address": "<string|null>",
      "displayed_phone": "<string|null>",
      "displayed_website": "<string|null>",
      "profile_issues": ["<string>", ...],
      "data_status": "complete|partial|unavailable|unable_to_verify"
    },
    "yelp": { ...same per-platform structure minus primary_category/additional_categories... },
    "facebook": { "profile_status": "...", "rating_or_recommendation": "<string|null>", ...same per-platform structure... }
  },
  "combined_review_metrics": {
    "observable_total_reviews": <number|null>,
    "observable_reviews_with_response": <number|null>,
    "observable_unanswered_reviews": <number|null>,
    "observable_unanswered_negative_reviews": <number|null>,
    "observable_unanswered_positive_reviews": <number|null>,
    "observable_response_rate_percent": <number|null>,
    "observable_unanswered_rate_percent": <number|null>,
    "oldest_unanswered_review": "<string|null>",
    "newest_unanswered_review": "<string|null>",
    "counts_complete": <boolean>
  },
  "website": {
    "url": "<string|null>",
    "status": "working|broken|none_found|social_media_only|unable_to_verify",
    "mobile_friendly": "yes|likely|no|unable_to_verify",
    "https": <boolean|null> (null when unable to verify),
    "contact_information_visible": <boolean|null> (null when unable to verify),
    "click_to_call_available": <boolean|null> (null when unable to verify),
    "call_to_action_present": <boolean|null> (null when unable to verify),
    "service_information_present": <boolean|null> (null when unable to verify),
    "location_information_present": <boolean|null> (null when unable to verify),
    "issues": ["<string>", ...],
    "conversion_opportunities": ["<string>", ...]
  },
  "nap_consistency": {
    "overall_status": "consistent|minor_variations|major_inconsistencies|unable_to_verify",
    "canonical_name": "<string|null>",
    "canonical_address": "<string|null>",
    "canonical_phone": "<string|null>",
    "name_variations": ["<string>", ...],
    "address_variations": ["<string>", ...],
    "phone_variations": ["<string>", ...],
    "material_issues": ["<string>", ...]
  },
  "unanswered_negative_review_examples": [
    { "platform": "<string>", "rating": <number|null>, "date": "<string|null>", "complaint_summary": "<string>", "response_status": "<string|null>", "verification_status": "<string|null>" }
  ],
  "negative_review_themes": [
    { "theme": "<string>", "observed_frequency": "<string|null>", "supporting_review_count": <number|null>, "summary": "<string|null>" }
  ],
  "digital_opportunity_score": {
    "score": <integer 0-10>,
    "classification": "<string>",
    "components": {
      "google_profile_maintenance": <number>,
      "review_response_opportunity": <number>,
      "unanswered_negative_reviews": <number>,
      "website_opportunity": <number>,
      "nap_consistency": <number>
    },
    "rationale": "<string>"
  },
  "high_attention": <boolean>,
  "high_attention_reasons": ["<string>", ...],
  "recommended_tier": "tier_1|tier_2|tier_3",
  "tier_rationale": "<string>",
  "estimated_monthly_service_fee": { "minimum": <number>, "maximum": <number>, "currency": "<string>" },
  "recommended_services": ["<string>", ...],
  "data_quality": {
    "confidence": "high|medium|low",
    "verified_fields": ["<string>", ...],
    "unavailable_fields": ["<string>", ...],
    "conflicts": ["<string>", ...],
    "limitations": ["<string>", ...]
  },
  "sources": [
    { "platform": "<string>", "source_type": "<string|null>", "url": "<string|null>", "accessed_date": "<string|null>" }
  ]
}

CRITICAL JSON RULES:
- Every element of a JSON array (e.g. "unanswered_negative_review_examples",
  "negative_review_themes", "recommended_services", "sources") MUST be a bare
  JSON object "{ ... }" or bare value, separated from the previous element by a
  comma.
- NEVER prefix an array element with a label, key name, identifier, or comment.
  The following are INVALID and will be rejected:
      "sources": [ { ... }, source_2: { ... } ]
  The correct form is:
      "sources": [ { ... }, { ... } ]
- Do not wrap the JSON in Markdown code fences.
- Do not include any text before or after the JSON object.

Return ONLY the JSON object, no markdown fences, no commentary.`;
