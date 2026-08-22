/**
 * Gold Standard Scan Output Schema (Gold Standard System — Sprint 0)
 *
 * Validates the output of gold-standard establishment and discovery scans.
 * The gold-standard scan finds candidate businesses that exemplify the
 * best-in-class profile for a category on a specific platform (or all
 * platforms), evaluates them against quality gates, and produces the
 * expected_fields + gold_standards structure that becomes the active
 * gold-standard intelligence profile's configuration_json.
 *
 * Two campaign kinds produce this schema:
 *   - establishment: bootstraps a category/platform gold-standard profile
 *     (expected_fields + pattern exemplars). The validated JSON is persisted
 *     as a DRAFT profile by IntelligenceProfileService.importAsDraft().
 *   - discovery: produces additional candidate businesses evaluated against
 *     an already-active gold-standard profile's parameters. Candidates can
 *     be added to per-platform gold-standard slots (up to 4 per platform).
 *
 * Key structural requirements:
 *   - category_key + category_name identify the category
 *   - platform_focus: 'all' | 'google' | 'yelp' | 'facebook' | 'bbb' |
 *     'apple_maps' | 'bing' (the platform the scan focused on)
 *   - expected_fields.universal: fields every gold-standard profile should
 *     have regardless of platform (canonical NAP, hours, website, etc.)
 *   - expected_fields.platforms: per-platform expected fields + quality gates
 *   - candidates[]: businesses evaluated as potential gold standards, with
 *     per-platform evaluations (profile_url, quality_score, branding artifacts)
 *   - scan_metadata: provenance (scan date, sources, selection criteria)
 *   - .passthrough() allows forward-compatible fields
 *
 * Used by:
 *   - The external-import endpoint (validates pasted JSON)
 *   - The prompt suffix (appended to the scan template's exported prompt)
 *   - The post-import hook in importExternalResult() (establishment → draft profile)
 */

import { z } from 'zod';

export const GOLD_STANDARD_SCAN_SCHEMA_NAME = 'gold_standard_scan';

// ─── Enums ───────────────────────────────────────────────────────────────

const platformFocusEnum = z.enum([
  'all',
  'google',
  'yelp',
  'facebook',
  'bbb',
  'apple_maps',
  'bing',
]);

const qualityGateSeverityEnum = z.enum([
  'non_negotiable',
  'recommended',
]);

// ─── Quality Gate ────────────────────────────────────────────────────────

const qualityGateSchema = z.object({
  field: z.string().min(1),
  description: z.string().min(1),
  severity: qualityGateSeverityEnum,
}).passthrough();

// ─── Expected Field Definition ───────────────────────────────────────────

const expectedFieldSchema = z.object({
  field: z.string().min(1),
  description: z.string().min(1),
  /** Whether this field is required or recommended for gold-standard quality. */
  severity: qualityGateSeverityEnum.optional(),
}).passthrough();

// ─── Branding Artifacts ──────────────────────────────────────────────────

const brandingArtifactsSchema = z.object({
  has_logo: z.boolean().nullable().optional(),
  has_cover_photo: z.boolean().nullable().optional(),
  has_profile_photo: z.boolean().nullable().optional(),
  photo_count: z.number().nullable().optional(),
  photo_types: z.array(z.string()).optional(),
  /** Platform-specific visual asset notes (e.g. "GBP cover photo set"). */
  visual_assets: z.array(z.string()).optional(),
}).passthrough();

// ─── Platform Expected Fields ────────────────────────────────────────────

const platformExpectedFieldsSchema = z.object({
  /** Primary + additional categories the gold-standard profile should have. */
  primary_category: z.string().nullable().optional(),
  additional_categories: z.array(z.string()).optional(),
  /** Required/recommended attributes for this platform. */
  required_attributes: z.array(z.string()).optional(),
  recommended_attributes: z.array(z.string()).optional(),
  /** Description requirements (min length, keyword inclusion, etc.). */
  description_requirements: z.string().nullable().optional(),
  /** Page type or profile type classification. */
  page_type: z.string().nullable().optional(),
  /** Expected photo count for gold-standard quality. */
  expected_photo_count: z.number().nullable().optional(),
  /** Branding artifact expectations. */
  branding_expectations: brandingArtifactsSchema.optional(),
  /** Quality gates specific to this platform. */
  quality_gates: z.array(qualityGateSchema).optional(),
  /** Expected fields specific to this platform. */
  fields: z.array(expectedFieldSchema).optional(),
}).passthrough();

// ─── Universal Expected Fields ───────────────────────────────────────────

const universalExpectedFieldsSchema = z.object({
  /** Canonical business name the gold-standard profile should use. */
  canonical_name: z.string().nullable().optional(),
  /** Canonical address (street, city, state, zip). */
  canonical_address: z.string().nullable().optional(),
  /** Canonical phone number. */
  canonical_phone: z.string().nullable().optional(),
  /** Business hours should be present and accurate. */
  hours_present: z.boolean().nullable().optional(),
  /** Website should be present and functional. */
  website_present: z.boolean().nullable().optional(),
  /** Universal quality gates (apply to all platforms). */
  quality_gates: z.array(qualityGateSchema).optional(),
  /** Universal expected fields. */
  fields: z.array(expectedFieldSchema).optional(),
}).passthrough();

// ─── Platform Evaluation (per-candidate, per-platform) ───────────────────

const platformEvaluationSchema = z.object({
  /** The platform this evaluation is for (google, yelp, etc.). */
  platform: z.string().min(1),
  /** Live profile URL on this platform (the destination URL). */
  profile_url: z.string().nullable().optional(),
  /** Quality score 0-10 for this platform. */
  quality_score: z.number().nullable().optional(),
  /** Why this candidate scored this way on this platform. */
  quality_rationale: z.string().nullable().optional(),
  /** Whether this candidate qualifies as a gold standard on this platform. */
  is_gold_standard: z.boolean().nullable().optional(),
  /** Branding artifacts observed on this platform. */
  branding_artifacts: brandingArtifactsSchema.optional(),
  /** Platform-specific configuration notes (categories, attributes, etc.). */
  platform_config: z.record(z.string(), z.any()).optional(),
  /** Quality gates this candidate passed on this platform. */
  quality_gates_passed: z.array(z.string()).optional(),
  /** Quality gates this candidate failed on this platform. */
  quality_gates_failed: z.array(z.string()).optional(),
}).passthrough();

// ─── Candidate Business ──────────────────────────────────────────────────

const candidateBusinessSchema = z.object({
  business_name: z.string().min(1),
  city: z.string().optional(),
  state: z.string().optional(),
  /** NAP (name, address, phone) as observed. */
  nap: z.object({
    name: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
  }).passthrough().optional(),
  /** Ownership type — independent, small_group, franchise, or chain. */
  ownership_type: z.enum(['independent', 'small_group', 'franchise', 'chain']).nullable().optional(),
  /** Approximate number of locations (for independence verification). */
  location_count_estimate: z.number().nullable().optional(),
  /** Why this business qualifies as independent (or why it was excluded). */
  independence_rationale: z.string().nullable().optional(),
  /** Per-platform evaluations for this candidate. */
  platform_evaluations: z.array(platformEvaluationSchema).optional(),
  /** Category-specific notes (e.g. "African goods store with full butcher counter"). */
  category_notes: z.string().nullable().optional(),
}).passthrough();

// ─── Scan Metadata ───────────────────────────────────────────────────────

const scanMetadataSchema = z.object({
  scan_date: z.string().optional(),
  /** Sources consulted (Google, Yelp, industry directories, etc.). */
  sources_consulted: z.array(z.string()).optional(),
  /** Selection criteria used to identify gold-standard candidates. */
  selection_criteria: z.string().nullable().optional(),
  /** Platforms evaluated during the scan. */
  platforms_evaluated: z.array(z.string()).optional(),
  /** How expected fields were derived (from top candidates, category standards, etc.). */
  expected_field_derivation: z.string().nullable().optional(),
  /** The platform focus of this scan. */
  platform_focus: platformFocusEnum,
  /** Businesses considered but excluded (franchises, chains, etc.) with reasons. */
  excluded_candidates: z.array(z.object({
    business_name: z.string().min(1),
    reason: z.string().min(1),
  }).passthrough()).optional(),
}).passthrough();

// ─── Top-level schema ────────────────────────────────────────────────────

export const goldStandardScanSchema = z.object({
  category_key: z.string().min(1),
  category_name: z.string().min(1),
  platform_focus: platformFocusEnum,

  expected_fields: z.object({
    universal: universalExpectedFieldsSchema.optional(),
    platforms: z.record(z.string(), platformExpectedFieldsSchema).optional(),
  }).passthrough().optional(),

  candidates: z.array(candidateBusinessSchema).optional(),

  scan_metadata: scanMetadataSchema.optional(),
}).passthrough();

export type GoldStandardScanOutput = z.infer<typeof goldStandardScanSchema>;

// ─── Prompt suffix (appended to the scan template's prompt) ──────────────

export const GOLD_STANDARD_SCAN_PROMPT_SUFFIX = `
=== EXPECTED OUTPUT FORMAT ===
Return a single JSON object with this structure (the Gold Standard Scan result):
{
  "category_key": "<normalized category key, lowercase, spaces collapsed>",
  "category_name": "<display name>",
  "platform_focus": "all|google|yelp|facebook|bbb|apple_maps|bing",

  "expected_fields": {
    "universal": {
      "canonical_name": "<string|null>",
      "canonical_address": "<string|null>",
      "canonical_phone": "<string|null>",
      "hours_present": <boolean|null>,
      "website_present": <boolean|null>,
      "quality_gates": [
        { "field": "<string>", "description": "<string>", "severity": "non_negotiable|recommended" }
      ],
      "fields": [
        { "field": "<string>", "description": "<string>", "severity": "non_negotiable|recommended" }
      ]
    },
    "platforms": {
      "google": {
        "primary_category": "<string|null>",
        "additional_categories": ["<string>", ...],
        "required_attributes": ["<string>", ...],
        "recommended_attributes": ["<string>", ...],
        "description_requirements": "<string|null>",
        "page_type": "<string|null>",
        "expected_photo_count": <number|null>,
        "branding_expectations": {
          "has_logo": <boolean|null>,
          "has_cover_photo": <boolean|null>,
          "has_profile_photo": <boolean|null>,
          "photo_count": <number|null>,
          "photo_types": ["<string>", ...],
          "visual_assets": ["<string>", ...]
        },
        "quality_gates": [
          { "field": "<string>", "description": "<string>", "severity": "non_negotiable|recommended" }
        ],
        "fields": [
          { "field": "<string>", "description": "<string>", "severity": "non_negotiable|recommended" }
        ]
      },
      "yelp": { ...same structure... },
      "facebook": { ...same structure... }
    }
  },

  "candidates": [
    {
      "business_name": "<string>",
      "city": "<string>",
      "state": "<string>",
      "nap": {
        "name": "<string|null>",
        "address": "<string|null>",
        "phone": "<string|null>"
      },
      "ownership_type": "independent|small_group|franchise|chain",
      "location_count_estimate": <number|null>,
      "independence_rationale": "<string: why this business qualifies as independent>",
      "platform_evaluations": [
        {
          "platform": "google|yelp|facebook|bbb|apple_maps|bing",
          "profile_url": "<string|null> (the live profile URL on this platform)",
          "quality_score": <number 0-10>,
          "quality_rationale": "<string>",
          "is_gold_standard": <boolean>,
          "branding_artifacts": {
            "has_logo": <boolean|null>,
            "has_cover_photo": <boolean|null>,
            "has_profile_photo": <boolean|null>,
            "photo_count": <number|null>,
            "photo_types": ["<string>", ...],
            "visual_assets": ["<string>", ...]
          },
          "platform_config": { "<key>": "<value>", ... },
          "quality_gates_passed": ["<gate field name>", ...],
          "quality_gates_failed": ["<gate field name>", ...]
        }
      ],
      "category_notes": "<string|null>"
    }
  ],

  "scan_metadata": {
    "scan_date": "<ISO date>",
    "sources_consulted": ["<source name>", ...],
    "selection_criteria": "<string>",
    "platforms_evaluated": ["google", "yelp", ...],
    "expected_field_derivation": "<string>",
    "platform_focus": "all|google|yelp|facebook|bbb|apple_maps|bing",
    "excluded_candidates": [
      { "business_name": "<string>", "reason": "<string: why excluded (franchise/chain/etc.)>" }
    ]
  }
}

Rules:
- For establishment scans: find the best 3-5 candidate businesses nationwide
  for this category on the target platform(s). Derive expected_fields from
  what the top candidates have in common. Evaluate each candidate per platform
  with quality_score, is_gold_standard flag, and branding artifacts.
- For discovery scans: evaluate additional candidates against the already-
  established expected_fields and quality gates. Mark is_gold_standard for
  candidates that meet the bar.
- profile_url is the LIVE destination URL on the platform (e.g.
  "https://www.google.com/maps/place/..."). Always capture this — it becomes
  the exemplar URL shown to operators and referenced in audit benchmarks.
- branding_artifacts capture what the candidate has (logo, cover photo, photo
  count, photo types). These become branding quality gates and audit gap inputs.
- quality_gates use severity "non_negotiable" for must-have fields and
  "recommended" for nice-to-have fields.
- category_key should be the normalized (lowercase, whitespace-collapsed) category name.
- Up to 4 candidates per platform should be flagged is_gold_standard = true.
- INDEPENDENT BUSINESSES ONLY. Only independent or small locally-owned groups
  (<= ~10 locations) qualify as gold-standard candidates. Franchises, chains,
  and corporate subsidiaries must be excluded and noted in
  scan_metadata.excluded_candidates with the business name and exclusion reason.
  Each candidate MUST include ownership_type, location_count_estimate, and
  independence_rationale. A candidate with ownership_type "franchise" or "chain"
  cannot have is_gold_standard = true.
- Aim for geographic diversity: select candidates across at least 3 distinct
  states/regions when possible to avoid coastal/metro clustering.
`;
