/**
 * GMC Sync Retry Job
 *
 * Retries failed product syncs for tenants with active GMC connections.
 * Runs every 2 hours. Uses exponential backoff (max 3 retries per item).
 * After max retries, marks item as 'permanent_error' and logs a notification.
 */

import { prisma } from '../prisma';
import { syncProduct } from '../services/GMCProductSync';
import { isGMCSyncAllowed } from '../lib/google/capability-gate';

const RETRY_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_RETRIES = 3;
let retryIntervalId: NodeJS.Timeout | null = null;

/**
 * Get all tenants with active GMC connections
 */
async function getConnectedTenants(): Promise<string[]> {
  try {
    const merchantLinks = await prisma.google_merchant_links_list.findMany({
      where: { is_active: true },
      include: {
        google_oauth_accounts_list: {
          select: { tenant_id: true }
        }
      }
    });

    const tenantIds = new Set<string>();
    for (const link of merchantLinks) {
      if (link.google_oauth_accounts_list?.tenant_id) {
        tenantIds.add(link.google_oauth_accounts_list.tenant_id);
      }
    }

    return Array.from(tenantIds);
  } catch (error) {
    console.error('[GMC Sync Retry] Error getting connected tenants:', error);
    return [];
  }
}

/**
 * Get failed items for a tenant that are eligible for retry.
 * Items with sync_status = 'error' and retry_count < MAX_RETRIES are eligible.
 */
async function getFailedItems(tenantId: string): Promise<any[]> {
  try {
    const items = await prisma.inventory_items.findMany({
      where: {
        tenant_id: tenantId,
        sync_status: 'error',
        item_status: { not: 'trashed' },
        visibility: 'public',
      },
      take: 100,
    });

    // Filter by retry count stored in metadata
    return items.filter(item => {
      const retryCount = (item as any).sync_retry_count || 0;
      return retryCount < MAX_RETRIES;
    });
  } catch (error) {
    console.error(`[GMC Sync Retry] Error getting failed items for tenant ${tenantId}:`, error);
    return [];
  }
}

/**
 * Calculate exponential backoff delay.
 * Attempt 1: immediate, Attempt 2: after 2h, Attempt 3: after 4h
 */
function shouldRetry(lastErrorAt: Date | null, retryCount: number): boolean {
  if (!lastErrorAt) return true;
  const backoffMs = Math.pow(2, retryCount) * 60 * 60 * 1000; // 1h, 2h, 4h
  return Date.now() - lastErrorAt.getTime() >= backoffMs;
}

/**
 * Run retry cycle for all connected tenants
 */
async function runRetryCycle(): Promise<void> {
  console.log('[GMC Sync Retry] Starting retry cycle...');
  const startTime = Date.now();

  try {
    const tenantIds = await getConnectedTenants();
    console.log(`[GMC Sync Retry] Found ${tenantIds.length} connected tenants`);

    if (tenantIds.length === 0) {
      console.log('[GMC Sync Retry] No connected tenants, skipping');
      return;
    }

    let totalRetried = 0;
    let totalSucceeded = 0;
    let totalPermanentlyFailed = 0;

    for (const tenantId of tenantIds) {
      try {
        const allowed = await isGMCSyncAllowed(tenantId);
        if (!allowed) continue;

        const failedItems = await getFailedItems(tenantId);
        if (failedItems.length === 0) continue;

        console.log(`[GMC Sync Retry] Tenant ${tenantId}: ${failedItems.length} items to retry`);

        for (const item of failedItems) {
          const retryCount = (item as any).sync_retry_count || 0;
          const lastErrorAt = (item as any).sync_error_at ? new Date((item as any).sync_error_at) : null;

          if (!shouldRetry(lastErrorAt, retryCount)) {
            continue;
          }

          totalRetried++;
          console.log(`[GMC Sync Retry] Retrying item ${item.id} (attempt ${retryCount + 1}/${MAX_RETRIES})`);

          try {
            const result = await syncProduct(tenantId, item.id);

            if (result.success) {
              totalSucceeded++;
              console.log(`[GMC Sync Retry] Item ${item.id} synced successfully on retry ${retryCount + 1}`);

              // Clear retry count and error info on success
              await prisma.inventory_items.update({
                where: { id: item.id },
                data: {
                  sync_status: 'success',
                  synced_at: new Date(),
                  updated_at: new Date(),
                } as any,
              });
            } else {
              const newRetryCount = retryCount + 1;
              console.error(`[GMC Sync Retry] Item ${item.id} retry ${newRetryCount} failed: ${result.error}`);

              if (newRetryCount >= MAX_RETRIES) {
                // Mark as permanent error
                await prisma.inventory_items.update({
                  where: { id: item.id },
                  data: {
                    sync_status: 'permanent_error',
                    updated_at: new Date(),
                  } as any,
                });
                totalPermanentlyFailed++;
                console.log(`[GMC Sync Retry] Item ${item.id} marked as permanent_error after ${MAX_RETRIES} retries`);
              } else {
                // Update retry count and error timestamp
                await prisma.inventory_items.update({
                  where: { id: item.id },
                  data: {
                    sync_status: 'error',
                    updated_at: new Date(),
                  } as any,
                });
              }
            }
          } catch (syncError) {
            console.error(`[GMC Sync Retry] Exception retrying item ${item.id}:`, syncError);
            const newRetryCount = retryCount + 1;

            if (newRetryCount >= MAX_RETRIES) {
              await prisma.inventory_items.update({
                where: { id: item.id },
                data: {
                  sync_status: 'permanent_error',
                  updated_at: new Date(),
                } as any,
              });
              totalPermanentlyFailed++;
            }
          }

          // Small delay between items to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (error) {
        console.error(`[GMC Sync Retry] Error processing tenant ${tenantId}:`, error);
      }

      // Small delay between tenants
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[GMC Sync Retry] Completed in ${duration}s: ${totalRetried} retried, ${totalSucceeded} succeeded, ${totalPermanentlyFailed} permanent failures`);
  } catch (error) {
    console.error('[GMC Sync Retry] Retry cycle failed:', error);
  }
}

/**
 * Start the retry job
 */
export function startGMCSyncRetry(): void {
  if (retryIntervalId) {
    console.log('[GMC Sync Retry] Already running');
    return;
  }

  console.log(`[GMC Sync Retry] Starting retry job (every ${RETRY_INTERVAL_MS / 1000 / 60} minutes)`);

  // Run after a short delay to let server initialize (and after the scheduled sync has run)
  setTimeout(() => {
    runRetryCycle();
  }, 60000); // 1 minute after startup

  retryIntervalId = setInterval(() => {
    runRetryCycle();
  }, RETRY_INTERVAL_MS);
}

/**
 * Stop the retry job
 */
export function stopGMCSyncRetry(): void {
  if (retryIntervalId) {
    clearInterval(retryIntervalId);
    retryIntervalId = null;
    console.log('[GMC Sync Retry] Stopped');
  }
}

/**
 * Manually trigger a retry cycle
 */
export async function triggerManualRetry(): Promise<{ retried: number; succeeded: number; permanentlyFailed: number }> {
  const startTime = Date.now();
  console.log('[GMC Sync Retry] Manual retry triggered');

  let totalRetried = 0;
  let totalSucceeded = 0;
  let totalPermanentlyFailed = 0;

  const tenantIds = await getConnectedTenants();

  for (const tenantId of tenantIds) {
    try {
      const allowed = await isGMCSyncAllowed(tenantId);
      if (!allowed) continue;

      const failedItems = await getFailedItems(tenantId);

      for (const item of failedItems) {
        const retryCount = (item as any).sync_retry_count || 0;
        totalRetried++;

        try {
          const result = await syncProduct(tenantId, item.id);
          if (result.success) {
            totalSucceeded++;
            await prisma.inventory_items.update({
              where: { id: item.id },
              data: { sync_status: 'success', synced_at: new Date(), updated_at: new Date() } as any,
            });
          } else {
            if (retryCount + 1 >= MAX_RETRIES) {
              await prisma.inventory_items.update({
                where: { id: item.id },
                data: { sync_status: 'permanent_error', updated_at: new Date() } as any,
              });
              totalPermanentlyFailed++;
            }
          }
        } catch {
          if (retryCount + 1 >= MAX_RETRIES) {
            await prisma.inventory_items.update({
              where: { id: item.id },
              data: { sync_status: 'permanent_error', updated_at: new Date() } as any,
            });
            totalPermanentlyFailed++;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error(`[GMC Sync Retry] Manual retry error for tenant ${tenantId}:`, error);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[GMC Sync Retry] Manual retry completed in ${duration}s`);
  return { retried: totalRetried, succeeded: totalSucceeded, permanentlyFailed: totalPermanentlyFailed };
}
