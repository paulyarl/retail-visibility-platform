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

const JOB_NAME = 'qr-analytics-sync';
const SYNC_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const STARTUP_DELAY_MS = 12 * 60 * 1000; // 12 minutes (after badge analytics sync)
let firstRun = true;

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

  try {
    const tenantIds = await getAllTenantIds();
    console.log(`[QrAnalyticsSync] Found ${tenantIds.length} active tenants`);

    if (tenantIds.length === 0) {
      console.log('[QrAnalyticsSync] No tenants, skipping');
      return result;
    }

    const periodTypes: PeriodType[] = ['day', 'week', 'month'];

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

      // Small delay between tenants
      await new Promise(resolve => setTimeout(resolve, 500));
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
    computeNextDelay: () => (firstRun ? ((firstRun = false), STARTUP_DELAY_MS) : SYNC_INTERVAL_MS),
    handler: async () => runScheduledSync(),
  });
}

export function stopQrAnalyticsSync(): void {
  stopJob(JOB_NAME);
}
