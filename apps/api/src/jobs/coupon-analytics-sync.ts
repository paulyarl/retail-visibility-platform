/**
 * Coupon Analytics Aggregation Job
 *
 * Scheduled job that runs every 6 hours to:
 * 1. Iterate all active tenants
 * 2. Aggregate coupon_events into coupon_analytics
 * 3. Compute per-coupon, per-period metrics (views, clicks, validates, redemptions, discount)
 *
 * This populates the coupon_analytics table for dashboard reads.
 *
 * Pattern: mirrors badge-analytics-sync.ts
 */

import { prisma } from '../prisma';
import { aggregateCouponAnalyticsForTenant, type PeriodType } from '../services/CouponAnalyticsService';
import { logger } from '../logger';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STARTUP_DELAY_MS = 12 * 60 * 1000; // 12 minutes (after badge analytics sync)
let syncIntervalId: NodeJS.Timeout | null = null;

export interface CouponAnalyticsSyncResult {
  tenantsProcessed: number;
  rowsComputed: number;
  errors: string[];
}

async function getAllTenantIds(): Promise<string[]> {
  try {
    const tenants = await prisma.tenants.findMany({
      where: { subscription_status: { not: 'cancelled' } },
      select: { id: true },
    });
    return tenants.map(t => t.id);
  } catch (error) {
    logger.error('[CouponAnalyticsSync] Error fetching tenants:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return [];
  }
}

async function runScheduledSync(): Promise<CouponAnalyticsSyncResult> {
  const result: CouponAnalyticsSyncResult = {
    tenantsProcessed: 0,
    rowsComputed: 0,
    errors: [],
  };

  console.log('[CouponAnalyticsSync] Starting scheduled coupon analytics aggregation...');
  const startTime = Date.now();

  try {
    const tenantIds = await getAllTenantIds();
    console.log(`[CouponAnalyticsSync] Found ${tenantIds.length} active tenants`);

    if (tenantIds.length === 0) {
      console.log('[CouponAnalyticsSync] No tenants, skipping');
      return result;
    }

    const periodTypes: PeriodType[] = ['day', 'week', 'month'];

    for (const tenantId of tenantIds) {
      try {
        for (const periodType of periodTypes) {
          const aggResult = await aggregateCouponAnalyticsForTenant(tenantId, periodType);
          result.rowsComputed += aggResult.rowsComputed;
          if (aggResult.errors.length > 0) {
            result.errors.push(...aggResult.errors);
          }
        }
        result.tenantsProcessed++;
      } catch (error: any) {
        logger.error(`[CouponAnalyticsSync] Error processing tenant ${tenantId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
        result.errors.push(`Tenant ${tenantId}: ${error.message}`);
      }

      // Small delay between tenants
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[CouponAnalyticsSync] Completed in ${duration}s: ${result.tenantsProcessed} tenants, ` +
      `${result.rowsComputed} rows computed, ${result.errors.length} errors`
    );
  } catch (error) {
    logger.error('[CouponAnalyticsSync] Fatal error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    result.errors.push(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

export async function startCouponAnalyticsSync(): Promise<void> {
  if (process.env.DISABLE_COUPON_ANALYTICS_SYNC === 'true') {
    console.log('[CouponAnalyticsSync] Disabled via DISABLE_COUPON_ANALYTICS_SYNC env var');
    return;
  }

  if (syncIntervalId) {
    console.log('[CouponAnalyticsSync] Already running');
    return;
  }

  console.log(`[CouponAnalyticsSync] Starting scheduler (every 6 hours)`);

  setTimeout(() => {
    runScheduledSync().catch(console.error);
  }, STARTUP_DELAY_MS);

  syncIntervalId = setInterval(() => {
    runScheduledSync().catch(console.error);
  }, SYNC_INTERVAL_MS);
}

export function stopCouponAnalyticsSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[CouponAnalyticsSync] Stopped');
  }
}
