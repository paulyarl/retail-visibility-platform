/**
 * Review Response Scheduler Job
 *
 * Runs every `schedulerIntervalHours` (default 6h) to check gates,
 * auto-advance stages, close stale threads, and promote closed
 * pipelines to monitoring. Reuses ReviewResponseScheduler.
 *
 * Wired into server startup in index.ts (following existing job pattern).
 * Can be disabled via DISABLE_REVIEW_RESPONSE_SCHEDULER env var.
 */

import { logger } from '../logger';
import { ReviewResponseScheduler } from '../services/ReviewResponseScheduler';
import { unifiedConfig } from '../config/unifiedConfig';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'review-response-scheduler';
const STARTUP_DELAY_MS = 2 * 60 * 1000; // 2 minutes

let configuredIntervalMs = 6 * 60 * 60 * 1000;
let firstRun = true;

async function runReviewResponseScheduler(): Promise<void> {
  logger.info('[ReviewResponseScheduler] Starting review-response pipeline pass...');

  try {
    const result = await ReviewResponseScheduler.getInstance().run();
    logger.info(`[ReviewResponseScheduler] Completed: ${result.advanced} advanced, ${result.gatesChecked} gates checked, ${result.followUpsFired} follow-ups fired, ${result.staleClosed} stale closed, ${result.promotedToMonitoring} promoted to monitoring`, undefined, result);
  } catch (error) {
    logger.error('[ReviewResponseScheduler] Failed:', undefined, {
      error: {
        name: (error as Error)?.name || 'Error',
        message: (error as Error)?.message || String(error),
        stack: (error as Error)?.stack,
      },
    });
  }
}

export async function startReviewResponseScheduler(): Promise<void> {
  const intervalHours = unifiedConfig.marketingOpsReviewResponseSchedulerIntervalHours;
  configuredIntervalMs = intervalHours * 60 * 60 * 1000;
  logger.info(`[ReviewResponseScheduler] Starting scheduler (every ${intervalHours}h)`);

  scheduleJob({
    name: JOB_NAME,
    description: 'Review pipeline gates, auto-advance, thread closing',
    scheduleLabel: `every ${intervalHours} hours`,
    envDisableVar: 'DISABLE_REVIEW_RESPONSE_SCHEDULER',
    computeNextDelay: () => (firstRun ? ((firstRun = false), STARTUP_DELAY_MS) : configuredIntervalMs),
    handler: async () => runReviewResponseScheduler(),
  });
}

export function stopReviewResponseScheduler(): void {
  stopJob(JOB_NAME);
}
