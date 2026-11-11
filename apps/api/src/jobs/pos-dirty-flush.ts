/**
 * POS Dirty Flush Job — POS_STOCK_SYNC_SPEC §5.
 *
 * Every 15 min, group unflushed pos_dirty_items rows by integration and
 * re-run the same full catalog reconcile the Clover poll job uses (stock +
 * price + name + category + new/deleted items — dedup means a busy merchant
 * costs ~1 reconcile per 15 min regardless of webhook volume), then mark the
 * rows flushed. Webhook payloads carry no field values; this job is where
 * the actual reconcile + SWIS push happens.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { scheduleJob, stopJob } from './registry';
import { syncIntegration } from './clover-stock-sync';

const JOB_NAME = 'pos-dirty-flush';
const INTERVAL_MS = 15 * 60 * 1000;

async function run(): Promise<void> {
  const dirty = await prisma.$queryRawUnsafe<Array<{ integration_id: string }>>(
    `SELECT DISTINCT integration_id FROM pos_dirty_items WHERE provider = 'clover' AND flushed_at IS NULL`,
  );
  if (dirty.length === 0) return;

  const integrationIds = dirty.map((d) => d.integration_id);
  console.log(`[${JOB_NAME}] ${integrationIds.length} integration(s) with dirty items`);

  const integrations = await prisma.clover_integrations_list.findMany({
    where: {
      id: { in: integrationIds },
      status: 'active',
      mode: 'production',
      access_token: { not: null },
      merchant_id: { not: null },
    },
    select: {
      id: true,
      tenant_id: true,
      merchant_id: true,
      access_token: true,
      last_sync_at: true,
    },
  });
  const flushed = new Set(integrations.map((i: any) => i.id));

  for (const integration of integrations) {
    try {
      await syncIntegration(integration as any);
    } catch (err) {
      // Non-fatal — rows stay unflushed and retry next window.
      logger.warn(`[${JOB_NAME}] integration ${integration.id} flush failed`, undefined, {
        error: err instanceof Error ? err.message : String(err),
      });
      flushed.delete(integration.id);
    }
  }

  if (flushed.size > 0) {
    const idList = [...flushed].map((id) => `'${id}'`).join(',');
    await prisma.$executeRawUnsafe(
      `UPDATE pos_dirty_items SET flushed_at = now() WHERE provider = 'clover' AND flushed_at IS NULL AND integration_id IN (${idList})`,
    );
  }
}

export function startPosDirtyFlush(): void {
  scheduleJob({
    name: JOB_NAME,
    description: 'Flushes POS webhook dirty-item queue via Clover stock re-pull + SWIS push',
    scheduleLabel: 'every 15 minutes',
    computeNextDelay: () => INTERVAL_MS,
    envDisableVar: 'DISABLE_POS_DIRTY_FLUSH',
    maxRunMs: 10 * 60 * 1000,
    handler: async () => {
      await run();
      return { ran: true };
    },
  });
  console.log(`[${JOB_NAME}] scheduled (every 15 min)`);
}

export function stopPosDirtyFlush(): void {
  stopJob(JOB_NAME);
}
