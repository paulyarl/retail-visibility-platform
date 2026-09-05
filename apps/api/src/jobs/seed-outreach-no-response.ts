/**
 * Seed Outreach No-Response Job
 *
 * Runs daily to mark seeds in `outreach_scheduled` state as `no_response`
 * when the courtesy window (SEED_OUTREACH_NO_RESPONSE_DAYS, default 14)
 * has elapsed with no operator contact logged.
 *
 * Wired into server startup in index.ts (following existing job pattern).
 * Can be disabled via DISABLE_SEED_OUTREACH_NO_RESPONSE_JOB env var.
 *
 * See: docs/LocalBiz/seed_outreach_courtesy_window_sprint_plan.md §7.5
 */

import { logger } from '../logger';
import { prisma } from '../prisma';
import { unifiedConfig } from '../config/unifiedConfig';
import DirectoryPresenceSeedService from '../services/DirectoryPresenceSeedService';

const STARTUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let noResponseIntervalId: NodeJS.Timeout | null = null;

async function runSeedOutreachNoResponse(): Promise<void> {
  logger.info('[SeedOutreachNoResponse] Starting no-response sweep...');

  try {
    const noResponseDays = unifiedConfig.seedOutreachNoResponseDays;

    // Find stale outreach_scheduled seeds
    const stale = await prisma.$queryRaw<any[]>`
      SELECT id FROM directory_presence_seeds
      WHERE outreach_state = 'outreach_scheduled'
        AND outreach_scheduled_at < now() - interval '${noResponseDays} days'
    `;

    let marked = 0;
    for (const seed of stale) {
      try {
        await DirectoryPresenceSeedService.setOutreachState(
          seed.id,
          'no_response',
          { actorId: 'system', actorType: 'system' },
        );
        marked++;
      } catch (err) {
        logger.warn('[SeedOutreachNoResponse] Failed to mark seed', undefined, {
          seedId: seed.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info(`[SeedOutreachNoResponse] Completed: ${marked} marked no_response (of ${stale.length} stale)`, undefined, {
      stale: stale.length,
      marked,
      noResponseDays,
    });
  } catch (error) {
    logger.error('[SeedOutreachNoResponse] Failed:', undefined, {
      error: {
        name: (error as Error)?.name || 'Error',
        message: (error as Error)?.message || String(error),
        stack: (error as Error)?.stack,
      },
    });
  }
}

export async function startSeedOutreachNoResponseJob(): Promise<void> {
  if (unifiedConfig.disableSeedOutreachNoResponseJob) {
    logger.info('[SeedOutreachNoResponse] Disabled by env var');
    return;
  }

  if (noResponseIntervalId) {
    logger.info('[SeedOutreachNoResponse] Already running');
    return;
  }

  logger.info(`[SeedOutreachNoResponse] Starting scheduler (every 24h, ${unifiedConfig.seedOutreachNoResponseDays}d threshold)`);

  setTimeout(() => {
    runSeedOutreachNoResponse();
  }, STARTUP_DELAY_MS);

  noResponseIntervalId = setInterval(() => {
    runSeedOutreachNoResponse();
  }, INTERVAL_MS);
}

export function stopSeedOutreachNoResponseJob(): void {
  if (noResponseIntervalId) {
    clearInterval(noResponseIntervalId);
    noResponseIntervalId = null;
    logger.info('[SeedOutreachNoResponse] Stopped');
  }
}
