/**
 * Seed script: PG-01 Proving Ground Preflight Playbook
 *
 * Seeds the `proving_ground`-category playbook + its 7 checklist steps into
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
    'by catalog code). Step 6 releases the outreach worklist.',
  matching_rules: {},
  fitd_offer_title: 'Directory Claim Setup',
  retainer_pitch_title: 'Proving Ground Review',
  is_active: true,
  priority_rank: 90,
};

// Steps per spec §4.3 — ordered, stage_tag='seek' (the parent stays at 'seek').
const STEPS = [
  {
    id: 'pstep-pg01-s1',
    step_order: 1,
    title: 'Reconcile Seed Funnel',
    instructions:
      'Review the funnel dashboard: resolve all potential duplicate pairs — ' +
      'same_entity or distinct with a short rationale. The gate: ' +
      'duplicateSeedCount = 0 for the tree-filtered cohort. Verdicts persist ' +
      'and become canonical identity knowledge.',
    step_type: 'manual',
    action_config: {},
    is_required: true,
  },
  {
    id: 'pstep-pg01-s2',
    step_order: 2,
    title: 'Seed & Contact',
    instructions:
      'Seed each prospect (auto-creates the directory presence record, links ' +
      'the intelligence campaign, issues the claim token, and stamps ' +
      'queue.seed_id); confirm the verified contact channel on every row.',
    step_type: 'internal_link',
    action_config: { target: 'seed_claim_kit' },
    is_required: true,
  },
  {
    id: 'pstep-pg01-s3',
    step_order: 3,
    title: 'QR / One-Pagers',
    instructions:
      'Generate per-seed claim-invite QR kits + gap-map one-pagers for every ' +
      'queue row. Requires step 2 — the kit resolves through the seed\'s ' +
      'claim token.',
    step_type: 'internal_link',
    action_config: { target: 'seed_claim_kit' },
    is_required: true,
  },
  {
    id: 'pstep-pg01-s4',
    step_order: 4,
    title: 'Offer Construction',
    instructions:
      'Decide the free path per archetype before any outreach: ' +
      'free-claim-only vs free-claim-plus-proof-pilot.',
    step_type: 'manual',
    action_config: {},
    is_required: true,
  },
  {
    id: 'pstep-pg01-s5',
    step_order: 5,
    title: 'Assignment',
    instructions:
      'Every queue row gets a named owner + a named mailer runner. Write the ' +
      'mailer runner\'s name in the step note — mail fulfillment is a weekly ' +
      'batch (v1).',
    step_type: 'manual',
    action_config: {},
    is_required: true,
  },
  {
    id: 'pstep-pg01-s6',
    step_order: 6,
    title: 'Open Worklist',
    instructions:
      'Open the tree-filtered worklist, sort by due-today, assign the first ' +
      'call block. Completing this step releases the proving-ground worklist ' +
      '(the preflight gate lives on the worklist, not on stage transitions — ' +
      'spec §4.10).',
    step_type: 'internal_link',
    action_config: { target: 'proving_ground_worklist' },
    is_required: true,
  },
  {
    id: 'pstep-pg01-s7',
    step_order: 7,
    title: 'Launch Readiness',
    instructions:
      'G1–G4 baselines recorded in the step note; mid-run gap-review dates ' +
      'booked on the calendar.',
    step_type: 'manual',
    action_config: {},
    is_required: true,
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
