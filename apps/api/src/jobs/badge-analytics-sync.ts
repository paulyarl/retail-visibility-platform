/**
 * Badge Analytics Aggregation Job
 *
 * Scheduled job that runs every 6 hours to:
 * 1. Iterate all active tenants
 * 2. Aggregate badge_events + order_items into badge_analytics
 * 3. Compute per-badge, per-period metrics (views, clicks, orders, revenue, lift)
 *
 * This populates the badge_analytics table for dashboard reads.
 */

import { prisma } from '../prisma';
import { aggregateBadgeAnalyticsForTenant, type PeriodType } from '../services/BadgeAnalyticsService';
import { logger } from '../logger';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STARTUP_DELAY_MS = 10 * 60 * 1000; // 10 minutes (after other jobs)
let syncIntervalId: NodeJS.Timeout | null = null;

export interface BadgeAnalyticsSyncResult {
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
    logger.error('[BadgeAnalyticsSync] Error fetching tenants:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return [];
  }
}

async function runScheduledSync(): Promise<BadgeAnalyticsSyncResult> {
  const result: BadgeAnalyticsSyncResult = {
    tenantsProcessed: 0,
    rowsComputed: 0,
    errors: [],
  };

  console.log('[BadgeAnalyticsSync] Starting scheduled badge analytics aggregation...');
  const startTime = Date.now();

  try {
    const tenantIds = await getAllTenantIds();
    console.log(`[BadgeAnalyticsSync] Found ${tenantIds.length} active tenants`);

    if (tenantIds.length === 0) {
      console.log('[BadgeAnalyticsSync] No tenants, skipping');
      return result;
    }

    const periodTypes: PeriodType[] = ['day', 'week', 'month'];

    for (const tenantId of tenantIds) {
      try {
        for (const periodType of periodTypes) {
          const aggResult = await aggregateBadgeAnalyticsForTenant(tenantId, periodType);
          result.rowsComputed += aggResult.rowsComputed;
          if (aggResult.errors.length > 0) {
            result.errors.push(...aggResult.errors);
          }
        }
        result.tenantsProcessed++;
      } catch (error: any) {
        logger.error(`[BadgeAnalyticsSync] Error processing tenant ${tenantId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
        result.errors.push(`Tenant ${tenantId}: ${error.message}`);
      }

      // Small delay between tenants
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[BadgeAnalyticsSync] Completed in ${duration}s: ${result.tenantsProcessed} tenants, ` +
      `${result.rowsComputed} rows computed, ${result.errors.length} errors`
    );
  } catch (error) {
    logger.error('[BadgeAnalyticsSync] Fatal error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    result.errors.push(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

export async function startBadgeAnalyticsSync(): Promise<void> {
  if (process.env.DISABLE_BADGE_ANALYTICS_SYNC === 'true') {
    console.log('[BadgeAnalyticsSync] Disabled via DISABLE_BADGE_ANALYTICS_SYNC env var');
    return;
  }

  if (syncIntervalId) {
    console.log('[BadgeAnalyticsSync] Already running');
    return;
  }

  console.log(`[BadgeAnalyticsSync] Starting scheduler (every 6 hours)`);

  setTimeout(() => {
    runScheduledSync().catch(console.error);
  }, STARTUP_DELAY_MS);

  syncIntervalId = setInterval(() => {
    runScheduledSync().catch(console.error);
  }, SYNC_INTERVAL_MS);
}

export function stopBadgeAnalyticsSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[BadgeAnalyticsSync] Stopped');
  }
}
