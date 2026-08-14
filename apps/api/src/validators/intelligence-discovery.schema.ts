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
  url: z.string().optional(),
  accessed_at: z.string().optional(),
}).passthrough();

// ─── Discovered Business Candidate ───────────────────────────────────────

const discoveredBusinessSchema = z.object({
  business_name: z.string(),
  category: z.string(),
  city: z.string(),
  state: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
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
}).passthrough();

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
      "review_count": <number or null>
    }
  ],
  "qualifying_businesses": [<same structure — excludes outside_market, national_chain, national_franchise, regional_chain>],
  "candidate_count": <number>,
  "qualifying_count": <number>,
  "hold_count": <number>,
  "category_definition": "<text>",
  "geographic_classification_notes": "<text>",
  "ownership_exclusion_notes": "<text>",
  "profile_id": "<profile id or null>",
  "profile_version": <number or null>
}

Rules:
- discovered_businesses is the full set found; qualifying_businesses excludes outside_market, national_chain, national_franchise, and regional_chain.
- discovery_signals MUST use INT_* codes only. Do NOT use RA/DS/WC/CP/VP signal codes.
- If identity_confidence is "low", business_seek_priority MUST be "hold".
- If category_fit is "insufficient", business_seek_priority MUST be "hold" OR business_seek_recommended MUST be false.
- Do NOT infer a deficiency from absence of evidence. Record what you found and what you could not verify as separate observations.
`;
