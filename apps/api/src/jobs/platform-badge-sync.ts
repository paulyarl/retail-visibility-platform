/**
 * Scheduled Platform Badge Sync Job
 *
 * Syncs platform-controlled badge types (trending, bestseller, recommended,
 * random_featured) from mv_storefront_discovery into the featured_products table
 * with assignment_source='system'. This unifies the query pattern so all badge
 * types can be read from featured_products instead of some being computed on-the-fly.
 *
 * Runs every 6 hours. 5-minute startup delay to avoid firing on nodemon restarts.
 */

import { prisma } from '../prisma';
import { FeaturedProductsService } from '../services/FeaturedProductsService';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STARTUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes
let syncIntervalId: NodeJS.Timeout | null = null;

/**
 * Get all active tenant IDs.
 */
async function getAllTenantIds(): Promise<string[]> {
  try {
    const tenants = await prisma.tenants.findMany({
      where: { subscription_status: { not: 'cancelled' } },
      select: { id: true },
    });
    return tenants.map(t => t.id);
  } catch (error) {
    console.error('[PlatformBadgeSync] Error fetching tenants:', error);
    return [];
  }
}

/**
 * Run platform badge sync for all tenants.
 */
async function runScheduledSync(): Promise<void> {
  console.log('[PlatformBadgeSync] Starting scheduled platform badge sync...');
  const startTime = Date.now();

  try {
    const tenantIds = await getAllTenantIds();
    console.log(`[PlatformBadgeSync] Found ${tenantIds.length} active tenants`);

    if (tenantIds.length === 0) {
      console.log('[PlatformBadgeSync] No tenants, skipping');
      return;
    }

    let totalSynced = 0;
    let totalDeactivated = 0;
    let failed = 0;

    for (const tenantId of tenantIds) {
      try {
        const result = await FeaturedProductsService.syncPlatformTypes(tenantId, 10);
        totalSynced += result.synced;
        totalDeactivated += result.deactivated;
      } catch (error) {
        console.error(`[PlatformBadgeSync] Error syncing tenant ${tenantId}:`, error);
        failed++;
      }

      // Small delay between tenants to avoid DB overload
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[PlatformBadgeSync] Completed in ${duration}s: ${tenantIds.length} tenants, ` +
      `${totalSynced} synced, ${totalDeactivated} deactivated, ${failed} failed`
    );
  } catch (error) {
    console.error('[PlatformBadgeSync] Scheduled sync failed:', error);
  }
}

/**
 * Start the scheduled platform badge sync job.
 */
export async function startPlatformBadgeSync(): Promise<void> {
  if (process.env.DISABLE_PLATFORM_BADGE_SYNC === 'true') {
    console.log('[PlatformBadgeSync] Disabled via DISABLE_PLATFORM_BADGE_SYNC env var');
    return;
  }

  if (syncIntervalId) {
    console.log('[PlatformBadgeSync] Already running');
    return;
  }

  console.log(`[PlatformBadgeSync] Starting scheduler (every 6 hours)`);

  setTimeout(() => {
    runScheduledSync();
  }, STARTUP_DELAY_MS);

  syncIntervalId = setInterval(() => {
    runScheduledSync();
  }, SYNC_INTERVAL_MS);
}

/**
 * Stop the scheduled platform badge sync job.
 */
export function stopPlatformBadgeSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[PlatformBadgeSync] Stopped');
  }
}

/**
 * Manually trigger platform badge sync for a single tenant.
 */
export async function triggerManualSync(tenantId: string): Promise<{ synced: number; deactivated: number }> {
  return FeaturedProductsService.syncPlatformTypes(tenantId, 10);
}
