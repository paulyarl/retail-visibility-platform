/**
 * Seed script: Project Phase Predicates (spec §5/§13)
 *
 * Seeds `mkt_project_phase_predicates` rows for
 * `PROJECT_PHASE_PREDICATES_VERSION`, transcribed verbatim from the spec §5
 * trigger table (`lib/project-phase-predicates.ts`).
 *
 * Idempotent upsert-in-place on (phase_key, predicate_version): re-running
 * refreshes signals/min_severity/int_rank_modifiers/copy_keys/seed_version on
 * existing v1 rows and inserts missing ones. A NEW predicate version is a
 * data change in lib/project-phase-predicates.ts + version bump — never an
 * edit of prior-version rows (plan `predicateSeedVersion` is reproducible
 * provenance).
 *
 * Coverage guardrail (sprint 3.3): the script asserts every
 * KNOWN_SIGNAL_CODES entry is either in a predicate's any_of set or in
 * PHASE_PREDICATE_UNMAPPED_SIGNALS, and fails on a silently unmapped code.
 *
 * Usage (from apps/api):
 *   doppler run --config local -- pnpm seed:project-phase-predicates
 *   doppler run --config prd --    pnpm seed:project-phase-predicates
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { KNOWN_SIGNAL_CODES } from '../services/triage/signal-taxonomy';
import {
  PHASE_PREDICATE_UNMAPPED_SIGNALS,
  PROJECT_PHASE_CATALOG_ORDER,
  PROJECT_PHASE_PREDICATES_SEED_MARKER,
  PROJECT_PHASE_PREDICATES_V1,
  PROJECT_PHASE_PREDICATES_VERSION,
} from '../lib/project-phase-predicates';

/** 3.3 coverage invariant — throws on a silently unmapped known code. */
export function assertSignalCoverage(): void {
  const mapped = new Set<string>();
  for (const row of PROJECT_PHASE_PREDICATES_V1) {
    for (const code of row.signals) mapped.add(code);
  }
  const unmapped = new Set<string>(PHASE_PREDICATE_UNMAPPED_SIGNALS);
  const uncovered = (KNOWN_SIGNAL_CODES as readonly string[]).filter(
    (code) => !mapped.has(code) && !unmapped.has(code),
  );
  if (uncovered.length > 0) {
    throw new Error(
      `Predicate coverage gap — KNOWN_SIGNAL_CODES with no predicate or unmapped entry: ${uncovered.join(', ')}`,
    );
  }
}

export async function seedProjectPhasePredicates(): Promise<void> {
  logger.info('Starting project-phase predicates seed...', undefined, {
    marker: PROJECT_PHASE_PREDICATES_SEED_MARKER,
    version: PROJECT_PHASE_PREDICATES_VERSION,
    count: PROJECT_PHASE_PREDICATES_V1.length,
  });

  assertSignalCoverage();

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of PROJECT_PHASE_PREDICATES_V1) {
    const payload = {
      signals: row.signals,
      min_severity: row.minSeverity,
      int_rank_modifiers: row.intRankModifiers,
      copy_keys: row.copyKeys,
      seed_version: PROJECT_PHASE_PREDICATES_SEED_MARKER,
    };
    try {
      const existing = await prisma.$queryRaw<any[]>`
        SELECT id, signals, min_severity, int_rank_modifiers, copy_keys, seed_version
        FROM mkt_project_phase_predicates
        WHERE phase_key = ${row.phaseKey} AND predicate_version = ${PROJECT_PHASE_PREDICATES_VERSION}
        LIMIT 1
      `;

      if (existing.length === 0) {
        await prisma.$executeRaw`
          INSERT INTO mkt_project_phase_predicates (
            id, phase_key, predicate_version, signals, min_severity,
            int_rank_modifiers, copy_keys, seed_version, created_at, updated_at
          ) VALUES (
            ${`mppp-${row.phaseKey}-v${PROJECT_PHASE_PREDICATES_VERSION}`},
            ${row.phaseKey},
            ${PROJECT_PHASE_PREDICATES_VERSION},
            ${JSON.stringify(payload.signals)}::jsonb,
            ${payload.min_severity === null ? null : JSON.stringify(payload.min_severity)}::jsonb,
            ${JSON.stringify(payload.int_rank_modifiers)}::jsonb,
            ${JSON.stringify(payload.copy_keys)}::jsonb,
            ${payload.seed_version},
            now(),
            now()
          )
        `;
        created++;
        logger.info(`Seeded predicate ${row.phaseKey} v${PROJECT_PHASE_PREDICATES_VERSION}`);
      } else {
        const cur = existing[0];
        const same =
          JSON.stringify(cur.signals) === JSON.stringify(payload.signals) &&
          JSON.stringify(cur.min_severity ?? null) === JSON.stringify(payload.min_severity) &&
          JSON.stringify(cur.int_rank_modifiers) === JSON.stringify(payload.int_rank_modifiers) &&
          JSON.stringify(cur.copy_keys) === JSON.stringify(payload.copy_keys) &&
          cur.seed_version === payload.seed_version;
        if (same) {
          skipped++;
          logger.info(`Predicate ${row.phaseKey} already up-to-date, skipping.`);
        } else {
          await prisma.$executeRaw`
            UPDATE mkt_project_phase_predicates
            SET signals = ${JSON.stringify(payload.signals)}::jsonb,
                min_severity = ${payload.min_severity === null ? null : JSON.stringify(payload.min_severity)}::jsonb,
                int_rank_modifiers = ${JSON.stringify(payload.int_rank_modifiers)}::jsonb,
                copy_keys = ${JSON.stringify(payload.copy_keys)}::jsonb,
                seed_version = ${payload.seed_version},
                updated_at = now()
            WHERE id = ${cur.id}
          `;
          updated++;
          logger.info(`Updated predicate ${row.phaseKey} v${PROJECT_PHASE_PREDICATES_VERSION}`);
        }
      }
    } catch (err) {
      logger.error(`Error seeding predicate ${row.phaseKey}`, undefined, {
        error: (err as Error).message,
      });
    }
  }

  logger.info('Project-phase predicates seed completed.', undefined, {
    marker: PROJECT_PHASE_PREDICATES_SEED_MARKER,
    version: PROJECT_PHASE_PREDICATES_VERSION,
    phases: PROJECT_PHASE_CATALOG_ORDER.length,
    created,
    updated,
    skipped,
  });
}

if (require.main === module) {
  seedProjectPhasePredicates()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
