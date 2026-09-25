/**
 * Triage Engine — shared types (Sprint 2A pivot)
 *
 * The engine's public input is a standardized `SignalCode[]` array.
 * `NormalizedSignals` survives only as the extractor's *internal* working
 * shape for threshold computations (e.g., computing `daysSinceLastReview`
 * before emitting `RA_REVIEW_DROUGHT`).
 *
 * Spec: docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md
 * Sprint 2A — Platform Signal Taxonomy & Signal-Code Pipeline
 */

import type { BusinessAnalysisAuditData } from '../outreach-openers/archetype-selection';
import type { SignalCode } from './signal-taxonomy';

// ─── Playbook codes & categories ─────────────────────────────────────────

export const PLAYBOOK_CODES = ['PB-01', 'PB-02', 'PB-03', 'PB-04', 'PB-05', 'PB-06', 'PB-07', 'PB-08'] as const;
export type PlaybookCode = (typeof PLAYBOOK_CODES)[number];

export const PLAYBOOK_CATEGORIES = [
  'review_management',
  'recovery_management',
  'profile_repair',
  'triage_management',
] as const;
export type PlaybookCategory = (typeof PLAYBOOK_CATEGORIES)[number];

// ─── Archetype (extended with A5 + A6 + A7) ─────────────────────────────
//
// NOTE: the name is historical — the union is the full archetype set. The
// `outreach-openers/archetype-selection.ts` `ArchetypeCode` union is the
// parallel definition and must stay in lockstep (A7 = website gap).
export type ArchetypeCodeWithA6 = 'A1' | 'A2' | 'A3' | 'A4' | 'A5' | 'A6' | 'A7';

/** @deprecated use ArchetypeCodeWithA6 — kept for backward-compat with existing importers. */
export type ArchetypeCodeWithA5 = ArchetypeCodeWithA6;

export const ARCHETYPE_LABELS: Record<ArchetypeCodeWithA6, string> = {
  A1: 'A1_REVIEW_GAP',
  A2: 'A2_NEGATIVE_RECOVERY',
  A3: 'A3_LISTING_DRIFT',
  A4: 'A4_CTA_GAP',
  A5: 'A5_DUAL_TRIAGE',
  A6: 'A6_PRODUCT_VISIBILITY_GAP',
  A7: 'A7_WEBSITE_GAP',
};

// ─── Rules DSL (§6.4) ────────────────────────────────────────────────────

/**
 * matching_rules DSL on mkt_playbook_catalog. Evaluated by set membership
 * over the campaign's SignalCode[].
 *
 * A playbook matches when:
 *   - at least one `any` code is present (or `any` is empty), AND
 *   - every `all` code is present, AND
 *   - no `none` code is present, AND
 *   - (if `dual` set) ≥1 code from each of `groupA` and `groupB` is present.
 *
 * First match in `priority_rank` order wins. `none` is how PB-05 expresses
 * "no active BBB crisis."
 */
export interface MatchingRules {
  any: SignalCode[];
  all: SignalCode[];
  none: SignalCode[];
  dual: { groupA: SignalCode[]; groupB: SignalCode[] } | null;
  confidence: number;
}

// ─── Triage recommendation ───────────────────────────────────────────────

/**
 * A detected signal entry recorded on mkt_campaign_triage_results.detected_signals.
 * Each entry names the signal code + whether it contributed to the winning rule.
 */
export interface DetectedSignal {
  code: SignalCode;
  label: string;
  contributedToRule: boolean;
  /**
   * Evidence lane that produced this signal. 'discovery_scan' = translated
   * from Category Discovery evidence (partial verdict); absent = audit /
   * campaign-field extraction (full-verdict lane).
   */
  origin?: 'discovery_scan';
}

/**
 * Output of TriageEngineService.evaluateTriage. Pure data — no DB writes.
 *
 * `confidence` comes from the winning playbook's `matching_rules.confidence`
 * (admin-tunable). The UI must label it "Rule Confidence" / "Signal Match
 * Strength" per Risk 3 — NOT "ML confidence."
 */
export interface TriageRecommendation {
  playbookCode: PlaybookCode;
  playbookName: string;
  category: PlaybookCategory;
  archetype: ArchetypeCodeWithA6;
  confidence: number;
  reasoning: string;
  detectedSignals: DetectedSignal[];
}

// ─── Extractor-internal NormalizedSignals (NOT the engine input) ─────────
//
// Per Sprint 2A: the engine input is SignalCode[]. NormalizedSignals is the
// extractor's internal working shape for threshold computations only.

export interface NormalizedSignals {
  bbbGrade?: string;
  googleRating?: number;
  unansweredBbbComplaints: number;
  hasDeadUrl: boolean;
  urlMismatch: boolean;
  napInconsistent: boolean;
  napNameDrift: boolean;
  napAddressDrift: boolean;
  napPhoneDrift: boolean;
  daysSinceLastReview: number;
  unaddressedReviewCount: number;
  unaddressedNegativeReviews: number;
  unaddressedPositiveReviews: number;
  combinedReviewCount: number;
  hasCtaFriction: boolean;
  hasMissingWebsite: boolean;
  hasMissingServicePages: boolean;
  hasMobileFriction: boolean;
  gbpClaimed: boolean;
  hasMissingProfile: boolean;
  hasBrokenProfileLink: boolean;
  hasMissingServiceMenu: boolean;
  hasOutdatedHours: boolean;
  photoCount: number;
  hasMissingProjectPhotos: boolean;
  hasStaleSocialActivity: boolean;
}

// ─── Signal extractor inputs ─────────────────────────────────────────────

export interface SignalExtractorInput {
  campaign: {
    last_review_date?: Date | null;
    unaddressed_reviews: number;
    nap_consistent?: boolean | null;
    has_website?: string | null;
    website_url?: string | null;
    gbp_claimed?: boolean | null;
  };
  auditData?: BusinessAnalysisAuditData | null;
  bbb?: {
    bbbGrade?: string;
    unansweredBbbComplaints?: number;
  };
  /**
   * Resolved signal_weight(category, platform) per normalized platform key
   * (Phase 6 — CATEGORY_PLATFORM_SIGNAL_WEIGHT_SPEC §7). When present, a
   * render-control `business_specific_failure` only emits DS_MISSING_PROFILE
   * for platforms at or above MIN_SIGNAL_WEIGHT_FOR_GAP — a low-signal
   * platform's absence says nothing for the category. When absent, the
   * legacy primary-platforms set applies (byte-identical pre-weight behavior).
   */
  platformSignalWeights?: Record<string, number>;
}

// ─── Playbook catalog row (DB shape) ─────────────────────────────────────

export interface PlaybookCatalogRow {
  id: string;
  code: PlaybookCode;
  name: string;
  category: PlaybookCategory;
  archetype: ArchetypeCodeWithA6;
  archetypeLabel: string;
  description: string | null;
  matchingRules: MatchingRules;
  priorityRank: number;
  fitdOfferTitle: string;
  fitdDefaultFeeCents: number;
  retainerPitchTitle: string;
  retainerFeeCents: number;
  openerPromptTemplateId: string | null;
  previewDeliverableType: string | null;
  isActive: boolean;
}

// ─── Multi-archetype triage (sibling creation support) ───────────────────
//
// When triage detects multiple qualifying archetypes, the winner is stored
// as usual (via evaluateTriageForCampaign). The alternatives are returned
// for the UI to present as sibling-creation suggestions. Each alternative
// includes its detectedSignals so the operator can see which signals
// triggered each alternative playbook.

/**
 * Result of evaluating all matching playbooks for a campaign.
 * The winner is the same as evaluateTriageForCampaign's result.
 * The alternatives are all other matching playbooks ranked by priority.
 */
export interface MultiArchetypeTriageResult {
  winner: import('../CampaignTriageService').StoredTriageResult;
  alternatives: TriageRecommendation[];
}
