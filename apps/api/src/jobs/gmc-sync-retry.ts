/**
 * GMC Sync Retry Job
 *
 * Retries failed product syncs for tenants with active GMC connections.
 * Runs every 2 hours. Exponential backoff (max 3 retries per item).
 *
 * Spec §6.5: state lives in gmc_item_sync_state (real retry_count /
 * last_error_at columns — the old version read phantom fields and wrote an
 * invalid 'permanent_error' enum value). Terminal state is 'exhausted';
 * eligibility filters match the unified feed filter (active+public+syncable
 * types) so non-feedable items stop being retried forever.
 */

import { prisma } from '../prisma';
import { syncProductToMerchant as syncProduct } from '../services/MerchantProductSync';
import { isGMCSyncAllowed } from '../lib/google/capability-gate';
import { logger } from '../logger';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'gmc-sync-retry';
const RETRY_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_RETRIES = 3;
let firstRun = true;

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
    logger.error('[GMC Sync Retry] Error getting connected tenants:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return [];
  }
}

/**
 * Failed online-destination rows eligible for retry — joined to the item so
 * the unified eligibility filter applies (active + public + feedable types +
 * not online-excluded). Ineligible items are marked 'excluded', not retried.
 */
async function getFailedItems(tenantId: string): Promise<any[]> {
  try {
    const rows = await prisma.gmc_item_sync_state.findMany({
      where: {
        destination: 'online',
        status: 'error',
        retry_count: { lt: MAX_RETRIES },
        inventory_items: {
          tenant_id: tenantId,
          item_status: 'active',
          visibility: 'public',
          product_type: { in: ['physical', 'hybrid'] },
          google_online_excluded: { not: true },
        },
      },
      take: 100,
      orderBy: { last_error_at: 'asc' },
    });
    return rows;
  } catch (error) {
    logger.error(`[GMC Sync Retry] Error getting failed items for tenant ${tenantId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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

async function markExhausted(stateId: string): Promise<void> {
  await prisma.gmc_item_sync_state.update({
    where: { id: stateId },
    data: { status: 'exhausted', updated_at: new Date() },
  });
}

async function runTenantRetries(tenantId: string): Promise<{ retried: number; succeeded: number; permanentlyFailed: number }> {
  const allowed = await isGMCSyncAllowed(tenantId);
  if (!allowed) return { retried: 0, succeeded: 0, permanentlyFailed: 0 };

  const failedItems = await getFailedItems(tenantId);
  const totals = { retried: 0, succeeded: 0, permanentlyFailed: 0 };

  for (const row of failedItems) {
    const retryCount = row.retry_count || 0;
    const lastErrorAt = row.last_error_at ? new Date(row.last_error_at) : null;

    if (!shouldRetry(lastErrorAt, retryCount)) {
      continue;
    }

    totals.retried++;
    console.log(`[GMC Sync Retry] Retrying item ${row.inventory_item_id} (attempt ${retryCount + 1}/${MAX_RETRIES})`);

    try {
      const result = await syncProduct(tenantId, row.inventory_item_id);
      // markItemSync inside syncProduct already writes the state row
      if (result.success) {
        totals.succeeded++;
        console.log(`[GMC Sync Retry] Item ${row.inventory_item_id} synced successfully on retry ${retryCount + 1}`);
      } else {
        const newRetryCount = retryCount + 1;
        logger.error(`[GMC Sync Retry] Item ${row.inventory_item_id} retry ${newRetryCount} failed: ${result.error}`, undefined);
        if (newRetryCount >= MAX_RETRIES) {
          await markExhausted(row.id);
          totals.permanentlyFailed++;
          console.log(`[GMC Sync Retry] Item ${row.inventory_item_id} marked exhausted after ${MAX_RETRIES} retries`);
        }
      }
    } catch (syncError) {
      logger.error(`[GMC Sync Retry] Exception retrying item ${row.inventory_item_id}:`, undefined, { error: { name: (syncError as any)?.name || 'Error', message: (syncError as any)?.message || String(syncError), stack: (syncError as any)?.stack } });
      const newRetryCount = retryCount + 1;
      if (newRetryCount >= MAX_RETRIES) {
        await markExhausted(row.id);
        totals.permanentlyFailed++;
      }
    }

    // Small delay between items to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  return totals;
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
        const totals = await runTenantRetries(tenantId);
        totalRetried += totals.retried;
        totalSucceeded += totals.succeeded;
        totalPermanentlyFailed += totals.permanentlyFailed;
      } catch (error) {
        logger.error(`[GMC Sync Retry] Error processing tenant ${tenantId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      }

      // Small delay between tenants
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[GMC Sync Retry] Completed in ${duration}s: ${totalRetried} retried, ${totalSucceeded} succeeded, ${totalPermanentlyFailed} permanent failures`);
  } catch (error) {
    logger.error('[GMC Sync Retry] Retry cycle failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  }
}

/**
 * Start the retry job
 */
export function startGMCSyncRetry(): void {
  scheduleJob({
    name: JOB_NAME,
    description: 'Retries failed GMC syncs',
    scheduleLabel: `every ${RETRY_INTERVAL_MS / 1000 / 60} minutes`,
    // Run after a short delay to let server initialize (and after the scheduled sync has run)
    computeNextDelay: () => (firstRun ? ((firstRun = false), 60_000) : RETRY_INTERVAL_MS),
    handler: async () => runRetryCycle(),
  });
}

/**
 * Stop the retry job
 */
export function stopGMCSyncRetry(): void {
  stopJob(JOB_NAME);
}

/**
 * Manually trigger a retry cycle
 */
export async function triggerManualRetry(): Promise<{ retried: number; succeeded: number; permanentlyFailed: number }> {
  console.log('[GMC Sync Retry] Manual retry triggered');

  let totalRetried = 0;
  let totalSucceeded = 0;
  let totalPermanentlyFailed = 0;

  const tenantIds = await getConnectedTenants();

  for (const tenantId of tenantIds) {
    try {
      const totals = await runTenantRetries(tenantId);
      totalRetried += totals.retried;
      totalSucceeded += totals.succeeded;
      totalPermanentlyFailed += totals.permanentlyFailed;
    } catch (error) {
      logger.error(`[GMC Sync Retry] Manual retry error for tenant ${tenantId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    }
  }

  console.log('[GMC Sync Retry] Manual retry completed');
  return { retried: totalRetried, succeeded: totalSucceeded, permanentlyFailed: totalPermanentlyFailed };
}
