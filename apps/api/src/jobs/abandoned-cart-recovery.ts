/**
 * Abandoned Cart Recovery Scheduled Job
 *
 * Runs every 30 minutes to find carts abandoned 1-24 hours ago
 * that haven't had a recovery email sent yet, and sends recovery emails.
 */

import { abandonedCartService } from '../services/AbandonedCartService';
import { logger } from '../logger';

const RECOVERY_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const MIN_AGE_HOURS = 1;
const MAX_AGE_HOURS = 24;
const BATCH_DELAY_MS = 2000; // 2s between emails to avoid rate limits

let recoveryIntervalId: NodeJS.Timeout | null = null;

async function runRecoveryJob(): Promise<void> {
  try {
    logger.info('Abandoned cart recovery job started', undefined, {
      minAgeHours: MIN_AGE_HOURS,
      maxAgeHours: MAX_AGE_HOURS,
    });

    const carts = await abandonedCartService.getCartsForRecovery(MIN_AGE_HOURS, MAX_AGE_HOURS);

    if (carts.length === 0) {
      logger.info('Abandoned cart recovery: no carts to process', undefined, {});
      return;
    }

    logger.info(`Abandoned cart recovery: processing ${carts.length} carts`, undefined, {
      count: carts.length,
    });

    let sent = 0;
    let failed = 0;

    for (const cart of carts) {
      try {
        const result = await abandonedCartService.sendRecoveryEmail(cart.id);
        if (result) {
          sent++;
        } else {
          failed++;
        }
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      } catch (err) {
        failed++;
        logger.warn('Abandoned cart recovery: error sending to cart', undefined, {
          cartId: cart.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('Abandoned cart recovery job completed', undefined, {
      total: carts.length,
      sent,
      failed,
    });
  } catch (error) {
    logger.error('Abandoned cart recovery job failed', undefined, {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    });
  }
}

export function startAbandonedCartRecovery(): void {
  if (recoveryIntervalId) {
    logger.warn('Abandoned cart recovery job already running', undefined, {});
    return;
  }

  setTimeout(() => {
    runRecoveryJob();
  }, 60000); // 1 min initial delay

  recoveryIntervalId = setInterval(() => {
    runRecoveryJob();
  }, RECOVERY_INTERVAL_MS);

  logger.info('Abandoned cart recovery job started (every 30 minutes)', undefined, {});
}

export function stopAbandonedCartRecovery(): void {
  if (recoveryIntervalId) {
    clearInterval(recoveryIntervalId);
    recoveryIntervalId = null;
    logger.info('Abandoned cart recovery job stopped', undefined, {});
  }
}
