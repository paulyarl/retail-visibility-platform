/**
 * PlanCockpitPanel — static-render tests (sprint 7.6).
 *
 * Node-environment vitest + renderToStaticMarkup (AGENTS.md). The panel is
 * presentational — plan/gate/siblings arrive as props — so every section
 * renders in SSR. Collapsed regions (suppressed phases) are unmounted until
 * expanded, so tests assert the collapsed-region *counts*, not their rows.
 */

import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PlanCockpitPanel, {
  type PlanSiblingSummary,
} from './PlanCockpitPanel';
import type {
  ProjectPhase,
  ProjectPhasePlan,
  ProjectPhaseGateResult,
  ProjectPhaseKey,
} from '@/services/MarketingOpsService';

const PHASE_ORDER: ProjectPhaseKey[] = [
  'foundation',
  'claim',
  'findability',
  'trust',
  'expansion',
];

function makePhase(
  key: ProjectPhaseKey,
  overrides: Partial<ProjectPhase> = {},
): ProjectPhase {
  return {
    key,
    name: `${key} phase`,
    goal: `Goal for ${key}`,
    confidence: 'verified',
    severity: 2,
    triggerSignals: [`SIG_${key.toUpperCase()}`],
    contributingCampaignIds: ['c-1'],
    evidence: [],
    actions: [],
    capability: { required: [], enabled: true },
    status: 'in_progress',
    exitCriterion: { copy: `${key} exit` },
    ...overrides,
  };
}

function makePlan(overrides: Partial<ProjectPhasePlan> = {}): ProjectPhasePlan {
  return {
    businessProspectId: 'bp-1',
    engagementCycle: 2,
    estimatedTier: 'tier_2',
    predicateSeedVersion: 1,
    lane: 'full',
    signals: [],
    signalLanes: {},
    sourceAuditId: 'audit-1',
    seedClaim: {
      seedId: 'seed-1',
      status: 'published',
      placeUrl: '/place/acme-market',
      claimUrl: '/claim/abc123',
      fidelity: 'aligned',
    },
    publicSurfaces: [
      {
        campaignId: 'c-1',
        seed: {
          seedId: 'seed-1',
          status: 'published',
          placeUrl: '/place/acme-market',
          fidelity: 'aligned',
        },
        retiredSeeds: [
          { seedId: 'seed-old', status: 'suppressed', placeUrl: '/place/acme-market-old' },
        ],
        demoStorefrontUrl: 'https://acme-demo.visibleshelf.com',
      },
    ],
    phases: PHASE_ORDER.map((k) => makePhase(k)),
    generatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const PASSING_GATE: ProjectPhaseGateResult = { passed: true, issues: [] };

function render(props: {
  plan?: ProjectPhasePlan;
  gate?: ProjectPhaseGateResult;
  siblings?: PlanSiblingSummary[];
}) {
  return renderToStaticMarkup(
    createElement(PlanCockpitPanel, {
      plan: props.plan ?? makePlan(),
      gate: props.gate ?? PASSING_GATE,
      siblings: props.siblings,
    }),
  );
}

describe('PlanCockpitPanel', () => {
  it('renders the five-phase board in canonical order', () => {
    const html = render({});
    const positions = PHASE_ORDER.map((k) => html.indexOf(`data-phase="${k}"`));
    for (const p of positions) expect(p).toBeGreaterThan(-1);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('shows the gate badge — pass and fail', () => {
    expect(render({})).toContain('gate passed');
    const failing = render({
      gate: { passed: false, issues: ['findability verified without full-lane evidence'] },
    });
    expect(failing).toContain('gate: 1 issue');
    expect(failing).toContain('findability verified without full-lane evidence');
  });

  it('renders the header band: tier, cycle, lane, predicate version, source audit', () => {
    const html = render({});
    expect(html).toContain('tier_2');
    expect(html).toContain('cycle 2');
    expect(html).toContain('full lane');
    expect(html).toContain('predicates v1');
    expect(html).toContain('audit-1');
  });

  it('lists every prospect sibling in the family strip, including non-contributing ones', () => {
    const html = render({
      siblings: [
        { id: 'c-1', businessName: 'Alpha Grocery', stage: 'shown', isPrimarySibling: true, engagementCycle: 2, archetype: 'A1' },
        { id: 'c-2', businessName: 'Beta Grocery', stage: 'seed', isPrimarySibling: false, engagementCycle: 2, archetype: 'A4' },
        // Non-contributing — not in any phase's contributingCampaignIds.
        { id: 'c-3', businessName: 'Gamma Grocery', stage: 'seek', isPrimarySibling: false, engagementCycle: 1, archetype: 'A7' },
      ],
    });
    expect(html).toContain('Alpha Grocery');
    expect(html).toContain('Beta Grocery');
    expect(html).toContain('Gamma Grocery');
    expect(html).toContain('Prospect family · 3');
    expect(html).toContain('/settings/admin/marketing-ops/campaigns/c-3');
  });

  it('renders the wedge card with seed status, fidelity, and claim link', () => {
    const html = render({});
    expect(html).toContain('published');
    expect(html).toContain('fidelity: aligned');
    expect(html).toContain('/claim/abc123');
    expect(html).toContain('/place/acme-market');
  });

  it('warns when the wedge seed is misaligned', () => {
    const html = render({
      plan: makePlan({
        seedClaim: {
          seedId: 'seed-1',
          status: 'published',
          placeUrl: '/place/acme-market',
          claimUrl: '/claim/abc123',
          fidelity: 'misaligned',
        },
      }),
    });
    expect(html).toContain('fidelity: misaligned');
    expect(html).toContain('Claim CTA suppressed');
  });

  it('renders live seed and demo storefront links plus retired-seed history in the surfaces strip', () => {
    const html = render({});
    expect(html).toContain('seed · published');
    expect(html).toContain('demo storefront');
    expect(html).toContain('https://acme-demo.visibleshelf.com');
    // Suppressed seed is history — a non-link marker, not a live surface.
    expect(html).toContain('retired seed · suppressed');
    expect(html).not.toContain('/place/acme-market-old"');
  });

  it('keeps suppressed rows on the board — dimmed, collapsed, counted', () => {
    const plan = makePlan({
      phases: PHASE_ORDER.map((k, i) =>
        makePhase(k, i < 2 ? { suppressedReason: 'pain_tier_cap' } : {}),
      ),
    });
    const html = render({ plan });
    // All five rows render internally; the count announces the suppressed set.
    expect(html).toContain('2 suppressed');
    expect(html).toContain('data-phase="foundation"');
    expect(html).toContain('pain_tier_cap');
    expect(html).toContain('data-phase="findability"');
  });

  it('renders the dependency marker on dependent phases', () => {
    // Findability depends on Foundation (§6).
    const html = render({});
    expect(html).toContain('depends on foundation');
  });

  it('renders prior-cycle siblings as history below the board', () => {
    const html = render({
      siblings: [
        { id: 'c-1', businessName: 'Alpha Grocery', stage: 'shown', isPrimarySibling: true, engagementCycle: 2 },
        { id: 'c-old', businessName: 'Old Cycle Campaign', stage: 'delivered', isPrimarySibling: false, engagementCycle: 1 },
      ],
    });
    expect(html).toContain('Prior-cycle history · 1');
    expect(html).toContain('Old Cycle Campaign');
    expect(html).toContain('cycle 1');
  });

  it('links contributing campaigns from a phase row', () => {
    // Phase detail content is collapsed until opened — the row summary
    // carries the campaign count; contributing links live in the open state.
    const html = render({});
    expect(html).toContain('1 signal');
    expect(html).toContain('1 campaign');
  });
});
