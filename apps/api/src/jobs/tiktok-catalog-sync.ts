/**
 * TikTok Shop Catalog Sync Scheduled Job
 * Phase 2B: TikTok Shop Integration
 *
 * Runs every 6 hours to sync product catalogs for all tenants
 * with connected TikTok Shop accounts.
 */

import { prisma } from '../prisma';
import { fullCatalogSync } from '../services/TikTokCatalogSyncService';
import { logger } from '../logger';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const BATCH_DELAY_MS = 5000; // 5s between tenants

let syncIntervalId: NodeJS.Timeout | null = null;

async function runTikTokCatalogSync(): Promise<void> {
  try {
    logger.info('TikTok catalog sync job started');

    const accounts = await prisma.tiktok_oauth_accounts_list.findMany({
      where: {
        shop_id: { not: null },
        tiktok_oauth_tokens_list: {
          isNot: null,
        },
      },
      select: {
        tenant_id: true,
        shop_id: true,
        tiktok_oauth_tokens_list: {
          select: { expires_at: true },
        },
      },
    });

    const now = new Date();
    const validAccounts = accounts.filter(a => {
      const token = a.tiktok_oauth_tokens_list;
      return token && token.expires_at > now;
    });

    if (validAccounts.length === 0) {
      logger.info('TikTok catalog sync: no tenants with valid TikTok connections');
      return;
    }

    logger.info(`TikTok catalog sync: processing ${validAccounts.length} tenants`);

    let synced = 0;
    let failed = 0;

    for (const account of validAccounts) {
      try {
        const result = await fullCatalogSync(account.tenant_id);
        synced += result.synced;
        failed += result.failed;
        logger.info(`TikTok catalog sync: tenant ${account.tenant_id} — ${result.synced}/${result.total} synced`, undefined, {
          tenantId: account.tenant_id,
          synced: result.synced,
          failed: result.failed,
          total: result.total,
        });
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      } catch (err) {
        failed++;
        logger.warn('TikTok catalog sync: error for tenant', undefined, {
          tenantId: account.tenant_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('TikTok catalog sync job completed', undefined, { tenants: validAccounts.length, synced, failed });
  } catch (error) {
    logger.error('TikTok catalog sync job failed', undefined, {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    });
  }
}

export function startTikTokCatalogSync(): void {
  if (syncIntervalId) {
    logger.warn('TikTok catalog sync job already running');
    return;
  }

  setTimeout(() => {
    runTikTokCatalogSync();
  }, 180000); // 3 min initial delay

  syncIntervalId = setInterval(() => {
    runTikTokCatalogSync();
  }, SYNC_INTERVAL_MS);

  logger.info('TikTok catalog sync job started (every 6 hours)');
}

export function stopTikTokCatalogSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    logger.info('TikTok catalog sync job stopped');
  }
}
