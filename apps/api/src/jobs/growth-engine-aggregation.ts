/**
 * Growth Engine Daily Aggregation Job
 *
 * Runs daily to populate growth_engine_daily_metrics (migration 224) via
 * GrowthEngineAnalyticsService.runDailyAggregation. Idempotent — re-running
 * for the same date upserts in place. Defaults to aggregating yesterday.
 */

import GrowthEngineAnalyticsService from '../services/GrowthEngineAnalyticsService';
import { logger } from '../logger';

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const STARTUP_DELAY_MS = 15 * 60 * 1000; // 15 minutes after boot
let syncIntervalId: NodeJS.Timeout | null = null;

async function runScheduledSync(): Promise<void> {
  try {
    const result = await GrowthEngineAnalyticsService.runDailyAggregation();
    logger.info('[GrowthEngineAggregation] Completed', undefined, {
      date: result.date,
      rowsUpdated: result.rowsUpdated,
    });
  } catch (error) {
    logger.error('[GrowthEngineAggregation] Fatal error:', undefined, {
      error: {
        name: (error as any)?.name || 'Error',
        message: (error as any)?.message || String(error),
        stack: (error as any)?.stack,
      },
    });
  }
}

export async function startGrowthEngineAggregation(): Promise<void> {
  if (process.env.DISABLE_GROWTH_ENGINE_AGGREGATION === 'true') {
    console.log('[GrowthEngineAggregation] Disabled via DISABLE_GROWTH_ENGINE_AGGREGATION env var');
    return;
  }

  if (syncIntervalId) {
    console.log('[GrowthEngineAggregation] Already running');
    return;
  }

  console.log('[GrowthEngineAggregation] Starting scheduler (daily)');

  setTimeout(() => {
    runScheduledSync().catch(console.error);
  }, STARTUP_DELAY_MS);

  syncIntervalId = setInterval(() => {
    runScheduledSync().catch(console.error);
  }, SYNC_INTERVAL_MS);
}

export function stopGrowthEngineAggregation(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[GrowthEngineAggregation] Stopped');
  }
}
