/**
 * Scheduled Google Merchant Center Sync Job
 * Automatically syncs products for all connected tenants every 6 hours
 */

import { prisma } from '../prisma';
import { batchSyncProducts } from '../services/GMCProductSync';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
let syncIntervalId: NodeJS.Timeout | null = null;

/**
 * Get all tenants with active GMC connections
 */
async function getConnectedTenants(): Promise<string[]> {
  try {
    // Find all active merchant links and get their tenant IDs
    const merchantLinks = await prisma.google_merchant_links_list.findMany({
      where: { is_active: true },
      include: {
        google_oauth_accounts_list: {
          select: { tenant_id: true }
        }
      }
    });

    // Extract unique tenant IDs
    const tenantIds = new Set<string>();
    for (const link of merchantLinks) {
      if (link.google_oauth_accounts_list?.tenant_id) {
        tenantIds.add(link.google_oauth_accounts_list.tenant_id);
      }
    }

    return Array.from(tenantIds);
  } catch (error) {
    console.error('[GMC Scheduled Sync] Error getting connected tenants:', error);
    return [];
  }
}

/**
 * Run sync for all connected tenants
 */
async function runScheduledSync(): Promise<void> {
  console.log('[GMC Scheduled Sync] Starting scheduled sync...');
  const startTime = Date.now();

  try {
    const tenantIds = await getConnectedTenants();
    console.log(`[GMC Scheduled Sync] Found ${tenantIds.length} connected tenants`);

    if (tenantIds.length === 0) {
      console.log('[GMC Scheduled Sync] No connected tenants, skipping sync');
      return;
    }

    let totalSynced = 0;
    let totalFailed = 0;
    let tenantsProcessed = 0;

    for (const tenantId of tenantIds) {
      try {
        console.log(`[GMC Scheduled Sync] Syncing tenant ${tenantId}...`);
        const result = await batchSyncProducts(tenantId);
        
        totalSynced += result.synced;
        totalFailed += result.failed;
        tenantsProcessed++;

        console.log(`[GMC Scheduled Sync] Tenant ${tenantId}: ${result.synced} synced, ${result.failed} failed`);
      } catch (error) {
        console.error(`[GMC Scheduled Sync] Error syncing tenant ${tenantId}:`, error);
        totalFailed++;
      }

      // Small delay between tenants to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[GMC Scheduled Sync] Completed in ${duration}s: ${tenantsProcessed} tenants, ${totalSynced} products synced, ${totalFailed} failed`);
  } catch (error) {
    console.error('[GMC Scheduled Sync] Scheduled sync failed:', error);
  }
}

/**
 * Start the scheduled sync job
 */
export function startGMCScheduledSync(): void {
  if (syncIntervalId) {
    console.log('[GMC Scheduled Sync] Already running');
    return;
  }

  console.log(`[GMC Scheduled Sync] Starting scheduler (every ${SYNC_INTERVAL_MS / 1000 / 60 / 60} hours)`);
  
  // Run immediately on startup (after a short delay to let server initialize)
  setTimeout(() => {
    runScheduledSync();
  }, 30000); // 30 second delay after startup

  // Then run on interval
  syncIntervalId = setInterval(() => {
    runScheduledSync();
  }, SYNC_INTERVAL_MS);
}

/**
 * Stop the scheduled sync job
 */
export function stopGMCScheduledSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[GMC Scheduled Sync] Stopped');
  }
}

/**
 * Manually trigger a sync for all connected tenants
 */
export async function triggerManualSync(): Promise<{ tenants: number; synced: number; failed: number }> {
  const startTime = Date.now();
  const tenantIds = await getConnectedTenants();
  
  let totalSynced = 0;
  let totalFailed = 0;

  for (const tenantId of tenantIds) {
    try {
      const result = await batchSyncProducts(tenantId);
      totalSynced += result.synced;
      totalFailed += result.failed;
    } catch (error) {
      console.error(`[GMC Manual Sync] Error syncing tenant ${tenantId}:`, error);
      totalFailed++;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return {
    tenants: tenantIds.length,
    synced: totalSynced,
    failed: totalFailed
  };
}
