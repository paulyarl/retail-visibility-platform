/**
 * Seed Intelligence Report — Evidence Contract Schema (Phase 1)
 *
 * Spec: docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md
 *   §6.0  CandidateReportEvidence (per-candidate scope)
 *   §6.2  ReportEvidenceOutput
 *   §6.3  ReportObservation + EvidenceState + EvidenceConfidence
 *   §6.4  IdentityCandidate
 *   §6.5  CategoryAssessment
 *   §6.6  GeographicAssessment
 *   §6.7  ReportSignal (registry-backed INT_* family)
 *   §6.8  UnresolvedQuestion
 *   §6.9  PlatformObservation
 *
 * Design principles (§4):
 *   - Evidence before narrative: prompts produce structured observations; the
 *     report service turns them into narrative.
 *   - LLMs may phrase evidence but may not create evidence (§4.2).
 *   - Absence is not a negative finding (§4.3): not_found_during_discovery ≠ false.
 *   - Provenance is first-class (§4.4): every fact traceable to source IDs.
 *   - Owner confirmation outranks public discovery for business-owned fields (§4.5).
 *
 * Per-candidate scope (§6.0): report_evidence is emitted per candidate business,
 * NOT once for the entire discovery run. Each candidate that can become a seed
 * receives its own evidence block keyed by the candidate's stable run-local key.
 *
 * Signal validation (§6.7): INT_* codes are validated against mkt_signal_registry
 * at runtime by SeedReportEvidenceService (Phase 3), NOT against a TS literal.
 * The schema accepts any string for `code` so admin-registered codes pass through;
 * the normalizer rejects codes not in the active registry.
 *
 * Used by:
 *   - SeedReportEvidenceService (Phase 3) — validates per-candidate prompt output
 *   - The report-evidence prompt directive (§6.1) appended to intelligence prompts
 *   - Integration tests: prompt output → normalized evidence → report DTO
 */

import { z } from 'zod';

export const SEED_REPORT_EVIDENCE_SCHEMA_NAME = 'seed_report_evidence';

// ─── Evidence state (§4.3, §6.3) ─────────────────────────────────────────
//
// The evidence-state taxonomy is the spec's core safety mechanism. It
// distinguishes "we looked and didn't find it" from "we didn't look" from
// "sources disagree." Converting any of these to `false` is forbidden (§4.3).
//
// Owner states (owner_confirmed, owner_corrected, owner_disputed) are set by
// the normalizer from claim/verification events, NOT by prompt output.

export const EVIDENCE_STATES = [
  'confirmed',
  'observed',
  'probable',
  'conflicting',
  'not_found_during_discovery',
  'not_checked',
  'owner_confirmed',
  'owner_corrected',
  'owner_disputed',
] as const;

export type EvidenceState = (typeof EVIDENCE_STATES)[number];

export const evidenceStateSchema = z.enum(EVIDENCE_STATES);

// ─── Evidence confidence (§6.3) ──────────────────────────────────────────

export const EVIDENCE_CONFIDENCE_LEVELS = ['high', 'medium', 'low', 'unknown'] as const;

export type EvidenceConfidence = (typeof EVIDENCE_CONFIDENCE_LEVELS)[number];

export const evidenceConfidenceSchema = z.enum(EVIDENCE_CONFIDENCE_LEVELS);

// ─── Report observation (§6.3) ────────────────────────────────────────────
//
// A single observed business fact with full provenance. The normalizer
// assigns a stable observation_id if the prompt does not supply one.

export const reportObservationSchema = z.object({
  observation_id: z.string().optional(),
  subject: z.string(),
  field: z.string(),
  value: z.unknown(),
  state: evidenceStateSchema,
  confidence: evidenceConfidenceSchema,
  source_name: z.string(),
  source_type: z.string(),
  source_url: z.string().nullable(),
  observed_at: z.string().nullable(),
  notes: z.string().nullable(),
}).passthrough();

export type ReportObservation = z.infer<typeof reportObservationSchema>;

// ─── Identity candidate (§6.4) ────────────────────────────────────────────
//
// A candidate business identity assembled from one or more source observations.
// The normalizer resolves identity candidates against directory_presence_seeds.

export const identityCandidateSchema = z.object({
  business_name: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  website: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  identity_confidence: z.enum(['high', 'medium', 'low']),
  basis: z.array(z.string()),
  source_observation_ids: z.array(z.string()),
}).passthrough();

export type IdentityCandidate = z.infer<typeof identityCandidateSchema>;

// ─── Category assessment (§6.5) ──────────────────────────────────────────

export const categoryAssessmentSchema = z.object({
  category: z.string(),
  subcategory: z.string().nullable(),
  category_fit: z.enum(['verified', 'probable', 'insufficient']),
  basis: z.array(z.string()),
  source_observation_ids: z.array(z.string()),
}).passthrough();

export type CategoryAssessment = z.infer<typeof categoryAssessmentSchema>;

// ─── Geographic assessment (§6.6) ────────────────────────────────────────

export const geographicAssessmentSchema = z.object({
  location_status: z.enum([
    'inside_city',
    'adjacent_city',
    'metro_area',
    'outside_market',
  ]),
  basis: z.array(z.string()),
  source_observation_ids: z.array(z.string()),
}).passthrough();

export type GeographicAssessment = z.infer<typeof geographicAssessmentSchema>;

// ─── Discovery signal (§6.7) ──────────────────────────────────────────────
//
// INT_* family only. The `code` is a plain string here so admin-registered
// codes pass schema validation; SeedReportEvidenceService validates against
// the active mkt_signal_registry at runtime and rejects/quarantines unknown
// or inactive codes.
//
// `registry_signal_id` and `label` are populated by the normalizer after
// registry lookup, NOT by the prompt.

export const reportSignalSchema = z.object({
  code: z.string().min(1),
  family: z.literal('INT'),
  label: z.string().optional(),
  basis: z.string(),
  source_observation_ids: z.array(z.string()),
  registry_signal_id: z.string().optional(),
}).passthrough();

export type ReportSignal = z.infer<typeof reportSignalSchema>;

// ─── Unresolved question (§6.8) ───────────────────────────────────────────

export const unresolvedQuestionSchema = z.object({
  field: z.string(),
  question: z.string(),
  reason: z.string(),
  suggested_verification_method: z.enum([
    'owner_claim',
    'phone_call',
    'email',
    'website_review',
    'source_refresh',
    'operator_review',
  ]),
}).passthrough();

export type UnresolvedQuestion = z.infer<typeof unresolvedQuestionSchema>;

// ─── Platform observation (§6.9) ──────────────────────────────────────────
//
// Per-platform presence record. `claimed_status: "not_verified"` is required
// when the source does not explicitly establish claimed or unclaimed status.

export const platformObservationSchema = z.object({
  platform: z.string(),
  presence: z.enum(['observed', 'not_found_during_discovery', 'not_checked']),
  business_name: z.string().nullable(),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  primary_category: z.string().nullable(),
  hours_present: z.boolean().nullable(),
  website_present: z.boolean().nullable(),
  claimed_status: z.enum(['claimed', 'unclaimed', 'not_verified']).nullable(),
  attributes: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.union([z.string(), z.boolean(), z.null()]),
    }).passthrough(),
  ),
  source_url: z.string().nullable(),
  observed_at: z.string().nullable(),
}).passthrough();

export type PlatformObservation = z.infer<typeof platformObservationSchema>;

// ─── Report evidence output (§6.2) ────────────────────────────────────────
//
// The complete evidence block emitted per candidate by the prompt's
// report_evidence directive (§6.1).

export const reportEvidenceOutputSchema = z.object({
  observations: z.array(reportObservationSchema),
  identity_candidates: z.array(identityCandidateSchema),
  category_assessment: categoryAssessmentSchema.nullable(),
  geographic_assessment: geographicAssessmentSchema.nullable(),
  signals: z.array(reportSignalSchema),
  unresolved_questions: z.array(unresolvedQuestionSchema),
  platform_observations: z.array(platformObservationSchema),
}).passthrough();

export type ReportEvidenceOutput = z.infer<typeof reportEvidenceOutputSchema>;

// ─── Candidate report evidence (§6.0) ────────────────────────────────────
//
// Per-candidate envelope. A discovery run may return many candidates; each
// candidate that can become a seed receives its own evidence block.

export const candidateReportEvidenceSchema = z.object({
  candidate_key: z.string(),
  business_name: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  report_evidence: reportEvidenceOutputSchema,
}).passthrough();

export type CandidateReportEvidence = z.infer<typeof candidateReportEvidenceSchema>;

// ─── Validation helpers ──────────────────────────────────────────────────

/**
 * Validate a single candidate's report_evidence block. Returns the parsed
 * output or throws a ZodError on invalid input. The normalizer (Phase 3)
 * calls this before assigning observation IDs and resolving against the
 * signal registry.
 */
export function validateCandidateReportEvidence(raw: unknown): CandidateReportEvidence {
  return candidateReportEvidenceSchema.parse(raw);
}

/**
 * Validate just the report_evidence block (without the candidate envelope).
 * Useful when the normalizer has already extracted the candidate.
 */
export function validateReportEvidenceOutput(raw: unknown): ReportEvidenceOutput {
  return reportEvidenceOutputSchema.parse(raw);
}
