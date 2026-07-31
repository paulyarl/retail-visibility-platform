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

const STARTUP_DELAY_MS = 2 * 60 * 1000; // 2 minutes

let reviewResponseIntervalId: NodeJS.Timeout | null = null;

async function runReviewResponseScheduler(): Promise<void> {
  logger.info('[ReviewResponseScheduler] Starting review-response pipeline pass...');

  try {
    const result = await ReviewResponseScheduler.getInstance().run();
    logger.info(`[ReviewResponseScheduler] Completed: ${result.advanced} advanced, ${result.gatesChecked} gates checked, ${result.followUpsScheduled} follow-ups scheduled, ${result.staleClosed} stale closed, ${result.promotedToMonitoring} promoted to monitoring`, undefined, result);
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
  if (process.env.DISABLE_REVIEW_RESPONSE_SCHEDULER === 'true') {
    logger.info('[ReviewResponseScheduler] Disabled by env var');
    return;
  }

  if (reviewResponseIntervalId) {
    logger.info('[ReviewResponseScheduler] Already running');
    return;
  }

  const intervalHours = unifiedConfig.marketingOpsReviewResponseSchedulerIntervalHours;
  const intervalMs = intervalHours * 60 * 60 * 1000;
  logger.info(`[ReviewResponseScheduler] Starting scheduler (every ${intervalHours}h)`);

  setTimeout(() => {
    runReviewResponseScheduler();
  }, STARTUP_DELAY_MS);

  reviewResponseIntervalId = setInterval(() => {
    runReviewResponseScheduler();
  }, intervalMs);
}

export function stopReviewResponseScheduler(): void {
  if (reviewResponseIntervalId) {
    clearInterval(reviewResponseIntervalId);
    reviewResponseIntervalId = null;
    logger.info('[ReviewResponseScheduler] Stopped');
  }
}
