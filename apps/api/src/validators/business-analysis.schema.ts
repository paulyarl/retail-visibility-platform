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
 *   - "verified" / "present" / "yes" / "true" / "1" / "working"  -> true
 *   - "not_verified" / "absent" / "missing" / "no" / "false" / "0" / "broken" -> false
 *   - "unable_to_verify" / "unverified" / "unknown" / "n/a" / "na" -> null
 *
 * The schema stores unable-to-verify as null. Some prompt templates and
 * agents emit "verified" (meaning "confirmed present") or "unable_to_verify"
 * for these boolean fields instead of true/false/null; this preprocessor
 * accepts all three forms so validation does not fail on otherwise-correct
 * audits.
 *
 * Agents also frequently reuse the `website.status` enum values
 * ("working"/"broken") for these sub-fields because the prompt's Website
 * Assessment section documents those values first and then lists the
 * sub-fields to "Evaluate" without restating their enum. We accept those as
 * synonyms ("working" -> true, "broken" -> false) so a structurally-correct
 * audit is not rejected solely for this vocabulary drift.
 *
 * Agents also emit "partial" for fields like call_to_action_present /
 * service_information_present when something is present but incomplete (e.g.
 * a CTA exists only on some pages). We treat "partial" as true — the thing IS
 * present, at least partially — so a structurally-correct audit is not
 * rejected solely because the agent qualified its yes. Downstream consumers
 * (e.g. signal-extractor's WC_MISSING_CTA) treat true as "present", which is
 * the correct semantic for a partial CTA.
 */
const coercedBooleanNullableTolerant = z.preprocess((val) => {
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'verified' || s === 'present' || s === 'yes' || s === 'true' || s === '1' || s === 'working' || s === 'partial') return true;
    if (s === 'not_verified' || s === 'not present' || s === 'absent' || s === 'missing' || s === 'no' || s === 'false' || s === '0' || s === 'broken') return false;
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
/**
 * Normalize `website.mobile_friendly` synonyms agents commonly emit. The
 * prompt documents `yes|likely|no|unable_to_verify`, but some agents emit the
 * same "verified"/"unable_to_verify" sentinel strings they use for the
 * tri-state boolean website fields. Without this preprocessor those audits
 * fail validation on `mobile_friendly` alone, even though the boolean fields
 * (https, contact_information_visible, ...) already tolerate "verified" via
 * `coercedBooleanNullableTolerant`.
 *
 * Agents also frequently reuse the `website.status` enum values
 * ("working"/"broken") for `mobile_friendly` because the prompt's Website
 * Assessment section documents those values first and then lists the
 * sub-fields to "Evaluate" without restating their enum. We accept those as
 * synonyms so a structurally-correct audit is not rejected solely for this
 * vocabulary drift.
 *
 *   - "verified" / "present" / "confirmed" / "true" / "1" / "working" -> "yes"
 *   - "not_verified" / "not present" / "absent" / "missing" / "false" / "0" / "broken" -> "no"
 *   - "unverified" / "unknown" / "n/a" / "na" -> "unable_to_verify"
 *
 * "yes", "likely", "no", and "unable_to_verify" pass through unchanged.
 * Unknown strings fall through to the enum check so genuine typos still
 * surface as validation errors.
 */
const mobileFriendlyCoerced = z.preprocess((val) => {
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    if (s === 'verified' || s === 'present' || s === 'confirmed' || s === 'true' || s === '1' || s === 'working') return 'yes';
    if (s === 'not_verified' || s === 'not present' || s === 'absent' || s === 'missing' || s === 'false' || s === '0' || s === 'broken') return 'no';
    if (s === 'unverified' || s === 'unknown' || s === 'n/a' || s === 'na') return 'unable_to_verify';
  }
  return val;
}, mobileFriendlyEnum);
const napStatusEnum = z.enum([
  'consistent',
  'minor_variations',
  'major_inconsistencies',
  'unable_to_verify',
]);
const tierEnum = z.enum(['tier_1', 'tier_2', 'tier_3']);
const confidenceEnum = z.enum(['high', 'medium', 'low']);
const dataStatusEnum = z.enum(['complete', 'partial', 'unavailable', 'unable_to_verify']);

// ---- Category-integrated enums (template v2 Category-Integrated Variant) ----

const storeFormatEnum = z.enum([
  'grocery',
  'grocery_plus_prepared_foods',
  'bakery',
  'butcher',
  'restaurant',
  'caterer',
  'wholesaler',
  'beauty_retailer',
  'online_seller',
  'service',
  'unknown',
]);
const actionClassificationEnum = z.enum([
  'ADMIN_NEGLECT',
  'CORPORATE_SHIELD',
  'CRITICAL_DISTRESS',
  'BALANCED_HEALTHY',
]);
const leadDispositionEnum = z.enum([
  'HIGH_PRIORITY_OUTREACH',
  'DISCARD',
  'REHABILITATION_OUTREACH',
  'STANDARD_OUTREACH',
]);
const operationalStatusEnum = z.enum([
  'active',
  'likely_active',
  'inactive',
  'unable_to_verify',
]);
const productBreadthEnum = z.enum(['narrow', 'moderate', 'broad']);
const deliveryModelEnum = z.enum(['none', 'marketplace', 'direct', 'both', 'unknown']);

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
  store_format: storeFormatEnum.nullable().optional(),
  hybrid_role: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
}).passthrough();

/**
 * Element schema for `audit_metadata.identity_corroboration_sources`.
 *
 * The prompt documents this as `["<string>", ...]`, but some agents (e.g.
 * GPT-5.6 Luna) emit richer objects like
 * `{ source, matched_identifiers, url }`. The field is persisted as part of
 * the `audit_data` JSON blob and not consumed by downstream code, so we accept
 * both shapes via a union — preserving the richer object representation when
 * the agent provides it. The object variant uses `.passthrough()` to tolerate
 * varying key names across agents.
 */
const corroborationSourceElement = z.union([
  z.string(),
  z.object({
    source: z.string().nullable().optional(),
    matched_identifiers: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
  }).passthrough(),
]);

const auditMetadataSchema = z.object({
  audit_date: z.string(),
  requested_business: requestedBusinessSchema,
  matched_business: matchedBusinessSchema.nullable().optional(),
  identity_status: identityStatusEnum,
  identity_confidence: identityConfidenceEnum,
  identity_corroboration_sources: z.array(corroborationSourceElement).optional(),
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
  // Gold Standard System — Sprint 0: live profile URL on the platform.
  // Captured so the audit can reference the exact profile being evaluated
  // and so the gold-standard benchmark comparison has a concrete destination.
  profile_url: z.string().nullable().optional(),
}).passthrough();

const googlePlatformSchema = platformSchema.extend({
  primary_category: z.string().nullable().optional(),
  additional_categories: z.array(z.string()).optional(),
  category_fit_assessment: z.string().nullable().optional(),
  displayed_name: z.string().nullable().optional(),
  displayed_address: z.string().nullable().optional(),
  displayed_phone: z.string().nullable().optional(),
  displayed_website: z.string().nullable().optional(),
  profile_issues: z.array(z.string()).optional(),
  // Product-visibility fields (Sprint 1 — Universal Recalibration)
  photo_count: coercedNumberNullable.optional(),
  photo_types: z.array(z.string()).optional(),
  special_hours_present: coercedBooleanNullableTolerant.optional(),
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
  mobile_friendly: mobileFriendlyCoerced.nullable().optional(),
  https: coercedBooleanNullableTolerant.optional(),
  contact_information_visible: coercedBooleanNullableTolerant.optional(),
  click_to_call_available: coercedBooleanNullableTolerant.optional(),
  call_to_action_present: coercedBooleanNullableTolerant.optional(),
  service_information_present: coercedBooleanNullableTolerant.optional(),
  location_information_present: coercedBooleanNullableTolerant.optional(),
  issues: z.array(z.string()).optional(),
  conversion_opportunities: z.array(z.string()).optional(),
  // Product-visibility fields (Sprint 1 — Universal Recalibration)
  has_product_browsing: coercedBooleanNullableTolerant.optional(),
  has_availability_inquiry: coercedBooleanNullableTolerant.optional(),
  has_pickup_ordering: coercedBooleanNullableTolerant.optional(),
  has_delivery_option: coercedBooleanNullableTolerant.optional(),
  product_categories_visible: z.array(z.string()).optional(),
  // Category-integrated fields (template v2 Category-Integrated Variant)
  category_specific_content_present: coercedBooleanNullableTolerant.optional(),
  ordering_or_pickup_info_present: coercedBooleanNullableTolerant.optional(),
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

// ---- Category-integrated nested schemas (template v2 Category-Integrated Variant) ----

const specializedSourceSchema = z.object({
  source: z.string(),
  tier: coercedNumberNullable.optional(),
  source_type: z.string().nullable().optional(),
  consulted: coercedBooleanNullable.optional(),
  findings: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  accessed_date: z.string().nullable().optional(),
}).passthrough();

const alignmentScoringSchema = z.object({
  misalignment_index: coercedNumberNullable.optional(),
  action_classification: actionClassificationEnum.optional(),
  lead_disposition: leadDispositionEnum.optional(),
  primary_outreach_hook: z.string().nullable().optional(),
  alignment_breakdown: z.object({
    admin_score: coercedNumberNullable.optional(),
    public_sentiment_score: coercedNumberNullable.optional(),
    delta: coercedNumberNullable.optional(),
  }).passthrough().optional(),
}).passthrough();

const operationalStatusSchema = z.object({
  status: operationalStatusEnum.optional(),
  last_activity_evidence: z.string().nullable().optional(),
  last_activity_date: z.string().nullable().optional(),
  evidence_sources: z.array(z.string()).optional(),
}).passthrough();

const competitiveBenchmarkSchema = z.object({
  business_name: z.string(),
  store_format: z.string().nullable().optional(),
  geographic_reach: z.string().nullable().optional(),
  product_breadth: productBreadthEnum.nullable().optional(),
  prepared_food_component: coercedBooleanNullable.optional(),
  delivery_model: deliveryModelEnum.nullable().optional(),
  regional_specialization: z.string().nullable().optional(),
  google_rating: coercedNumberNullable.optional(),
  google_review_count: coercedNumberNullable.optional(),
  yelp_rating: coercedNumberNullable.optional(),
  yelp_review_count: coercedNumberNullable.optional(),
  profile_completeness_score: coercedNumberNullable.optional(),
  format_context_note: z.string().nullable().optional(),
  specialization_evidence_direct: coercedBooleanNullable.optional(),
}).passthrough();

// ---- Gold Standard gap analysis + quality gate results (Sprint 0) ----

/**
 * Gap analysis entry — a single field where the business's actual value
 * differs from the gold-standard expected value. Produced by the audit
 * prompt when a gold-standard benchmark is injected.
 */
const gapAnalysisEntrySchema = z.object({
  platform: z.string().optional(),
  field: z.string(),
  // `expected`/`actual` may be a string (e.g. "African grocery store"), a
  // boolean (presence fields like hours_present/website_present), a number
  // (count fields like photo_count), an array of strings/numbers/booleans
  // (multi-value fields like additional_categories), or null when not
  // verifiable.
  expected: z.union([z.string(), z.boolean(), z.number(), z.array(z.union([z.string(), z.boolean(), z.number()]))]).nullable().optional(),
  actual: z.union([z.string(), z.boolean(), z.number(), z.array(z.union([z.string(), z.boolean(), z.number()]))]).nullable().optional(),
  gap_description: z.string().nullable().optional(),
  severity: z.enum(['non_negotiable', 'recommended']).optional(),
}).passthrough();

const gapAnalysisSchema = z.object({
  gaps: z.array(gapAnalysisEntrySchema).optional(),
  summary: z.string().nullable().optional(),
}).passthrough();

/**
 * Quality gate result — whether a specific gold-standard quality gate
 * passed or failed for this business. Produced by the audit prompt when
 * a gold-standard benchmark is injected.
 */
const qualityGateResultSchema = z.object({
  platform: z.string().optional(),
  gate: z.string(),
  passed: z.boolean().nullable().optional(),
  severity: z.enum(['non_negotiable', 'recommended']).optional(),
  notes: z.string().nullable().optional(),
}).passthrough();

const qualityGateResultsSchema = z.object({
  results: z.array(qualityGateResultSchema).optional(),
  summary: z.string().nullable().optional(),
}).passthrough();

// ---- Top-level schema ----

export const businessAnalysisSchema = z.object({
  audit_metadata: auditMetadataSchema,
  detected_signals: z.array(z.string()).optional(),
  // Product-visibility classification (Sprint 1 — Universal Recalibration)
  business_type: z.enum(['service', 'product', 'hybrid', 'unable_to_verify']).nullable().optional(),
  summary: z.string(),
  platforms: platformsSchema,
  specialized_sources_audited: z.array(specializedSourceSchema).optional(),
  combined_review_metrics: combinedReviewMetricsSchema.optional(),
  alignment_scoring: alignmentScoringSchema.optional(),
  website: websiteSchema,
  nap_consistency: napConsistencySchema,
  operational_status: operationalStatusSchema.optional(),
  competitive_benchmarks: z.array(competitiveBenchmarkSchema).optional(),
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
  // Gold Standard System — Sprint 0: gap analysis + quality gate results.
  // These are optional — only present when a gold-standard benchmark was
  // injected into the audit prompt. The audit compares the business's
  // actual profile against the gold-standard expected fields and quality
  // gates, producing structured gaps and pass/fail results.
  gap_analysis: gapAnalysisSchema.optional(),
  quality_gate_results: qualityGateResultsSchema.optional(),
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
      "store_format": "grocery|grocery_plus_prepared_foods|bakery|butcher|restaurant|caterer|wholesaler|beauty_retailer|online_seller|service|unknown",
      "hybrid_role": "<string|null>",
      "address": "<string|null>",
      "phone": "<string|null>",
      "website": "<string|null>"
    },
    "identity_status": "confirmed|ambiguous|mismatched",
    "identity_confidence": "high|medium|low",
    "identity_corroboration_sources": ["<string>", ...],
    "limitations": ["<string>", ...]
  },
  "detected_signals": ["<signal_code>", ...],
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
      "category_fit_assessment": "<string|null>",
      "displayed_name": "<string|null>",
      "displayed_address": "<string|null>",
      "displayed_phone": "<string|null>",
      "displayed_website": "<string|null>",
      "profile_issues": ["<string>", ...],
      "data_status": "complete|partial|unavailable|unable_to_verify"
    },
    "yelp": { ...same per-platform structure minus primary_category/additional_categories/category_fit_assessment... },
    "facebook": { "profile_status": "...", "rating_or_recommendation": "<string|null>", ...same per-platform structure... }
  },
  "specialized_sources_audited": [
    { "source": "<string>", "tier": <number>, "source_type": "<string>", "consulted": <boolean>, "findings": "<string>", "url": "<string|null>", "accessed_date": "<string|null>" }
  ],
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
  "alignment_scoring": {
    "misalignment_index": <number|null>,
    "action_classification": "ADMIN_NEGLECT|CORPORATE_SHIELD|CRITICAL_DISTRESS|BALANCED_HEALTHY",
    "lead_disposition": "HIGH_PRIORITY_OUTREACH|DISCARD|REHABILITATION_OUTREACH|STANDARD_OUTREACH",
    "primary_outreach_hook": "<string>",
    "alignment_breakdown": { "admin_score": <number|null>, "public_sentiment_score": <number|null>, "delta": <number|null> }
  },
  "website": {
    "url": "<string|null>",
    "status": "working|broken|none_found|social_media_only|unable_to_verify",
    "mobile_friendly": "yes|likely|no|unable_to_verify" (use "yes" when confirmed mobile-friendly; do NOT use "verified"),
    "https": <boolean|null> (null when unable to verify),
    "contact_information_visible": <boolean|null> (null when unable to verify),
    "click_to_call_available": <boolean|null> (null when unable to verify),
    "call_to_action_present": <boolean|null> (null when unable to verify),
    "service_information_present": <boolean|null> (null when unable to verify),
    "location_information_present": <boolean|null> (null when unable to verify),
    "category_specific_content_present": "yes|likely|no|unable_to_verify" (null when unable to verify),
    "ordering_or_pickup_info_present": "yes|likely|no|unable_to_verify" (null when unable to verify),
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
  "operational_status": {
    "status": "active|likely_active|inactive|unable_to_verify",
    "last_activity_evidence": "<string|null>",
    "last_activity_date": "<string|null>",
    "evidence_sources": ["<string>", ...]
  },
  "competitive_benchmarks": [
    {
      "business_name": "<string>",
      "store_format": "<string>",
      "geographic_reach": "<string>",
      "product_breadth": "narrow|moderate|broad",
      "prepared_food_component": <boolean>,
      "delivery_model": "none|marketplace|direct|both|unknown",
      "regional_specialization": "<string|null>",
      "google_rating": <number|null>,
      "google_review_count": <number|null>,
      "yelp_rating": <number|null>,
      "yelp_review_count": <number|null>,
      "profile_completeness_score": <number 0-10>,
      "format_context_note": "<string>",
      "specialization_evidence_direct": <boolean>
    }
  ],
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
  ],
  "business_type": "service|product|hybrid|unable_to_verify" (classify the business: 'service' for service businesses like HVAC/plumbing/dental, 'product' for inventory businesses like grocery stores/bakeries/pharmacies, 'hybrid' for businesses with both service and product components like restaurants/caterers, 'unable_to_verify' when the business model is unclear),
  "gap_analysis": {
    "gaps": [
      { "platform": "<string>", "field": "<string>", "expected": "<string|boolean|number|<array>|null>", "actual": "<string|boolean|number|<array>|null>", "gap_description": "<string>", "severity": "non_negotiable|recommended" }
    ],
    "summary": "<string>"
  },
  "quality_gate_results": {
    "results": [
      { "platform": "<string>", "gate": "<string>", "passed": <boolean>, "severity": "non_negotiable|recommended", "notes": "<string>" }
    ],
    "summary": "<string>"
  }
}

GOLD STANDARD FIELDS (assess when a GOLD STANDARD BENCHMARK section is present in the prompt):
- platforms.{platform}.profile_url: "<string|null>" — the LIVE profile URL on each platform (e.g. "https://www.google.com/maps/place/..."). Always capture this.
- gap_analysis: compare the business's actual profile against the gold-standard expected fields. For each field where the business's actual value differs from the expected value, produce a gap entry with the platform, field name, expected value, actual value, gap description, and severity (non_negotiable or recommended). The expected and actual values may be a string (e.g. "African grocery store"), a boolean (presence fields like hours_present/website_present — use true/false), a number (count fields like photo_count), an array of strings/numbers/booleans (multi-value fields like additional_categories — use a JSON array such as ["Grocery store", "International grocery store"]), or null when not verifiable.
- quality_gate_results: for each gold-standard quality gate, record whether the business passed or failed, with the platform, gate name, passed boolean, severity, and notes.

PRODUCT-VISIBILITY FIELDS (assess for all businesses, especially product/inventory types):
- website.has_product_browsing: <boolean|null> — can customers browse products or categories on the website? (null when unable to verify or no website)
- website.has_availability_inquiry: <boolean|null> — is there a way to check if a specific product is in stock (WhatsApp, SMS, click-to-call, web form)?
- website.has_pickup_ordering: <boolean|null> — does the business offer pickup ordering online?
- website.has_delivery_option: <boolean|null> — does the business offer delivery?
- website.product_categories_visible: ["<string>", ...] — product categories visible on the website or GBP
- platforms.google.photo_count: <number|null> — total number of photos on GBP
- platforms.google.photo_types: ["storefront"|"exterior"|"interior"|"product"|"team"|"logo", ...] — categorize GBP photos by type
- platforms.google.special_hours_present: <boolean|null> — are special/holiday hours present on GBP?

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
