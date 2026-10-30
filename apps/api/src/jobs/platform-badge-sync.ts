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
import { logger } from '../logger';
import { scheduleJob, stopJob } from './registry';
import { dripPaceMs, sleep } from './pacing';

const JOB_NAME = 'platform-badge-sync';
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STARTUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes
let firstRun = true;
let cycleStartAt = 0;

/**
 * Get all active tenant IDs.
 */
async function getAllTenantIds(): Promise<string[]> {
  try {
    const tenants = await prisma.tenants.findMany({
      where: { subscription_status: { not: 'cancelled' }, is_demo: { not: true } },
      select: { id: true },
    });
    return tenants.map(t => t.id);
  } catch (error) {
    logger.error('[PlatformBadgeSync] Error fetching tenants:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return [];
  }
}

/**
 * Run platform badge sync for all tenants.
 */
async function runScheduledSync(): Promise<void> {
  console.log('[PlatformBadgeSync] Starting scheduled platform badge sync...');
  const startTime = Date.now();
  cycleStartAt = startTime;

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

    // Drip: spread the sweep across most of the interval instead of bursting —
    // smooths DB reads (Supabase pooler egress) into a low-rate stream.
    const paceMs = dripPaceMs(tenantIds.length, SYNC_INTERVAL_MS);

    for (const tenantId of tenantIds) {
      try {
        const result = await FeaturedProductsService.syncPlatformTypes(tenantId, 10);
        totalSynced += result.synced;
        totalDeactivated += result.deactivated;
      } catch (error) {
        logger.error(`[PlatformBadgeSync] Error syncing tenant ${tenantId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
        failed++;
      }

      // Drip-paced delay between tenants (see dripPaceMs)
      await sleep(paceMs);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[PlatformBadgeSync] Completed in ${duration}s: ${tenantIds.length} tenants, ` +
      `${totalSynced} synced, ${totalDeactivated} deactivated, ${failed} failed`
    );
  } catch (error) {
    logger.error('[PlatformBadgeSync] Scheduled sync failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  }
}

/**
 * Start the scheduled platform badge sync job.
 */
export async function startPlatformBadgeSync(): Promise<void> {
  scheduleJob({
    name: JOB_NAME,
    description: 'Syncs trending/bestseller/recommended badges to featured products',
    scheduleLabel: 'every 6 hours',
    envDisableVar: 'DISABLE_PLATFORM_BADGE_SYNC',
    // Cadence measured from cycle start so a drip-paced sweep doesn't dilate
    // the schedule (run ~70% of interval, then idle until the next tick).
    computeNextDelay: () => {
      if (firstRun) { firstRun = false; return STARTUP_DELAY_MS; }
      if (!cycleStartAt) return SYNC_INTERVAL_MS;
      return Math.max(60_000, SYNC_INTERVAL_MS - (Date.now() - cycleStartAt));
    },
    // The drip sweep legitimately occupies most of the interval — bound the
    // run lease above it so only a crashed worker gets reclaimed.
    maxRunMs: SYNC_INTERVAL_MS,
    handler: async () => runScheduledSync(),
  });
}

/**
 * Stop the scheduled platform badge sync job.
 */
export function stopPlatformBadgeSync(): void {
  stopJob(JOB_NAME);
}

/**
 * Manually trigger platform badge sync for a single tenant.
 */
export async function triggerManualSync(tenantId: string): Promise<{ synced: number; deactivated: number }> {
  return FeaturedProductsService.syncPlatformTypes(tenantId, 10);
}
