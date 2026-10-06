/**
 * Scheduled Bot Product Embedding Sync Job
 * Refreshes product catalog embeddings for all tenants with chatbot enabled
 * every 12 hours so the bot stays aware of new/updated products.
 */

import { prisma } from '../prisma';
import BotRagService from '../services/BotRagService';
import { logger } from '../logger';
import { scheduleJob, stopJob } from './registry';

const JOB_NAME = 'bot-product-embedding-sync';
const DEFAULT_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours
const STARTUP_DELAY_MS = 5 * 60 * 1000; // 5 minutes after server start (avoids firing on nodemon restarts)
let configuredIntervalMs = DEFAULT_SYNC_INTERVAL_MS;
let firstRun = true;

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
    logger.error('[BotProductEmbeddingSync] Error fetching chatbot-enabled tenants:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
        logger.error(`[BotProductEmbeddingSync] Error refreshing tenant ${tenantId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error('[BotProductEmbeddingSync] Scheduled sync failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  }
}

/**
 * Start the scheduled product embedding sync job.
 */
export async function startBotProductEmbeddingSync(): Promise<void> {
  const intervalMs = await getSyncIntervalMs();
  if (intervalMs === 0) {
    console.log('[BotProductEmbeddingSync] Sync interval is 0 (manual only), scheduler not started');
    return;
  }
  configuredIntervalMs = intervalMs;

  const hours = intervalMs / 1000 / 60 / 60;
  console.log(`[BotProductEmbeddingSync] Starting scheduler (every ${hours} hours)`);

  // runScheduledSync checks platform settings each run — stays registered so it
  // self-activates when the admin re-enables embedding sync.
  scheduleJob({
    name: JOB_NAME,
    description: 'Product embedding sync for the bot platform (platform-settings gated)',
    scheduleLabel: `every ${hours} hours`,
    envDisableVar: 'DISABLE_BOT_EMBEDDING_SYNC',
    computeNextDelay: () => (firstRun ? ((firstRun = false), STARTUP_DELAY_MS) : configuredIntervalMs),
    handler: async () => runScheduledSync(),
  });
}

/**
 * Stop the scheduled product embedding sync job.
 */
export function stopBotProductEmbeddingSync(): void {
  stopJob(JOB_NAME);
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
      logger.error(`[BotProductEmbeddingSync] Manual sync error for tenant ${tenantId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  return { tenants: tenantIds.length, products: totalProducts, chunks: totalChunks, failed };
}
