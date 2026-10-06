/**
 * Marketing Ops Auto-Follow-Up Scheduler Job
 *
 * Runs every `schedulerIntervalHours` (default 6h) to automatically
 * schedule follow-ups for hot prospects whose latest contact was a
 * no-response. Reuses Sprint 2's outreach log + rollups.
 *
 * Wired into server startup in index.ts (following existing job pattern).
 * Can be disabled via DISABLE_MARKETING_OPS_AUTO_FOLLOWUP env var.
 */

import { logger } from '../logger';
import { MarketingAutoFollowUpScheduler } from '../services/MarketingAutoFollowUpScheduler';
import { unifiedConfig } from '../config/unifiedConfig';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'marketing-ops-auto-followup';
const STARTUP_DELAY_MS = 2 * 60 * 1000; // 2 minutes

let configuredIntervalMs = 6 * 60 * 60 * 1000;
let firstRun = true;

async function runMarketingOpsAutoFollowUp(): Promise<void> {
  logger.info('[MarketingOpsAutoFollowUp] Starting hot-prospect auto-follow-up pass...');

  try {
    const result = await MarketingAutoFollowUpScheduler.getInstance().run();
    logger.info(`[MarketingOpsAutoFollowUp] Completed: ${result.scheduled} scheduled, ${result.skipped} skipped, ${result.deprioritized} deprioritized`, undefined, result);
  } catch (error) {
    logger.error('[MarketingOpsAutoFollowUp] Failed:', undefined, {
      error: {
        name: (error as Error)?.name || 'Error',
        message: (error as Error)?.message || String(error),
        stack: (error as Error)?.stack,
      },
    });
  }

  // Run the review cascade pass (email → SMS → DM escalation for opted-in campaigns)
  try {
    const { default: ReviewCascadeService } = await import('../services/ReviewCascadeService.js');
    const cascadeResult = await ReviewCascadeService.run();
    if (cascadeResult.fired > 0 || cascadeResult.exhausted > 0) {
      logger.info(`[MarketingOpsAutoFollowUp] Review cascade: ${cascadeResult.fired} fired, ${cascadeResult.skipped} skipped, ${cascadeResult.exhausted} exhausted`, undefined, cascadeResult);
    }
  } catch (error) {
    logger.error('[MarketingOpsAutoFollowUp] Review cascade failed:', undefined, {
      error: {
        name: (error as Error)?.name || 'Error',
        message: (error as Error)?.message || String(error),
      },
    });
  }
}

export async function startMarketingOpsAutoFollowUp(): Promise<void> {
  const intervalHours = unifiedConfig.marketingOpsAutoFollowUpSchedulerIntervalHours;
  configuredIntervalMs = intervalHours * 60 * 60 * 1000;
  logger.info(`[MarketingOpsAutoFollowUp] Starting scheduler (every ${intervalHours}h)`);

  scheduleJob({
    name: JOB_NAME,
    description: 'Schedules follow-ups for no-response hot prospects',
    scheduleLabel: `every ${intervalHours} hours`,
    envDisableVar: 'DISABLE_MARKETING_OPS_AUTO_FOLLOWUP',
    computeNextDelay: () => (firstRun ? ((firstRun = false), STARTUP_DELAY_MS) : configuredIntervalMs),
    handler: async () => runMarketingOpsAutoFollowUp(),
  });
}

export function stopMarketingOpsAutoFollowUp(): void {
  stopJob(JOB_NAME);
}
