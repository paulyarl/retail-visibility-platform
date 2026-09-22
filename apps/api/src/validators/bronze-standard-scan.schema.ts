/**
 * Bronze Standard Scan Output Schema (Bronze Standard System)
 *
 * Validates the output of bronze-standard establishment (stage 1 —
 * nationwide or market-scoped) and city discovery (stage 2) scans.
 * Spec: docs/LocalBiz/BRONZE_STANDARD_SPEC.md §4.
 *
 * The bronze profile maps what INVISIBLE looks like for a category: its
 * slots are typed by WHY a business is invisible (a discovery blind spot =
 * a discovery vector), and each slot holds the lowest digital quality that
 * still qualifies as a real, operating, category-fit business — a floor,
 * not a ranking.
 *
 * Two campaign kinds produce this schema — the post-import hook in
 * importExternalResult() persists a DRAFT profile for BOTH (keyed on the
 * schema name, not campaign kind, spec §6.1):
 *   - establishment (stage 1 — nationwide or market-scoped): embeds a
 *     revision-stamped snapshot of the scope-applicable reason catalog +
 *     proof slots.
 *   - discovery (stage 2, city): fills city reason slots, reporting the
 *     three-state coverage vocabulary and the vector execution log.
 *   Discovery-kind bronze imports do NOT create an audit row
 *   (auditPlatform: null in OUTPUT_SCHEMA_REGISTRY).
 *
 * Key structural requirements (§4):
 *   - reason_coverage[].status is the three-state vocabulary
 *     (filled | empty_unproven | empty_proven_elsewhere) — the §6.2.2
 *     mandatory distinction. Reasons that fail the scope predicate are not
 *     coverage entries; they go in not_applicable_reasons.
 *   - discovered_by provenance is mandatory per slot (§7.2 — ground truth
 *     vs confirmatory fills).
 *   - platform_presence + observed_platform + digital_quality are
 *     controlled vocabularies — the emitted profile is a calibration
 *     artifact other prompts consume, not free text.
 *   - catalog_revision is stamped from mkt_bronze_catalog_meta at scan time.
 *   - .passthrough() allows forward-compatible fields.
 */

import { z } from 'zod';

export const BRONZE_STANDARD_SCAN_SCHEMA_NAME = 'bronze_standard_scan';

// ─── Enums ───────────────────────────────────────────────────────────────

/** §4.1 — the three-state coverage vocabulary (never conflated, §6.2.2). */
const reasonCoverageStatusEnum = z.enum([
  'filled',
  'empty_unproven',
  'empty_proven_elsewhere',
]);

/** §4.3 — fill provenance. Ground truth vs confirmatory is load-bearing. */
const discoveredByEnum = z.enum([
  'operator_self_discovery',
  'business_audit',
  'emerging_scan',
  'competitive_scan',
  'bronze_establishment_scan',
]);

/**
 * Gold platform vocabulary (matches gold-standard-scan.schema.ts minus
 * 'all'). NULL on a slot means the reason is not platform-anchored.
 */
const observedPlatformEnum = z.enum([
  'google',
  'yelp',
  'facebook',
  'bbb',
  'apple_maps',
  'bing',
]);

/** §4.2 — per-platform presence vocabulary. Controlled, not free text. */
const platformPresenceEnum = z.enum([
  'present_generic_category',
  'present_category_aligned',
  'present_unclaimed',
  'not_verified',
  'absent',
  'hosted_storefront_unverified',
]);

/** §4.2 — "thin" vs "nearly absent"; never a ranking. */
const digitalQualityEnum = z.enum(['low', 'very_low']);

// ─── Slot ────────────────────────────────────────────────────────────────

const bronzeSlotSchema = z.object({
  business_name: z.string().min(1),
  /** Street address / locality for dedupe within the reason (§7.3). */
  address: z.string().nullable().optional(),
  /** §3.6.5 — which platform the reason was observed on (platform-anchored reasons only). */
  observed_platform: observedPlatformEnum.nullable().optional(),
  /** Assortment evidence, NOT the platform's category label (§5.2 gate 1). */
  category_fit_evidence: z.string().optional(),
  /** Operational verification — active or likely_active; unable_to_verify never fills a slot (§5.2 gate 2). */
  operational_evidence: z.string().optional(),
  operational_status: z.enum(['active', 'likely_active', 'unable_to_verify']).nullable().optional(),
  /** Provenance is mandatory (§7.2). */
  discovered_by: discoveredByEnum,
  /** What vector/surface produced the find (e.g. "US Customs bill of lading records"). */
  discovered_via: z.string().nullable().optional(),
  evidence_urls: z.array(z.string()).optional(),
  digital_quality: digitalQualityEnum.optional(),
  platform_presence: z.record(z.string(), platformPresenceEnum).optional(),
}).passthrough();

// ─── Reason coverage entry ───────────────────────────────────────────────

const reasonCoverageSchema = z.object({
  reason_key: z.string().min(1),
  status: reasonCoverageStatusEnum,
  slots: z.array(bronzeSlotSchema).optional(),
  /** Execution outcome for empty slots — "executed, returned 0" vs "not executed" (§4.1). */
  empty_slot_note: z.string().nullable().optional(),
}).passthrough();

// ─── Suggested reason (analyst-detected uncataloged blind spot) ───────────

const suggestedReasonExemplarLeadSchema = z.object({
  business_name: z.string().min(1),
  address: z.string().nullable().optional(),
  observed_platform: observedPlatformEnum.nullable().optional(),
  discovery_vector: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

const suggestedReasonSchema = z.object({
  reason_key: z.string().optional(),
  proposed_label: z.string().min(1),
  proposed_definition: z.string().min(1),
  observed_signals: z.array(z.string()).default([]),
  expected_vectors: z.array(z.string()).optional(),
  scope_level: z.enum(['universal', 'category', 'category_family', 'location']).optional(),
  /**
   * Signal indicating whether this blind spot generalizes across a category
   * family (e.g. grocery, food service, specialty trade) or is strictly
   * narrow to this specific category.
   */
  category_family_applicable: z.boolean().optional(),
  /**
   * The suggested category or category family scope (e.g. "grocery" instead of
   * "african grocery store", or null if universal).
   */
  suggested_category_scope: z.string().nullable().optional(),
  suggested_scope_platform: observedPlatformEnum.nullable().optional(),
  exemplar_lead: suggestedReasonExemplarLeadSchema.optional(),
}).passthrough();

// ─── Catalog snapshot row (establishment profiles embed these) ──────────

const catalogSnapshotRowSchema = z.object({
  reason_key: z.string().min(1),
  label: z.string().optional(),
  definition: z.string().optional(),
  signals: z.array(z.string()).optional(),
  expected_vectors: z.array(z.string()).optional(),
  priority: z.number().nullable().optional(),
  scope_category_key: z.string().nullable().optional(),
  scope_city: z.string().nullable().optional(),
  scope_state: z.string().nullable().optional(),
  scope_platform: z.string().nullable().optional(),
  provenance: z.string().nullable().optional(),
}).passthrough();

// ─── Top-level schema ────────────────────────────────────────────────────

export const bronzeStandardScanSchema = z.object({
  category_key: z.string().min(1),
  category_name: z.string().min(1),
  /** Set when the scan is market-scoped; null for nationwide runs. */
  reference_city: z.string().nullable().optional(),
  reference_state: z.string().nullable().optional(),
  /** null = cross-platform (default); a platform-scoped profile filters the reason set (§3.6.5). */
  reference_platform: observedPlatformEnum.nullable().optional(),
  /** Stamped from mkt_bronze_catalog_meta at scan time (§3.5.2). */
  catalog_revision: z.number().int(),

  /** §3 — stage-1 profiles embed the scope-applicable catalog rows verbatim. */
  catalog_snapshot: z.array(catalogSnapshotRowSchema).optional(),

  reason_coverage: z.array(reasonCoverageSchema).optional(),

  /** Reasons that failed the scope predicate — keys only, never coverage entries (§4.1). */
  not_applicable_reasons: z.array(z.string()).optional(),

  /**
   * Uncataloged blind spots detected during the scan. When an analyst identifies
   * a verified operating, category-fit business obscured by an uncataloged discovery
   * mechanism, they propose it here rather than force-fitting it into an existing reason.
   */
  suggested_reasons: z.array(suggestedReasonSchema).optional(),

  /** Portable/locale ratio visibility (§3.6.3). */
  scope_mix: z.object({
    universal: z.number().int().optional(),
    category: z.number().int().optional(),
    location: z.number().int().optional(),
    category_location: z.number().int().optional(),
    platform_bound: z.number().int().optional(),
  }).passthrough().optional(),

  /** Every vector attempt — executed vs returned are recorded separately (§8). */
  vector_execution_log: z.array(z.object({
    vector: z.string().min(1),
    executed: z.boolean(),
    returned: z.number().int().nullable().optional(),
  }).passthrough()).optional(),

  prohibited_inferences: z.array(z.string()).optional(),

  scan_metadata: z.record(z.string(), z.any()).optional(),
}).passthrough();

export type BronzeStandardScanOutput = z.infer<typeof bronzeStandardScanSchema>;

// ─── Prompt suffix (appended to the scan template's prompt) ──────────────

export const BRONZE_STANDARD_SCAN_PROMPT_SUFFIX = `
=== EXPECTED OUTPUT FORMAT ===
Return a single JSON object with this structure (the Bronze Standard Scan result):
{
  "category_key": "<normalized category key, lowercase, spaces collapsed>",
  "category_name": "<display name>",
  "reference_city": "<string|null — set when the SEARCH SCOPE is region-narrowed, null for nationwide>",
  "reference_state": "<string|null — 2-letter code>",
  "reference_platform": "<null|google|yelp|facebook|bbb|apple_maps|bing>",
  "catalog_revision": <integer — echo the catalog revision from the injected catalog block>,

  "catalog_snapshot": [
    {
      "reason_key": "<string>",
      "label": "<string>",
      "definition": "<string>",
      "signals": ["<string>", ...],
      "expected_vectors": ["<string>", ...],
      "priority": <number|null>,
      "scope_category_key": "<string|null>",
      "scope_city": "<string|null>",
      "scope_state": "<string|null>",
      "scope_platform": "<string|null>",
      "provenance": "derived|operator_authored"
    }
  ],

  "reason_coverage": [
    {
      "reason_key": "<string — must be a key from the catalog>",
      "status": "filled|empty_unproven|empty_proven_elsewhere",
      "slots": [
        {
          "business_name": "<string>",
          "address": "<string|null>",
          "observed_platform": "<null|google|yelp|facebook|bbb|apple_maps|bing>",
          "category_fit_evidence": "<string — observable assortment evidence, NOT a category label>",
          "operational_evidence": "<string — why the business is verified operating>",
          "operational_status": "active|likely_active",
          "discovered_by": "operator_self_discovery|business_audit|emerging_scan|competitive_scan|bronze_establishment_scan",
          "discovered_via": "<string|null — the vector/surface that produced the find>",
          "evidence_urls": ["<url>", ...],
          "digital_quality": "low|very_low",
          "platform_presence": {
            "google": "present_generic_category|present_category_aligned|present_unclaimed|not_verified|absent|hosted_storefront_unverified",
            "yelp": "<same vocabulary>",
            "facebook": "<same vocabulary>"
          }
        }
      ],
      "empty_slot_note": "<string|null — required for empty slots: what was executed and what it returned>"
    }
  ],

  "not_applicable_reasons": ["<reason_key>", ...],

  "suggested_reasons": [
    {
      "proposed_label": "<human-readable short name for the blind spot>",
      "proposed_definition": "<why this blind spot hides businesses and how discovery fails>",
      "observed_signals": ["<observable signal 1>", ...],
      "expected_vectors": ["<vector that surfaced or would surface this blind spot>", ...],
      "scope_level": "universal|category|category_family|location",
      "category_family_applicable": <true if this blind spot applies to a category family/niche (e.g. grocery, food service), false if narrow to this specific category only>,
      "suggested_category_scope": "<suggested broader category or family key e.g. 'grocery', or null if universal>",
      "suggested_scope_platform": "<null|google|yelp|facebook|bbb|apple_maps|bing>",
      "exemplar_lead": {
        "business_name": "<string>",
        "observed_platform": "<null|platform>",
        "address": "<string|null>",
        "discovery_vector": "<string>",
        "notes": "<string>"
      }
    }
  ],

  "scope_mix": {
    "universal": <int>, "category": <int>, "location": <int>,
    "category_location": <int>, "platform_bound": <int>
  },

  "vector_execution_log": [
    { "vector": "<string>", "executed": <boolean>, "returned": <int|null> }
  ],

  "prohibited_inferences": ["<string>", ...]
}

Rules:
- EVERY applicable catalog reason produces exactly one reason_coverage entry.
  A reason that fails the scope predicate is NOT a coverage entry — list its
  key in not_applicable_reasons instead.
- status is the three-state vocabulary and is NEVER conflated:
    filled                  — at least one qualifying exemplar found in this market this pass
    empty_unproven          — no exemplar here, and none ever found at any evaluable scope
    empty_proven_elsewhere  — no exemplar here, but proven at national scope or another market
- A slot qualifies ONLY when all three hold (§5.2): category-qualified by
  observable assortment evidence (not the platform's category label),
  operationally verified (operational_status active or likely_active —
  unable_to_verify does NOT qualify), and low digital quality in a way the
  reason explains.
- PHYSICAL RETAIL STOREFRONT MANDATE: The platform's mission is to make physical
  shelves visible for businesses where customers walk through the door. A business
  with inventory but no physical walk-in retail outlet (e.g. delivery-app-only /
  DoorDash virtual listing, ghost kitchen, dark store, warehouse-only, online-only)
  is strictly DISQUALIFIED, no matter how strong the category or assortment signal.
  Every qualifying bronze slot MUST be an operating physical storefront with walk-in
  customer access.
- discovered_by is mandatory per slot. discovered_by values other than
  bronze_establishment_scan are for slots carried forward from out-of-loop
  fills — a scan's own fills use the scan's provenance.
- observed_platform is set only for platform-anchored reasons
  (absent_from_platform, unclaimed_profile, and the field-gap family): it names
  the platform the reason was observed on. null for non-platform reasons.
- empty_slot_note is required for every non-filled entry and records the
  EXECUTION outcome — "executed, returned 0" is materially different from
  "not executed". Mirror it in vector_execution_log: an unexecuted vector is
  an admitted blind spot, never a silent gap.
- catalog_revision echoes the revision stamped on the injected catalog block.
  For establishment scans, catalog_snapshot embeds the scope-applicable
  catalog rows verbatim so the profile stays interpretable after the catalog
  moves on.
- Cap slots at 2 per reason — two exemplars calibrate; more is token cost
  without marginal signal. Emit the empty-slot report for unfilled reasons;
  do NOT emit the full platform x reason grid.
- UNCATALOGED BLIND SPOT SUGGESTIONS: If you detect a verified operating business
  with category assortment fit that is invisible due to a distinct discovery
  mechanism NOT in the catalog, do NOT force-fit it into an existing reason slot.
  Suggest it under suggested_reasons. Propose a label, definition, observed
  signals, expected vectors, and set category_family_applicable (true/false) to
  signal whether the blind spot generalizes across the category family or is
  specific to this exact category. A suggested reason must describe a DISCOVERY
  MECHANIC (why it is hidden), never a business attribute (size, age, etc.).
- PROHIBITED INFERENCES: low digital quality describes observable online
  fields only — never infer low revenue, low customer volume, poor products,
  poor service, or sales readiness. A bronze slot is NOT a prospect verdict or
  a competitive benchmark. An empty slot never means no such business exists.
  A filled absent_from_platform or field-gap slot is a per-platform finding,
  never a whole-business verdict. Bronze output must never be framed as
  competitive benchmarking.
`;
