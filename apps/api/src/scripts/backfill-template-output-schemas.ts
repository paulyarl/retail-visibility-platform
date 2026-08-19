/**
 * Backfill: Set output_schema on custom templates missing it.
 *
 * Targets non-seed templates (anything not in seed-marketing-ops-templates.ts,
 * seed-intelligence-*.ts, or seed-profile-repair-signals.ts) that have
 * output_schema = NULL. Sets them to {"name": "raw_json"} so importExternalResult()
 * succeeds without forcing a specific shape.
 *
 * SKIPS:
 *   - Templates that already have output_schema set (idempotent)
 *   - Fragment templates (prompt_type = 'fragment') — composition building
 *     blocks, never executed or imported directly
 *   - Inactive templates
 *
 * Usage:
 *   doppler run --config local -- npx tsx src/scripts/backfill-template-output-schemas.ts
 *   doppler run --config prd -- npx tsx src/scripts/backfill-template-output-schemas.ts
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

// Template IDs managed by seed scripts — these get their schemas from the
// seed files, not from this backfill. Listed here so the backfill skips them
// even if they temporarily have NULL output_schema (the seed will fix them).
const SEED_MANAGED_IDS = new Set([
  // seed-marketing-ops-templates.ts
  'mpt-seed-seek-001',
  'mpt-seed-seek-002',
  'mpt-seed-seek-003',
  'mpt-seed-fulfill-001',
  'mpt-seed-fulfill-002',
  'mpt-seed-fulfill-003',
  'mpt-seed-filter-001',
  'mpt-seed-retainer-001',
  // seed-intelligence-discovery-templates.ts
  'mpt-seed-intel-discovery-emerging-001',
  'mpt-seed-intel-discovery-competitive-001',
  // seed-intelligence-profile-establishment-template.ts
  'mpt-seed-intel-profile-establishment-001',
  // seed-profile-repair-signals.ts (triage template)
  'mpt-profile-repair-triage-default',
]);

async function main(): Promise<void> {
  logger.info('Starting output_schema backfill for custom templates...');

  const templates = await prisma.mkt_prompt_templates_list.findMany({
    select: {
      id: true,
      name: true,
      prompt_type: true,
      scope: true,
      category: true,
      output_schema: true,
      is_active: true,
    },
    orderBy: { id: 'asc' },
  });

  let backfilled = 0;
  let skippedAlreadySet = 0;
  let skippedFragment = 0;
  let skippedSeedManaged = 0;
  let skippedInactive = 0;

  for (const t of templates) {
    // Skip if already has output_schema
    const currentSchema = t.output_schema as any;
    if (currentSchema && currentSchema.name) {
      skippedAlreadySet++;
      continue;
    }

    // Skip fragments — composition building blocks, never executed/imported
    if (t.prompt_type === 'fragment') {
      skippedFragment++;
      continue;
    }

    // Skip seed-managed templates — the seed scripts handle these
    if (SEED_MANAGED_IDS.has(t.id)) {
      skippedSeedManaged++;
      logger.info(`Skipping seed-managed template (run the seed script): ${t.id}`);
      continue;
    }

    // Skip inactive templates
    if (!t.is_active) {
      skippedInactive++;
      continue;
    }

    // Backfill: set raw_json
    await prisma.mkt_prompt_templates_list.update({
      where: { id: t.id },
      data: {
        output_schema: { name: 'raw_json' } as any,
      },
    });
    backfilled++;
    logger.info(`Backfilled ${t.id} (${t.name}) → raw_json`, undefined, {
      id: t.id,
      prompt_type: t.prompt_type,
      scope: t.scope,
      category: t.category,
    });
  }

  logger.info('Backfill complete', undefined, {
    backfilled,
    skippedAlreadySet,
    skippedFragment,
    skippedSeedManaged,
    skippedInactive,
  });

  await prisma.$disconnect();
}

main().catch((err) => {
  logger.error('Backfill failed', undefined, { error: (err as Error).message });
  process.exit(1);
});
