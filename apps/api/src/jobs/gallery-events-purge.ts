/**
 * Gallery Events Purge Job
 *
 * Scheduled job that runs daily at 2:30 AM UTC (after aggregation, before
 * log-purge) to delete raw mkt_gallery_events older than 90 days.
 *
 * mkt_gallery_analytics rows are retained indefinitely (they are the
 * permanent rollup — raw events are only needed for 90 days for the
 * recent activity feed).
 *
 * Mirrors log-purge.ts scheduling pattern.
 *
 * Design doc: docs/LocalBiz/MARKETING_OPS_DIAGNOSTIC_GALLERY_SPEC.md §12 Sprint 7
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

const RETENTION_DAYS = 90;

let jobInterval: NodeJS.Timeout | null = null;
let jobTimeout: NodeJS.Timeout | null = null;

async function runPurge(): Promise<void> {
  const startTime = Date.now();
  logger.info(`[GalleryEventsPurge] Starting purge of events older than ${RETENTION_DAYS} days...`);

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

    const result = await prisma.mkt_gallery_events.deleteMany({
      where: {
        created_at: { lt: cutoff },
      },
    });

    const elapsed = Date.now() - startTime;
    logger.info(`[GalleryEventsPurge] Complete. ${result.count} events deleted in ${elapsed}ms`);
  } catch (err) {
    const error = err instanceof Error ? err : { name: 'Error', message: String(err), stack: undefined as string | undefined };
    logger.error('[GalleryEventsPurge] Unhandled error', undefined, {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
  }
}

/**
 * Start the scheduled job — runs daily at 2:30 AM UTC.
 * Mirrors log-purge.ts scheduling pattern.
 */
export function startGalleryEventsPurge(): void {
  if (jobInterval || jobTimeout) {
    logger.info('[GalleryEventsPurge] Job already running');
    return;
  }

  // Calculate time until next 2:30 AM UTC
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  nextRun.setUTCHours(2, 30, 0, 0);

  const msUntilNextRun = nextRun.getTime() - now.getTime();

  logger.info(`[GalleryEventsPurge] Scheduling first run in ${Math.round(msUntilNextRun / 1000 / 60)} minutes`);

  jobTimeout = setTimeout(() => {
    runPurge().catch((err) => {
      logger.error('[GalleryEventsPurge] Unhandled error in first run', undefined, {
        error: { name: err.name, message: err.message, stack: err.stack },
      });
    });

    jobInterval = setInterval(() => {
      runPurge().catch((err) => {
        logger.error('[GalleryEventsPurge] Unhandled error', undefined, {
          error: { name: err.name, message: err.message, stack: err.stack },
        });
      });
    }, 24 * 60 * 60 * 1000);

    logger.info('[GalleryEventsPurge] Daily job started (2:30 AM UTC)');
  }, msUntilNextRun);
}

/**
 * Stop the scheduled job (for testing / graceful shutdown).
 */
export function stopGalleryEventsPurge(): void {
  if (jobTimeout) {
    clearTimeout(jobTimeout);
    jobTimeout = null;
  }
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
  }
  logger.info('[GalleryEventsPurge] Job stopped');
}
