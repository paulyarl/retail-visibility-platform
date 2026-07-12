/**
 * Affiliate Click Expiry Job
 *
 * Runs daily to mark affiliate clicks as 'expired' after 30 days
 * with no conversion. This keeps the affiliate_clicks table clean
 * and ensures analytics reflect only active/potential conversions.
 *
 * Design doc: docs/BARCODE_WHOLESALE_SPRINT_PLAN.md (Sprint 5 — Task 3)
 */

import { logger } from '../logger';
import wholesaleMatchingService from '../services/WholesaleMatchingService';

let jobInterval: NodeJS.Timeout | null = null;

export async function processClickExpiry(): Promise<number> {
  try {
    const expired = await wholesaleMatchingService.expireStaleClicks();
    if (expired > 0) {
      logger.info('[AffiliateClickExpiry] Processed stale clicks', undefined, { expired });
    }
    return expired;
  } catch (err) {
    logger.error('[AffiliateClickExpiry] Failed to process stale clicks', undefined, {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/**
 * Start the affiliate click expiry job.
 * Runs daily.
 */
export function startAffiliateClickExpiryJob(): void {
  if (jobInterval) {
    console.log('[AffiliateClickExpiry] Job already running');
    return;
  }

  console.log('[AffiliateClickExpiry] Starting daily click expiry job');

  // Run immediately on start
  processClickExpiry().catch(err => {
    logger.error('[AffiliateClickExpiry] Initial run failed', undefined, {
      error: err instanceof Error ? err.message : String(err),
    });
  });

  // Then run daily (24 hours)
  jobInterval = setInterval(() => {
    processClickExpiry().catch(err => {
      logger.error('[AffiliateClickExpiry] Scheduled run failed', undefined, {
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }, 24 * 60 * 60 * 1000);
}

/**
 * Stop the affiliate click expiry job.
 */
export function stopAffiliateClickExpiryJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log('[AffiliateClickExpiry] Job stopped');
  }
}
