/**
 * runProjectPhaseGate — spec §11 gate rules.
 *
 * Covers every gate condition: triggerless unsuppressed phases, disabled-
 * capability references, forbidden terms in narrative (quote exemption),
 * owner count vs tier cap, single-seed rule, duplicate actions, misaligned
 * claim CTA, and the verified/suggested visibility rules.
 */
import { describe, expect, it } from 'vitest';
import { runProjectPhaseGate } from '../project-phase-gate';
import {
  selectProjectPhases,
  type ProjectPhaseInput,
  type ProjectPhasePlan,
  type ProjectPhase,
} from '../project-phases';
import type { SignalCode } from '../../triage/signal-taxonomy';

const CAPS = {
  storefrontEnabled: true,
  subdomainEnabled: true,
  qrPrintEnabled: true,
  domainEnabled: false,
};

function input(over: Partial<ProjectPhaseInput> = {}): ProjectPhaseInput {
  return {
    predicateSeedVersion: 1,
    lane: 'full',
    signals: [],
    signalLanes: {},
    discoverySignals: [],
    sourceAuditId: 'a-1',
    audit: null,
    siblings: [
      {
        campaignId: 'c-1',
        isPrimary: true,
        playbookCode: null,
        archetype: null,
        stage: 'seed',
        detectedSignals: [] as SignalCode[],
      },
    ],
    capabilities: { ...CAPS },
    estimatedTier: null,
    ...over,
  };
}

function cleanPlan(over: Partial<ProjectPhaseInput> = {}): ProjectPhasePlan {
  return selectProjectPhases(input(over));
}

describe('runProjectPhaseGate', () => {
  it('a clean plan passes', () => {
    const plan = cleanPlan({ signals: ['WC_MISSING_WEBSITE'] });
    const res = runProjectPhaseGate(plan);
    expect(res.passed).toBe(true);
    expect(res.issues).toHaveLength(0);
  });

  it('fails when an unsuppressed phase has no trigger evidence', () => {
    const plan = cleanPlan();
    const trust = plan.phases.find((p) => p.key === 'trust')!;
    trust.suppressedReason = undefined; // forged — simulates a bad assembly
    const res = runProjectPhaseGate(plan);
    expect(res.passed).toBe(false);
    expect(res.issues.some((i) => i.includes("'trust' is unsuppressed"))).toBe(true);
  });

  it('a domain-requested expansion is a legal triggerless phase', () => {
    const plan = cleanPlan({ operatorInputs: { domainRequested: true } });
    const res = runProjectPhaseGate(plan);
    expect(res.passed).toBe(true);
  });

  it('fails when an owner-facing phase references a disabled capability', () => {
    const plan = cleanPlan({
      signals: ['WC_MISSING_WEBSITE'],
      capabilities: { ...CAPS, subdomainEnabled: false },
    });
    // capability-disabled → suppressed internally, so the owner projection
    // drops it — force it into the owner view to trip the rule.
    const res = runProjectPhaseGate(
      plan,
      plan.phases
        .filter((p) => p.key === 'findability')
        .map((p) => ({
          key: p.key,
          name: p.name,
          goal: p.goal,
          confidence: 'verified' as const,
          status: p.status,
          actions: p.actions,
          exitCriterion: { copy: p.exitCriterion.copy },
        })),
    );
    expect(res.passed).toBe(false);
    expect(res.issues.some((i) => i.includes('disabled capability'))).toBe(true);
  });

  it('fails on §9 forbidden terms in generated narrative', () => {
    const plan = cleanPlan({ signals: ['RA_REVIEW_DROUGHT'] });
    const trust = plan.phases.find((p) => p.key === 'trust')!;
    trust.goal = 'This tier_3 campaign is on the RA_REVIEW_DROUGHT pipeline stage';
    const res = runProjectPhaseGate(plan);
    expect(res.passed).toBe(false);
    expect(res.issues.some((i) => i.includes('tier label'))).toBe(true);
    expect(res.issues.some((i) => i.includes('signal code'))).toBe(true);
  });

  it('verbatim review quotes are exempt from the forbidden-term scan', () => {
    const plan = cleanPlan({ signals: ['RA_UNADDRESSED_NEGATIVE_BACKLOG'] });
    const trust = plan.phases.find((p) => p.key === 'trust')!;
    trust.evidence.push({
      campaignId: 'c-1',
      field: 'review_quote',
      value: 'The delivery was late and nobody answered — terrible.',
      isQuote: true,
      attribution: 'Google review',
    });
    const res = runProjectPhaseGate(plan);
    expect(res.passed).toBe(true);
  });

  it('non-quote evidence IS scanned — a leaked signal code fails', () => {
    const plan = cleanPlan({ signals: ['RA_UNADDRESSED_NEGATIVE_BACKLOG'] });
    const trust = plan.phases.find((p) => p.key === 'trust')!;
    trust.evidence.push({
      campaignId: 'c-1',
      field: 'unanswered',
      value: 'Flagged as RA_UNADDRESSED_NEGATIVE_BACKLOG in triage',
    });
    const res = runProjectPhaseGate(plan);
    expect(res.passed).toBe(false);
  });

  it('fails when owner-facing count exceeds the tier cap', () => {
    const plan = cleanPlan({
      signals: ['WC_MISSING_WEBSITE', 'RA_BBB_GRADE_SUPPRESSION', 'DS_CLAIMED_STATUS'],
      estimatedTier: 'tier_3',
    });
    // Force all three verified phases into a hand-built owner projection.
    const ownerAll = plan.phases
      .filter((p) => !p.suppressedReason || p.confidence === 'verified')
      .map((p) => ({
        key: p.key,
        name: p.name,
        goal: p.goal,
        confidence: 'verified' as const,
        status: p.status,
        actions: p.actions,
        exitCriterion: { copy: p.exitCriterion.copy },
      }));
    expect(ownerAll.length).toBeGreaterThan(2);
    const res = runProjectPhaseGate(plan, ownerAll);
    expect(res.passed).toBe(false);
    expect(res.issues.some((i) => i.includes('cap 2'))).toBe(true);
  });

  it('fails the single-seed rule on a second live seed', () => {
    const plan = cleanPlan({ signals: ['WC_MISSING_WEBSITE'] });
    plan.seedClaim = {
      seedId: 's-1',
      status: 'published',
      placeUrl: '/place/a',
      claimUrl: '/c/x',
      fidelity: 'aligned',
    };
    plan.publicSurfaces = [
      {
        campaignId: 'c-1',
        seed: { seedId: 's-2', status: 'published', placeUrl: '/place/b' },
        demoStorefrontUrl: null,
      },
    ];
    const res = runProjectPhaseGate(plan);
    expect(res.passed).toBe(false);
    expect(res.issues.some((i) => i.includes('single-seed'))).toBe(true);
  });

  it('fails when two phases describe the same action', () => {
    const plan = cleanPlan({ signals: ['WC_MISSING_WEBSITE', 'WC_MISSING_CTA'] });
    const shared = { text: 'We publish a clean, correct listing for your business.', ownerAction: false };
    plan.phases.find((p) => p.key === 'findability')!.actions.push({ ...shared });
    plan.phases.find((p) => p.key === 'expansion')!.actions.push({ ...shared });
    const res = runProjectPhaseGate(plan);
    expect(res.passed).toBe(false);
    expect(res.issues.some((i) => i.includes('same action'))).toBe(true);
  });

  it('fails when the claim CTA renders on a misaligned seed', () => {
    const plan = cleanPlan({ signals: ['WC_MISSING_WEBSITE'] });
    plan.seedClaim = {
      seedId: 's-1',
      status: 'published',
      placeUrl: '/place/a',
      claimUrl: '/c/xyz',
      fidelity: 'misaligned',
    };
    const res = runProjectPhaseGate(plan);
    expect(res.passed).toBe(false);
    expect(res.issues.some((i) => i.includes('misaligned'))).toBe(true);
  });

  it('misaligned seed with no claimUrl is legal (inquiry degrade)', () => {
    const plan = cleanPlan({ signals: ['WC_MISSING_WEBSITE'] });
    plan.seedClaim = {
      seedId: 's-1',
      status: 'published',
      placeUrl: '/place/a',
      claimUrl: null,
      fidelity: 'misaligned',
    };
    const res = runProjectPhaseGate(plan);
    expect(res.passed).toBe(true);
  });

  it('fails when a verified phase has no full-lane evidence', () => {
    const plan = cleanPlan({ signals: ['WC_MISSING_WEBSITE'] });
    // Forge a verified phase whose only trigger is partial-lane.
    const f = plan.phases.find((p) => p.key === 'findability')!;
    plan.signalLanes = { WC_MISSING_WEBSITE: 'partial' };
    const res = runProjectPhaseGate(plan);
    expect(res.passed).toBe(false);
    expect(res.issues.some((i) => i.includes('no full-lane evidence'))).toBe(true);
  });

  it('fails when a suggested phase leaks into the owner projection', () => {
    const plan = cleanPlan({
      lane: 'partial',
      signals: ['WC_MISSING_WEBSITE'],
      signalLanes: { WC_MISSING_WEBSITE: 'partial' },
    });
    const leak = plan.phases
      .filter((p) => p.key === 'findability')
      .map((p) => ({
        key: p.key,
        name: p.name,
        goal: p.goal,
        confidence: 'verified' as const,
        status: p.status,
        actions: p.actions,
        exitCriterion: { copy: p.exitCriterion.copy },
      }));
    const res = runProjectPhaseGate(plan, leak);
    expect(res.passed).toBe(false);
    expect(res.issues.some((i) => i.includes('suggested'))).toBe(true);
  });
});
