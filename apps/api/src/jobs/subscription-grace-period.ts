/**
 * Subscription Grace Period Job
 * 
 * Scheduled job that runs daily to:
 * 1. Process trial ends (charge payment method)
 * 2. Retry payments during grace period (every 3 days)
 * 3. Demote tenants with expired grace period to expired_trial tier
 * 
 * Run schedule: Daily at midnight (00:00 UTC)
 */

import { prisma } from '../prisma';
import { getBillingNotificationService } from '../services/subscription/BillingNotificationService';
import { getTrialManagementService, GRACE_DURATION_DAYS } from '../services/subscription/TrialManagementService';

export interface GracePeriodResult {
  processed: number;
  demoted: number;
  retried: number;
  trialEndsProcessed: number;
  errors: string[];
}

/**
 * Process tenants that have exceeded the grace period
 * Demotes them to expired_trial tier (invisible on public pages)
 */
export async function processGracePeriodExpiry(): Promise<GracePeriodResult> {
  const result: GracePeriodResult = {
    processed: 0,
    demoted: 0,
    retried: 0,
    trialEndsProcessed: 0,
    errors: [],
  };

  const trialService = getTrialManagementService();

  try {
    // 1. Process trials ending today
    const trialsEnding = await trialService.getTrialsEndingToday();
    console.log(`[GracePeriodJob] Found ${trialsEnding.length} trials ending today`);

    for (const tenantId of trialsEnding) {
      try {
        const chargeResult = await trialService.processTrialEnd(tenantId);
        result.trialEndsProcessed++;
        
        if (chargeResult.charged) {
          console.log(`[GracePeriodJob] Trial converted for tenant ${tenantId}`);
        } else {
          console.log(`[GracePeriodJob] Trial entered grace period for tenant ${tenantId}: ${chargeResult.error}`);
        }
      } catch (error: any) {
        console.error(`[GracePeriodJob] Error processing trial end for ${tenantId}:`, error);
        result.errors.push(`Trial ${tenantId}: ${error.message}`);
      }
    }

    // 2. Retry payments for tenants in grace period
    const tenantsNeedingRetry = await trialService.getTenantsNeedingRetry();
    console.log(`[GracePeriodJob] Found ${tenantsNeedingRetry.length} tenants needing payment retry`);

    for (const tenantId of tenantsNeedingRetry) {
      try {
        const retryResult = await trialService.retryPayment(tenantId);
        result.retried++;
        
        if (retryResult.charged) {
          console.log(`[GracePeriodJob] Payment retry succeeded for tenant ${tenantId}`);
        } else if (retryResult.newStatus === 'expired_trial') {
          console.log(`[GracePeriodJob] Grace period expired for tenant ${tenantId}`);
          result.demoted++;
        } else {
          console.log(`[GracePeriodJob] Payment retry failed for tenant ${tenantId}: ${retryResult.error}`);
        }
      } catch (error: any) {
        console.error(`[GracePeriodJob] Error retrying payment for ${tenantId}:`, error);
        result.errors.push(`Retry ${tenantId}: ${error.message}`);
      }
    }

    // 3. Process grace period expiry (downgrade to expired_trial)
    const graceExpired = await trialService.getGracePeriodExpired();
    console.log(`[GracePeriodJob] Found ${graceExpired.length} tenants with expired grace period`);

    for (const tenantId of graceExpired) {
      result.processed++;

      try {
        await trialService.downgradeToExpired(tenantId);
        console.log(`[GracePeriodJob] Demoted tenant ${tenantId} to expired_trial - grace period expired`);
        result.demoted++;
      } catch (error: any) {
        console.error(`[GracePeriodJob] Error demoting tenant ${tenantId}:`, error);
        result.errors.push(`Tenant ${tenantId}: ${error.message}`);
      }
    }

    console.log(`[GracePeriodJob] Complete. Trials: ${result.trialEndsProcessed}, Retries: ${result.retried}, Demoted: ${result.demoted}, Errors: ${result.errors.length}`);
    
    return result;
  } catch (error: any) {
    console.error('[GracePeriodJob] Fatal error:', error);
    result.errors.push(`Fatal error: ${error.message}`);
    return result;
  }
}

/**
 * Get tenants approaching grace period expiry (for notifications)
 * Returns tenants at 7, 14, 21, 28 days past due
 */
export async function getTenantsApproachingExpiry(): Promise<{
  sevenDays: Array<{ id: string; name: string; email: string }>;
  fourteenDays: Array<{ id: string; name: string; email: string }>;
  twentyOneDays: Array<{ id: string; name: string; email: string }>;
  twentyEightDays: Array<{ id: string; name: string; email: string }>;
}> {
  const now = new Date();
  
  const getTenantsAtDays = async (days: number) => {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() - days);
    
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    return prisma.$queryRaw<Array<{ id: string; name: string; email: string }>>`
      SELECT t.id, t.name, u.email
      FROM tenants t
      JOIN users u ON u.tenant_id = t.id AND u.role = 'owner'
      WHERE t.subscription_status = 'past_due'
        AND t.status_changed_at >= ${startOfDay.toISOString()}::timestamp
        AND t.status_changed_at <= ${endOfDay.toISOString()}::timestamp
    `;
  };

  const [sevenDays, fourteenDays, twentyOneDays, twentyEightDays] = await Promise.all([
    getTenantsAtDays(7),
    getTenantsAtDays(14),
    getTenantsAtDays(21),
    getTenantsAtDays(28),
  ]);

  return {
    sevenDays,
    fourteenDays,
    twentyOneDays,
    twentyEightDays,
  };
}

/**
 * Start the scheduled job
 * Runs daily at midnight
 */
let jobInterval: NodeJS.Timeout | null = null;

export function startGracePeriodJob(): void {
  if (jobInterval) {
    console.log('[GracePeriodJob] Job already running');
    return;
  }

  // Calculate time until next midnight
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const msUntilMidnight = tomorrow.getTime() - now.getTime();

  console.log(`[GracePeriodJob] Scheduling first run in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);

  // Schedule first run at midnight
  setTimeout(() => {
    // Run the job
    processGracePeriodExpiry().catch(console.error);

    // Then run every 24 hours
    jobInterval = setInterval(() => {
      processGracePeriodExpiry().catch(console.error);
    }, 24 * 60 * 60 * 1000);

    console.log('[GracePeriodJob] Daily job started');
  }, msUntilMidnight);

  console.log('[GracePeriodJob] Scheduler initialized');
}

/**
 * Stop the scheduled job
 */
export function stopGracePeriodJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
    console.log('[GracePeriodJob] Job stopped');
  }
}

/**
 * Manual trigger for testing
 */
export async function triggerGracePeriodJob(): Promise<GracePeriodResult> {
  console.log('[GracePeriodJob] Manual trigger');
  return processGracePeriodExpiry();
}
