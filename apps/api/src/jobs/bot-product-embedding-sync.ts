/**
 * Scheduled Bot Product Embedding Sync Job
 * Refreshes product catalog embeddings for all tenants with chatbot enabled
 * every 12 hours so the bot stays aware of new/updated products.
 */

import { prisma } from '../prisma';
import BotRagService from '../services/BotRagService';

const SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
const STARTUP_DELAY_MS = 60_000; // 1 minute after server start
let syncIntervalId: NodeJS.Timeout | null = null;

/**
 * Get all tenant IDs that have chatbot enabled and dynamic mode on.
 */
async function getChatbotEnabledTenants(): Promise<string[]> {
  try {
    const configs = await prisma.bot_configurations.findMany({
      where: { status: 'active' },
      select: { tenant_id: true },
    });
    return configs.map((c: any) => c.tenant_id);
  } catch (error) {
    console.error('[BotProductEmbeddingSync] Error fetching chatbot-enabled tenants:', error);
    return [];
  }
}

/**
 * Run product embedding refresh for all eligible tenants.
 */
async function runScheduledSync(): Promise<void> {
  console.log('[BotProductEmbeddingSync] Starting scheduled product embedding refresh...');
  const startTime = Date.now();

  try {
    const tenantIds = await getChatbotEnabledTenants();
    console.log(`[BotProductEmbeddingSync] Found ${tenantIds.length} tenants with active chatbot`);

    if (tenantIds.length === 0) {
      console.log('[BotProductEmbeddingSync] No eligible tenants, skipping');
      return;
    }

    const ragService = BotRagService.getInstance();
    let tenantsProcessed = 0;
    let totalProducts = 0;
    let totalChunks = 0;
    let failed = 0;

    for (const tenantId of tenantIds) {
      try {
        const result = await ragService.refreshProductEmbeddings(tenantId);
        tenantsProcessed++;
        totalProducts += result.processed;
        totalChunks += result.chunks;
        console.log(`[BotProductEmbeddingSync] Tenant ${tenantId}: ${result.processed} products, ${result.chunks} chunks`);
      } catch (error) {
        console.error(`[BotProductEmbeddingSync] Error refreshing tenant ${tenantId}:`, error);
        failed++;
      }

      // Small delay between tenants to avoid OpenAI rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[BotProductEmbeddingSync] Completed in ${duration}s: ${tenantsProcessed} tenants, ` +
      `${totalProducts} products, ${totalChunks} chunks, ${failed} failed`
    );
  } catch (error) {
    console.error('[BotProductEmbeddingSync] Scheduled sync failed:', error);
  }
}

/**
 * Start the scheduled product embedding sync job.
 */
export function startBotProductEmbeddingSync(): void {
  if (syncIntervalId) {
    console.log('[BotProductEmbeddingSync] Already running');
    return;
  }

  console.log(`[BotProductEmbeddingSync] Starting scheduler (every ${SYNC_INTERVAL_MS / 1000 / 60 / 60} hours)`);

  setTimeout(() => {
    runScheduledSync();
  }, STARTUP_DELAY_MS);

  syncIntervalId = setInterval(() => {
    runScheduledSync();
  }, SYNC_INTERVAL_MS);
}

/**
 * Stop the scheduled product embedding sync job.
 */
export function stopBotProductEmbeddingSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
    console.log('[BotProductEmbeddingSync] Stopped');
  }
}

/**
 * Manually trigger product embedding sync for all eligible tenants.
 */
export async function triggerManualProductEmbeddingSync(): Promise<{
  tenants: number;
  products: number;
  chunks: number;
  failed: number;
}> {
  const tenantIds = await getChatbotEnabledTenants();
  const ragService = BotRagService.getInstance();

  let totalProducts = 0;
  let totalChunks = 0;
  let failed = 0;

  for (const tenantId of tenantIds) {
    try {
      const result = await ragService.refreshProductEmbeddings(tenantId);
      totalProducts += result.processed;
      totalChunks += result.chunks;
    } catch (error) {
      console.error(`[BotProductEmbeddingSync] Manual sync error for tenant ${tenantId}:`, error);
      failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { tenants: tenantIds.length, products: totalProducts, chunks: totalChunks, failed };
}
