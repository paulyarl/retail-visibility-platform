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

const STARTUP_DELAY_MS = 2 * 60 * 1000; // 2 minutes

let autoFollowUpIntervalId: NodeJS.Timeout | null = null;

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
  if (process.env.DISABLE_MARKETING_OPS_AUTO_FOLLOWUP === 'true') {
    logger.info('[MarketingOpsAutoFollowUp] Disabled by env var');
    return;
  }

  if (autoFollowUpIntervalId) {
    logger.info('[MarketingOpsAutoFollowUp] Already running');
    return;
  }

  const intervalHours = unifiedConfig.marketingOpsAutoFollowUpSchedulerIntervalHours;
  const intervalMs = intervalHours * 60 * 60 * 1000;
  logger.info(`[MarketingOpsAutoFollowUp] Starting scheduler (every ${intervalHours}h)`);

  setTimeout(() => {
    runMarketingOpsAutoFollowUp();
  }, STARTUP_DELAY_MS);

  autoFollowUpIntervalId = setInterval(() => {
    runMarketingOpsAutoFollowUp();
  }, intervalMs);
}

export function stopMarketingOpsAutoFollowUp(): void {
  if (autoFollowUpIntervalId) {
    clearInterval(autoFollowUpIntervalId);
    autoFollowUpIntervalId = null;
    logger.info('[MarketingOpsAutoFollowUp] Stopped');
  }
}
