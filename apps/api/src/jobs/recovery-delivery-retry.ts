/**
 * Recovery Delivery Retry Scheduler Job
 *
 * Polls mkt_outreach_log for failed/retrying delivery entries and
 * re-attempts delivery via RecoveryResolutionService.retryDelivery().
 *
 * Retry policy:
 *   - Max 3 attempts
 *   - Exponential backoff: 15min, 30min, 45min
 *   - After 3 failed attempts → permanently failed (manual intervention)
 *
 * Wired into server startup in index.ts (following existing job pattern).
 * Can be disabled via DISABLE_RECOVERY_DELIVERY_RETRY env var.
 *
 * Sprint 2 — Recovery Production Readiness.
 */

import { logger } from '../logger';
import { prisma } from '../prisma';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'recovery-delivery-retry';
const STARTUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes after startup
const POLL_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes
const MAX_ATTEMPTS = 3;

let firstRun = true;

// ====================
// DELIVERY RETRY PASS
// ====================

async function runDeliveryRetryPass(): Promise<void> {
  logger.info('[RecoveryDeliveryRetry] Starting retry pass...');

  try {
    // Find outreach log entries that are due for retry:
    // - delivery_status is 'failed' or 'retrying'
    // - delivery_attempts < MAX_ATTEMPTS
    // - retry_after is null (immediate) OR retry_after <= now
    const now = new Date();
    const dueForRetry = await prisma.mkt_outreach_log.findMany({
      where: {
        delivery_status: { in: ['failed', 'retrying'] },
        delivery_attempts: { lt: MAX_ATTEMPTS },
        OR: [
          { retry_after: null },
          { retry_after: { lte: now } },
        ],
        notes: { contains: 'Recovery resolution delivery' },
      },
      orderBy: { created_at: 'asc' },
      take: 20, // Process in batches
    });

    if (dueForRetry.length === 0) {
      logger.info('[RecoveryDeliveryRetry] No deliveries due for retry');
      return;
    }

    logger.info(`[RecoveryDeliveryRetry] Found ${dueForRetry.length} delivery(ies) due for retry`);

    const { default: RecoveryResolutionService } = await import('../services/RecoveryResolutionService');

    let succeeded = 0;
    let failed = 0;

    for (const log of dueForRetry) {
      try {
        const result = await RecoveryResolutionService.retryDelivery(log.id);
        if (result.success) {
          succeeded++;
        } else {
          failed++;
        }
      } catch (err) {
        logger.warn('[RecoveryDeliveryRetry] Retry threw for log entry', undefined, {
          logId: log.id,
          error: (err as Error).message,
        });
        failed++;
      }
    }

    logger.info('[RecoveryDeliveryRetry] Pass complete', undefined, {
      total: dueForRetry.length,
      succeeded,
      failed,
    });
  } catch (error) {
    logger.error('[RecoveryDeliveryRetry] Pass failed', undefined, {
      error: (error as Error).message,
    });
  }
}

// ====================
// JOB LIFECYCLE
// ====================

export function startRecoveryDeliveryRetryJob(): void {
  scheduleJob({
    name: JOB_NAME,
    description: 'Retries failed recovery deliveries with backoff',
    scheduleLabel: 'every 15 minutes',
    envDisableVar: 'DISABLE_RECOVERY_DELIVERY_RETRY',
    computeNextDelay: () => (firstRun ? ((firstRun = false), STARTUP_DELAY_MS) : POLL_INTERVAL_MS),
    handler: async () => runDeliveryRetryPass(),
  });
}

export function stopRecoveryDeliveryRetryJob(): void {
  stopJob(JOB_NAME);
}
