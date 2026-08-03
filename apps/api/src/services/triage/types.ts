/**
 * Triage Engine — shared types
 *
 * Spec: docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md
 * Sprint 2 — Signal Extractor & Triage Engine.
 *
 * The triage engine sits between audit ingestion and campaign initialization.
 * It normalizes raw audit signals, runs a deterministic priority cascade, and
 * recommends one of five standard playbooks (PB-01..PB-05).
 */

import type { BusinessAnalysisAuditData } from '../outreach-openers/archetype-selection';

// ─── Playbook codes & categories ─────────────────────────────────────────

export const PLAYBOOK_CODES = ['PB-01', 'PB-02', 'PB-03', 'PB-04', 'PB-05'] as const;
export type PlaybookCode = (typeof PLAYBOOK_CODES)[number];

export const PLAYBOOK_CATEGORIES = [
  'review_management',
  'recovery_management',
  'triage_management',
] as const;
export type PlaybookCategory = (typeof PLAYBOOK_CATEGORIES)[number];

// ─── Normalized signals ──────────────────────────────────────────────────

/**
 * Normalized signal set consumed by the triage cascade. Maps the raw
 * business_analysis audit_data + mkt_campaigns_list columns into a flat,
 * typed shape the engine can switch on deterministically.
 *
 * BBB fields are optional because there is no automated BBB source today
 * (see roadmap Risk 1). When absent, Rule 1 (PB-04) is skipped.
 */
export interface NormalizedSignals {
  bbbGrade?: string;                       // 'A+' ... 'F' — manual operator input
  googleRating?: number;
  unansweredBbbComplaints: number;         // manual operator input (0 when unknown)
  hasDeadUrl: boolean;
  urlMismatch: boolean;
  napInconsistent: boolean;
  daysSinceLastReview: number;             // -1 when last_review_date is null
  unaddressedReviewCount: number;
  hasCtaFriction: boolean;
}

// ─── Triage recommendation ───────────────────────────────────────────────

/**
 * A detected signal entry recorded on mkt_campaign_triage_results.detected_signals.
 * Each entry names the signal, its value, and whether it contributed to the
 * winning rule — useful for the admin UI's "triggered signals" display.
 */
export interface DetectedSignal {
  signal: keyof NormalizedSignals;
  value: string | number | boolean;
  contributedToRule: boolean;
}

/**
 * Output of TriageEngineService.evaluateTriage. Pure data — no DB writes.
 *
 * `confidence` is a hardcoded proxy for rule specificity/severity (NOT an ML
 * probability). The UI must label it "Rule Confidence" / "Signal Match
 * Strength" per roadmap Risk 3.
 */
export interface TriageRecommendation {
  playbookCode: PlaybookCode;
  category: PlaybookCategory;
  archetype: ArchetypeCodeWithA5;
  confidence: number;                      // 0.000–1.000
  reasoning: string;
  detectedSignals: DetectedSignal[];
}

// ─── Archetype (extended with A5) ────────────────────────────────────────

/**
 * ArchetypeCode extended with A5_DUAL_TRIAGE for PB-05. The base
 * ArchetypeCode in outreach-openers/archetype-selection.ts is A1–A4; A5 is
 * only produced by the triage engine for multi-signal footprint triage.
 *
 * Sprint 6 adds the A5 opener prompt; until then A5 campaigns fall back to
 * the existing selectArchetype (A2 > A1 > A3 > A4) for opener generation.
 */
export type ArchetypeCodeWithA5 = 'A1' | 'A2' | 'A3' | 'A4' | 'A5';

export const ARCHETYPE_LABELS: Record<ArchetypeCodeWithA5, string> = {
  A1: 'A1_REVIEW_GAP',
  A2: 'A2_NEGATIVE_RECOVERY',
  A3: 'A3_LISTING_DRIFT',
  A4: 'A4_CTA_GAP',
  A5: 'A5_DUAL_TRIAGE',
};

// ─── Signal extractor inputs ─────────────────────────────────────────────

/**
 * Input bundle for the SignalExtractor. The campaign row carries the
 * denormalized signal columns (last_review_date, unaddressed_reviews,
 * nap_consistent, has_website, website_url); the latest business_analysis
 * audit carries the structured website/NAP/platform breakdown.
 *
 * BBB fields are operator-supplied via the triage pre-flight form (roadmap
 * Risk 1 / Sprint 5). When omitted, Rule 1 (PB-04) cannot fire.
 */
export interface SignalExtractorInput {
  campaign: {
    last_review_date?: Date | null;
    unaddressed_reviews: number;
    nap_consistent?: boolean | null;
    has_website?: string | null;           // 'yes' | 'no' | null
    website_url?: string | null;
  };
  auditData?: BusinessAnalysisAuditData | null;
  bbb?: {
    bbbGrade?: string;
    unansweredBbbComplaints?: number;
  };
}

// ─── Playbook catalog row (DB shape) ─────────────────────────────────────

/**
 * The subset of mkt_playbook_catalog fields the engine needs to map a
 * recommendation back to a catalog row. Loaded by MarketingPlaybookCatalogService.
 */
export interface PlaybookCatalogRow {
  id: string;
  code: PlaybookCode;
  category: PlaybookCategory;
  archetype: ArchetypeCodeWithA5;
  archetype_label: string;
  fitd_offer_title: string;
  fitd_default_fee_cents: number;
  retainer_pitch_title: string;
  retainer_fee_cents: number;
  preview_deliverable_type: string | null;
  is_active: boolean;
}
