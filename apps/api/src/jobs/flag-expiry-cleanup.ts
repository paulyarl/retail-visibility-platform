/**
 * Flag Expiry Auto-Cleanup Job
 *
 * Runs daily to clean up stale tenant flag overrides that haven't been updated
 * in a configurable period (default 90 days). This prevents accumulation of
 * orphaned tenant overrides for flags that no longer exist on the platform.
 *
 * Wired into server startup in index.ts (following existing job pattern).
 * Can be disabled via DISABLE_FLAG_EXPIRY_CLEANUP env var.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

const STARTUP_DELAY_MS = 60 * 1000; // 1 minute
const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_STALE_DAYS = 90;

let cleanupIntervalId: NodeJS.Timeout | null = null;

async function runFlagExpiryCleanup(): Promise<void> {
  console.log('[FlagExpiryCleanup] Starting stale flag cleanup...');

  try {
    const staleDays = parseInt(process.env.FLAG_OVERRIDE_STALE_DAYS || String(DEFAULT_STALE_DAYS), 10);
    const cutoff = new Date(Date.now() - staleDays * 24 * 60 * 60 * 1000);

    // 1. Delete tenant overrides for flags that no longer exist on platform
    const platformFlags = await prisma.platform_feature_flags_list.findMany({
      select: { flag: true },
    });
    const platformFlagSet = new Set(platformFlags.map(f => f.flag));

    const tenantOverrides = await prisma.tenant_feature_flags_list.findMany({
      select: { flag: true, tenant_id: true, updated_at: true },
    });

    const orphaned = tenantOverrides.filter(t => !platformFlagSet.has(t.flag));
    let orphanedDeleted = 0;
    if (orphaned.length > 0) {
      const orphanedFlags = [...new Set(orphaned.map(o => o.flag))];
      const result = await prisma.tenant_feature_flags_list.deleteMany({
        where: { flag: { in: orphanedFlags } },
      });
      orphanedDeleted = result.count;
      console.log(`[FlagExpiryCleanup] Deleted ${orphanedDeleted} orphaned tenant overrides for flags no longer on platform`);
    }

    // 2. Delete stale tenant overrides (not updated within cutoff period)
    const staleResult = await prisma.tenant_feature_flags_list.deleteMany({
      where: {
        updated_at: { lt: cutoff },
      },
    });
    console.log(`[FlagExpiryCleanup] Deleted ${staleResult.count} stale tenant overrides (older than ${staleDays} days)`);

    // 3. Invalidate effective flag caches
    const { invalidateEffectiveFlagCaches } = await import('../utils/effectiveFlags');
    invalidateEffectiveFlagCaches();

    console.log(`[FlagExpiryCleanup] Completed: ${orphanedDeleted} orphaned + ${staleResult.count} stale removed`);
  } catch (error) {
    logger.error('[FlagExpiryCleanup] Failed:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
  }
}

export async function startFlagExpiryCleanup(): Promise<void> {
  if (process.env.DISABLE_FLAG_EXPIRY_CLEANUP === 'true') {
    console.log('[FlagExpiryCleanup] Disabled by env var');
    return;
  }

  if (cleanupIntervalId) {
    console.log('[FlagExpiryCleanup] Already running');
    return;
  }

  console.log('[FlagExpiryCleanup] Starting scheduler (daily)');

  setTimeout(() => {
    runFlagExpiryCleanup();
  }, STARTUP_DELAY_MS);

  cleanupIntervalId = setInterval(() => {
    runFlagExpiryCleanup();
  }, INTERVAL_MS);
}

export function stopFlagExpiryCleanup(): void {
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
    console.log('[FlagExpiryCleanup] Stopped');
  }
}
