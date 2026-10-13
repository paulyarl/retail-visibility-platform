/**
 * Engagement Brief output schema (Pass 2) — the persisted spine.
 *
 * Spec: docs/AUDIT_CHANNEL_SCAN_AND_OPPORTUNITY_COLLECTION_SPEC.md
 * ("Brief shape", "Rank once, project many", "The brief must be stored").
 *
 * The Pass-2 job consumes a stored business_analysis audit + a PLATFORM
 * CAPABILITIES block and emits ONE structured deliverable that downstream
 * artifacts (project plan, proposal, pitch/call script) project from.
 * Reports and Narratives read Pass 1 directly and never read the spine.
 *
 * Registered in OUTPUT_SCHEMA_REGISTRY with auditPlatform='engagement_brief'
 * so external imports persist as mkt_audits_list rows carrying the full
 * brief JSON in audit_data — the persisted spine that makes "rank once"
 * enforceable.
 *
 * Validation posture mirrors business_analysis: .passthrough() at every
 * level and every field optional at the validator (the prompt contract is
 * what makes pains/assets/fits/gates REQUIRED blocks; a schema shared by
 * future template variants may not emit them all). The stamp hook
 * (engagement-brief-stamp.ts) writes source_audit_id / side / brief_version
 * post-validation, so those are optional here even though every persisted
 * brief carries them.
 */

import { z } from 'zod';

// ─── Coercers (house style — tolerate the agent's vocabulary drift) ──────

const coercedString = z.preprocess(
  (v) => (v === undefined || v === null || v === '' ? undefined : String(v)),
  z.string().optional(),
);

const coercedStringNullable = z.preprocess(
  (v) => (v === undefined || v === '' ? null : v === null ? null : String(v)),
  z.string().nullable().optional(),
);

const coercedBoolean = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === 'yes' || s === '1') return true;
    if (s === 'false' || s === 'no' || s === '0') return false;
  }
  if (typeof v === 'number') return v !== 0;
  return v;
}, z.boolean().optional());

const stringArray = z.array(z.string()).optional();

// ─── Enums ─────────────────────────────────────────────────────────────

/** Evidence-backed items carry the audit's tri-state confidence. */
const evidenceConfidenceEnum = z.enum([
  'verified_on_surface',
  'inferred',
  'verify_with_owner',
]);

/** Pure-judgment items (capability_fits) carry a separate vocabulary. */
const judgmentConfidenceEnum = z.enum(['high', 'medium', 'low']);

/**
 * The leak guardrail one layer up: a renderer must not let a tier name or an
 * underexposure note reach a public/client surface. `internal` items are
 * operator-only; `client_safe` may be spoken to the owner; `public_safe` may
 * reach public narrative surfaces.
 */
const visibilityEnum = z.enum(['internal', 'client_safe', 'public_safe']);

const severityEnum = z.enum(['high', 'medium', 'low']);

const whoCanAnswerEnum = z.enum(['owner', 'operator', 'public_source']);

// ─── Spine item blocks ──────────────────────────────────────────────────

const briefPainSchema = z
  .object({
    ref_id: coercedString,
    severity: severityEnum.optional(),
    /** The customer-facing cost, not the technical label. */
    business_consequence: coercedString,
    /** A ref_id key into evidence_index — never a paraphrased fact. */
    evidence_ref: coercedString,
    confidence: evidenceConfidenceEnum.optional(),
    visibility: visibilityEnum.optional(),
  })
  .passthrough();

const briefAssetSchema = z
  .object({
    ref_id: coercedString,
    asset: coercedString,
    underexposure: coercedBoolean,
    /** Lead with it / leverage it / leave alone. */
    how_to_use: coercedString,
    evidence_ref: coercedString,
    confidence: evidenceConfidenceEnum.optional(),
    visibility: visibilityEnum.optional(),
  })
  .passthrough();

const capabilityFitSchema = z
  .object({
    capability: coercedString,
    /** -> pains[].ref_id | assets[].ref_id */
    addresses_ref: coercedString,
    why_it_fits: coercedString,
    confidence: judgmentConfidenceEnum.optional(),
    visibility: visibilityEnum.optional(),
  })
  .passthrough();

const verificationGateSchema = z
  .object({
    /** What must be confirmed before it can be claimed. */
    gate: coercedString,
    /** Which pain, asset, or capability_fit it gates. */
    blocks: coercedString,
    who_can_answer: whoCanAnswerEnum.optional(),
    visibility: visibilityEnum.optional(),
  })
  .passthrough();

const engagementShapeSchema = z
  .object({
    /** -> pains[].ref_id */
    primary_hook_ref: coercedStringNullable,
    /** pain or asset first. */
    lead_with: coercedStringNullable,
    /** Affirmative prohibitions — what every projection must not claim. */
    do_not_claim: stringArray,
  })
  .passthrough();

const briefSideSchema = z
  .object({
    value: z.enum(['emerging', 'competitive']).optional(),
    density_score: z.number().optional(),
    inputs_used: stringArray,
    classifier_version: z.number().int().optional(),
  })
  .passthrough();

// ─── Root ───────────────────────────────────────────────────────────────

export const engagementBriefSchema = z
  .object({
    brief_version: z.number().int().min(1).optional(),
    /** mkt_audits_list.id of the business_analysis audit this brief cites —
     *  audits and executions are different tables; cite the audit. Code
     *  stamps it at import. */
    source_audit_id: coercedStringNullable,
    business: z
      .object({
        name: coercedString,
        category: coercedString,
        store_format: coercedString,
      })
      .passthrough()
      .optional(),
    /** Code-stamped by applyEngagementBriefStamp — never model-authored. */
    side: briefSideSchema.optional(),
    /** ref_id -> audit field path. */
    evidence_index: z.record(z.string(), z.string()).optional(),
    pains: z.array(briefPainSchema).optional(),
    assets: z.array(briefAssetSchema).optional(),
    capability_fits: z.array(capabilityFitSchema).optional(),
    verification_gates: z.array(verificationGateSchema).optional(),
    engagement_shape: engagementShapeSchema.optional(),
  })
  .passthrough();

export type EngagementBriefOutput = z.infer<typeof engagementBriefSchema>;

export const ENGAGEMENT_BRIEF_SCHEMA_NAME = 'engagement_brief' as const;

// ─── Prompt suffix (safety net — appended by resolvePrompt) ──────────────
// Unlike business_analysis, engagement_brief is NOT in
// LEGACY_NO_SUFFIX_SCHEMAS, so this contract is appended to every render —
// keep it in sync with the embedded schema in
// scripts/engagement-brief-default-body.md.

export const ENGAGEMENT_BRIEF_PROMPT_SUFFIX = `

OUTPUT FORMAT — Return ONLY valid JSON matching this schema (no markdown fences, no commentary):

{
  "brief_version": 1,
  "source_audit_id": "<mkt_audits_list.id — leave empty; stamped at import>",
  "business": { "name": "", "category": "", "store_format": "" },
  "side": {
    "value": "emerging|competitive",
    "density_score": 0,
    "inputs_used": ["<audit field path>"],
    "classifier_version": 1
  },
  "evidence_index": { "<ref_id>": "<audit field path>" },
  "pains": [{
    "ref_id": "",
    "severity": "high|medium|low",
    "business_consequence": "<the customer-facing cost, not the technical label>",
    "evidence_ref": "<ref_id key into evidence_index — never a paraphrased fact>",
    "confidence": "verified_on_surface|inferred|verify_with_owner",
    "visibility": "internal|client_safe|public_safe"
  }],
  "assets": [{
    "ref_id": "",
    "asset": "",
    "underexposure": true|false,
    "how_to_use": "<lead with it / leverage it / leave alone>",
    "evidence_ref": "<ref_id>",
    "confidence": "verified_on_surface|inferred|verify_with_owner",
    "visibility": "internal|client_safe|public_safe"
  }],
  "capability_fits": [{
    "capability": "",
    "addresses_ref": "<pains[].ref_id | assets[].ref_id>",
    "why_it_fits": "",
    "confidence": "high|medium|low",
    "visibility": "internal|client_safe|public_safe"
  }],
  "verification_gates": [{
    "gate": "<what must be confirmed before it can be claimed>",
    "blocks": "<which pain, asset, or capability_fit it gates>",
    "who_can_answer": "owner|operator|public_source",
    "visibility": "internal|client_safe|public_safe"
  }],
  "engagement_shape": {
    "primary_hook_ref": "<pains[].ref_id>",
    "lead_with": "pain|asset",
    "do_not_claim": ["<affirmative prohibition>"]
  }
}
`;
