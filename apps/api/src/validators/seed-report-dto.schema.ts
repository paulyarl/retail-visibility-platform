/**
 * Seed Intelligence Report — Report DTO Schema (Phase 1)
 *
 * Spec: docs/LocalBiz/AUTOMATED_SEED_INTELLIGENCE_REPORT_SPEC.md
 *   §5.3  SeedReportStatus
 *   §5.5  ReportGenerationMetadata (reproducibility)
 *   §9    SeedIntelligenceReport DTO
 *   §9.1  BusinessIdentitySection
 *   §9.2  ReportFact
 *   §9.3  SourceSummarySection
 *   §9.4  IdentityReconciliationSection
 *   §9.5  ClaimSummarySection
 *   §10   Section shapes derived from §10.5–§10.9 descriptions
 *   §12.2 report_mode (free | claimed | paid)
 *   §5.2  Claim-hook eligibility
 *   §17   Acceptance criteria → lint rules
 *
 * The report builder (Phase 4) consumes normalized evidence and produces
 * this stable DTO. HTML, customer portal, operator views, and PDF all render
 * from the same DTO (§14.1).
 *
 * The builder must read the current canonical identity and claim state from
 * `directory_presence_seeds`, not reconstruct those values solely from raw
 * prompt observations (§9). Raw observations and `directory_field_provenance`
 * explain how the seed was built; the seed row represents the current
 * resolved record.
 */

import { z } from 'zod';
import {
  evidenceStateSchema,
  evidenceConfidenceSchema,
  identityCandidateSchema,
  type EvidenceState,
  type EvidenceConfidence,
  type IdentityCandidate,
} from './seed-report-evidence.schema';

// ─── Report status (§5.3) ────────────────────────────────────────────────

export const SEED_REPORT_STATUSES = [
  'provisional',
  'complete',
  'requires_identity_review',
  'insufficient_evidence',
  'claimed',
] as const;

export type SeedReportStatus = (typeof SEED_REPORT_STATUSES)[number];

export const seedReportStatusSchema = z.enum(SEED_REPORT_STATUSES);

// ─── Report mode (§12.2, §14) ────────────────────────────────────────────

export const SEED_REPORT_MODES = ['free', 'claimed', 'paid'] as const;

export type SeedReportMode = (typeof SEED_REPORT_MODES)[number];

export const seedReportModeSchema = z.enum(SEED_REPORT_MODES);

// ─── Claim status (§9.5) ────────────────────────────────────────────────

export const CLAIM_STATUSES = ['unclaimed', 'claim_invited', 'claim_pending', 'claimed'] as const;

export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

// ─── Report generation metadata (§5.5) ──────────────────────────────────

export const reportGenerationMetadataSchema = z.object({
  prompt_templates: z.array(
    z.object({
      template_id: z.string(),
      template_version: z.number(),
    }).passthrough(),
  ),
  source_snapshot_ids: z.array(z.string()),
  evidence_ids: z.array(z.string()),
}).passthrough();

export type ReportGenerationMetadata = z.infer<typeof reportGenerationMetadataSchema>;

// ─── Report fact (§9.2) ─────────────────────────────────────────────────
//
// A single resolved field in the report. Carries the evidence state,
// confidence, source observation IDs, and owner-verification timestamp.
// `display_note` is the human-readable explanation the report renderer shows.

export const reportFactSchema = z.object({
  field: z.string(),
  value: z.unknown(),
  state: evidenceStateSchema,
  confidence: evidenceConfidenceSchema,
  source_observation_ids: z.array(z.string()),
  owner_verified_at: z.string().nullable(),
  display_note: z.string().nullable(),
}).passthrough();

export type ReportFact = z.infer<typeof reportFactSchema>;

// ─── Business identity section (§9.1) ────────────────────────────────────

export const businessIdentitySectionSchema = z.object({
  business_name: reportFactSchema,
  address: reportFactSchema,
  phone: reportFactSchema,
  website: reportFactSchema,
  city: reportFactSchema,
  state: reportFactSchema,
  owner_name: reportFactSchema,
  ownership_type: reportFactSchema,
}).passthrough();

export type BusinessIdentitySection = z.infer<typeof businessIdentitySectionSchema>;

// ─── Source summary section (§9.3) ───────────────────────────────────────

export const sourceSummarySectionSchema = z.object({
  sources_checked_count: z.number(),
  sources_with_evidence_count: z.number(),
  source_types: z.array(
    z.object({
      source_type: z.string(),
      source_name: z.string(),
      role: z.string(),
      observation_count: z.number(),
    }).passthrough(),
  ),
  identity_signals_count: z.number(),
  name_variants_count: z.number(),
  address_variants_count: z.number(),
  unresolved_count: z.number(),
}).passthrough();

export type SourceSummarySection = z.infer<typeof sourceSummarySectionSchema>;

// ─── Identity reconciliation section (§9.4) ─────────────────────────────

export const identityReconciliationSectionSchema = z.object({
  canonical_candidate: identityCandidateSchema.nullable(),
  alternate_names: z.array(z.string()),
  alternate_addresses: z.array(z.string()),
  alternate_phones: z.array(z.string()),
  conflicts: z.array(
    z.object({
      field: z.string(),
      values: z.array(
        z.object({
          value: z.string(),
          source_observation_ids: z.array(z.string()),
        }).passthrough(),
      ),
      resolution: z.enum(['resolved', 'unresolved']),
    }).passthrough(),
  ),
  identity_confidence: z.enum(['high', 'medium', 'low']),
}).passthrough();

export type IdentityReconciliationSection = z.infer<typeof identityReconciliationSectionSchema>;

// ─── Market classification section (§10.5) ──────────────────────────────
//
// Derived from §10.5: category fit, subcategory, location status, ownership
// classification, category-profile context, relevant operational/community
// signals. Descriptive only — must not become an unsupported quality judgment.

export const marketClassificationSectionSchema = z.object({
  category: z.string(),
  subcategory: z.string().nullable(),
  category_fit: z.enum(['verified', 'probable', 'insufficient']),
  location_status: z.enum(['inside_city', 'adjacent_city', 'metro_area', 'outside_market']),
  ownership_type: z.string().nullable(),
  category_profile_context: z.string().nullable(),
  operational_signals: z.array(z.string()).default([]),
}).passthrough();

export type MarketClassificationSection = z.infer<typeof marketClassificationSectionSchema>;

// ─── Platform presence section (§10.6) ──────────────────────────────────
//
// Derived from §10.6: platform observations with clear states
// (observed / not_found_during_discovery / not_checked).

export const platformPresenceSectionSchema = z.object({
  platforms: z.array(
    z.object({
      platform: z.string(),
      presence: z.enum(['observed', 'not_found_during_discovery', 'not_checked']),
      business_name: z.string().nullable(),
      address: z.string().nullable(),
      phone: z.string().nullable(),
      primary_category: z.string().nullable(),
      hours_present: z.boolean().nullable(),
      website_present: z.boolean().nullable(),
      claimed_status: z.enum(['claimed', 'unclaimed', 'not_verified']).nullable(),
      source_url: z.string().nullable(),
      observed_at: z.string().nullable(),
    }).passthrough(),
  ),
}).passthrough();

export type PlatformPresenceSection = z.infer<typeof platformPresenceSectionSchema>;

// ─── Category fit section (§10.5) ───────────────────────────────────────
//
// Separate from market classification for rendering flexibility. Carries
// the category fit assessment and its evidence basis.

export const categoryFitSectionSchema = z.object({
  category: z.string(),
  subcategory: z.string().nullable(),
  category_fit: z.enum(['verified', 'probable', 'insufficient']),
  basis: z.array(z.string()),
  source_observation_ids: z.array(z.string()),
}).passthrough();

export type CategoryFitSection = z.infer<typeof categoryFitSectionSchema>;

// ─── Intelligence signal section (§10.7) ────────────────────────────────
//
// For each INT_* signal: signal code, human-readable label, evidence basis,
// source links or observation IDs.

export const intelligenceSignalSectionSchema = z.object({
  signals: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      basis: z.string(),
      source_observation_ids: z.array(z.string()),
      registry_signal_id: z.string().optional(),
    }).passthrough(),
  ),
}).passthrough();

export type IntelligenceSignalSection = z.infer<typeof intelligenceSignalSectionSchema>;

// ─── Verification activity section (§10.8) ─────────────────────────────
//
// Only displayed when contact or owner-verification events exist.
// Includes: date, channel, purpose, contact outcome, facts confirmed/
// corrected/disputed, owner-reported pain, claim response, next action.

export const verificationActivitySectionSchema = z.object({
  events: z.array(
    z.object({
      date: z.string(),
      channel: z.string(),
      purpose: z.string(),
      contact_outcome: z.string().nullable(),
      facts_confirmed: z.array(z.string()).default([]),
      facts_corrected: z.array(z.string()).default([]),
      facts_disputed: z.array(z.string()).default([]),
      owner_reported_pain: z.string().nullable(),
      claim_response: z.string().nullable(),
      next_action: z.string().nullable(),
      anchor_id: z.string().nullable().optional(),
    }).passthrough(),
  ),
}).passthrough();

export type VerificationActivitySection = z.infer<typeof verificationActivitySectionSchema>;

// ─── Claim summary section (§9.5) ───────────────────────────────────────

export const claimSummarySectionSchema = z.object({
  claim_status: z.enum(CLAIM_STATUSES),
  claim_url: z.string().nullable(),
  claim_benefits: z.array(z.string()),
  owner_confirmation_count: z.number(),
  owner_correction_count: z.number(),
}).passthrough();

export type ClaimSummarySection = z.infer<typeof claimSummarySectionSchema>;

// ─── Next action section (§10.9) ─────────────────────────────────────────
//
// The claim invitation CTA and any operator-suggested next steps.

export const nextActionSectionSchema = z.object({
  primary_cta: z.string().nullable(),
  cta_eligible: z.boolean(),
  cta_disabled_reason: z.string().nullable(),
  suggested_actions: z.array(
    z.object({
      action: z.string(),
      description: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    }).passthrough(),
  ).default([]),
}).passthrough();

export type NextActionSection = z.infer<typeof nextActionSectionSchema>;

// ─── Seed intelligence report DTO (§9) ───────────────────────────────────
//
// The complete report DTO. HTML, customer portal, operator views, and PDF
// all render from this shape (§14.1). Stored as `report_data` jsonb in
// `mkt_seed_intelligence_reports` (§12.2).

export const seedIntelligenceReportSchema = z.object({
  report_id: z.string(),
  seed_id: z.string(),
  version: z.number(),
  status: seedReportStatusSchema,
  report_mode: seedReportModeSchema,
  generated_at: z.string(),
  generated_from: reportGenerationMetadataSchema,

  evidence_count: z.number(),
  unresolved_count: z.number(),
  owner_verification_count: z.number(),

  business_identity: businessIdentitySectionSchema,
  source_summary: sourceSummarySectionSchema,
  identity_reconciliation: identityReconciliationSectionSchema,
  market_classification: marketClassificationSectionSchema,
  platform_presence: platformPresenceSectionSchema,
  category_fit: categoryFitSectionSchema,
  intelligence_signals: intelligenceSignalSectionSchema,
  verification_activity: verificationActivitySectionSchema,
  claim_summary: claimSummarySectionSchema,
  next_actions: nextActionSectionSchema,
}).passthrough();

export type SeedIntelligenceReport = z.infer<typeof seedIntelligenceReportSchema>;

// ─── Claim-hook eligibility (§5.2) ──────────────────────────────────────
//
// A report may be generated internally with any status for operator review,
// but business-facing claim-hook eligibility has stricter requirements.
// `insufficient_evidence` and `requires_identity_review` are operator-internal
// and must NOT expose a claim CTA.

export interface ClaimHookEligibility {
  eligible: boolean;
  reasons: string[];
}

/**
 * Evaluate whether a report status + evidence state qualifies for
 * business-facing claim-hook use (§5.2).
 *
 * Requirements:
 *   - status is 'provisional' or 'complete' (not requires_identity_review
 *     or insufficient_evidence)
 *   - identity confidence is 'medium' or 'high'
 *   - location is inside_city, adjacent_city, or metro_area (not outside_market)
 *   - at least one reliable source observation
 *   - no unresolved identity conflict that makes the claim ambiguous
 */
export function evaluateClaimHookEligibility(params: {
  status: SeedReportStatus;
  identityConfidence: 'high' | 'medium' | 'low';
  locationStatus: 'inside_city' | 'adjacent_city' | 'metro_area' | 'outside_market';
  sourceObservationCount: number;
  hasUnresolvedIdentityConflict: boolean;
}): ClaimHookEligibility {
  const reasons: string[] = [];

  if (params.status === 'requires_identity_review' || params.status === 'insufficient_evidence') {
    reasons.push(`status "${params.status}" is operator-internal — claim CTA disabled`);
  }

  if (params.identityConfidence === 'low') {
    reasons.push('identity_confidence is "low" — requires medium or high for claim hook');
  }

  if (params.locationStatus === 'outside_market') {
    reasons.push('location_status is "outside_market" — must be inside_city, adjacent_city, or metro_area');
  }

  if (params.sourceObservationCount < 1) {
    reasons.push('no reliable source observations');
  }

  if (params.hasUnresolvedIdentityConflict) {
    reasons.push('unresolved identity conflict makes the claim ambiguous');
  }

  return {
    eligible: reasons.length === 0,
    reasons,
  };
}
