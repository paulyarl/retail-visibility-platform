/**
 * TriageEngineService — GENERIC evaluator over the matching_rules DSL
 *
 * Pure function: no DB, no async, no side effects. Evaluates active playbooks
 * (loaded from mkt_playbook_catalog ordered by priority_rank) against the
 * campaign's SignalCode[] set, using the §6.4 DSL (any/all/none/dual set
 * membership). First match in priority_rank order wins.
 *
 * This is NOT a hardcoded if/else cascade. The cascade order lives in the
 * catalog's `priority_rank` column; the rule criteria live in each
 * playbook's `matching_rules` JSONB. Admins can reorder, add, or disable
 * playbooks/rules from the UI without a deploy (Sprint 4 Rule Builder).
 *
 * §6.4 DSL semantics:
 *   A playbook matches when:
 *     - at least one `any` code is present (or `any` is empty), AND
 *     - every `all` code is present, AND
 *     - no `none` code is present, AND
 *     - (if `dual` set) ≥1 code from each of `groupA` and `groupB` is present.
 *   First match in `priority_rank` order wins. `none` is how PB-05 expresses
 *   "no active BBB crisis."
 *
 * Unknown codes in rules or detected signals are ignored with a warning log
 * — forward-compatible with signals registered later.
 *
 * `confidence` comes from the winning playbook's matching_rules.confidence
 * (admin-tunable). The UI must label it "Rule Confidence" / "Signal Match
 * Strength" per Risk 3 — NOT "ML confidence."
 *
 * Spec: docs/LocalBiz/marketing_ops_playbook_catalog_triage_sprint_plan.md
 * Sprint 2A — Platform Signal Taxonomy & Signal-Code Pipeline (§6.4 DSL)
 */

import type {
  TriageRecommendation,
  DetectedSignal,
  PlaybookCatalogRow,
  MatchingRules,
  PlaybookCode,
} from './types';
import {
  isRepairSignal,
  isReviewSignal,
  isCrisisSignal,
  isVisualSignal,
  isOutreachStateSignal,
  signalLabel,
  type SignalCode,
} from './signal-taxonomy';

// ─── DSL evaluator ───────────────────────────────────────────────────────

/**
 * Evaluate a single playbook's matching_rules against a SignalCode[] set.
 * Returns true if the playbook matches (all clauses satisfied).
 *
 * Semantics (§6.4):
 *   - `any`: ≥1 code present (or empty → pass)
 *   - `all`: every code present (or empty → pass)
 *   - `none`: no code present (or empty → pass)
 *   - `dual`: ≥1 from groupA AND ≥1 from groupB (or null → pass)
 */
export function ruleMatches(
  rules: MatchingRules,
  signals: ReadonlySet<SignalCode>,
): boolean {
  // any: at least one code present (empty array → pass)
  if (rules.any.length > 0) {
    const anyMatch = rules.any.some((code) => signals.has(code));
    if (!anyMatch) return false;
  }

  // all: every code present (empty array → pass)
  if (rules.all.length > 0) {
    const allMatch = rules.all.every((code) => signals.has(code));
    if (!allMatch) return false;
  }

  // none: no code present (empty array → pass)
  if (rules.none.length > 0) {
    const nonePresent = rules.none.some((code) => signals.has(code));
    if (nonePresent) return false;
  }

  // dual: ≥1 from groupA AND ≥1 from groupB (null → pass)
  if (rules.dual) {
    const groupAMatch = rules.dual.groupA.some((code) => signals.has(code));
    if (!groupAMatch) return false;
    const groupBMatch = rules.dual.groupB.some((code) => signals.has(code));
    if (!groupBMatch) return false;
  }

  return true;
}

// ─── Reasoning builder ───────────────────────────────────────────────────

/**
 * Build a human-readable reasoning string for the winning playbook, naming
 * the triggered signals and which clause matched. Uses the family predicates
 * for natural-language grouping (e.g., "repair + review signals present").
 */
function buildReasoning(
  playbook: PlaybookCatalogRow,
  signals: ReadonlySet<SignalCode>,
  rules: MatchingRules,
): string {
  const detected = Array.from(signals);
  const repair = detected.filter(isRepairSignal);
  const review = detected.filter(isReviewSignal);
  const crisis = detected.filter(isCrisisSignal);
  const visual = detected.filter(isVisualSignal);

  const parts: string[] = [];

  // Name the winning playbook + its primary trigger
  parts.push(`${playbook.code} (${playbook.name})`);

  if (rules.dual) {
    parts.push(
      `dual trigger: ${repair.length} repair signal(s) + ${review.length} review signal(s) present, no active BBB crisis`,
    );
  } else if (rules.none.length > 0 && crisis.length === 0) {
    parts.push(`crisis guard passed (no ${rules.none.join('/')} present)`);
  } else if (crisis.length > 0) {
    parts.push(`crisis signal(s): ${crisis.join(', ')}`);
  }

  if (repair.length > 0 && rules.dual === null) {
    parts.push(`repair signals: ${repair.join(', ')}`);
  }
  if (review.length > 0 && rules.dual === null) {
    parts.push(`review signals: ${review.join(', ')}`);
  }
  if (visual.length > 0) {
    parts.push(`visual signals: ${visual.join(', ')}`);
  }

  // List any other detected signals not yet mentioned
  const mentioned = new Set<SignalCode>([
    ...repair,
    ...review,
    ...crisis,
    ...visual,
  ]);
  const other = detected.filter((s) => !mentioned.has(s));
  if (other.length > 0) {
    parts.push(`other signals: ${other.join(', ')}`);
  }

  if (detected.length === 0) {
    parts.push('no actionable signals detected — fallback playbook');
  }

  return parts.join('; ');
}

// ─── DetectedSignal[] builder ────────────────────────────────────────────

/**
 * Build the DetectedSignal[] array for the recommendation, marking which
 * signals contributed to the winning rule (appeared in any/all/dual clauses)
 * vs. which were merely detected.
 */
function buildDetectedSignals(
  signals: ReadonlySet<SignalCode>,
  rules: MatchingRules,
): DetectedSignal[] {
  const contributingCodes = new Set<SignalCode>([
    ...rules.any,
    ...rules.all,
    ...(rules.dual?.groupA ?? []),
    ...(rules.dual?.groupB ?? []),
  ]);

  return Array.from(signals).map((code) => ({
    code,
    label: signalLabel(code),
    contributedToRule: contributingCodes.has(code),
  }));
}

// ─── Main evaluator ──────────────────────────────────────────────────────

/**
 * Evaluate the triage cascade: load active playbooks ordered by priority_rank,
 * evaluate each playbook's matching_rules against the SignalCode[] set, and
 * return the first match.
 *
 * @param signals  The campaign's detected SignalCode[] array
 * @param playbooks Active playbooks from mkt_playbook_catalog, ordered by
 *                  priority_rank ascending. The caller (CampaignTriageService)
 *                  is responsible for fetching + ordering.
 * @returns TriageRecommendation, or null if no playbook matched (should not
 *          happen if PB-03 is seeded with empty any/all/none as the fallback).
 */
export function evaluateTriage(
  signals: SignalCode[],
  playbooks: PlaybookCatalogRow[],
): TriageRecommendation | null {
  // Filter out OX_* (outreach-state) signals — they're display-only and
  // must not influence playbook selection (they track outreach execution
  // state, not prospect problems).
  const signalSet = new Set(signals.filter((s) => !isOutreachStateSignal(s)));

  // Playbooks are expected to be pre-sorted by priority_rank ascending.
  // Sort defensively in case the caller didn't.
  const sorted = [...playbooks].sort((a, b) => a.priorityRank - b.priorityRank);

  for (const playbook of sorted) {
    if (!playbook.isActive) continue;

    const rules = playbook.matchingRules;
    if (ruleMatches(rules, signalSet)) {
      return {
        playbookCode: playbook.code,
        playbookName: playbook.name,
        category: playbook.category,
        archetype: playbook.archetype,
        confidence: rules.confidence,
        reasoning: buildReasoning(playbook, signalSet, rules),
        detectedSignals: buildDetectedSignals(signalSet, rules),
      };
    }
  }

  // No playbook matched. This is a configuration error if PB-03 (the
  // fallback) is seeded correctly with empty any/all/none — it should match
  // any signal set (including empty). Return null to signal the issue.
  return null;
}

// ─── Multi-archetype: all matching playbooks (sibling creation) ──────────

/**
 * Evaluate ALL matching playbooks for a signal set, ranked by priority_rank.
 * Unlike evaluateTriage (which returns only the first match), this returns
 * every playbook whose matching_rules are satisfied by the signal set.
 *
 * Used by CampaignTriageService.evaluateAllForCampaign to present the
 * operator with all qualifying archetypes as sibling-creation suggestions.
 * The first element is the winner (same as evaluateTriage's result).
 *
 * Each recommendation includes detectedSignals so the operator can see
 * which signals triggered each alternative playbook.
 *
 * @param signals  SignalCode[] from the extractor (post operator enrichment).
 * @param playbooks Active playbooks from mkt_playbook_catalog, ordered by
 *                  priority_rank ascending.
 * @returns TriageRecommendation[] — all matching playbooks, ranked by
 *          priority_rank. Empty if no playbook matched (should not happen
 *          if PB-03 is seeded as the fallback).
 */
export function evaluateAllMatchingPlaybooks(
  signals: SignalCode[],
  playbooks: PlaybookCatalogRow[],
): TriageRecommendation[] {
  // Filter out OX_* (outreach-state) signals — display-only, not prospect problems.
  const signalSet = new Set(signals.filter((s) => !isOutreachStateSignal(s)));
  const sorted = [...playbooks].sort((a, b) => a.priorityRank - b.priorityRank);
  const matches: TriageRecommendation[] = [];

  for (const playbook of sorted) {
    if (!playbook.isActive) continue;

    const rules = playbook.matchingRules;
    if (ruleMatches(rules, signalSet)) {
      matches.push({
        playbookCode: playbook.code,
        playbookName: playbook.name,
        category: playbook.category,
        archetype: playbook.archetype,
        confidence: rules.confidence,
        reasoning: buildReasoning(playbook, signalSet, rules),
        detectedSignals: buildDetectedSignals(signalSet, rules),
      });
    }
  }

  return matches;
}

// ─── Fallback recommendation (for misconfiguration) ──────────────────────

/**
 * Build a fallback recommendation pointing at PB-03 (the seeded fallback
 * playbook) when no playbook matched. This is a safety net for
 * misconfiguration — the caller should log a warning.
 */
export function fallbackRecommendation(
  signals: SignalCode[],
  fallback: PlaybookCatalogRow,
): TriageRecommendation {
  const signalSet = new Set(signals);
  return {
    playbookCode: fallback.code,
    playbookName: fallback.name,
    category: fallback.category,
    archetype: fallback.archetype,
    confidence: fallback.matchingRules.confidence,
    reasoning: `fallback: no playbook rule matched; defaulting to ${fallback.code} (${fallback.name})`,
    detectedSignals: buildDetectedSignals(signalSet, fallback.matchingRules),
  };
}

// ─── Re-export for callers ───────────────────────────────────────────────

export type { PlaybookCode };
