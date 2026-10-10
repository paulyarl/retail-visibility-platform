/**
 * project-phase-gate — Phase 5.3 owner-facing quality gate (spec §11).
 *
 * Pure function over the computed plan. A plan fails the gate if ANY of
 * the §11 conditions hold:
 *
 *   1. A phase is unsuppressed with no trigger signals (or domain request).
 *   2. An owner-facing phase references a disabled capability.
 *   3. Generated owner-facing narrative contains a §9 forbidden term —
 *      attributed verbatim review quotes are exempt.
 *   4. Owner-facing phase count exceeds the tier cap.
 *   5. The plan carries a second public listing / a second live seed.
 *   6. Two phases describe the same action.
 *   7. The claim CTA renders while the wedge seed is misaligned.
 *   8. A `verified` phase lacks full-lane evidence, or a `suggested` phase
 *      appears in owner-facing output.
 *
 * Spec: docs/LocalBiz/marketing_ops_project_phase_spec.md §9/§11.
 */

import type { SignalCode } from '../triage/signal-taxonomy';
import { severityRank } from './signal-magnitude';
import type { ProjectPhasePlan, ProjectPhase, EstimatedTier } from './project-phases';
import type { PhaseEvidenceRow } from './project-phase-evidence';
import type { OwnerFacingPhase } from './project-phases';
import { toOwnerFacingPhases } from './project-phases';

export interface ProjectPhaseGateResult {
  passed: boolean;
  issues: string[];
}

// ─── Forbidden terms (spec §9 — generated narrative only) ────────────────

const FORBIDDEN_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bA[1-7]\b/, label: 'archetype code' },
  { pattern: /\b(?:RA|DS|WC|CP|VP|OX|INT)_[A-Z_0-9]+\b/, label: 'signal code' },
  { pattern: /review response gap/i, label: 'internal label' },
  { pattern: /\btriage\b/i, label: 'internal term: triage' },
  { pattern: /\btier[\s_]?[123]\b/i, label: 'tier label' },
  { pattern: /\$[\d,]+/, label: 'pricing ($ amount)' },
  { pattern: /\bfee\b/i, label: 'fee mention' },
  { pattern: /digital opportunity score/i, label: 'digital opportunity score' },
  { pattern: /\bpipeline\b/i, label: 'internal term: pipeline' },
  { pattern: /\bstages?\b/i, label: 'internal term: stage' },
  { pattern: /\bsiblings?\b/i, label: 'internal term: sibling' },
  { pattern: /\bseeds?\b/i, label: 'internal term: seed' },
  { pattern: /\bcycles?\b/i, label: 'internal term: cycle' },
  { pattern: /\bscans?\b/i, label: 'internal term: scan' },
];

const TIER_CAPS: Record<EstimatedTier, number> = { tier_1: 5, tier_2: 3, tier_3: 2 };

function normalizeAction(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Narrative text subject to §9 scanning — name/goal/actions/exit copy plus
 * non-quote evidence values. Verbatim quotes (`isQuote`) are exempt.
 */
function narrativeStrings(p: ProjectPhase): string[] {
  const out = [p.name, p.goal, p.exitCriterion.copy];
  for (const a of p.actions) out.push(a.text);
  for (const e of p.evidence as PhaseEvidenceRow[]) {
    if (!e.isQuote) out.push(e.value);
  }
  return out;
}

/**
 * runProjectPhaseGate — §11. `ownerPhases` defaults to the plan's own
 * owner projection; pass an explicitly rendered projection when the
 * endpoint builds one with additional fields.
 */
export function runProjectPhaseGate(
  plan: ProjectPhasePlan,
  ownerPhases: OwnerFacingPhase[] = toOwnerFacingPhases(plan),
): ProjectPhaseGateResult {
  const issues: string[] = [];

  // 1. Unsuppressed phase with no trigger evidence.
  for (const p of plan.phases) {
    if (!p.suppressedReason && p.triggerSignals.length === 0 && !p.triggeredByDomainRequest) {
      issues.push(`phase '${p.key}' is unsuppressed with no trigger signals`);
    }
  }

  // 2. Owner-facing phase references a disabled capability.
  const ownerKeys = new Set(ownerPhases.map((p) => p.key));
  for (const p of plan.phases) {
    if (ownerKeys.has(p.key) && !p.capability.enabled) {
      issues.push(`owner-facing phase '${p.key}' references a disabled capability (${p.capability.required.join(', ')})`);
    }
  }

  // 3. Forbidden terms in generated narrative (quotes exempt).
  for (const p of plan.phases) {
    if (p.suppressedReason) continue;
    for (const text of narrativeStrings(p)) {
      for (const { pattern, label } of FORBIDDEN_PATTERNS) {
        if (pattern.test(text)) {
          issues.push(`phase '${p.key}' narrative contains forbidden term (${label}): "${text.slice(0, 80)}"`);
        }
      }
    }
  }

  // 4. Owner-facing phase count exceeds the tier cap.
  const cap = plan.estimatedTier ? TIER_CAPS[plan.estimatedTier] : 3;
  if (ownerPhases.length > cap) {
    issues.push(`owner-facing phase count ${ownerPhases.length} exceeds ${plan.estimatedTier ?? 'default'} cap ${cap}`);
  }

  // 5. Single-seed rule — at most one live seed across the plan.
  const liveSeeds =
    plan.publicSurfaces.filter((s) => s.seed != null).length + (plan.seedClaim ? 1 : 0);
  if (liveSeeds > 1) {
    issues.push(`plan carries ${liveSeeds} live seeds — the single-seed rule allows one`);
  }

  // 6. Two phases describe the same action.
  const actionSeen = new Map<string, string>();
  for (const p of plan.phases) {
    if (p.suppressedReason) continue;
    for (const a of p.actions) {
      const key = normalizeAction(a.text);
      const prior = actionSeen.get(key);
      if (prior && prior !== p.key) {
        issues.push(`phases '${prior}' and '${p.key}' describe the same action: "${a.text}"`);
      } else {
        actionSeen.set(key, p.key);
      }
    }
  }

  // 7. Claim CTA while the wedge seed is misaligned.
  if (plan.seedClaim?.fidelity === 'misaligned' && plan.seedClaim.claimUrl) {
    issues.push('claim CTA renders while the wedge seed is misaligned');
  }

  // 8a. A verified phase has no full-lane evidence — verified requires at
  // least one full-lane (or operator-input) trigger signal.
  for (const p of plan.phases) {
    if (p.confidence !== 'verified' || p.suppressedReason) continue;
    const hasFullLane =
      p.triggeredByDomainRequest === true ||
      p.triggerSignals.some((c) => (plan.signalLanes[c] ?? 'full') === 'full');
    if (!hasFullLane) {
      issues.push(`verified phase '${p.key}' has no full-lane evidence`);
    }
  }

  // 8b. A suggested phase appears in owner-facing output — the projection
  // filters by construction; re-assert for hand-built projections.
  const internalByKey = new Map(plan.phases.map((p) => [p.key, p]));
  for (const op of ownerPhases) {
    const internal = internalByKey.get(op.key);
    if (internal?.confidence === 'suggested' || internal?.suppressedReason) {
      issues.push(`phase '${op.key}' appears in owner-facing output but is ${internal.confidence === 'suggested' ? 'suggested' : 'suppressed'}`);
    }
  }

  return { passed: issues.length === 0, issues };
}
