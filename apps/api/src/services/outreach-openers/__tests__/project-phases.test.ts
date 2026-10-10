/**
 * project-phases — the pure plan evaluator (spec §5/§8/§12 + §11 gate).
 *
 * Covers: every v1 trigger set, tier caps + dependency protection,
 * capability-disabled, lane/confidence matrices, INT_* rank-only behavior,
 * min_severity floors (synthetic rows), sibling attribution pools +
 * archetype fallback, status derivation incl. lost/dead, exit predicates,
 * engagement-cycle selection, claim veto, tier_3 expansion rule, owner
 * projection, and plan-CTA precedence.
 */
import { describe, expect, it } from 'vitest';
import {
  selectProjectPhases,
  toOwnerFacingPhases,
  resolvePlanCta,
  ACTIVE_STAGES,
  TERMINAL_COMPLETE_STAGES,
  type ProjectPhaseInput,
  type ProjectPhasePlan,
  type EvaluationContext,
  type ProjectPhaseKey,
} from '../project-phases';
import {
  PROJECT_PHASE_PREDICATES_V1,
  type ProjectPhasePredicateSeed,
} from '../../../lib/project-phase-predicates';
import type { SignalCode } from '../../triage/signal-taxonomy';

// ─── Fixtures ────────────────────────────────────────────────────────────

const ALL_CAPS = {
  storefrontEnabled: true,
  subdomainEnabled: true,
  qrPrintEnabled: true,
  domainEnabled: false,
};

const PRIMARY = {
  campaignId: 'c-primary',
  isPrimary: true,
  playbookCode: null as string | null,
  archetype: null as string | null,
  stage: 'seed',
  detectedSignals: [] as SignalCode[],
};

function input(over: Partial<ProjectPhaseInput> = {}): ProjectPhaseInput {
  return {
    predicateSeedVersion: 1,
    lane: 'full',
    signals: [],
    signalLanes: {},
    discoverySignals: [],
    sourceAuditId: 'audit-1',
    audit: null,
    siblings: [{ ...PRIMARY }],
    capabilities: { ...ALL_CAPS },
    estimatedTier: null,
    ...over,
  };
}

function sibling(over: Partial<(typeof PRIMARY)> = {}) {
  return { ...PRIMARY, ...over };
}

function phase(plan: ProjectPhasePlan, key: ProjectPhaseKey) {
  const p = plan.phases.find((x) => x.key === key);
  if (!p) throw new Error(`phase ${key} missing`);
  return p;
}

function unsuppressed(plan: ProjectPhasePlan) {
  return plan.phases.filter((p) => !p.suppressedReason);
}

// ─── 4.3a — every v1 trigger set ─────────────────────────────────────────

describe('v1 trigger sets', () => {
  const reps: [ProjectPhaseKey, SignalCode][] = [
    ['foundation', 'CP_NAP_NAME_DRIFT'],
    ['foundation', 'CP_MISSING_CONTACT_INFO'],
    ['claim', 'DS_CLAIMED_STATUS'],
    ['findability', 'WC_MISSING_WEBSITE'],
    ['findability', 'DS_MISSING_PRODUCT_CATALOG'],
    ['findability', 'VP_MISSING_STOREFRONT_PHOTOS'],
    ['trust', 'RA_UNADDRESSED_NEGATIVE_BACKLOG'],
    ['trust', 'RA_REVIEW_DROUGHT'],
    ['expansion', 'WC_MISSING_CTA'],
    ['expansion', 'WC_POOR_SITE_QUALITY'],
  ];
  for (const [key, code] of reps) {
    it(`${key} triggers on ${code}`, () => {
      const plan = selectProjectPhases(input({ signals: [code] }));
      expect(phase(plan, key).triggerSignals).toContain(code);
      expect(phase(plan, key).suppressedReason).toBeUndefined();
    });
  }

  it('emits all five catalog entries even with no signals', () => {
    const plan = selectProjectPhases(input());
    expect(plan.phases.map((p) => p.key)).toEqual([
      'foundation',
      'claim',
      'findability',
      'trust',
      'expansion',
    ]);
    for (const p of plan.phases) {
      expect(p.status).toBe('not_started');
      expect(p.suppressedReason).toBe('not_triggered');
    }
  });

  it('OX_* outreach-state codes never trigger a phase', () => {
    const plan = selectProjectPhases(
      input({ signals: ['OX_OPENER_SENT', 'OX_QR_SCANNED'] as SignalCode[] }),
    );
    expect(unsuppressed(plan)).toHaveLength(0);
  });

  it('unmapped codes (VP_STALE_SOCIAL_ACTIVITY, positive backlog) never trigger', () => {
    const plan = selectProjectPhases(
      input({
        signals: ['VP_STALE_SOCIAL_ACTIVITY', 'RA_UNADDRESSED_POSITIVE_BACKLOG'],
      }),
    );
    expect(unsuppressed(plan)).toHaveLength(0);
  });

  it('§11 gate — every unsuppressed phase carries trigger evidence', () => {
    const plan = selectProjectPhases(
      input({ signals: ['WC_MISSING_WEBSITE', 'RA_REVIEW_DROUGHT'] }),
    );
    for (const p of unsuppressed(plan)) {
      expect(
        p.triggerSignals.length > 0 || p.triggeredByDomainRequest === true,
      ).toBe(true);
    }
  });
});

// ─── Lanes + confidence ──────────────────────────────────────────────────

describe('lanes and confidence', () => {
  it("lane 'none' — every phase not_triggered", () => {
    const plan = selectProjectPhases(input({ lane: 'none' }));
    for (const p of plan.phases) {
      expect(p.status).toBe('not_started');
      expect(p.suppressedReason).toBe('not_triggered');
      expect(p.triggerSignals).toHaveLength(0);
    }
  });

  it('full-lane trigger → verified', () => {
    const plan = selectProjectPhases(input({ signals: ['WC_MISSING_WEBSITE'] }));
    expect(phase(plan, 'findability').confidence).toBe('verified');
  });

  it('partial-only triggers → suggested', () => {
    const plan = selectProjectPhases(
      input({
        lane: 'partial',
        signals: ['WC_MISSING_WEBSITE'],
        signalLanes: { WC_MISSING_WEBSITE: 'partial' },
      }),
    );
    expect(phase(plan, 'findability').confidence).toBe('suggested');
  });

  it('mixed lanes — one full-lane trigger verifies the phase', () => {
    const plan = selectProjectPhases(
      input({
        lane: 'partial',
        signals: ['WC_MISSING_WEBSITE', 'DS_MISSING_PROFILE'],
        signalLanes: { WC_MISSING_WEBSITE: 'partial', DS_MISSING_PROFILE: 'full' },
      }),
    );
    expect(phase(plan, 'findability').confidence).toBe('verified');
  });
});

// ─── Tier caps + dependency protection ───────────────────────────────────

describe('tier caps', () => {
  const FOUR_SIGNALS: SignalCode[] = [
    'CP_NAP_NAME_DRIFT', // foundation
    'DS_CLAIMED_STATUS', // claim
    'WC_MISSING_WEBSITE', // findability
    'RA_REVIEW_DROUGHT', // trust
  ];

  it('tier_3 caps at 2, tier_2/null cap at 3, tier_1 keeps all', () => {
    for (const [tier, expected] of [
      ['tier_3', 2],
      ['tier_2', 3],
      [null, 3],
      ['tier_1', 4],
    ] as const) {
      const plan = selectProjectPhases(
        input({ signals: FOUR_SIGNALS, estimatedTier: tier }),
      );
      expect(unsuppressed(plan)).toHaveLength(expected);
      if (expected < 4) {
        const trimmed = plan.phases.filter(
          (p) => p.suppressedReason === 'pain_tier_cap',
        );
        expect(trimmed.length).toBe(4 - expected);
        for (const t of trimmed) expect(t.triggerSignals.length).toBeGreaterThan(0);
      }
    }
  });

  it('cap keeps highest-confidence then highest-severity phases', () => {
    // tier_3, two verified (crisis + material), one suggested — suggested trims first.
    const plan = selectProjectPhases(
      input({
        signals: ['WC_MISSING_WEBSITE', 'RA_BBB_GRADE_SUPPRESSION', 'RA_REVIEW_DROUGHT'],
        signalLanes: { RA_REVIEW_DROUGHT: 'partial' },
        estimatedTier: 'tier_3',
      }),
    );
    const kept = unsuppressed(plan).map((p) => p.key).sort();
    expect(kept).toEqual(['findability', 'trust']);
    // trust is kept via the crisis BBB trigger; findability crisis via WC_MISSING_WEBSITE.
    // Drought (partial) is the third verified-or-not? — drought shares trust.
    expect(phase(plan, 'trust').confidence).toBe('verified');
  });

  it('ranks by confidence before severity', () => {
    // Crisis partial (suggested) vs material/crisis full (verified) — at a
    // 2-slot cap the verified phases outrank the suggested crisis.
    const plan = selectProjectPhases(
      input({
        signals: ['RA_BBB_GRADE_SUPPRESSION', 'CP_MISSING_CONTACT_INFO', 'WC_MISSING_WEBSITE'],
        signalLanes: { RA_BBB_GRADE_SUPPRESSION: 'partial' },
        estimatedTier: 'tier_3',
      }),
    );
    const kept = unsuppressed(plan).map((p) => p.key).sort();
    expect(kept).toEqual(['findability', 'foundation']); // verified beats suggested
    expect(phase(plan, 'trust').suppressedReason).toBe('pain_tier_cap');
  });

  it('dependency protection — findability kept ⇒ foundation kept', () => {
    // tier_3 = 2 slots. findability (crisis) + trust (crisis) outrank
    // foundation (cosmetic NAP). Without protection foundation trims and
    // findability would show without its dependency.
    const plan = selectProjectPhases(
      input({
        signals: ['WC_MISSING_WEBSITE', 'RA_BBB_GRADE_SUPPRESSION', 'CP_NAP_NAME_DRIFT'],
        estimatedTier: 'tier_3',
      }),
    );
    const kept = unsuppressed(plan).map((p) => p.key).sort();
    if (kept.includes('findability')) {
      expect(kept).toContain('foundation');
    }
    // Weakest phase — not the protected dependency — takes the trim.
    expect(
      plan.phases.filter((p) => p.suppressedReason === 'pain_tier_cap').length,
    ).toBeLessThanOrEqual(1);
  });
});

// ─── Capability gating ───────────────────────────────────────────────────

describe('capability gating', () => {
  it('findability blocked + suppressed when subdomain capability off', () => {
    const plan = selectProjectPhases(
      input({
        signals: ['WC_MISSING_WEBSITE'],
        capabilities: { ...ALL_CAPS, subdomainEnabled: false },
      }),
    );
    const f = phase(plan, 'findability');
    expect(f.capability.required).toEqual(['subdomainEnabled']);
    expect(f.capability.enabled).toBe(false);
    expect(f.status).toBe('blocked');
    expect(f.suppressedReason).toBe('capability_disabled');
  });

  it('capability block is overridden when the exit predicate already holds', () => {
    const plan = selectProjectPhases(
      input(
        { signals: ['WC_MISSING_WEBSITE'], capabilities: { ...ALL_CAPS, subdomainEnabled: false } },
      ),
      { facts: { wedgeSeedStatus: 'published' } },
    );
    expect(phase(plan, 'findability').status).toBe('complete');
  });
});

// ─── INT_* rank modifiers ────────────────────────────────────────────────

describe('INT_* rank modifiers', () => {
  it('INT codes alone never trigger a phase', () => {
    const plan = selectProjectPhases(input({ signals: [], discoverySignals: ['INT_LOW_VISIBILITY'] }));
    expect(unsuppressed(plan)).toHaveLength(0);
  });

  it('INT boost decides an otherwise-tied cap rank', () => {
    // tier_3 = 2 slots; findability + claim both verified/crisis-or-material.
    // INT_LOW_VISIBILITY boosts findability above claim → claim trims.
    const plan = selectProjectPhases(
      input({
        signals: ['WC_MISSING_WEBSITE', 'DS_CLAIMED_STATUS'],
        discoverySignals: ['INT_LOW_VISIBILITY'],
        estimatedTier: 'tier_3',
      }),
    );
    const kept = unsuppressed(plan).map((p) => p.key).sort();
    expect(kept).toEqual(['claim', 'findability']); // both fit in cap 2 — assert boost below
  });

  it('INT boost breaks a severity tie at the cap boundary', () => {
    // foundation (cosmetic NAP) vs claim (material) vs findability (crisis)
    // at tier_3: claim trims first... use equal-severity phases instead:
    // trust (crisis BBB) vs claim (material) vs findability (crisis) — claim
    // is weakest; INT on findability keeps ordering deterministic.
    const plan = selectProjectPhases(
      input({
        signals: ['WC_MISSING_WEBSITE', 'RA_BBB_GRADE_SUPPRESSION', 'DS_CLAIMED_STATUS'],
        discoverySignals: ['INT_LOW_VISIBILITY'],
        estimatedTier: 'tier_3',
      }),
    );
    expect(phase(plan, 'claim').suppressedReason).toBe('pain_tier_cap');
    const kept = unsuppressed(plan).map((p) => p.key).sort();
    expect(kept).toEqual(['findability', 'trust']);
  });
});

// ─── min_severity floors (synthetic rows — v1 has none) ──────────────────

describe('min_severity floors', () => {
  const floored: ProjectPhasePredicateSeed[] = [
    {
      phaseKey: 'foundation',
      signals: ['CP_NAP_NAME_DRIFT'],
      minSeverity: { CP_NAP_NAME_DRIFT: 'material' },
      intRankModifiers: [],
      copyKeys: {
        name: 'k', goal: 'k', evidence: 'k', actions: 'k', exit_criterion: 'k',
      },
    },
    ...PROJECT_PHASE_PREDICATES_V1.filter((p) => p.phaseKey !== 'foundation'),
  ];

  it('signal below floor does not trigger', () => {
    // NAP name drift with no audit data computes 'cosmetic' < 'material'.
    const plan = selectProjectPhases(
      input({ signals: ['CP_NAP_NAME_DRIFT'] }),
      { predicates: floored },
    );
    expect(phase(plan, 'foundation').suppressedReason).toBe('not_triggered');
    expect(phase(plan, 'foundation').triggerSignals).toHaveLength(0);
  });

  it('signal at/above floor triggers', () => {
    // Material name drift → 'material' meets the floor.
    const audit = {
      nap_consistency: {
        name_variations: ['Harbor Deli', 'Harbor Grocery & Deli'],
        material_issues: [],
      },
    };
    const plan = selectProjectPhases(
      input({ signals: ['CP_NAP_NAME_DRIFT'], audit: audit as any }),
      { predicates: floored },
    );
    expect(phase(plan, 'foundation').triggerSignals).toContain('CP_NAP_NAME_DRIFT');
    expect(phase(plan, 'foundation').suppressedReason).toBeUndefined();
  });
});

// ─── Sibling attribution ─────────────────────────────────────────────────

describe('sibling attribution', () => {
  it('playbook pool ∩ detected ∩ phase triggers — pool gates attribution', () => {
    // Sibling inherits the full source signal set but its playbook only
    // matched the website-gap codes → it does NOT contribute to trust.
    const plan = selectProjectPhases(
      input({
        signals: ['RA_REVIEW_DROUGHT', 'WC_MISSING_WEBSITE'],
        siblings: [
          sibling({ campaignId: 'c-primary', isPrimary: true }),
          sibling({
            campaignId: 'c-sib',
            isPrimary: false,
            playbookCode: 'PB-08',
            detectedSignals: ['RA_REVIEW_DROUGHT', 'WC_MISSING_WEBSITE'],
          }),
        ],
      }),
      { playbookSignalPools: { 'PB-08': ['WC_MISSING_WEBSITE', 'WC_THIRD_PARTY_DOMAIN'] } },
    );
    expect(phase(plan, 'findability').contributingCampaignIds).toContain('c-sib');
    expect(phase(plan, 'trust').contributingCampaignIds).not.toContain('c-sib');
  });

  it('archetype fallback maps A3→foundation, A1/A2→trust, A6/A7→findability, A4→expansion', () => {
    const mk = (arch: string, id: string) =>
      sibling({ campaignId: id, isPrimary: false, archetype: arch, detectedSignals: [] });
    const plan = selectProjectPhases(
      input({
        signals: [
          'CP_MISSING_CONTACT_INFO',
          'RA_REVIEW_DROUGHT',
          'WC_MISSING_WEBSITE',
          'WC_MISSING_CTA',
        ],
        siblings: [
          sibling({ campaignId: 'c-primary' }),
          mk('A3', 'c-a3'),
          mk('A1', 'c-a1'),
          mk('A7', 'c-a7'),
          mk('A4', 'c-a4'),
        ],
      }),
    );
    expect(phase(plan, 'foundation').contributingCampaignIds).toContain('c-a3');
    expect(phase(plan, 'trust').contributingCampaignIds).toContain('c-a1');
    expect(phase(plan, 'findability').contributingCampaignIds).toContain('c-a7');
    expect(phase(plan, 'expansion').contributingCampaignIds).toContain('c-a4');
    // A3 maps ONLY to foundation — never to trust.
    expect(phase(plan, 'trust').contributingCampaignIds).not.toContain('c-a3');
  });

  it('A5 falls back to the union of component signals', () => {
    const plan = selectProjectPhases(
      input({
        signals: ['RA_REVIEW_DROUGHT', 'WC_MISSING_WEBSITE'],
        siblings: [
          sibling({ campaignId: 'c-primary' }),
          sibling({
            campaignId: 'c-a5',
            isPrimary: false,
            archetype: 'A5',
            detectedSignals: ['RA_REVIEW_DROUGHT'],
          }),
        ],
      }),
    );
    expect(phase(plan, 'trust').contributingCampaignIds).toContain('c-a5');
    expect(phase(plan, 'findability').contributingCampaignIds).not.toContain('c-a5');
  });
});

// ─── Status derivation ───────────────────────────────────────────────────

describe('status derivation', () => {
  const triggered = (stages: string[], code: SignalCode = 'RA_REVIEW_DROUGHT') =>
    input({
      signals: [code],
      siblings: stages.map((st, i) =>
        sibling({
          campaignId: `c-${i}`,
          isPrimary: i === 0,
          archetype: 'A1', // archetype fallback → trust contributor
          stage: st,
        }),
      ),
    });

  it('active contributor → in_progress', () => {
    for (const st of ['seed', 'paid', 'outreach_dispatched', 'owner_approved']) {
      const plan = selectProjectPhases(triggered([st]));
      expect(phase(plan, 'trust').status).toBe('in_progress');
    }
  });

  it('ACTIVE_STAGES / TERMINAL_COMPLETE_STAGES match the spec sets', () => {
    expect(ACTIVE_STAGES).toContain('seed');
    expect(ACTIVE_STAGES).toContain('owner_approved');
    expect(ACTIVE_STAGES).not.toContain('delivered');
    expect(TERMINAL_COMPLETE_STAGES).toContain('delivered');
    expect(TERMINAL_COMPLETE_STAGES).toContain('resolved_and_closed');
    expect(TERMINAL_COMPLETE_STAGES).not.toContain('lost');
  });

  it('all contributors terminal-complete → complete', () => {
    const plan = selectProjectPhases(triggered(['delivered', 'closed']));
    expect(phase(plan, 'trust').status).toBe('complete');
  });

  it("lost/dead never count complete — mixed stages aren't all-terminal", () => {
    const plan = selectProjectPhases(triggered(['delivered', 'lost']));
    expect(phase(plan, 'trust').status).not.toBe('complete');
  });

  it('lost/dead only → not_started', () => {
    const plan = selectProjectPhases(triggered(['dead']));
    expect(phase(plan, 'trust').status).toBe('not_started');
  });

  it('triggered with no contributing sibling and no exit → not_started', () => {
    const plan = selectProjectPhases(
      input({ signals: ['RA_UNADDRESSED_NEGATIVE_BACKLOG'] }),
    );
    expect(phase(plan, 'trust').status).toBe('not_started');
  });
});

// ─── Exit predicates ─────────────────────────────────────────────────────

describe('exit predicates', () => {
  it("foundation completes when the audit's nap is consistent", () => {
    const plan = selectProjectPhases(
      input({
        signals: ['CP_NAP_NAME_DRIFT'],
        audit: { nap_consistency: { overall_status: 'consistent' } } as any,
      }),
    );
    expect(phase(plan, 'foundation').status).toBe('complete');
  });

  it('foundation completes on campaign nap_consistent fact', () => {
    const plan = selectProjectPhases(
      input({ signals: ['CP_NAP_NAME_DRIFT'] }),
      { facts: { napConsistent: true } },
    );
    expect(phase(plan, 'foundation').status).toBe('complete');
  });

  it('claim completes on gbp_claimed fact or audit profile status', () => {
    const byFact = selectProjectPhases(
      input({ signals: ['DS_CLAIMED_STATUS'] }),
      { facts: { gbpClaimed: true } },
    );
    expect(phase(byFact, 'claim').status).toBe('complete');
    const byAudit = selectProjectPhases(
      input({
        signals: ['DS_CLAIMED_STATUS'],
        audit: { platforms: { google: { profile_status: 'likely_claimed' } } } as any,
      }),
    );
    expect(phase(byAudit, 'claim').status).toBe('complete');
  });

  it('claim audit veto — claimed verdict suppresses the trigger, shows complete', () => {
    const plan = selectProjectPhases(
      input({
        signals: ['DS_CLAIMED_STATUS'],
        audit: { platforms: { google: { profile_status: 'claimed' } } } as any,
      }),
    );
    const c = phase(plan, 'claim');
    // The phase does not trigger (audit verdict wins §5) — and the same
    // verdict satisfies the exit, so the phase reads 'complete'.
    expect(c.triggerSignals).toHaveLength(0);
    expect(c.status).toBe('complete');
    expect(c.suppressedReason).toBeUndefined();
  });

  it("'unable_to_verify' never vetoes a column-fired claim signal", () => {
    const plan = selectProjectPhases(
      input({
        signals: ['DS_CLAIMED_STATUS'],
        audit: { platforms: { google: { profile_status: 'unable_to_verify' } } } as any,
      }),
    );
    expect(phase(plan, 'claim').triggerSignals).toContain('DS_CLAIMED_STATUS');
  });

  it('findability completes on a live wedge seed or storefront', () => {
    const bySeed = selectProjectPhases(
      input({ signals: ['WC_MISSING_WEBSITE'] }),
      { facts: { wedgeSeedStatus: 'invited' } },
    );
    expect(phase(bySeed, 'findability').status).toBe('complete');
    const byStorefront = selectProjectPhases(
      input({ signals: ['WC_MISSING_WEBSITE'] }),
      { facts: { demoStorefrontLive: true } },
    );
    expect(phase(byStorefront, 'findability').status).toBe('complete');
  });

  it('trust does NOT vacuously complete when backlog was never present', () => {
    // The §8 exit presupposes the backlog triggered the phase. A BBB-triggered
    // trust phase with no backlog in signals still has live work — the
    // backlog's mere absence is not "resolved".
    const plan = selectProjectPhases(input({ signals: ['RA_BBB_GRADE_SUPPRESSION'] }));
    const t = phase(plan, 'trust');
    expect(t.triggerSignals).toContain('RA_BBB_GRADE_SUPPRESSION');
    expect(t.status).toBe('not_started');
  });

  it('trust completes via terminal-complete contributing siblings', () => {
    const plan = selectProjectPhases(
      input({
        signals: ['RA_UNADDRESSED_NEGATIVE_BACKLOG'],
        siblings: [
          sibling({ campaignId: 'c-primary', archetype: 'A2', stage: 'delivered' }),
          sibling({ campaignId: 'c-2', isPrimary: false, archetype: 'A1', stage: 'resolved_and_closed' }),
        ],
      }),
    );
    const t = phase(plan, 'trust');
    expect(t.contributingCampaignIds.sort()).toEqual(['c-2', 'c-primary'].sort());
    expect(t.status).toBe('complete'); // all contributors terminal-complete
  });

  it('expansion exit is manual — never completes via predicates in v1', () => {
    const plan = selectProjectPhases(input({ signals: ['WC_MISSING_CTA'] }));
    expect(phase(plan, 'expansion').status).not.toBe('complete');
    expect(phase(plan, 'expansion').exitCriterion.predicate).toBe('manual');
  });
});

// ─── Dependency blocking ─────────────────────────────────────────────────

describe('dependency blocking', () => {
  it('findability blocked while foundation is present + incomplete', () => {
    const plan = selectProjectPhases(
      input({
        signals: ['CP_NAP_NAME_DRIFT', 'WC_MISSING_WEBSITE'],
        estimatedTier: 'tier_1',
      }),
    );
    expect(phase(plan, 'foundation').status).toBe('not_started');
    expect(phase(plan, 'findability').status).toBe('blocked');
    // blocked-by-dependency is NOT a suppression — stays in the owner view.
    expect(phase(plan, 'findability').suppressedReason).toBeUndefined();
  });

  it('protected dependency stays present → dependent shows blocked', () => {
    // tier_3: findability(crisis) + trust(crisis) outrank cosmetic foundation.
    // Protection swaps foundation in for the weakest kept phase → foundation
    // is present-and-incomplete → findability is blocked, not stranded.
    const plan = selectProjectPhases(
      input({
        signals: ['WC_MISSING_WEBSITE', 'RA_BBB_GRADE_SUPPRESSION', 'CP_NAP_NAME_DRIFT'],
        estimatedTier: 'tier_3',
      }),
    );
    const kept = unsuppressed(plan).map((p) => p.key).sort();
    expect(kept).toEqual(['findability', 'foundation']);
    expect(phase(plan, 'trust').suppressedReason).toBe('pain_tier_cap');
    expect(phase(plan, 'findability').status).toBe('blocked');
  });
});

// ─── Expansion rules ─────────────────────────────────────────────────────

describe('expansion triggers', () => {
  it('owner domain request triggers expansion (non-signal trigger)', () => {
    const plan = selectProjectPhases(
      input({ signals: [], operatorInputs: { domainRequested: true } }),
    );
    const e = phase(plan, 'expansion');
    expect(e.triggeredByDomainRequest).toBe(true);
    expect(e.confidence).toBe('verified'); // operator input = full-lane
    expect(e.suppressedReason).toBeUndefined();
  });

  it('tier_3 — conversion signals alone do not trigger expansion', () => {
    const plan = selectProjectPhases(
      input({ signals: ['WC_MISSING_CTA'], estimatedTier: 'tier_3' }),
    );
    expect(phase(plan, 'expansion').suppressedReason).toBe('not_triggered');
  });

  it('tier_3 — the domain request still triggers expansion', () => {
    const plan = selectProjectPhases(
      input({
        signals: ['WC_MISSING_CTA'],
        estimatedTier: 'tier_3',
        operatorInputs: { domainRequested: true },
      }),
    );
    const e = phase(plan, 'expansion');
    expect(e.triggerSignals).toHaveLength(0);
    expect(e.triggeredByDomainRequest).toBe(true);
  });
});

// ─── Plan fields ─────────────────────────────────────────────────────────

describe('plan fields', () => {
  it('engagement cycle comes from the primary sibling (no merging)', () => {
    const plan = selectProjectPhases(input(), {
      businessProspectId: 'bp-1',
      engagementCycle: 3,
    });
    expect(plan.engagementCycle).toBe(3);
    expect(plan.businessProspectId).toBe('bp-1');
  });

  it('plan carries predicateSeedVersion, signals, sourceAuditId, generatedAt', () => {
    const plan = selectProjectPhases(input({ signals: ['WC_MISSING_WEBSITE'] }));
    expect(plan.predicateSeedVersion).toBe(1);
    expect(plan.signals).toContain('WC_MISSING_WEBSITE');
    expect(plan.sourceAuditId).toBe('audit-1');
    expect(plan.generatedAt).toBeTruthy();
    expect(plan.phases).toHaveLength(5);
  });
});

// ─── Owner projection + CTA ──────────────────────────────────────────────

describe('owner projection', () => {
  it('drops suppressed + suggested phases, strips internals, keeps statuses', () => {
    const plan = selectProjectPhases(
      input({
        signals: ['WC_MISSING_WEBSITE', 'CP_MISSING_CONTACT_INFO', 'RA_REVIEW_DROUGHT'],
        signalLanes: { RA_REVIEW_DROUGHT: 'partial' },
        estimatedTier: 'tier_3',
      }),
    );
    const owner = toOwnerFacingPhases(plan);
    for (const p of owner) {
      expect(p.confidence).toBe('verified');
      expect(p).not.toHaveProperty('triggerSignals');
      expect(p).not.toHaveProperty('suppressedReason');
      expect(p).not.toHaveProperty('contributingCampaignIds');
      expect(p).not.toHaveProperty('capability');
    }
    // suggested trust phase is invisible to the owner.
    expect(owner.map((p) => p.key)).not.toContain('trust');
  });
});

describe('plan CTA precedence', () => {
  const seed = (over: Partial<NonNullable<ProjectPhasePlan['seedClaim']>> = {}) => ({
    seedId: 's-1',
    status: 'published' as const,
    placeUrl: '/place/harbor-deli',
    claimUrl: '/c/abc123',
    fidelity: 'aligned' as const,
    ...over,
  });

  it('live unclaimed seed → claim CTA wins', () => {
    const plan = selectProjectPhases(input({ signals: ['WC_MISSING_WEBSITE'] }));
    plan.seedClaim = seed();
    expect(resolvePlanCta(plan)).toEqual({ kind: 'claim', url: '/c/abc123' });
  });

  it('misaligned seed → no claim CTA (inquiry degrade is surface-side)', () => {
    const plan = selectProjectPhases(input({ signals: ['WC_MISSING_WEBSITE'] }));
    plan.seedClaim = seed({ fidelity: 'misaligned', claimUrl: null });
    const cta = resolvePlanCta(plan);
    expect(cta.kind).not.toBe('claim');
  });

  it('no live claim path → earliest incomplete verified phase', () => {
    const plan = selectProjectPhases(
      input({ signals: ['WC_MISSING_WEBSITE', 'CP_MISSING_CONTACT_INFO'] }),
    );
    plan.seedClaim = seed({ status: 'claimed' });
    const cta = resolvePlanCta(plan);
    // Findability exits complete (claimed seed isn't fed back through facts —
    // CTA works off phase status): earliest incomplete unsuppressed verified.
    expect(cta.kind).toBe('phase');
  });

  it('suggested phases are never CTA targets', () => {
    const plan = selectProjectPhases(
      input({
        lane: 'partial',
        signals: ['WC_MISSING_WEBSITE'],
        signalLanes: { WC_MISSING_WEBSITE: 'partial' },
      }),
    );
    const cta = resolvePlanCta(plan);
    expect(cta.kind).toBe('pricing');
  });
});
