/**
 * project-phase-prompts — Phase 5.1 owner-facing copy templates.
 *
 * One template per phase, fixed anatomy (spec §9): name → goal → evidence
 * → actions → exit criterion. Copy keys resolve from the predicate row's
 * `copy_keys` (the registry of which template fills which slot) — v1 ships
 * deterministic builders so the owner view never waits on a model call.
 *
 * Hard rule (spec §9): owner copy never names signal codes, archetypes,
 * tiers, prices, or internal labels. `runProjectPhaseGate` enforces it —
 * these templates simply must never produce it. All copy is written in
 * second-person plain language framing gaps as findability opportunities.
 */

import type { ProjectPhaseKey } from '../../lib/project-phase-predicates';
import type { PhaseEvidenceRow } from './project-phase-evidence';

export interface PhaseCopy {
  name: string;
  goal: string;
  actions: { text: string; ownerAction: boolean }[];
  exitCopy: string;
}

interface TemplateContext {
  evidence: PhaseEvidenceRow[];
  businessName?: string | null;
}

type PhaseTemplate = (ctx: TemplateContext) => PhaseCopy;

// ─── Shared copy atoms ───────────────────────────────────────────────────

function evidenceLine(ctx: TemplateContext, field: string): string | null {
  const row = ctx.evidence.find((e) => e.field === field && !e.isQuote);
  return row?.value ?? null;
}

const action = (text: string, ownerAction = false) => ({ text, ownerAction });

// ─── Per-phase templates ─────────────────────────────────────────────────

const foundationTemplate: PhaseTemplate = (ctx) => {
  const nameVar = evidenceLine(ctx, 'name_variations');
  const goal = nameVar
    ? `Your business name shows up differently across the web — customers may not be sure they found the right place.`
    : `Your business name, address, and phone need to match everywhere customers look.`;
  return {
    name: 'Getting your details right',
    goal,
    actions: [
      action('Confirm the correct name, address, and phone for your business.', true),
      action('We correct the mismatched listings so every platform shows the same details.'),
    ],
    exitCopy: 'Your business details match across the platforms we checked.',
  };
};

const claimTemplate: PhaseTemplate = () => ({
  name: 'Your business profile',
  goal: 'Your public business profile needs an owner — until it is claimed, its details can drift without you knowing.',
  actions: [
    action('Confirm you own this business.', true),
    action('We walk the claim through so the profile is under your control.'),
  ],
  exitCopy: 'Your business profile is claimed and under your control.',
});

const findabilityTemplate: PhaseTemplate = (ctx) => {
  const site = evidenceLine(ctx, 'website');
  const goal = site
    ? `Customers looking for you online hit a gap — ${site.toLowerCase()}.`
    : 'Customers looking for you online have no reliable place to land.';
  return {
    name: 'Being easy to find',
    goal,
    actions: [
      action('We publish a clean, correct listing for your business.'),
      action('Share it anywhere customers look for you.', true),
    ],
    exitCopy: 'Your listing is live and visible to customers.',
  };
};

const trustTemplate: PhaseTemplate = (ctx) => {
  const backlog = evidenceLine(ctx, 'unanswered_negative_reviews');
  const quote = ctx.evidence.find((e) => e.isQuote);
  const goal = backlog
    ? `${backlog} sit without a response — new customers read that silence.`
    : quote
      ? 'What customers are saying publicly deserves a response.'
      : 'Your online reputation has open items worth addressing.';
  return {
    name: 'What customers see',
    goal,
    actions: [
      action('We draft responses you can approve word-for-word.'),
      action('Approve the responses to publish under your name.', true),
    ],
    exitCopy: 'Outstanding reputation items are addressed.',
  };
};

const expansionTemplate: PhaseTemplate = (ctx) => {
  const cta = evidenceLine(ctx, 'call_to_action');
  return {
    name: 'Reaching further',
    goal: cta
      ? `Your online presence has room to convert better — ${cta.toLowerCase()}.`
      : 'There is a next surface where your business can reach more customers.',
    actions: [
      action('We set up the next growth surface for your business.'),
      action('Decide whether to keep it running after the pilot.', true),
    ],
    exitCopy: 'The expansion item is delivered.',
  };
};

export const PHASE_TEMPLATES: Record<ProjectPhaseKey, PhaseTemplate> = {
  foundation: foundationTemplate,
  claim: claimTemplate,
  findability: findabilityTemplate,
  trust: trustTemplate,
  expansion: expansionTemplate,
};

/**
 * Resolve owner-facing copy for a phase. `copyKeys` from the predicate row
 * are the registry handles — v1 templates are deterministic, so the key
 * selects the builder rather than a stored body.
 */
export function resolvePhaseCopy(
  phaseKey: ProjectPhaseKey,
  ctx: TemplateContext,
): PhaseCopy {
  return PHASE_TEMPLATES[phaseKey](ctx);
}
