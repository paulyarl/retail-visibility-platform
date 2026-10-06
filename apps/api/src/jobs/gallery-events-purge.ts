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
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'gallery-events-purge';
const RETENTION_DAYS = 90;

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
/** ms until the next 2:30 AM UTC — always a future delay. */
function nextDailyRunDelay(): number {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(2, 30, 0, 0);
  return next.getTime() - Date.now();
}

export function startGalleryEventsPurge(): void {
  scheduleJob({
    name: JOB_NAME,
    description: 'Purges gallery events past 90-day retention',
    scheduleLabel: 'daily at 2:30 AM UTC',
    computeNextDelay: nextDailyRunDelay,
    handler: async () => runPurge(),
  });
}

/**
 * Stop the scheduled job (for testing / graceful shutdown).
 */
export function stopGalleryEventsPurge(): void {
  stopJob(JOB_NAME);
}
