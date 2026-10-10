/**
 * project-phases — the pure project-plan evaluator (spec §5/§8/§12).
 *
 * `selectProjectPhases` is a pure function: no DB, no async, no side effects.
 * All I/O (signal resolution, predicate rows, playbook pools, capability
 * state, seed/surface assembly) is resolved by the caller and passed in.
 *
 * Phase selection is predicate-driven: `any_of` signal sets loaded from
 * `mkt_project_phase_predicates` at `predicateSeedVersion` (v1 constant is
 * the same data — `lib/project-phase-predicates.ts`). A phase is not an
 * entity with a lifecycle — it is a computed projection over the prospect's
 * canonical signal set, re-derived on every read.
 *
 * Spec: docs/LocalBiz/marketing_ops_project_phase_spec.md
 */

import type { SignalCode } from '../triage/signal-taxonomy';
import {
  computeSignalSeverity,
  severityRank,
  type SignalSeverity,
} from './signal-magnitude';
import type { BusinessAnalysisAuditData } from './archetype-selection';
import type { PhaseEvidenceRow } from './project-phase-evidence';
import {
  PROJECT_PHASE_CATALOG_ORDER,
  PROJECT_PHASE_PREDICATES_V1,
  type ProjectPhaseKey,
  type ProjectPhasePredicateSeed,
} from '../../lib/project-phase-predicates';

// ─── Contract types (spec §12) ───────────────────────────────────────────

export type { ProjectPhaseKey };
export type PhaseStatus = 'not_started' | 'in_progress' | 'complete' | 'blocked';

export type PhaseExitPredicate =
  | 'signal_set_empty' // trigger set empty on re-extraction
  | 'nap_consistent' // audit overall_status = 'consistent' or campaign nap_consistent
  | 'gbp_claimed' // campaign gbp_claimed = true, or re-audit claimed/likely_claimed
  | 'seed_status' // wedge seed in published/invited/claimed
  | 'manual'; // operator-confirmed

export type PlanLane = 'full' | 'partial' | 'none';
export type SignalLane = 'full' | 'partial';
export type EstimatedTier = 'tier_1' | 'tier_2' | 'tier_3';
export type SeedFidelity = 'aligned' | 'thin' | 'misaligned' | 'unknown';
export type SeedStatus = 'draft' | 'published' | 'invited' | 'claimed' | 'suppressed';

export interface ProjectPhaseInput {
  predicateSeedVersion: number;
  lane: PlanLane;
  signals: SignalCode[];
  signalLanes: Partial<Record<SignalCode, SignalLane>>;
  discoverySignals: string[];
  sourceAuditId: string | null;
  audit: BusinessAnalysisAuditData | null;
  siblings: {
    campaignId: string;
    isPrimary: boolean;
    playbookCode: string | null;
    archetype: string | null;
    stage: string;
    detectedSignals: SignalCode[];
  }[];
  capabilities: {
    storefrontEnabled: boolean;
    subdomainEnabled: boolean;
    qrPrintEnabled: boolean;
    domainEnabled: boolean;
  };
  estimatedTier: EstimatedTier | null;
  operatorInputs?: { domainRequested?: boolean };
}

export interface ProjectPhase {
  key: ProjectPhaseKey;
  name: string;
  goal: string;
  confidence: 'verified' | 'suggested';
  severity: number;
  triggerSignals: SignalCode[];
  /** True when Expansion was triggered by operatorInputs.domainRequested —
   *  not a signal, but a valid trigger under §5/the §11 gate. */
  triggeredByDomainRequest?: boolean;
  contributingCampaignIds: string[];
  /** Spec §12 rows: {campaignId, field, value, signalCode?} — `isQuote` +
   *  `attribution` extend it for the verbatim-quote gate exemption (§9). */
  evidence: PhaseEvidenceRow[];
  actions: { text: string; ownerAction: boolean }[];
  capability: { required: string[]; enabled: boolean };
  status: PhaseStatus;
  exitCriterion: { copy: string; predicate?: PhaseExitPredicate };
  suppressedReason?: 'pain_tier_cap' | 'capability_disabled' | 'not_triggered';
}

export interface ProjectPhasePlan {
  businessProspectId: string | null;
  engagementCycle: number;
  estimatedTier: EstimatedTier | null;
  predicateSeedVersion: number;
  /** Lane of the source audit — 'none' on an empty plan (spec §12). The
   *  cockpit header band renders it; per-signal provenance lives on
   *  `signalLanes`. */
  lane: PlanLane;
  signals: SignalCode[];
  sourceAuditId: string | null;
  seedClaim: {
    seedId: string;
    status: SeedStatus;
    placeUrl: string | null;
    claimUrl: string | null;
    fidelity: SeedFidelity;
  } | null;
  publicSurfaces: {
    campaignId: string;
    seed: {
      seedId: string;
      status: SeedStatus;
      placeUrl: string;
      fidelity?: SeedFidelity;
    } | null;
    /** Suppressed linked seeds — operator-visible audit history, never a
     *  live surface (sprint 7.5). */
    retiredSeeds: { seedId: string; status: SeedStatus; placeUrl: string }[];
    demoStorefrontUrl: string | null;
  }[];
  phases: ProjectPhase[];
  generatedAt: string;
  /** Per-signal provenance — internal only; the owner projection strips it.
   *  The gate reads it for the verified-phase/full-lane-evidence rule. */
  signalLanes: Partial<Record<SignalCode, SignalLane>>;
}

// ─── Stage sets (spec §8, per REVIEW_/RECOVERY_TRANSITIONS) ──────────────

export const ACTIVE_STAGES: readonly string[] = [
  // Review track
  'seed',
  'preview_built',
  'shown',
  'paid',
  'retainer_pitched',
  'gbp_intake_submitted',
  'review_setup_submitted',
  'repair_access_submitted',
  // Recovery track
  'framework_preview_generated',
  'outreach_dispatched',
  'awaiting_owner_intake',
  'intake_submitted',
  'final_resolution_drafted',
  'owner_approved',
];

export const TERMINAL_COMPLETE_STAGES: readonly string[] = [
  // Review track
  'delivered',
  'closed',
  'retainer_won',
  'tenant_onboarded',
  // Recovery track
  'resolved_and_closed',
];

/** Neither active nor complete — resurrection edges exist, so "stalled". */
export const STALLED_STAGES: readonly string[] = ['lost', 'dead'];

// ─── Evaluation context (I/O-resolved inputs beyond the §12 contract) ────

export interface EvaluationContext {
  /** Predicate rows at predicateSeedVersion. Defaults to the v1 constant. */
  predicates?: readonly ProjectPhasePredicateSeed[];
  /** Playbook signal pools for sibling attribution: playbookCode → the union
   *  of matching_rules any/all/dual codes (never `none`). */
  playbookSignalPools?: Record<string, SignalCode[]>;
  /** Exit-predicate facts assembled by the resolver. */
  facts?: {
    /** mkt_campaigns_list.nap_consistent on the primary sibling. */
    napConsistent?: boolean;
    /** mkt_campaigns_list.gbp_claimed on the primary sibling. */
    gbpClaimed?: boolean;
    /** Wedge seed status for the Findability exit. */
    wedgeSeedStatus?: string | null;
    /** Storefront live on the demo tenant. */
    demoStorefrontLive?: boolean;
  };
  businessProspectId?: string | null;
  engagementCycle?: number;
}

// ─── Catalog constants ───────────────────────────────────────────────────

/** Phase-level capability gates (spec §7). Findability display requires the
 *  subdomain capability; storefront/QR/domain are item-level gates. */
const PHASE_REQUIRED_CAPABILITIES: Record<ProjectPhaseKey, string[]> = {
  foundation: [],
  claim: [],
  findability: ['subdomainEnabled'],
  trust: [],
  expansion: [],
};

/** Declared dependency edges (spec §6): Findability depends on Foundation. */
const PHASE_DEPENDENCIES: Partial<Record<ProjectPhaseKey, ProjectPhaseKey[]>> = {
  findability: ['foundation'],
};

const PHASE_DISPLAY: Record<ProjectPhaseKey, { name: string; goal: string; exitCopy: string; exitPredicate?: PhaseExitPredicate }> = {
  foundation: {
    name: 'Foundation',
    goal: 'Make sure your name, address, and phone are right everywhere customers look.',
    exitCopy: 'Your business details match across the platforms we checked.',
    exitPredicate: 'nap_consistent',
  },
  claim: {
    name: 'Claim',
    goal: 'Confirm ownership of your public business profile.',
    exitCopy: 'Your business profile is claimed and under your control.',
    exitPredicate: 'gbp_claimed',
  },
  findability: {
    name: 'Findability',
    goal: 'Give customers a live place to find your business, products, and hours.',
    exitCopy: 'Your listing is live and visible to customers.',
    exitPredicate: 'seed_status',
  },
  trust: {
    name: 'Trust',
    goal: 'Strengthen what customers see about your reputation.',
    exitCopy: 'Outstanding reputation items are addressed.',
    exitPredicate: 'signal_set_empty',
  },
  expansion: {
    name: 'Expansion',
    goal: 'Extend your reach with the next growth surface.',
    exitCopy: 'The expansion item is delivered.',
    exitPredicate: 'manual',
  },
};

/** Archetype-fallback attribution (spec §5) for siblings with no playbook. */
const ARCHETYPE_PHASE_MAP: Record<string, ProjectPhaseKey[]> = {
  A3: ['foundation'],
  A1: ['trust'],
  A2: ['trust'],
  A6: ['findability'],
  A7: ['findability'],
  A4: ['expansion'],
};

const TIER_CAPS: Record<EstimatedTier, number> = {
  tier_1: 5,
  tier_2: 3,
  tier_3: 2,
};
const NULL_TIER_CAP = 3;

// ─── Evaluator ───────────────────────────────────────────────────────────

interface EvaluatedPhase extends ProjectPhase {
  /** Internal rank/status inputs — stripped before output. */
  _intBoost: boolean;
  _triggered: boolean;
  _dependencyBlocked?: boolean;
}

function laneOf(input: ProjectPhaseInput, code: SignalCode): SignalLane {
  return input.signalLanes[code] ?? (input.lane === 'partial' ? 'partial' : 'full');
}

/** Exit predicate evaluation (spec §8). Facts come from the resolver. */
function exitPredicateHolds(
  key: ProjectPhaseKey,
  input: ProjectPhaseInput,
  ctx: EvaluationContext,
  triggered: boolean,
  triggerSignals: SignalCode[],
): boolean {
  const facts = ctx.facts ?? {};
  const audit = input.audit as any;
  switch (key) {
    case 'foundation':
      return (
        audit?.nap_consistency?.overall_status === 'consistent' || facts.napConsistent === true
      );
    case 'claim': {
      const status = audit?.platforms?.google?.profile_status;
      return facts.gbpClaimed === true || status === 'claimed' || status === 'likely_claimed';
    }
    case 'findability':
      return (
        (facts.wedgeSeedStatus != null &&
          ['published', 'invited', 'claimed'].includes(facts.wedgeSeedStatus)) ||
        facts.demoStorefrontLive === true
      );
    case 'trust': {
      // §8: "re-extracted signals no longer contain
      // RA_UNADDRESSED_NEGATIVE_BACKLOG." "No longer" presupposes the backlog
      // WAS the trigger — a vacuous absence must not complete a trust phase
      // driven by other live gaps (drought, BBB), or every backlog-free
      // prospect would render Trust 'complete' forever. In a stateless read
      // the backlog can only be proven absent when it isn't in signals —
      // and it can only have been the trigger when it is — so this can't
      // fire in the same evaluation. Trust completes via terminal-complete
      // contributing siblings; a future trigger-memory input can enable
      // this exit path for real.
      return (
        triggered &&
        triggerSignals.includes('RA_UNADDRESSED_NEGATIVE_BACKLOG') &&
        !input.signals.includes('RA_UNADDRESSED_NEGATIVE_BACKLOG')
      );
    }
    case 'expansion':
      return false; // manual/operator-confirmed in v1
  }
}

/**
 * Attribute contributing siblings to one phase (spec §5):
 *   - Playbook siblings: (detectedSignals ∩ matchingRuleSignals(playbook)) ∩
 *     phase triggers — never raw detectedSignals alone (triage siblings
 *     inherit the source campaign's full set).
 *   - Playbook-less siblings: resolved-archetype map; A5 maps to the union
 *     of its component signals' phases (raw detected ∩ triggers).
 */
function attributePhase(
  phaseKey: ProjectPhaseKey,
  phaseTriggers: Set<SignalCode>,
  input: ProjectPhaseInput,
  pools: Record<string, SignalCode[]>,
): string[] {
  const out: string[] = [];
  for (const s of input.siblings) {
    const pool = s.playbookCode ? pools[s.playbookCode] : undefined;
    if (pool) {
      const poolSet = new Set<SignalCode>(pool);
      if (s.detectedSignals.some((c) => poolSet.has(c) && phaseTriggers.has(c))) {
        out.push(s.campaignId);
      }
      continue;
    }
    const mapped = s.archetype ? ARCHETYPE_PHASE_MAP[s.archetype] : null;
    if (mapped) {
      if (mapped.includes(phaseKey)) out.push(s.campaignId);
      continue;
    }
    // A5 / unmapped: union of component signals' phases.
    if (s.detectedSignals.some((c) => phaseTriggers.has(c))) out.push(s.campaignId);
  }
  return out;
}

/** Status derivation (spec §8) — never advances a pipeline. */
function deriveStatus(args: {
  triggered: boolean;
  capabilityEnabled: boolean;
  dependencyBlocked: boolean;
  exitHolds: boolean;
  contributorStages: string[];
}): { status: PhaseStatus; suppressedReason?: ProjectPhase['suppressedReason'] } {
  const { triggered, capabilityEnabled, dependencyBlocked, exitHolds, contributorStages } = args;
  // An evaluable exit predicate that already holds wins — the work is done
  // even where the capability that would extend it is off, and even where
  // the trigger was vetoed (a claimed profile renders Claim complete, not
  // "not_triggered").
  if (exitHolds) return { status: 'complete' };
  if (!triggered) return { status: 'not_started', suppressedReason: 'not_triggered' };
  if (!capabilityEnabled) {
    return { status: 'blocked', suppressedReason: 'capability_disabled' };
  }
  if (dependencyBlocked) return { status: 'blocked' };
  const complete = new Set(TERMINAL_COMPLETE_STAGES);
  if (
    contributorStages.length > 0 &&
    contributorStages.every((st) => complete.has(st))
  ) {
    return { status: 'complete' };
  }
  const active = new Set(ACTIVE_STAGES);
  if (contributorStages.some((st) => active.has(st))) return { status: 'in_progress' };
  return { status: 'not_started' };
}

/**
 * selectProjectPhases — pure plan evaluation.
 *
 * Sequence per spec §5/§8:
 *   1. Evaluate each predicate's any_of set (+ min_severity floors, + the
 *      Claim audit veto, + the owner-domain-request OR for Expansion, + the
 *      tier_3 Expansion restriction).
 *   2. Attribute contributing siblings (playbook pools / archetype fallback).
 *   3. Confidence from signalLanes; severity from computeSignalSeverity.
 *   4. Rank + tier cap with dependency protection → pain_tier_cap suppression.
 *   5. Dependency blocking (present-and-incomplete deps; absent = satisfied).
 *   6. Status derivation (exit predicate → capability → dependency → stages).
 */
export function selectProjectPhases(
  input: ProjectPhaseInput,
  ctx: EvaluationContext = {},
): ProjectPhasePlan {
  const predicates = ctx.predicates ?? PROJECT_PHASE_PREDICATES_V1;
  const pools = ctx.playbookSignalPools ?? {};
  const audit = (input.audit ?? {}) as BusinessAnalysisAuditData;
  const signalSet = new Set(input.signals);
  const discoverySet = new Set(input.discoverySignals);
  const domainRequested = input.operatorInputs?.domainRequested === true;
  const googleProfileStatus = (input.audit as any)?.platforms?.google?.profile_status;
  // Claim veto (spec §5): the audit's claimed/likely_claimed verdict beats a
  // column-fired DS_CLAIMED_STATUS. 'unable_to_verify' never vetoes.
  const claimVetoed =
    signalSet.has('DS_CLAIMED_STATUS') &&
    (googleProfileStatus === 'claimed' || googleProfileStatus === 'likely_claimed');

  const evaluated: EvaluatedPhase[] = PROJECT_PHASE_CATALOG_ORDER.map((key) => {
    const row = predicates.find((p) => p.phaseKey === key);
    const anyOf = new Set<SignalCode>((row?.signals ?? []) as SignalCode[]);
    const floors = row?.minSeverity ?? null;

    // ── Trigger evaluation ──
    let triggerSignals: SignalCode[] = [];
    if (input.lane !== 'none') {
      for (const code of anyOf) {
        if (!signalSet.has(code)) continue;
        if (floors && floors[code]) {
          const computed = computeSignalSeverity(code, audit);
          if (severityRank(computed) < severityRank(floors[code] as SignalSeverity)) continue;
        }
        triggerSignals.push(code);
      }
    }
    let triggeredByDomainRequest = false;
    if (input.lane !== 'none' && key === 'expansion') {
      if (input.estimatedTier === 'tier_3') {
        // §5: tier_3 plans — only the owner-requested domain triggers
        // Expansion; conversion signals alone do not include it.
        triggerSignals = [];
      }
      triggeredByDomainRequest = domainRequested;
    }
    if (key === 'claim' && claimVetoed) triggerSignals = [];

    const triggered = triggerSignals.length > 0 || triggeredByDomainRequest;
    const phaseTriggerSet = new Set(triggerSignals);

    // ── Attribution / confidence / severity ──
    const contributingCampaignIds = triggered
      ? attributePhase(key, phaseTriggerSet, input, pools)
      : [];
    const anyFullLane =
      triggerSignals.some((c) => laneOf(input, c) === 'full') || triggeredByDomainRequest;
    const confidence: ProjectPhase['confidence'] = anyFullLane ? 'verified' : 'suggested';
    const severity = triggerSignals.reduce(
      (max, c) => Math.max(max, severityRank(computeSignalSeverity(c, audit))),
      0,
    );
    // INT_* boost: a discovery code for the same gap raises cap rank only
    // when the phase is already triggered by an audit-derived signal (§5).
    const intBoost =
      triggered &&
      (row?.intRankModifiers ?? []).some((code) => discoverySet.has(code)) &&
      triggerSignals.length > 0;

    // ── Capability ──
    const required = PHASE_REQUIRED_CAPABILITIES[key];
    const capabilityEnabled = required.every(
      (cap) => input.capabilities[cap as keyof ProjectPhaseInput['capabilities']] === true,
    );

    const display = PHASE_DISPLAY[key];
    return {
      key,
      name: display.name,
      goal: display.goal,
      confidence,
      severity,
      triggerSignals,
      ...(triggeredByDomainRequest ? { triggeredByDomainRequest: true } : {}),
      contributingCampaignIds,
      // Evidence rows and actions are composed by the endpoint via the
      // Phase 5 evidence extractor + copy resolution — the evaluator owns
      // selection/status, not narrative.
      evidence: [],
      actions: [],
      capability: { required, enabled: capabilityEnabled },
      status: 'not_started',
      exitCriterion: { copy: display.exitCopy, predicate: display.exitPredicate },
      _intBoost: intBoost,
      _triggered: triggered,
    };
  });

  // ── Rank + tier cap (spec §5): confidence → severity → INT boost →
  // catalog order. Trim weakest-first; a phase that a kept phase depends on
  // is protected (dependency-blocking is resolved AFTER caps — a suppressed
  // dependency counts as satisfied, §6). ──
  const catalogIndex = new Map(PROJECT_PHASE_CATALOG_ORDER.map((k, i) => [k, i]));
  const rankOf = (p: EvaluatedPhase) =>
    (p.confidence === 'verified' ? 1 : 0) * 100 +
    p.severity * 10 +
    (p._intBoost ? 1 : 0) -
    (catalogIndex.get(p.key) ?? 0) * 0.001;

  const cap = input.estimatedTier ? TIER_CAPS[input.estimatedTier] : NULL_TIER_CAP;
  const triggeredPhases = evaluated.filter((p) => p._triggered);
  const sortedByRank = [...triggeredPhases].sort((a, b) => rankOf(b) - rankOf(a));
  const kept = new Set<ProjectPhaseKey>(sortedByRank.slice(0, cap).map((p) => p.key));

  // Dependency protection: while >cap kept, a trimmed phase that a KEPT
  // phase depends on takes the slot of the weakest unprotected kept phase —
  // never show a phase without its dependency (§5).
  for (const [phase, deps] of Object.entries(PHASE_DEPENDENCIES) as [ProjectPhaseKey, ProjectPhaseKey[]][]) {
    if (!kept.has(phase)) continue;
    for (const dep of deps) {
      const depEval = evaluated.find((p) => p.key === dep);
      if (depEval?._triggered && !kept.has(dep)) {
        // Swap in the dependency for the weakest kept phase that is not
        // itself a dependency of another kept phase.
        const keptList = sortedByRank.filter((p) => kept.has(p.key) && p.key !== phase);
        const swapTarget = [...keptList]
          .sort((a, b) => rankOf(a) - rankOf(b))
          .find((p) =>
            !Object.entries(PHASE_DEPENDENCIES).some(
              ([otherPhase, otherDeps]) =>
                otherPhase !== p.key &&
                kept.has(otherPhase as ProjectPhaseKey) &&
                (otherDeps as ProjectPhaseKey[]).includes(p.key),
            ),
          );
        if (swapTarget && swapTarget.key !== dep) {
          kept.delete(swapTarget.key);
          kept.add(dep);
        } else if (!swapTarget) {
          kept.add(dep); // protection wins over the cap's shown count
        }
      }
    }
  }

  // ── Dependency blocking: a present (triggered + not cap-suppressed)
  // dependency that is not complete blocks the dependent phase (§6). ──
  for (const p of evaluated) {
    const deps = PHASE_DEPENDENCIES[p.key] ?? [];
    p._dependencyBlocked = deps.some((dep) => {
      const depEval = evaluated.find((e) => e.key === dep);
      if (!depEval || !depEval._triggered || !kept.has(dep)) return false; // absent = satisfied
      return (
        depEval.status !== 'complete' &&
        !exitPredicateHolds(dep, input, ctx, depEval._triggered, depEval.triggerSignals)
      );
    });
  }

  // ── Status derivation ──
  for (const p of evaluated) {
    // A vetoed Claim still evaluates its exit — the audit's claimed verdict
    // that suppressed the trigger is the same fact that completes the goal.
    const vetoedExit =
      p.key === 'claim' && claimVetoed && input.lane !== 'none';
    const exitHolds =
      (p._triggered || vetoedExit) &&
      exitPredicateHolds(p.key, input, ctx, p._triggered || vetoedExit, p.triggerSignals);
    const contributorStages = p.contributingCampaignIds
      .map((cid) => input.siblings.find((s) => s.campaignId === cid)?.stage)
      .filter((st): st is string => !!st);
    const derived = deriveStatus({
      triggered: p._triggered,
      capabilityEnabled: p.capability.enabled,
      dependencyBlocked: p._dependencyBlocked === true,
      exitHolds,
      contributorStages,
    });
    p.status = derived.status;
    if (derived.suppressedReason) p.suppressedReason = derived.suppressedReason;
  }

  // ── Cap suppression mark (status is still computed — internal plan keeps
  // the full picture; owner-facing drops suppressed rows). ──
  for (const p of evaluated) {
    if (p._triggered && !kept.has(p.key)) {
      p.suppressedReason = 'pain_tier_cap';
    }
    delete (p as any)._intBoost;
    delete (p as any)._triggered;
    delete (p as any)._dependencyBlocked;
  }

  return {
    businessProspectId: ctx.businessProspectId ?? null,
    engagementCycle: ctx.engagementCycle ?? 1,
    estimatedTier: input.estimatedTier,
    predicateSeedVersion: input.predicateSeedVersion,
    lane: input.lane,
    signals: input.signals,
    sourceAuditId: input.sourceAuditId,
    // Assembled by the endpoint (I/O) — the evaluator stays pure.
    seedClaim: null,
    publicSurfaces: [],
    phases: evaluated,
    generatedAt: new Date().toISOString(),
    signalLanes: input.signalLanes,
  };
}

// ─── Owner-facing projection (spec §9/§12) ───────────────────────────────

export interface OwnerFacingPhase {
  key: ProjectPhaseKey;
  name: string;
  goal: string;
  confidence: 'verified';
  status: PhaseStatus;
  actions: { text: string; ownerAction: boolean }[];
  exitCriterion: { copy: string };
}

/**
 * The owner-facing payload is a projection of the same plan — never a
 * divergent object. Suppressed phases and `suggested` phases are removed;
 * internals (signals, lanes, internal evidence fields) are stripped;
 * statuses stay as computed (§9/§12).
 */
export function toOwnerFacingPhases(plan: ProjectPhasePlan): OwnerFacingPhase[] {
  return plan.phases
    .filter((p) => !p.suppressedReason && p.confidence === 'verified')
    .map((p) => ({
      key: p.key,
      name: p.name,
      goal: p.goal,
      confidence: 'verified',
      status: p.status,
      actions: p.actions,
      exitCriterion: { copy: p.exitCriterion.copy },
    }));
}

// ─── Plan-level CTA (spec §9/§13 precedence) ─────────────────────────────

export type PlanCta =
  | { kind: 'claim'; url: string }
  | { kind: 'phase'; phaseKey: ProjectPhaseKey }
  | { kind: 'pricing' };

/**
 * One plan-level CTA: while an unclaimed published/invited seed exists and
 * is not misaligned, "claim your listing". After claim (or no seed), the
 * next step of the earliest incomplete unsuppressed verified phase —
 * suggested phases are never CTA targets. Otherwise defer to pricing.
 */
export function resolvePlanCta(plan: ProjectPhasePlan): PlanCta {
  const seed = plan.seedClaim;
  if (
    seed &&
    (seed.status === 'published' || seed.status === 'invited') &&
    seed.fidelity !== 'misaligned'
  ) {
    const url = seed.claimUrl ?? seed.placeUrl;
    if (url) return { kind: 'claim', url };
  }
  const next = plan.phases.find(
    (p) =>
      !p.suppressedReason &&
      p.confidence === 'verified' &&
      p.status !== 'complete' &&
      p.status !== 'blocked',
  );
  if (next) return { kind: 'phase', phaseKey: next.key };
  return { kind: 'pricing' };
}
