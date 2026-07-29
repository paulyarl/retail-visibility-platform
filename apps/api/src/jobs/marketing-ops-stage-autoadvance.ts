/**
 * Marketing Ops Stage Auto-Advance Job
 *
 * Runs daily to auto-advance campaigns stuck in the 'shown' stage
 * to 'lost' after 7 days with no response. This keeps the pipeline
 * clean and ensures accurate stage reporting.
 *
 * Wired into server startup in index.ts (following existing job pattern).
 * Can be disabled via DISABLE_MARKETING_OPS_AUTOADVANCE env var.
 */

import { logger } from '../logger';
import MarketingCampaignService from '../services/MarketingCampaignService';
import { unifiedConfig } from '../config/unifiedConfig';

const STARTUP_DELAY_MS = 60 * 1000; // 1 minute
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let autoAdvanceIntervalId: NodeJS.Timeout | null = null;

async function runMarketingOpsAutoAdvance(): Promise<void> {
  logger.info('[MarketingOpsAutoAdvance] Starting stale shown campaign auto-advance...');

  try {
    const staleDays = unifiedConfig.marketingOpsShownStaleDays;
    const { advanced, skipped } = await MarketingCampaignService.autoAdvanceStaleShownCampaigns(staleDays);
    logger.info(`[MarketingOpsAutoAdvance] Completed: ${advanced} campaigns advanced from 'shown' to 'lost', ${skipped} skipped (live preview tokens)`, undefined, { advanced, skipped, staleDays });
  } catch (error) {
    logger.error('[MarketingOpsAutoAdvance] Failed:', undefined, {
      error: {
        name: (error as Error)?.name || 'Error',
        message: (error as Error)?.message || String(error),
        stack: (error as Error)?.stack,
      },
    });
  }
}

export async function startMarketingOpsAutoAdvance(): Promise<void> {
  if (process.env.DISABLE_MARKETING_OPS_AUTOADVANCE === 'true') {
    logger.info('[MarketingOpsAutoAdvance] Disabled by env var');
    return;
  }

  if (autoAdvanceIntervalId) {
    logger.info('[MarketingOpsAutoAdvance] Already running');
    return;
  }

  logger.info('[MarketingOpsAutoAdvance] Starting scheduler (daily)');

  setTimeout(() => {
    runMarketingOpsAutoAdvance();
  }, STARTUP_DELAY_MS);

  autoAdvanceIntervalId = setInterval(() => {
    runMarketingOpsAutoAdvance();
  }, INTERVAL_MS);
}

export function stopMarketingOpsAutoAdvance(): void {
  if (autoAdvanceIntervalId) {
    clearInterval(autoAdvanceIntervalId);
    autoAdvanceIntervalId = null;
    logger.info('[MarketingOpsAutoAdvance] Stopped');
  }
}
