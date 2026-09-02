/**
 * Intelligence Discovery Output Schema
 *
 * Validates the output of Intelligence-scope discovery audits (spec §O1).
 * This is a discovery-only schema — it produces discovered businesses with
 * discovery signals (INT_* family), NOT business audit signals (RA/DS/WC/CP/VP).
 *
 * Key structural guarantees (§31):
 *   - No Business-Audit signal fields present (structural separation)
 *   - discovery_signals use INT_* codes only
 *   - outside_market candidates are excluded from the final qualifying set
 *   - identity_confidence conflict → business_seek_priority = 'hold'
 *   - category_fit = 'insufficient' → business_seek_priority = 'hold' or
 *     business_seek_recommended = false
 *   - .passthrough() allows forward-compatible fields
 *
 * Used by:
 *   - The external-import endpoint (validates pasted JSON)
 *   - The prompt suffix (appended to exported prompt text)
 *   - The queue ingestion service (maps candidates to queue rows)
 */

import { z } from 'zod';

export const INTELLIGENCE_DISCOVERY_SCHEMA_NAME = 'intelligence_discovery';

// ─── Enum preprocessors (tolerant — mirror city-category-opportunity.schema.ts) ───

const locationStatusEnum = z.enum(['inside_city', 'adjacent_city', 'metro_area', 'outside_market']);
const categoryFitEnum = z.enum(['verified', 'probable', 'insufficient']);
const identityConfidenceEnum = z.enum(['high', 'medium', 'low']);
const businessSeekPriorityEnum = z.enum(['high', 'medium', 'low', 'hold']);
const ownershipTypeEnum = z.enum([
  'independent',
  'local_chain',
  'franchise',
  'national_chain',
  'national_franchise',
  'regional_chain',
  'unknown',
]);

// ─── Discovery Provenance ────────────────────────────────────────────────

const discoveryProvenanceSchema = z.object({
  source: z.string(),
  role: z.string(),
  evidence_types: z.array(z.string()).optional(),
  // url/accessed_at are nullable (not just optional) to match the tolerance
  // for `null` emissions on the parent business fields (address/phone/website/
  // gbp_url). Models emit `null` when a source has no clean URL (e.g. a
  // Facebook page discovered via social-first search without a canonical URL).
  url: z.string().nullable().optional(),
  accessed_at: z.string().nullable().optional(),
}).passthrough();

// ─── Discovered Business Candidate ───────────────────────────────────────

const discoveredBusinessSchema = z.object({
  business_name: z.string(),
  category: z.string(),
  city: z.string(),
  state: z.string().optional(),
  // address/phone are nullable (not just optional) to match website/gbp_url:
  // models reasonably emit `null` for "unknown" rather than omitting the key.
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  website: z.string().nullable().optional(),
  gbp_url: z.string().nullable().optional(),

  // Geographic classification (§G2)
  location_status: locationStatusEnum,

  // Ownership classification (§G2 — chain/franchise exclusion)
  ownership_type: ownershipTypeEnum,

  // Discovery assessment
  category_fit: categoryFitEnum,
  identity_confidence: identityConfidenceEnum,

  // Discovery signals (INT_* family only — §S1)
  discovery_signals: z.array(z.string()),

  // Discovery provenance (§E2)
  discovery_provenance: z.array(discoveryProvenanceSchema),

  // Business Seek routing
  business_seek_recommended: z.boolean(),
  business_seek_priority: businessSeekPriorityEnum,

  // Rating/reviews (optional — may not be available for thin-footprint businesses)
  rating: z.number().nullable().optional(),
  review_count: z.number().nullable().optional(),

  // Gold standard rating (optional — present only when a gold-standard
  // discovery benchmark block was injected into the prompt). Forward-compatible:
  // legacy payloads without these fields import cleanly via .passthrough().
  gold_standard_match: z.boolean().nullable().optional(),
  gold_standard_gate_results: z.array(
    z.object({
      gate: z.string(),
      passed: z.boolean(),
      platform: z.string().optional(),
    }).passthrough(),
  ).nullable().optional(),
}).passthrough();

// ─── Top-level schema ────────────────────────────────────────────────────

export const intelligenceDiscoverySchema = z.object({
  intelligence_mode: z.enum(['profile', 'generic_fallback']),
  category: z.string(),
  city: z.string(),
  state: z.string().optional(),
  focus: z.enum(['emerging', 'competitive']),

  // The full candidate list as discovered (includes outside_market)
  discovered_businesses: z.array(discoveredBusinessSchema),

  // The qualifying set (outside_market + national_chain + national_franchise +
  // regional_chain excluded — these are filtered out before qualifying)
  qualifying_businesses: z.array(discoveredBusinessSchema),

  // Summary counts
  candidate_count: z.number(),
  qualifying_count: z.number(),
  hold_count: z.number(),

  // Category-level context
  category_definition: z.string().optional(),
  geographic_classification_notes: z.string().optional(),
  ownership_exclusion_notes: z.string().optional(),

  // Provenance
  profile_id: z.string().nullable().optional(),
  profile_version: z.number().nullable().optional(),

  // Platform-aware analysis (optional — present only when a gold-standard
  // discovery benchmark block was injected). Introduces platform awareness
  // into emerging/competitive discovery scans for the first time. When absent
  // (no gold standard), this section is omitted entirely.
  platform_analysis: z.object({
    // Gold standard reference for traceability
    gold_standard_profile_id: z.string().nullable(),
    gold_standard_profile_version: z.number().nullable(),
    gold_standard_platform: z.string().nullable(),

    // Per-platform presence + benchmarking
    platform_breakdown: z.array(
      z.object({
        platform: z.string(),
        present_count: z.number(),
        absent_count: z.number(),
        meets_gold_standard_count: z.number(),
        common_gate_failures: z.array(
          z.object({
            gate: z.string(),
            failed_count: z.number(),
          }).passthrough(),
        ).optional(),
      }).passthrough(),
    ).optional(),

    // Category-level benchmarking summary
    candidates_meeting_all_gates: z.number(),
    most_common_gate_failures: z.array(
      z.object({
        gate: z.string(),
        failed_count: z.number(),
        severity: z.enum(['non_negotiable', 'recommended']).optional(),
      }).passthrough(),
    ).optional(),

    // Platform-aware outreach recommendations
    outreach_recommendation: z.object({
      primary_platform: z.string(),
      platform_rationale: z.string(),
      platform_specific_opportunities: z.array(
        z.object({
          platform: z.string(),
          opportunity: z.string(),
          evidence_summary: z.string(),
        }).passthrough(),
      ).optional(),
      recommended_platform_focus: z.string(),
      primary_angle: z.string(),
      suggested_call_to_action: z.string(),
    }).passthrough(),
  }).passthrough().optional(),
}).passthrough();

// ─── Payload normalization (reference-style + missing qualifying_businesses) ───
//
// Two model-emission quirks are normalized here so operators don't have to
// re-run discovery when the model gets the envelope shape slightly wrong:
//
// 1. Reference-style qualifying_businesses: some models emit
//    `qualifying_businesses` as entries that point back to
//    `discovered_businesses` rather than duplicating the full record, e.g.:
//      { "business_name": "His Grace African Grocery Store",
//        "note": "See discovered_businesses — identical record, qualifies" }
//    The schema requires full business objects, so this normalizer resolves
//    any reference-style entry by looking up its `business_name` in
//    `discovered_businesses` and substituting the full record. Extra fields on
//    the reference entry (e.g. `note`) are preserved via passthrough.
//
//    An entry is treated as reference-style when it has a `business_name` but
//    is missing the required `location_status` field (a required enum that a
//    full record always carries). Unmatched references are left untouched so
//    the validator surfaces a clear, field-level error.
//
// 2. Missing qualifying_businesses: some models emit only
//    `discovered_businesses` and omit `qualifying_businesses` entirely, even
//    though the prompt suffix requires it. Rather than reject the payload, we
//    derive `qualifying_businesses` from `discovered_businesses` by applying
//    the same exclusion rules the schema's refinements enforce (§31):
//    exclude `outside_market` and the chain/franchise ownership types
//    (`national_chain`, `national_franchise`, `regional_chain`). This mirrors
//    exactly what the prompt tells the model to do, so a model that lists only
//    qualifying candidates in `discovered_businesses` still imports cleanly.

const EXCLUDED_OWNERSHIP_TYPES = new Set([
  'national_chain',
  'national_franchise',
  'regional_chain',
]);

function isQualifyingCandidate(biz: any): boolean {
  if (!biz || typeof biz !== 'object') return false;
  if (biz.location_status === 'outside_market') return false;
  if (EXCLUDED_OWNERSHIP_TYPES.has(biz.ownership_type)) return false;
  return true;
}

export function normalizeIntelligenceDiscoveryPayload(parsed: any): any {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const discovered: any[] = Array.isArray(parsed.discovered_businesses) ? parsed.discovered_businesses : [];
  if (discovered.length === 0) return parsed;

  // Case 2: qualifying_businesses missing entirely → derive from discovered.
  if (!Array.isArray(parsed.qualifying_businesses)) {
    return {
      ...parsed,
      qualifying_businesses: discovered.filter(isQualifyingCandidate),
    };
  }

  const qualifying: any[] = parsed.qualifying_businesses;

  const byName = new Map<string, any>();
  for (const d of discovered) {
    if (d && typeof d.business_name === 'string') {
      // First occurrence wins; duplicates are rare and would be ambiguous anyway.
      if (!byName.has(d.business_name)) byName.set(d.business_name, d);
    }
  }

  const resolved = qualifying.map((q) => {
    if (!q || typeof q !== 'object') return q;
    // Full records already carry location_status → leave as-is.
    if (q.location_status !== undefined) return q;
    const name = typeof q.business_name === 'string' ? q.business_name : undefined;
    if (!name) return q;
    const full = byName.get(name);
    if (!full) return q;
    // Merge: start from the full record, then overlay any extra keys from the
    // reference entry (e.g. `note`) so provenance of the reference is retained.
    return { ...full, ...q };
  });

  return { ...parsed, qualifying_businesses: resolved };
}

// ─── Cross-field refinements (hold conditions) ───────────────────────────

export const intelligenceDiscoverySchemaWithRefinements = intelligenceDiscoverySchema.superRefine((data, ctx) => {
  // outside_market candidates must NOT appear in qualifying_businesses
  for (let i = 0; i < data.qualifying_businesses.length; i++) {
    const biz = data.qualifying_businesses[i];
    if (biz.location_status === 'outside_market') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `qualifying_businesses[${i}] has location_status "outside_market" — must be excluded from the qualifying set`,
        path: ['qualifying_businesses', i, 'location_status'],
      });
    }
    // Chain/franchise exclusion
    if (biz.ownership_type === 'national_chain' || biz.ownership_type === 'national_franchise' || biz.ownership_type === 'regional_chain') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `qualifying_businesses[${i}] has ownership_type "${biz.ownership_type}" — must be excluded from the qualifying set`,
        path: ['qualifying_businesses', i, 'ownership_type'],
      });
    }
    // identity_confidence conflict → hold
    if (biz.identity_confidence === 'low' && biz.business_seek_priority !== 'hold') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `qualifying_businesses[${i}] has identity_confidence "low" — business_seek_priority must be "hold"`,
        path: ['qualifying_businesses', i, 'business_seek_priority'],
      });
    }
    // category_fit insufficient → hold or not recommended
    if (biz.category_fit === 'insufficient' && biz.business_seek_priority !== 'hold' && biz.business_seek_recommended !== false) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `qualifying_businesses[${i}] has category_fit "insufficient" — business_seek_priority must be "hold" or business_seek_recommended must be false`,
        path: ['qualifying_businesses', i, 'category_fit'],
      });
    }
  }
});

// ─── Prompt suffix (appended to exported prompt text) ────────────────────

export const INTELLIGENCE_DISCOVERY_PROMPT_SUFFIX = `
=== EXPECTED OUTPUT FORMAT ===
Return a single JSON object with this structure:
{
  "intelligence_mode": "profile" | "generic_fallback",
  "category": "<category name>",
  "city": "<city name>",
  "state": "<state>",
  "focus": "emerging" | "competitive",
  "discovered_businesses": [
    {
      "business_name": "<name>",
      "category": "<category>",
      "city": "<city>",
      "state": "<state>",
      "address": "<address if known>",
      "phone": "<phone if known>",
      "website": "<url or null>",
      "gbp_url": "<gbp url or null>",
      "location_status": "inside_city" | "adjacent_city" | "metro_area" | "outside_market",
      "ownership_type": "independent" | "local_chain" | "franchise" | "national_chain" | "national_franchise" | "regional_chain" | "unknown",
      "category_fit": "verified" | "probable" | "insufficient",
      "identity_confidence": "high" | "medium" | "low",
      "discovery_signals": ["INT_*", ...],
      "discovery_provenance": [
        { "source": "<source name>", "role": "<role>", "evidence_types": ["..."], "url": "<url>", "accessed_at": "<date>" }
      ],
      "business_seek_recommended": true | false,
      "business_seek_priority": "high" | "medium" | "low" | "hold",
      "rating": <number or null>,
      "review_count": <number or null>,
      "gold_standard_match": <true | false | null — ONLY when a GOLD STANDARD DISCOVERY BENCHMARK block is present in the prompt; null when no gold standard block>,
      "gold_standard_gate_results": [
        { "gate": "<gate name>", "passed": <true | false>, "platform": "<platform name, optional>" }
      ]
    }
  ],
  "qualifying_businesses": [<FULL duplicate records — same structure as discovered_businesses, excludes outside_market, national_chain, national_franchise, regional_chain. Do NOT emit references like {"business_name": "...", "note": "see discovered_businesses"} — repeat the complete record for each qualifying business>],
  "candidate_count": <number>,
  "qualifying_count": <number>,
  "hold_count": <number>,
  "category_definition": "<text>",
  "geographic_classification_notes": "<text>",
  "ownership_exclusion_notes": "<text>",
  "profile_id": "<profile id or null>",
  "profile_version": <number or null>,
  "platform_analysis": {
    "gold_standard_profile_id": "<gold standard profile id or null>",
    "gold_standard_profile_version": <number or null>,
    "gold_standard_platform": "<platform name or null for cross-platform>",
    "platform_breakdown": [
      {
        "platform": "<google | yelp | facebook | bbb | apple_maps | bing | ...>",
        "present_count": <number of candidates with a presence on this platform>,
        "absent_count": <number of candidates with no presence on this platform>,
        "meets_gold_standard_count": <number of candidates that pass ALL non_negotiable gates on this platform>,
        "common_gate_failures": [
          { "gate": "<gate name>", "failed_count": <number> }
        ]
      }
    ],
    "candidates_meeting_all_gates": <number of candidates that pass ALL non_negotiable gates across all platforms where they have a presence>,
    "most_common_gate_failures": [
      { "gate": "<gate name>", "failed_count": <number>, "severity": "non_negotiable" | "recommended" }
    ],
    "outreach_recommendation": {
      "primary_platform": "<platform to lead outreach with — where the gold standard is deepest AND where candidates have the most fixable gaps>",
      "platform_rationale": "<why this platform leads for this category/city>",
      "platform_specific_opportunities": [
        { "platform": "<platform>", "opportunity": "<e.g. 12 candidates missing GBP primary category>", "evidence_summary": "<text>" }
      ],
      "recommended_platform_focus": "<platform that downstream business audits should target>",
      "primary_angle": "<outreach angle>",
      "suggested_call_to_action": "<CTA>"
    }
  }
}

Rules:
- discovered_businesses is the full set found; qualifying_businesses excludes outside_market, national_chain, national_franchise, and regional_chain.
- qualifying_businesses MUST contain full duplicate records (every field), NOT references or summaries. Each entry must be a complete business object identical in shape to its discovered_businesses counterpart.
- discovery_signals MUST use INT_* codes only. Do NOT use RA/DS/WC/CP/VP signal codes.
- If identity_confidence is "low", business_seek_priority MUST be "hold".
- If category_fit is "insufficient", business_seek_priority MUST be "hold" OR business_seek_recommended MUST be false.
- Do NOT infer a deficiency from absence of evidence. Record what you found and what you could not verify as separate observations.
- GOLD STANDARD RATING: When a "=== GOLD STANDARD DISCOVERY BENCHMARK ===" block is present in the prompt, populate gold_standard_match and gold_standard_gate_results per candidate (rate each candidate per-platform against the established expected fields and quality gates), and populate the platform_analysis section with per-platform presence counts, gate-failure aggregation, and platform-aware outreach recommendations. The primary_platform should be where the gold standard is deepest AND where candidates have the most fixable gaps (highest-opportunity platform for outreach, not just the most-present platform). The recommended_platform_focus tells downstream business audits which platform to target.
- When NO gold standard block is present (degraded mode), OMIT gold_standard_match, gold_standard_gate_results, and platform_analysis entirely. Rate candidates on category-general heuristics only.
`;
