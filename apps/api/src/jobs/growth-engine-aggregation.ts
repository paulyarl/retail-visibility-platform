/**
 * Growth Engine Daily Aggregation Job
 *
 * Runs daily to populate growth_engine_daily_metrics (migration 224) via
 * GrowthEngineAnalyticsService.runDailyAggregation. Idempotent — re-running
 * for the same date upserts in place. Defaults to aggregating yesterday.
 */

import GrowthEngineAnalyticsService from '../services/GrowthEngineAnalyticsService';
import { logger } from '../logger';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'growth-engine-aggregation';
const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // daily
const STARTUP_DELAY_MS = 15 * 60 * 1000; // 15 minutes after boot
let firstRun = true;

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
  scheduleJob({
    name: JOB_NAME,
    description: 'Populates growth_engine_daily_metrics',
    scheduleLabel: 'daily',
    envDisableVar: 'DISABLE_GROWTH_ENGINE_AGGREGATION',
    computeNextDelay: () => (firstRun ? ((firstRun = false), STARTUP_DELAY_MS) : SYNC_INTERVAL_MS),
    handler: async () => runScheduledSync(),
  });
}

export function stopGrowthEngineAggregation(): void {
  stopJob(JOB_NAME);
}
