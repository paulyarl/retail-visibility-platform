/**
 * Search Console Demand Ingest Job
 *
 * Runs daily (09:15 UTC, after Google posts the previous day) to pull Search
 * Console demand for visibleshelf.com into seo_gsc_* and seo_query_signals,
 * which feed the data-driven seeding report.
 *
 * No-ops until GSC_SERVICE_ACCOUNT_JSON_B64 is set.
 * Can be disabled via DISABLE_GSC_SEARCH_DEMAND_JOB env var.
 */
import { logger } from '../logger';
import { ingestSearchConsole } from '../services/GscSearchDemandService';
import { nextCronRun } from './cronSpec';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'gsc-search-demand-ingest';
const CRON = '15 9 * * *';
const FALLBACK_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function runGscSearchDemandIngest(): Promise<unknown> {
  try {
    const result = await ingestSearchConsole();
    if (result.skipped) {
      logger.info('[GscSearchDemand] Skipped: GSC_SERVICE_ACCOUNT_JSON_B64 not set');
    }
    return result;
  } catch (error) {
    logger.error('[GscSearchDemand] Failed:', undefined, {
      error: {
        name: (error as Error)?.name || 'Error',
        message: (error as Error)?.message || String(error),
        stack: (error as Error)?.stack,
      },
    });
    throw error;
  }
}

export function startGscSearchDemandIngestJob(): void {
  scheduleJob({
    name: JOB_NAME,
    description: 'Pulls Search Console demand into seo_gsc_* and seo_query_signals',
    scheduleLabel: 'daily at 9:15 AM UTC',
    envDisableVar: 'DISABLE_GSC_SEARCH_DEMAND_JOB',
    computeNextDelay: () => {
      const next = nextCronRun(CRON);
      return next ? next.getTime() - Date.now() : FALLBACK_INTERVAL_MS;
    },
    handler: async () => runGscSearchDemandIngest(),
  });
}

export function stopGscSearchDemandIngestJob(): void {
  stopJob(JOB_NAME);
}
