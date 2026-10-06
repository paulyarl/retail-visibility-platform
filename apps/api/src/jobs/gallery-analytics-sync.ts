/**
 * Gallery Analytics Aggregation Job
 *
 * Scheduled job that runs daily at 2:00 AM UTC to:
 * 1. Aggregate mkt_gallery_events into mkt_gallery_analytics rollup rows
 * 2. Token-scoped grouping (G28 — groups by token_id, campaign_id, not tenant)
 * 3. avg_session_duration_ms = MAX(dwell_ms) per session, then averaged (G27)
 * 4. Upsert into mkt_gallery_analytics with ON CONFLICT DO UPDATE
 *
 * Mirrors log-purge.ts scheduling pattern (setTimeout until next 2 AM, then
 * setInterval every 24h). Aggregation logic delegates to
 * GalleryAnalyticsService.aggregateAnalytics (Sprint 4).
 *
 * Design doc: docs/LocalBiz/MARKETING_OPS_DIAGNOSTIC_GALLERY_SPEC.md §12 Sprint 7
 */

import { logger } from '../logger';
import galleryAnalyticsService from '../services/GalleryAnalyticsService';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'gallery-analytics-sync';

async function runAggregation(): Promise<void> {
  const startTime = Date.now();
  logger.info('[GalleryAnalyticsSync] Starting scheduled gallery analytics aggregation...');

  try {
    // Aggregate the last 30 days of events (covers re-runs + late events)
    const upserted = await galleryAnalyticsService.aggregateAnalytics(30);
    const elapsed = Date.now() - startTime;
    logger.info(`[GalleryAnalyticsSync] Complete. ${upserted} rows upserted in ${elapsed}ms`);
  } catch (err) {
    const error = err instanceof Error ? err : { name: 'Error', message: String(err), stack: undefined as string | undefined };
    logger.error('[GalleryAnalyticsSync] Unhandled error', undefined, {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
  }
}

/**
 * Start the scheduled job — runs daily at 2:00 AM UTC.
 * Mirrors log-purge.ts scheduling pattern.
 */
/** ms until the next 2:00 AM UTC — always a future delay. */
function nextDailyRunDelay(): number {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + 1);
  next.setUTCHours(2, 0, 0, 0);
  return next.getTime() - Date.now();
}

export function startGalleryAnalyticsSync(): void {
  scheduleJob({
    name: JOB_NAME,
    description: 'Gallery analytics aggregation',
    scheduleLabel: 'daily at 2 AM UTC',
    computeNextDelay: nextDailyRunDelay,
    handler: async () => runAggregation(),
  });
}

/**
 * Stop the scheduled job (for testing / graceful shutdown).
 */
export function stopGalleryAnalyticsSync(): void {
  stopJob(JOB_NAME);
}
