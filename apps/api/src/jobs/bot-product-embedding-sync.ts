/**
 * Scheduled Bot Product Embedding Sync Job
 * Refreshes product catalog embeddings for all tenants with chatbot enabled
 * every 12 hours so the bot stays aware of new/updated products.
 */

import { prisma } from '../prisma';
import BotRagService from '../services/BotRagService';

const DEFAULT_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
const STARTUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes after server start (avoids firing on nodemon restarts)
let syncIntervalId: NodeJS.Timeout | null = null;

/**
 * Get the configured sync interval from platform settings.
 */
async function getSyncIntervalMs(): Promise<number> {
  try {
    const settings = await prisma.platform_settings_list.findFirst();
    const hours = settings?.bot_sync_interval_hours ?? 12;
    if (hours <= 0) return 0; // 0 = manual only
    return hours * 60 * 60 * 1000;
  } catch {
    return DEFAULT_SYNC_INTERVAL_MS;
  }
}

/**
 * Check if bot AI and embedding sync are enabled in platform settings.
 */
async function isBotAiEnabled(): Promise<boolean> {
  try {
    const settings = await prisma.platform_settings_list.findFirst();
    return (settings?.bot_ai_enabled ?? true) && (settings?.bot_embedding_sync_enabled ?? true);
  } catch {
    return true; // fail open
  }
}

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
  const aiEnabled = await isBotAiEnabled();
  if (!aiEnabled) {
    console.log('[BotProductEmbeddingSync] Bot AI or embedding sync is disabled by platform admin, skipping');
    return;
  }

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

    let quotaExceeded = false;

    for (const tenantId of tenantIds) {
      if (quotaExceeded) {
        console.log(`[BotProductEmbeddingSync] Skipping tenant ${tenantId} - OpenAI quota exceeded`);
        failed++;
        continue;
      }

      try {
        const result = await ragService.refreshProductEmbeddings(tenantId);
        tenantsProcessed++;
        totalProducts += result.processed;
        totalChunks += result.chunks;
        console.log(`[BotProductEmbeddingSync] Tenant ${tenantId}: ${result.processed} products, ${result.chunks} chunks`);
      } catch (error: any) {
        console.error(`[BotProductEmbeddingSync] Error refreshing tenant ${tenantId}:`, error);
        failed++;
        if (error?.code === 'insufficient_quota' || error?.status === 429) {
          console.log('[BotProductEmbeddingSync] OpenAI quota exceeded, skipping remaining tenants');
          quotaExceeded = true;
        }
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
export async function startBotProductEmbeddingSync(): Promise<void> {
  if (process.env.DISABLE_BOT_EMBEDDING_SYNC === 'true') {
    console.log('[BotProductEmbeddingSync] Disabled via DISABLE_BOT_EMBEDDING_SYNC env var');
    return;
  }

  if (syncIntervalId) {
    console.log('[BotProductEmbeddingSync] Already running');
    return;
  }

  const intervalMs = await getSyncIntervalMs();
  if (intervalMs === 0) {
    console.log('[BotProductEmbeddingSync] Sync interval is 0 (manual only), scheduler not started');
    return;
  }

  const hours = intervalMs / 1000 / 60 / 60;
  console.log(`[BotProductEmbeddingSync] Starting scheduler (every ${hours} hours)`);

  // Check platform settings before first run; if disabled, still set up the interval
  // so it can self-activate when settings change (the runScheduledSync will no-op)
  setTimeout(() => {
    runScheduledSync();
  }, STARTUP_DELAY_MS);

  syncIntervalId = setInterval(() => {
    runScheduledSync();
  }, intervalMs);
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
