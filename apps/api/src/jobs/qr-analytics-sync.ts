/**
 * QR Analytics Aggregation Job
 *
 * Scheduled job that runs every 6 hours to:
 * 1. Iterate all active tenants
 * 2. Aggregate qr_scan_events into qr_analytics
 * 3. Compute per-surface, per-period metrics (scans, visitors, conversions, device breakdown)
 *
 * This populates the qr_analytics table for dashboard reads.
 */

import { prisma } from '../prisma';
import { aggregateQrAnalyticsForTenant, type PeriodType } from '../services/QrAnalyticsService';
import { logger } from '../logger';
import { scheduleJob, stopJob } from './registry';
import { dripPaceMs, sleep } from './pacing';

const JOB_NAME = 'qr-analytics-sync';
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STARTUP_DELAY_MS = 12 * 60 * 1000; // 12 minutes (after badge analytics sync)
let firstRun = true;
let cycleStartAt = 0;

export interface QrAnalyticsSyncResult {
  tenantsProcessed: number;
  rowsComputed: number;
  errors: string[];
}

async function getAllTenantIds(): Promise<string[]> {
  try {
    const tenants = await prisma.tenants.findMany({
      where: { subscription_status: { not: 'cancelled' } },
      select: { id: true },
    });
    return tenants.map(t => t.id);
  } catch (error) {
    logger.error('[QrAnalyticsSync] Error fetching tenants:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return [];
  }
}

async function runScheduledSync(): Promise<QrAnalyticsSyncResult> {
  const result: QrAnalyticsSyncResult = {
    tenantsProcessed: 0,
    rowsComputed: 0,
    errors: [],
  };

  console.log('[QrAnalyticsSync] Starting scheduled QR analytics aggregation...');
  const startTime = Date.now();
  cycleStartAt = startTime;

  try {
    const tenantIds = await getAllTenantIds();
    console.log(`[QrAnalyticsSync] Found ${tenantIds.length} active tenants`);

    if (tenantIds.length === 0) {
      console.log('[QrAnalyticsSync] No tenants, skipping');
      return result;
    }

    const periodTypes: PeriodType[] = ['day', 'week', 'month'];

    // Drip: spread the sweep across most of the interval instead of bursting —
    // smooths DB reads (Supabase pooler egress) into a low-rate stream.
    const paceMs = dripPaceMs(tenantIds.length, SYNC_INTERVAL_MS);

    for (const tenantId of tenantIds) {
      try {
        for (const periodType of periodTypes) {
          const aggResult = await aggregateQrAnalyticsForTenant(tenantId, periodType);
          result.rowsComputed += aggResult.rowsComputed;
          if (aggResult.errors.length > 0) {
            result.errors.push(...aggResult.errors);
          }
        }
        result.tenantsProcessed++;
      } catch (error: any) {
        logger.error(`[QrAnalyticsSync] Error processing tenant ${tenantId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
        result.errors.push(`Tenant ${tenantId}: ${error.message}`);
      }

      // Drip-paced delay between tenants (see dripPaceMs)
      await sleep(paceMs);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(
      `[QrAnalyticsSync] Completed in ${duration}s: ${result.tenantsProcessed} tenants, ` +
      `${result.rowsComputed} rows computed, ${result.errors.length} errors`
    );
  } catch (error) {
    logger.error('[QrAnalyticsSync] Fatal error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    result.errors.push(`Fatal: ${error instanceof Error ? error.message : String(error)}`);
  }

  return result;
}

export async function startQrAnalyticsSync(): Promise<void> {
  scheduleJob({
    name: JOB_NAME,
    description: 'Aggregates qr_scan_events into qr_analytics',
    scheduleLabel: 'every 6 hours',
    envDisableVar: 'DISABLE_QR_ANALYTICS_SYNC',
    // Cadence measured from cycle start so a drip-paced sweep doesn't dilate
    // the schedule (run ~70% of interval, then idle until the next tick).
    computeNextDelay: () => {
      if (firstRun) { firstRun = false; return STARTUP_DELAY_MS; }
      if (!cycleStartAt) return SYNC_INTERVAL_MS;
      return Math.max(60_000, SYNC_INTERVAL_MS - (Date.now() - cycleStartAt));
    },
    maxRunMs: SYNC_INTERVAL_MS,
    handler: async () => runScheduledSync(),
  });
}

export function stopQrAnalyticsSync(): void {
  stopJob(JOB_NAME);
}
