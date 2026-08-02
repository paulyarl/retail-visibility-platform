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

const STARTUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes after startup
const POLL_INTERVAL_MS = 15 * 60 * 1000; // every 15 minutes
const MAX_ATTEMPTS = 3;

let intervalId: NodeJS.Timeout | null = null;

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
  if (process.env.DISABLE_RECOVERY_DELIVERY_RETRY === 'true') {
    logger.info('[RecoveryDeliveryRetry] Job disabled via DISABLE_RECOVERY_DELIVERY_RETRY env var');
    return;
  }

  logger.info(`[RecoveryDeliveryRetry] Job scheduled — first run in ${STARTUP_DELAY_MS / 1000}s, then every ${POLL_INTERVAL_MS / 1000}s`);

  // First run after startup delay
  setTimeout(() => {
    runDeliveryRetryPass();
  }, STARTUP_DELAY_MS);

  // Recurring poll
  intervalId = setInterval(() => {
    runDeliveryRetryPass();
  }, POLL_INTERVAL_MS);
}

export function stopRecoveryDeliveryRetryJob(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[RecoveryDeliveryRetry] Job stopped');
  }
}
