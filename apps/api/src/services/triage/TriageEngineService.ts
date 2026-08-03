/**
 * TriageEngineService — deterministic priority cascade over NormalizedSignals
 *
 * Pure function: no DB, no async, no side effects. Maps NormalizedSignals to
 * a TriageRecommendation using the spec's fixed priority order:
 *
 *   Rule 1 (PB-04) BBB Emergency Recovery      — highest priority, requires BBB input
 *   Rule 2 (PB-05) Multi-Signal Footprint Triage — both repair AND review signals
 *   Rule 3 (PB-01) Pure Profile Repair          — repair signal, no review gap
 *   Rule 4 (PB-02) Pure Review Gap              — review gap, no repair signal
 *   Rule 5 (PB-03) Fallback CTA Gap             — lowest priority
 *
 * Hardcoded confidence scores (roadmap §6.2):
 *   PB-04: 0.95  |  PB-05: 0.90  |  PB-01/PB-02: 0.85  |  PB-03: 0.70
 *
 * `confidence` is a proxy for rule specificity/severity, NOT an ML probability.
 * The UI must label it "Rule Confidence" / "Signal Match Strength".
 *
 * Spec: docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md §6
 * Sprint 2 — Signal Extractor & Triage Engine.
 */

import type {
  NormalizedSignals,
  TriageRecommendation,
  DetectedSignal,
  PlaybookCode,
  PlaybookCategory,
  ArchetypeCodeWithA5,
} from './types';
import { signalPredicates } from './signal-extractor';

// ─── Hardcoded confidence scores ─────────────────────────────────────────

export const CONFIDENCE: Record<PlaybookCode, number> = {
  'PB-01': 0.85,
  'PB-02': 0.85,
  'PB-03': 0.70,
  'PB-04': 0.95,
  'PB-05': 0.90,
};

// ─── Rule metadata ───────────────────────────────────────────────────────

interface RuleOutcome {
  playbookCode: PlaybookCode;
  category: PlaybookCategory;
  archetype: ArchetypeCodeWithA5;
  confidence: number;
  reasoning: string;
}

// ─── Signal recording helper ─────────────────────────────────────────────

/**
 * Build the detected_signals array for the recommendation. Every signal is
 * recorded with its raw value; `contributedToRule` marks the ones that
 * triggered the winning rule (for the admin UI's "triggered signals" view).
 */
function recordSignals(
  signals: NormalizedSignals,
  contributed: Array<keyof NormalizedSignals>,
): DetectedSignal[] {
  const contributedSet = new Set(contributed);
  return (Object.keys(signals) as Array<keyof NormalizedSignals>).map((signal) => ({
    signal,
    value: signals[signal] as DetectedSignal['value'],
    contributedToRule: contributedSet.has(signal),
  }));
}

// ─── Cascade ─────────────────────────────────────────────────────────────

/**
 * Evaluate normalized signals against the deterministic priority cascade and
 * return a TriageRecommendation. Pure function.
 *
 * Order matters: the first matching rule wins. PB-04 is gated on BBB input
 * being present (roadmap Risk 1) — when bbbGrade is undefined AND
 * unansweredBbbComplaints is 0, Rule 1 is skipped entirely.
 */
export function evaluateTriage(signals: NormalizedSignals): TriageRecommendation {
  const preds = signalPredicates;

  // ── Rule 1: BBB Emergency Recovery (PB-04) ────────────────────────────
  // Highest priority. Requires operator-supplied BBB input. When BBB data is
  // absent (bbbGrade undefined AND unansweredBbbComplaints 0), skip — PB-04
  // cannot fire on inferred signals alone.
  const bbbProvided =
    signals.bbbGrade !== undefined || signals.unansweredBbbComplaints > 0;
  if (bbbProvided && preds.bbbEmergency(signals)) {
    return buildRecommendation(
      signals,
      {
        playbookCode: 'PB-04',
        category: 'recovery_management',
        archetype: 'A2',
        confidence: CONFIDENCE['PB-04'],
        reasoning: bbbReasoning(signals),
      },
      ['bbbGrade', 'unansweredBbbComplaints'],
    );
  }

  // ── Rule 2: Multi-Signal Footprint Triage (PB-05) ─────────────────────
  // Both a repair signal (NAP/dead-URL/mismatch) AND a review gap must fire.
  const repair = preds.hasRepairSignal(signals);
  const reviewGap = preds.hasReviewGap(signals);
  if (repair && reviewGap) {
    return buildRecommendation(
      signals,
      {
        playbookCode: 'PB-05',
        category: 'triage_management',
        archetype: 'A5',
        confidence: CONFIDENCE['PB-05'],
        reasoning: dualTriageReasoning(signals),
      },
      ['napInconsistent', 'hasDeadUrl', 'urlMismatch', 'daysSinceLastReview', 'unaddressedReviewCount'],
    );
  }

  // ── Rule 3: Pure Profile Repair (PB-01) ───────────────────────────────
  if (repair) {
    return buildRecommendation(
      signals,
      {
        playbookCode: 'PB-01',
        category: 'review_management',
        archetype: 'A3',
        confidence: CONFIDENCE['PB-01'],
        reasoning: profileRepairReasoning(signals),
      },
      ['napInconsistent', 'hasDeadUrl', 'urlMismatch'],
    );
  }

  // ── Rule 4: Pure Review Gap (PB-02) ───────────────────────────────────
  if (reviewGap) {
    return buildRecommendation(
      signals,
      {
        playbookCode: 'PB-02',
        category: 'review_management',
        archetype: 'A1',
        confidence: CONFIDENCE['PB-02'],
        reasoning: reviewGapReasoning(signals),
      },
      ['daysSinceLastReview', 'unaddressedReviewCount'],
    );
  }

  // ── Rule 5: Fallback CTA Gap (PB-03) ───────────────────────────────────
  // Lowest priority. Fires when no repair or review signal fired but there is
  // website CTA friction. If even CTA is clean, still returns PB-03 as the
  // spec's terminal fallback (confidence 0.70).
  return buildRecommendation(
    signals,
    {
      playbookCode: 'PB-03',
      category: 'review_management',
      archetype: 'A4',
      confidence: CONFIDENCE['PB-03'],
      reasoning: ctaFallbackReasoning(signals),
    },
    signals.hasCtaFriction ? ['hasCtaFriction'] : [],
  );
}

// ─── Reasoning builders ──────────────────────────────────────────────────

function bbbReasoning(s: NormalizedSignals): string {
  if (s.unansweredBbbComplaints > 0 && s.bbbGrade) {
    return `BBB emergency: grade ${s.bbbGrade} with ${s.unansweredBbbComplaints} unanswered BBB complaints`;
  }
  if (s.unansweredBbbComplaints > 0) {
    return `BBB emergency: ${s.unansweredBbbComplaints} unanswered BBB complaints`;
  }
  return `BBB emergency: grade ${s.bbbGrade} (C or below)`;
}

function dualTriageReasoning(s: NormalizedSignals): string {
  const repairParts: string[] = [];
  if (s.napInconsistent) repairParts.push('NAP inconsistency');
  if (s.hasDeadUrl) repairParts.push('dead URL');
  if (s.urlMismatch) repairParts.push('URL mismatch');
  const repair = repairParts.join(', ') || 'repair signal';
  const review =
    s.daysSinceLastReview >= 90
      ? `${s.daysSinceLastReview} days since last review`
      : `${s.unaddressedReviewCount} unaddressed reviews`;
  return `Dual-signal triage: ${repair} AND review gap (${review})`;
}

function profileRepairReasoning(s: NormalizedSignals): string {
  const parts: string[] = [];
  if (s.napInconsistent) parts.push('NAP inconsistency');
  if (s.hasDeadUrl) parts.push('dead URL');
  if (s.urlMismatch) parts.push('URL mismatch');
  return `Profile repair: ${parts.join(', ')}`;
}

function reviewGapReasoning(s: NormalizedSignals): string {
  if (s.daysSinceLastReview >= 90 && s.unaddressedReviewCount > 0) {
    return `Review gap: ${s.daysSinceLastReview} days since last review, ${s.unaddressedReviewCount} unaddressed`;
  }
  if (s.daysSinceLastReview >= 90) {
    return `Review gap: ${s.daysSinceLastReview} days since last review`;
  }
  return `Review gap: ${s.unaddressedReviewCount} unaddressed reviews`;
}

function ctaFallbackReasoning(s: NormalizedSignals): string {
  if (s.hasCtaFriction) {
    return 'CTA friction: missing call-to-action / click-to-call / online booking';
  }
  return 'Fallback: no repair, review, or CTA signal fired — defaulting to CTA gap playbook';
}

// ─── Recommendation assembly ─────────────────────────────────────────────

function buildRecommendation(
  signals: NormalizedSignals,
  outcome: RuleOutcome,
  contributed: Array<keyof NormalizedSignals>,
): TriageRecommendation {
  return {
    playbookCode: outcome.playbookCode,
    category: outcome.category,
    archetype: outcome.archetype,
    confidence: outcome.confidence,
    reasoning: outcome.reasoning,
    detectedSignals: recordSignals(signals, contributed),
  };
}
