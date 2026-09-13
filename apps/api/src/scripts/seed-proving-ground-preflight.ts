/**
 * Seed script: PG-01 Proving Ground Preflight Playbook
 *
 * Seeds the `proving_ground`-category playbook + its 9 checklist steps into
 * mkt_playbook_catalog / mkt_playbook_checklist_steps (Migration 262).
 *
 * Why a seed script (not migration SQL): the catalog is curated data, and
 * pg-crypto/pgcrypto id formats come from id-generator — consistent with the
 * repo's seed-script convention for catalog/template rows.
 *
 * IMPORTANT ordering: migration 262's chk_playbook_category extension must be
 * applied BEFORE this script runs (constraint precedes the row insert — same
 * ordering discipline as migration 178).
 *
 * Idempotent — deterministic IDs; re-running updates rows in place.
 * Marker check: presence of the 'PG-01' catalog row, per AGENTS.md
 * ("check for the presence of the new marker, NOT the absence of an old one").
 *
 * Step-copy convention: every instruction opens with its scope —
 * "PG-level" = one action for the whole campaign, "Per prospect" / "Per
 * queue row" = repeat for every row, "repeatable" = re-runnable as new
 * prospects arrive. Cross-references name steps, never positional numbers
 * (merged permanent steps used to shift display positions).
 *
 * Usage:
 *   doppler run --config local -- npx tsx src/scripts/seed-proving-ground-preflight.ts
 *   doppler run --config prd   -- npx tsx src/scripts/seed-proving-ground-preflight.ts
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

const PLAYBOOK_ID = 'pbk-pg01main';

const PLAYBOOK = {
  id: PLAYBOOK_ID,
  code: 'PG-01',
  name: 'Proving Ground Preflight',
  category: 'proving_ground',
  archetype: 'ops',
  archetype_label: 'Operations',
  description:
    'City/category proving-ground launch checklist. Attaches directly to the ' +
    'proving-ground campaign (no triage — aggregate campaigns resolve PG-01 ' +
    'by catalog code). Steps 1–6 are the required launch funnel (attach ' +
    'discovery sources → load → queue → prioritize → promote → reconcile ' +
    'duplicates); steps 7–9 are optional market-enrichment lanes.',
  matching_rules: {},
  fitd_offer_title: 'Directory Claim Setup',
  retainer_pitch_title: 'Proving Ground Review',
  is_active: true,
  priority_rank: 90,
};

// Steps follow the cockpit's actual operator flow (attach → load → queue →
// prioritize → promote → reconcile → enrich). Every instruction leads with
// its scope so a step is never ambiguous about acting once per PG vs once
// per prospect. Steps 1–6 required (the launch funnel); 7–9 optional
// enrichment lanes. All stage_tag=null — the parent never leaves 'seek',
// so stage tags would hide them forever.
const STEPS = [
  {
    id: 'pstep-pg01-s1',
    step_order: 1,
    title: 'Attach profiles & discovery campaigns',
    instructions:
      'PG-level, once per slot: cover every profile slot in the header ' +
      'strip — one active intelligence profile per category × geo × focus ' +
      '(click a red slot to create or activate it) — then attach the ' +
      'unparented discovery campaign(s) under "Attached campaigns". Done ' +
      'when every slot is covered and at least one intelligence child is ' +
      'attached.',
    step_type: 'internal_link',
    action_config: { target: 'proving_ground_section', params: { section: 'children' } },
    is_required: true,
  },
  {
    id: 'pstep-pg01-s2',
    step_order: 2,
    title: 'Load discovery prospects',
    instructions:
      'PG-level, repeatable: "Load prospects" pulls the businesses the ' +
      'attached discovery campaign(s) found into the Discovery prospects ' +
      'panel. Re-run as "Reload prospects" whenever a child campaign ' +
      'finishes a new run — already-queued businesses render "In queue".',
    step_type: 'internal_link',
    action_config: { target: 'proving_ground_section', params: { section: 'prospects' } },
    is_required: true,
  },
  {
    id: 'pstep-pg01-s3',
    step_order: 3,
    title: 'Queue the prospects',
    instructions:
      'Per prospect: on each discovered business you intend to work, use ' +
      'Queue — queued rows become this PG\'s working set (the promote ' +
      'panel and worklist below). Verify/Campaign are per-business ' +
      'alternatives for rows that need them.',
    step_type: 'internal_link',
    action_config: { target: 'proving_ground_section', params: { section: 'prospects' } },
    is_required: true,
  },
  {
    id: 'pstep-pg01-s4',
    step_order: 4,
    title: 'Prioritize the queue (top to bottom)',
    instructions:
      'Per queue row: set priority high/normal on the promote panel — the ' +
      'list reads top-to-bottom in work order (high floats first). ' +
      'Discovery\'s seek-priority chips carry over; "hold" rows stay ' +
      'unchecked until an analyst resolves the hold.',
    step_type: 'internal_link',
    action_config: { target: 'proving_ground_section', params: { section: 'queue' } },
    is_required: true,
  },
  {
    id: 'pstep-pg01-s5',
    step_order: 5,
    title: 'Promote prospects to listings',
    instructions:
      'Per prospect, repeatable: check the ready rows in "Promote to ' +
      'listings" and promote — each promotion creates + publishes that ' +
      'prospect\'s directory listing, links its own discovery campaign, ' +
      'mints its claim token, and stamps queue.seed_id. Repeat as audits ' +
      'land; promotion is incremental, not a one-shot batch.',
    step_type: 'internal_link',
    action_config: { target: 'proving_ground_section', params: { section: 'queue' } },
    is_required: true,
  },
  {
    id: 'pstep-pg01-s6',
    step_order: 6,
    title: 'Reconcile Seed Funnel',
    instructions:
      'PG-level, one pass after promotions: resolve every duplicate group ' +
      'in the panel below — same_entity or distinct, with a short ' +
      'rationale. The gate: duplicateSeedCount = 0 for the tree-filtered ' +
      'cohort. Verdicts persist and become canonical identity knowledge.',
    step_type: 'manual',
    action_config: {},
    is_required: true,
  },
  {
    id: 'pstep-pg01-s7',
    step_order: 7,
    title: 'Enrich market listings',
    instructions:
      'PG-level, repeatable: "Enrich Market Listings" back-fills sourced ' +
      'attributes on every listing in this PG\'s category × city market. ' +
      'Re-run after promotion batches so new seeds get enriched too. ' +
      'Requires the campaign\'s category + city + state to be set.',
    step_type: 'internal_link',
    action_config: { target: 'proving_ground_section', params: { section: 'enrich' } },
    is_required: false,
  },
  {
    id: 'pstep-pg01-s8',
    step_order: 8,
    title: 'Category enrichment campaign',
    instructions:
      'PG-level, optional: spawn a directory_enrichment child campaign for ' +
      'this category market — deeper per-listing field work beyond the ' +
      'bulk attribute pass. It attaches under this PG automatically.',
    step_type: 'internal_link',
    action_config: { target: 'proving_ground_section', params: { section: 'enrich' } },
    is_required: false,
  },
  {
    id: 'pstep-pg01-s9',
    step_order: 9,
    title: 'Location enrichment campaign',
    instructions:
      'PG-level, optional: spawn a directory_enrichment child campaign for ' +
      'this city — enriches listings across categories in the market. It ' +
      'attaches under this PG automatically.',
    step_type: 'internal_link',
    action_config: { target: 'proving_ground_section', params: { section: 'enrich' } },
    is_required: false,
  },
];

async function main() {
  // Marker-presence idempotency: check for the PG-01 row, not the absence of
  // any old section (AGENTS.md).
  const existing = await prisma.mkt_playbook_catalog.findUnique({
    where: { code: 'PG-01' },
  });

  if (existing) {
    await prisma.mkt_playbook_catalog.update({
      where: { code: 'PG-01' },
      data: { ...PLAYBOOK, id: existing.id },
    });
    logger.info('Updated playbook: PG-01');
  } else {
    await prisma.mkt_playbook_catalog.create({ data: PLAYBOOK });
    logger.info('Created playbook: PG-01');
  }

  const playbook = await prisma.mkt_playbook_catalog.findUniqueOrThrow({
    where: { code: 'PG-01' },
  });

  let upserted = 0;
  for (const step of STEPS) {
    await prisma.mkt_playbook_checklist_steps.upsert({
      where: { id: step.id },
      create: { ...step, playbook_id: playbook.id },
      update: { ...step, playbook_id: playbook.id },
    });
    upserted++;
  }

  logger.info(`Seed complete: playbook PG-01 + ${upserted} steps upserted`);
  process.exit(0);
}

main().catch((err) => {
  logger.error('Seed script failed', undefined, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
  process.exit(1);
});
