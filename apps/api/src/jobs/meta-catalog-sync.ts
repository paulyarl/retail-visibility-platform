/**
 * Meta Commerce Catalog Sync Scheduled Job
 * Phase 2A: Meta Commerce Integration
 *
 * Runs every 6 hours to sync product catalogs for all tenants
 * with connected Meta Commerce accounts.
 */

import { prisma } from '../prisma';
import { fullCatalogSync } from '../services/MetaCatalogSyncService';
import { logger } from '../logger';

const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const BATCH_DELAY_MS = 5000; // 5s between tenants to avoid rate limits

let syncIntervalId: NodeJS.Timeout | null = null;

async function runMetaCatalogSync(): Promise<void> {
  try {
    logger.info('Meta catalog sync job started');

    const accounts = await prisma.meta_oauth_accounts_list.findMany({
      where: {
        catalog_id: { not: null },
        meta_oauth_tokens_list: {
          isNot: null,
        },
      },
      select: {
        tenant_id: true,
        catalog_id: true,
        meta_oauth_tokens_list: {
          select: { expires_at: true },
        },
      },
    });

    const now = new Date();
    const validAccounts = accounts.filter(a => {
      const token = a.meta_oauth_tokens_list;
      return token && token.expires_at > now;
    });

    if (validAccounts.length === 0) {
      logger.info('Meta catalog sync: no tenants with valid Meta connections');
      return;
    }

    logger.info(`Meta catalog sync: processing ${validAccounts.length} tenants`);

    let synced = 0;
    let failed = 0;

    for (const account of validAccounts) {
      try {
        const result = await fullCatalogSync(account.tenant_id);
        synced += result.synced;
        failed += result.failed;
        logger.info(`Meta catalog sync: tenant ${account.tenant_id} — ${result.synced}/${result.total} synced`, undefined, {
          tenantId: account.tenant_id,
          synced: result.synced,
          failed: result.failed,
          total: result.total,
        });
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY_MS));
      } catch (err) {
        failed++;
        logger.warn('Meta catalog sync: error for tenant', undefined, {
          tenantId: account.tenant_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('Meta catalog sync job completed', undefined, { tenants: validAccounts.length, synced, failed });
  } catch (error) {
    logger.error('Meta catalog sync job failed', undefined, {
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    });
  }
}

export function startMetaCatalogSync(): void {
  if (syncIntervalId) {
    logger.warn('Meta catalog sync job already running');
    return;
  }

  setTimeout(() => {
    runMetaCatalogSync();
  }, 120000); // 2 min initial delay

  syncIntervalId = setInterval(() => {
    runMetaCatalogSync();
  }, SYNC_INTERVAL_MS);

  logger.info('Meta catalog sync job started (every 6 hours)');
}

export function stopMetaCatalogSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    logger.info('Meta catalog sync job stopped');
  }
}
