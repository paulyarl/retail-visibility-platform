/**
 * Clover Stock Sync Job — POS → platform lane (POS_STOCK_SYNC_SPEC.md §4).
 *
 * Every 15 min, poll stockCount for every mapped item on every active
 * production Clover integration, reconcile into inventory_items.stock,
 * then push the dirty SWIS-listed items into Google's local inventory.
 * Demo integrations (the emulator lane) are never polled — mode guard
 * lives in the tenant-selection query, not the fetch.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { scheduleJob, stopJob } from './registry';
import { generateCloverSyncLogId } from '../lib/id-generator';
import posStockSyncService, { type PosStockDiff } from '../services/PosStockSyncService';

const JOB_NAME = 'clover-stock-sync';
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const MIN_INTERVAL_MS = 5 * 60 * 1000;
const ITEMS_PAGE_LIMIT = 1000;

function pollIntervalMs(): number {
  const raw = Number(process.env.POS_CLOVER_POLL_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_INTERVAL_MS;
  return Math.max(raw, MIN_INTERVAL_MS);
}

function cloverApiBaseUrl(): string {
  // REST host — tokens issued by the sandbox OAuth flow validate against
  // api.clover.com, not the sandbox.dev.clover.com dashboard host.
  return process.env.CLOVER_API_BASE_URL || 'https://api.clover.com';
}

/** Paginate /v3/merchants/{id}/items → Map<cloverItemId, stockCount>. */
async function fetchCloverStockCounts(
  integration: { merchant_id: string; access_token: string },
): Promise<{ stockByItemId: Map<string, number>; httpStatus: number | null }> {
  const stockByItemId = new Map<string, number>();
  let offset = 0;
  let httpStatus: number | null = null;

  for (;;) {
    const res = await fetch(
      `${cloverApiBaseUrl()}/v3/merchants/${integration.merchant_id}/items?limit=${ITEMS_PAGE_LIMIT}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${integration.access_token}` } },
    );
    httpStatus = res.status;
    const bodyText = await res.text().catch(() => '');
    if (!res.ok) {
      logger.warn('[clover-stock-sync] items fetch failed', undefined, {
        merchantId: integration.merchant_id,
        httpStatus: res.status,
        body: bodyText.slice(0, 500),
      });
      throw Object.assign(new Error(`clover_items_${res.status}`), {
        httpStatus: res.status,
        body: bodyText.slice(0, 500),
      });
    }
    let data: { elements?: Array<{ id?: string; stockCount?: number }> } = {};
    try {
      data = JSON.parse(bodyText);
    } catch {
      logger.warn('[clover-stock-sync] non-JSON items response', undefined, {
        merchantId: integration.merchant_id,
        body: bodyText.slice(0, 500),
      });
    }
    const elements = data.elements || [];
    if (elements.length === 0) {
      logger.warn('[clover-stock-sync] empty items payload', undefined, {
        merchantId: integration.merchant_id,
        httpStatus: res.status,
        body: bodyText.slice(0, 500),
      });
    }
    for (const el of elements) {
      if (el.id) stockByItemId.set(el.id, el.stockCount ?? 0);
    }
    if (elements.length < ITEMS_PAGE_LIMIT) break;
    offset += ITEMS_PAGE_LIMIT;
  }

  return { stockByItemId, httpStatus };
}

export async function syncIntegration(integration: {
  id: string;
  tenant_id: string;
  merchant_id: string;
  access_token: string;
  last_sync_at: Date | null;
}): Promise<void> {
  const startedAt = Date.now();
  const isBaseline = !integration.last_sync_at;

  const mappings = await prisma.clover_item_mappings_list.findMany({
    where: {
      integration_id: integration.id,
      mapping_status: 'mapped',
      rvp_item_id: { not: null },
    },
    select: { clover_item_id: true, rvp_item_id: true },
  });

  const operation = isBaseline ? 'stock_sync_baseline' : 'stock_sync_poll';
  let status = 'success';
  let itemsSucceeded = 0;
  let itemsFailed = 0;
  let errorMessage: string | null = null;
  let swisPushed = 0;
  let swisSkipped = 0;

  try {
    if (mappings.length > 0) {
      const { stockByItemId } = await fetchCloverStockCounts(integration as any);
      const diffs: PosStockDiff[] = [];
      for (const m of mappings) {
        const stock = stockByItemId.get(m.clover_item_id);
        if (stock === undefined || !m.rvp_item_id) {
          // Mapped item not returned by Clover — leave it alone this run.
          itemsFailed++;
          continue;
        }
        diffs.push({
          inventoryItemId: m.rvp_item_id,
          newStock: stock,
          source: 'clover_poll',
          posItemId: m.clover_item_id,
        });
      }

      const reconciled = await posStockSyncService.reconcileStock(
        integration.tenant_id,
        diffs,
      );
      itemsSucceeded = reconciled.updated;
      itemsFailed += reconciled.skipped;

      const pushed = await posStockSyncService.swisPushForDirty(
        integration.tenant_id,
        reconciled.swisDirty,
      );
      swisPushed = pushed.pushed;
      swisSkipped = pushed.skipped;
      if (pushed.errors.length > 0) {
        errorMessage = `swis push errors: ${pushed.errors
          .slice(0, 3)
          .map((e) => `${e.itemId}:${e.error}`)
          .join('; ')}`;
      }
    }
  } catch (err: any) {
    status = 'failed';
    errorMessage = err?.message || String(err);
    if (err?.httpStatus === 401) {
      status = 'token_expired';
      errorMessage = 'clover access token rejected (401) — reconnect required';
    }
  }

  await prisma.clover_integrations_list.update({
    where: { id: integration.id },
    data: {
      last_sync_at: new Date(),
      last_sync_status: status,
    },
  });

  await prisma.clover_sync_logs_list.create({
    data: {
      id: generateCloverSyncLogId(),
      integration_id: integration.id,
      trace_id: `${JOB_NAME}-${Date.now()}`,
      operation,
      status,
      items_processed: mappings.length,
      items_succeeded: itemsSucceeded,
      items_failed: itemsFailed,
      error_message: errorMessage,
      error_details: {
        swisPushed,
        swisSkipped,
        baseline: isBaseline,
      } as any,
      duration_ms: Date.now() - startedAt,
      completed_at: new Date(),
    },
  });
}

async function run(): Promise<void> {
  const integrations = await prisma.clover_integrations_list.findMany({
    where: {
      status: 'active',
      // Production lane only — demo/emulator integrations never touch
      // real stock, so they're never polled.
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

  console.log(`[${JOB_NAME}] ${integrations.length} production integration(s) to poll`);

  for (const integration of integrations) {
    try {
      await syncIntegration(integration as any);
    } catch (err) {
      // Per-integration isolation — one bad tenant never wedges the run.
      logger.warn(`[${JOB_NAME}] integration ${integration.id} failed (non-fatal)`, undefined, {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

export function startCloverStockSync(): void {
  scheduleJob({
    name: JOB_NAME,
    description: 'Polls Clover item stock into inventory_items + SWIS local inventory push',
    scheduleLabel: `every ${Math.round(pollIntervalMs() / 60000)} minutes`,
    computeNextDelay: () => pollIntervalMs(),
    envDisableVar: 'DISABLE_CLOVER_STOCK_SYNC',
    maxRunMs: 10 * 60 * 1000,
    handler: async () => {
      await run();
      return { ran: true };
    },
  });
  console.log(`[${JOB_NAME}] scheduled (every ${Math.round(pollIntervalMs() / 60000)} min)`);
}

export function stopCloverStockSync(): void {
  stopJob(JOB_NAME);
}
