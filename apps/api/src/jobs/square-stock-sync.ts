/**
 * Square Stock Sync Job — POS → platform lane for Square
 * (POS_STOCK_SYNC_SPEC.md §6.3). Daily pull of
 * batchRetrieveInventoryCounts per enabled integration.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { scheduleJob, stopJob } from './registry';
import { syncSquareIntegration } from '../services/square/square-stock-sync';

const JOB_NAME = 'square-stock-sync';
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;

function pollIntervalMs(): number {
  const raw = Number(process.env.POS_SQUARE_POLL_INTERVAL_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_INTERVAL_MS;
}

async function run(): Promise<void> {
  const integrations = await prisma.square_integrations_list.findMany({
    where: { enabled: true },
    select: { id: true, tenant_id: true, merchant_id: true, location_id: true },
  });
  console.log(`[${JOB_NAME}] ${integrations.length} integration(s) to poll`);
  for (const integration of integrations) {
    try {
      await syncSquareIntegration(integration);
    } catch (err) {
      logger.warn(`[${JOB_NAME}] integration ${integration.id} failed (non-fatal)`, undefined, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function startSquareStockSync(): void {
  scheduleJob({
    name: JOB_NAME,
    description: 'Polls Square inventory counts into inventory_items + SWIS local inventory push',
    scheduleLabel: 'daily',
    computeNextDelay: () => pollIntervalMs(),
    envDisableVar: 'DISABLE_SQUARE_STOCK_SYNC',
    maxRunMs: 10 * 60 * 1000,
    handler: async () => {
      await run();
      return { ran: true };
    },
  });
  console.log(`[${JOB_NAME}] scheduled (daily)`);
}

export function stopSquareStockSync(): void {
  stopJob(JOB_NAME);
}
