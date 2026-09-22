/**
 * Seed Report Backfill Job
 *
 * Runs daily to generate a seed intelligence report for every live seed
 * (published / invited / claimed) that has no published report version in
 * mkt_seed_intelligence_reports.
 *
 * Why: the automatic refresh triggers (claim accept, owner NAP correction,
 * verification events) only fire on post-claim lifecycle events, and the
 * prompt-evidence path is unwired — so an unclaimed seed never gets a first
 * report unless an operator clicks "Refresh report". Without a published
 * report the public preview endpoint 404s and the report QR kit cannot be
 * generated (spec §13.1, §13.6).
 *
 * refreshReport is idempotent (§22.3): when the substrate inputs are
 * unchanged the latest version is reused, so re-sweeping a seed whose
 * report already exists — or whose lint keeps failing — is a no-op.
 *
 * Draft and suppressed seeds are skipped: drafts are parked for operator
 * QC, and the build path may mint a claim token (flipping the seed to
 * 'invited'), which must not happen to a pre-publication seed.
 *
 * Wired into server startup in index.ts (following existing job pattern).
 * Can be disabled via DISABLE_SEED_REPORT_BACKFILL_JOB env var.
 */

import { logger } from '../logger';
import { prisma } from '../prisma';
import { unifiedConfig } from '../config/unifiedConfig';

const STARTUP_DELAY_MS = 7 * 60 * 1000; // 7 minutes — stagger after the other startup jobs
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let backfillIntervalId: NodeJS.Timeout | null = null;

async function runSeedReportBackfill(): Promise<void> {
  logger.info('[SeedReportBackfill] Starting backfill sweep...');

  try {
    // Live seeds with no published report version.
    const seeds = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT dps.id
      FROM directory_presence_seeds dps
      WHERE dps.status IN ('published', 'invited', 'claimed')
        AND NOT EXISTS (
          SELECT 1 FROM mkt_seed_intelligence_reports r
          WHERE r.seed_id = dps.id AND r.published_at IS NOT NULL
        )
      ORDER BY dps.created_at ASC
    `;

    if (seeds.length === 0) {
      logger.info('[SeedReportBackfill] Completed: no seeds missing a published report');
      return;
    }

    const { SeedIntelligenceReportService } = await import(
      '../services/intelligence/SeedIntelligenceReportService'
    );
    const reportService = SeedIntelligenceReportService.getInstance();

    let published = 0;
    let reused = 0;
    let lintFailed = 0;
    let failed = 0;

    for (const seed of seeds) {
      try {
        const result = await reportService.refreshReport(seed.id);
        if (result.reused) {
          reused++;
        } else if (result.lint.passed) {
          published++;
        } else {
          lintFailed++;
          logger.warn('[SeedReportBackfill] Report built but not published (lint)', undefined, {
            seedId: seed.id,
            version: result.version,
            findings: result.lint.findings.map((f) => ({ rule: f.rule, message: f.message })),
          });
        }
      } catch (err) {
        failed++;
        logger.warn('[SeedReportBackfill] Refresh failed for seed', undefined, {
          seedId: seed.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info(
      `[SeedReportBackfill] Completed: ${published} published, ${reused} reused, ${lintFailed} lint-blocked, ${failed} failed (of ${seeds.length} seeds)`,
      undefined,
      { candidates: seeds.length, published, reused, lintFailed, failed },
    );
  } catch (error) {
    logger.error('[SeedReportBackfill] Failed:', undefined, {
      error: {
        name: (error as Error)?.name || 'Error',
        message: (error as Error)?.message || String(error),
        stack: (error as Error)?.stack,
      },
    });
  }
}

export async function startSeedReportBackfillJob(): Promise<void> {
  if (unifiedConfig.disableSeedReportBackfillJob) {
    logger.info('[SeedReportBackfill] Disabled by env var');
    return;
  }

  if (backfillIntervalId) {
    logger.info('[SeedReportBackfill] Already running');
    return;
  }

  logger.info('[SeedReportBackfill] Starting scheduler (every 24h)');

  setTimeout(() => {
    runSeedReportBackfill();
  }, STARTUP_DELAY_MS);

  backfillIntervalId = setInterval(() => {
    runSeedReportBackfill();
  }, INTERVAL_MS);
}

export function stopSeedReportBackfillJob(): void {
  if (backfillIntervalId) {
    clearInterval(backfillIntervalId);
    backfillIntervalId = null;
    logger.info('[SeedReportBackfill] Stopped');
  }
}
