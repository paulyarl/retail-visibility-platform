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
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'affiliate-click-expiry';
const INTERVAL_MS = 24 * 60 * 60 * 1000; // daily

let firstRun = true;

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
  scheduleJob({
    name: JOB_NAME,
    description: 'Marks pending affiliate clicks expired after 30 days',
    scheduleLabel: 'daily',
    computeNextDelay: () => (firstRun ? ((firstRun = false), 5_000) : INTERVAL_MS),
    handler: async () => processClickExpiry(),
  });
}

/**
 * Stop the affiliate click expiry job.
 */
export function stopAffiliateClickExpiryJob(): void {
  stopJob(JOB_NAME);
}
