/**
 * Clover Catalog Sync Job — POS → platform lane (POS_STOCK_SYNC_SPEC.md §4).
 *
 * Every 15 min, fully reconcile every active production Clover integration:
 * stock + price + name + category moves on mapped items (the demo's
 * stock_update/price_update/category_items_moved vocabulary), new items
 * (import or SKU-collision conflict), deleted items (archive), and category
 * creates + renames — then push dirty SWIS-listed items into Google's local
 * inventory. Demo integrations (the emulator lane) are never polled — mode
 * guard lives in the tenant-selection query, not the fetch.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { scheduleJob, stopJob } from './registry';
import {
  generateCloverItemId,
  generateCloverItemMappingsId,
  generateCloverSyncLogId,
  generateProductCatId,
} from '../lib/id-generator';
import { cloverApiBaseUrl, decryptToken } from '../services/clover-oauth';
import posStockSyncService, { type PosItemDiff } from '../services/PosStockSyncService';

const JOB_NAME = 'clover-stock-sync';
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const MIN_INTERVAL_MS = 5 * 60 * 1000;
const ITEMS_PAGE_LIMIT = 1000;

function pollIntervalMs(): number {
  const raw = Number(process.env.POS_CLOVER_POLL_INTERVAL_MS);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_INTERVAL_MS;
  return Math.max(raw, MIN_INTERVAL_MS);
}

/**
 * Paginate /v3/merchants/{id}/item_stocks → Map<cloverItemId, stockCount>.
 * item_stocks is Clover's authoritative stock source — the stockCount field
 * on /items is denormalized and reads 0 for stock-tracked items.
 */
async function fetchCloverStockCounts(
  integration: { merchant_id: string; access_token: string },
): Promise<{ stockByItemId: Map<string, number>; httpStatus: number | null }> {
  const stockByItemId = new Map<string, number>();
  let offset = 0;
  let httpStatus: number | null = null;

  for (;;) {
    const res = await fetch(
      `${cloverApiBaseUrl()}/v3/merchants/${integration.merchant_id}/item_stocks?limit=${ITEMS_PAGE_LIMIT}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${decryptToken(integration.access_token)}` } },
    );
    httpStatus = res.status;
    const bodyText = await res.text().catch(() => '');
    if (!res.ok) {
      logger.warn('[clover-stock-sync] item_stocks fetch failed', undefined, {
        merchantId: integration.merchant_id,
        httpStatus: res.status,
        body: bodyText.slice(0, 500),
      });
      throw Object.assign(new Error(`clover_item_stocks_${res.status}`), {
        httpStatus: res.status,
        body: bodyText.slice(0, 500),
      });
    }
    let data: { elements?: Array<{ item?: { id?: string }; stockCount?: number }> } = {};
    try {
      data = JSON.parse(bodyText);
    } catch {
      logger.warn('[clover-stock-sync] non-JSON item_stocks response', undefined, {
        merchantId: integration.merchant_id,
        body: bodyText.slice(0, 500),
      });
    }
    const elements = data.elements || [];
    if (elements.length === 0) {
      logger.warn('[clover-stock-sync] empty item_stocks payload', undefined, {
        merchantId: integration.merchant_id,
        httpStatus: res.status,
        body: bodyText.slice(0, 500),
      });
    }
    for (const el of elements) {
      if (el.item?.id) stockByItemId.set(el.item.id, el.stockCount ?? 0);
    }
    if (elements.length < ITEMS_PAGE_LIMIT) break;
    offset += ITEMS_PAGE_LIMIT;
  }
  return { stockByItemId, httpStatus };
}

interface CloverItemSnapshot {
  id: string;
  name: string;
  sku: string;
  priceCents: number;
  salePriceCents: number | null;
  categoryId: string | null;
}

/**
 * Paginate /v3/merchants/{id}/items?expand=categories → every item the
 * merchant has. Must be complete — the delete-detection pass archives mapped
 * items absent from this list, so a partial page would mass-archive. Any
 * page failing throws and aborts the run before anything is applied.
 */
async function fetchCloverItems(
  integration: { merchant_id: string; access_token: string },
): Promise<CloverItemSnapshot[]> {
  const items: CloverItemSnapshot[] = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(
      `${cloverApiBaseUrl()}/v3/merchants/${integration.merchant_id}/items?expand=categories&limit=${ITEMS_PAGE_LIMIT}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${decryptToken(integration.access_token)}` } },
    );
    const bodyText = await res.text().catch(() => '');
    if (!res.ok) {
      throw Object.assign(new Error(`clover_items_${res.status}`), {
        httpStatus: res.status,
        body: bodyText.slice(0, 500),
      });
    }
    let data: { elements?: any[] } = {};
    try {
      data = JSON.parse(bodyText);
    } catch {
      throw new Error('clover_items_non_json');
    }
    const elements = data.elements || [];
    for (const item of elements) {
      items.push({
        id: item.id,
        name: item.name,
        sku: item.sku || item.code || `CLV-${item.id.substring(0, 8)}`,
        priceCents: item.price || 0,
        salePriceCents: item.priceType === 'VARIABLE'
          ? null
          : (item.alternatePrices?.[0]?.price || null),
        categoryId: item.categories?.elements?.[0]?.id || null,
      });
    }
    if (elements.length < ITEMS_PAGE_LIMIT) break;
    offset += ITEMS_PAGE_LIMIT;
  }
  return items;
}

/**
 * /v3/merchants/{id}/categories — best-effort. A failed fetch skips the
 * category pass only; item reconcile still runs.
 */
async function fetchCloverCategories(
  integration: { merchant_id: string; access_token: string },
): Promise<Array<{ id: string; name: string }> | null> {
  const res = await fetch(
    `${cloverApiBaseUrl()}/v3/merchants/${integration.merchant_id}/categories`,
    { headers: { Authorization: `Bearer ${decryptToken(integration.access_token)}` } },
  );
  if (!res.ok) {
    logger.warn('[clover-stock-sync] categories fetch failed — category pass skipped', undefined, {
      merchantId: integration.merchant_id,
      httpStatus: res.status,
    });
    return null;
  }
  const data = await res.json() as { elements?: any[] };
  return (data.elements || []).map((c: any) => ({ id: c.id, name: c.name }));
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
  const tenantId = integration.tenant_id;

  const operation = isBaseline ? 'catalog_sync_baseline' : 'catalog_sync_poll';
  let status = 'success';
  let itemsProcessed = 0;
  let itemsSucceeded = 0;
  let itemsFailed = 0;
  let errorMessage: string | null = null;
  const details: Record<string, number | boolean> = { baseline: isBaseline };

  try {
    // All three fetches up front. /items must be a COMPLETE paginated set —
    // the delete pass archives mapped items absent from it, so a partial
    // result would mass-archive. A failed /items page throws and aborts the
    // run before anything is applied; /categories failure skips only the
    // category pass.
    const [cloverItems, stockResult, cloverCategories] = await Promise.all([
      fetchCloverItems(integration as any),
      fetchCloverStockCounts(integration as any),
      fetchCloverCategories(integration as any),
    ]);
    const cloverItemById = new Map(cloverItems.map((i) => [i.id, i]));
    itemsProcessed = cloverItems.length;

    const allMappings = await prisma.clover_item_mappings_list.findMany({
      where: { integration_id: integration.id },
      select: { id: true, clover_item_id: true, rvp_item_id: true, mapping_status: true },
    });
    const knownCloverIds = new Set(allMappings.map((m) => m.clover_item_id));

    // ---- Category pass: new_category + category_renamed ------------------
    // Builds the cloverCategoryId → directory_category id map item diffs
    // use, so a category rename is applied before items move under it.
    const rvpCategoryByCloverId = new Map<string, string>();
    let categoriesCreated = 0;
    let categoriesRenamed = 0;
    if (cloverCategories) {
      for (const cat of cloverCategories) {
        const catMapping = await prisma.clover_category_mappings_list.findFirst({
          where: { integration_id: integration.id, clover_category_id: cat.id },
        });
        if (catMapping?.rvp_category_id) {
          rvpCategoryByCloverId.set(cat.id, catMapping.rvp_category_id);
          if (catMapping.rvp_category_name !== cat.name) {
            await prisma.directory_category.update({
              where: { id: catMapping.rvp_category_id },
              data: { name: cat.name, updatedAt: new Date() },
            });
            await prisma.clover_category_mappings_list.update({
              where: { id: catMapping.id },
              data: { clover_category_name: cat.name, rvp_category_name: cat.name, updated_at: new Date() },
            });
            categoriesRenamed++;
          }
          continue;
        }

        const slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        let rvpCategory = await prisma.directory_category.findFirst({
          where: { tenantId, slug },
        });
        if (!rvpCategory) {
          rvpCategory = await prisma.directory_category.create({
            data: {
              id: generateProductCatId(tenantId),
              tenantId,
              name: cat.name,
              slug,
              isActive: true,
              updatedAt: new Date(),
            },
          });
          categoriesCreated++;
        }
        if (catMapping) {
          await prisma.clover_category_mappings_list.update({
            where: { id: catMapping.id },
            data: { rvp_category_id: rvpCategory.id, rvp_category_name: cat.name, mapping_status: 'mapped', updated_at: new Date() },
          });
        } else {
          await prisma.clover_category_mappings_list.create({
            data: {
              id: generateCloverItemMappingsId(),
              integration_id: integration.id,
              clover_category_id: cat.id,
              clover_category_name: cat.name,
              rvp_category_id: rvpCategory.id,
              rvp_category_name: cat.name,
              sync_direction: 'bidirectional',
              mapping_status: 'mapped',
              last_synced_at: new Date(),
              last_sync_status: 'success',
              updated_at: new Date(),
            } as any,
          });
        }
        rvpCategoryByCloverId.set(cat.id, rvpCategory.id);
      }
    }

    // ---- Item diff pass: stock/price/name/category moves -----------------
    const diffs: PosItemDiff[] = [];
    for (const m of allMappings) {
      if (m.mapping_status !== 'mapped' || !m.rvp_item_id) continue;
      const ci = cloverItemById.get(m.clover_item_id);
      if (!ci) continue; // absent → delete pass below
      diffs.push({
        inventoryItemId: m.rvp_item_id,
        source: 'clover_poll',
        posItemId: m.clover_item_id,
        name: ci.name,
        priceCents: ci.priceCents,
        salePriceCents: ci.salePriceCents,
        // undefined → stock untouched (untracked items aren't in item_stocks)
        stock: stockResult.stockByItemId.get(ci.id),
        directoryCategoryId: ci.categoryId ? (rvpCategoryByCloverId.get(ci.categoryId) ?? null) : null,
      });
      await prisma.clover_item_mappings_list.update({
        where: { id: m.id },
        data: { clover_item_name: ci.name, clover_sku: ci.sku, last_synced_at: new Date(), last_sync_status: 'success', updated_at: new Date() },
      });
    }
    const reconciled = await posStockSyncService.reconcileItems(tenantId, diffs);
    itemsSucceeded = reconciled.updated + reconciled.skipped;
    itemsFailed = reconciled.failed;
    details.updated = reconciled.updated;
    details.unchanged = reconciled.skipped;

    // ---- New items: create, or flag a SKU collision as conflict ----------
    let itemsCreated = 0;
    let conflictsCreated = 0;
    for (const ci of cloverItems) {
      if (knownCloverIds.has(ci.id)) continue;
      const skuOwner = await prisma.inventory_items.findFirst({
        where: { tenant_id: tenantId, sku: ci.sku },
        select: { id: true },
      });
      if (skuOwner) {
        // SKU collision with an unmapped item — same diff the demo 'conflict'
        // scenario simulates. Point the conflict row at the existing item so
        // the resolve endpoint can apply use_clover/use_rvp/custom onto it.
        await prisma.clover_item_mappings_list.create({
          data: {
            id: generateCloverItemMappingsId(),
            integration_id: integration.id,
            clover_item_id: ci.id,
            clover_item_name: ci.name,
            clover_sku: ci.sku,
            rvp_item_id: skuOwner.id,
            rvp_sku: ci.sku,
            mapping_status: 'conflict',
            last_synced_at: new Date(),
            last_sync_status: 'conflict',
            updated_at: new Date(),
          } as any,
        });
        conflictsCreated++;
        continue;
      }
      const newItem = await prisma.inventory_items.create({
        data: {
          id: generateCloverItemId(),
          tenant_id: tenantId,
          sku: ci.sku,
          name: ci.name,
          title: ci.name,
          brand: 'Clover Import',
          price_cents: ci.priceCents,
          price: ci.priceCents / 100,
          sale_price_cents: ci.salePriceCents,
          stock: stockResult.stockByItemId.get(ci.id) ?? 0,
          source: 'API_IMPORT',
          directory_category_id: ci.categoryId ? (rvpCategoryByCloverId.get(ci.categoryId) ?? null) : null,
          item_status: 'active',
          visibility: 'public',
          product_type: 'physical',
          updated_at: new Date(),
        } as any,
      });
      await prisma.clover_item_mappings_list.create({
        data: {
          id: generateCloverItemMappingsId(),
          integration_id: integration.id,
          clover_item_id: ci.id,
          clover_item_name: ci.name,
          clover_sku: ci.sku,
          rvp_item_id: newItem.id,
          rvp_sku: ci.sku,
          mapping_status: 'mapped',
          last_synced_at: new Date(),
          last_sync_status: 'success',
          updated_at: new Date(),
        } as any,
      });
      itemsCreated++;
      itemsSucceeded++;
    }
    details.created = itemsCreated;
    details.conflicts = conflictsCreated;

    // ---- Deleted items: archive ------------------------------------------
    // Demo 'item_deleted' semantics — archive, never hard-delete; the item's
    // photos/enrichment survive if Clover ever brings the item back.
    let itemsArchived = 0;
    for (const m of allMappings) {
      // Only Clover-managed items archive — a 'conflict' mapping points at a
      // merchant-owned item that must outlive a Clover-side delete.
      if (m.mapping_status !== 'mapped' || !m.rvp_item_id || cloverItemById.has(m.clover_item_id)) continue;
      await prisma.inventory_items.update({
        where: { id: m.rvp_item_id },
        data: { item_status: 'archived', updated_at: new Date() },
      });
      await prisma.clover_item_mappings_list.update({
        where: { id: m.id },
        data: { last_sync_status: 'archived', updated_at: new Date() },
      });
      itemsArchived++;
    }
    details.archived = itemsArchived;
    details.categoriesCreated = categoriesCreated;
    details.categoriesRenamed = categoriesRenamed;

    const pushed = await posStockSyncService.swisPushForDirty(tenantId, reconciled.swisDirty);
    details.swisPushed = pushed.pushed;
    details.swisSkipped = pushed.skipped;
    if (pushed.errors.length > 0) {
      errorMessage = `swis push errors: ${pushed.errors
        .slice(0, 3)
        .map((e) => `${e.itemId}:${e.error}`)
        .join('; ')}`;
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
      items_processed: itemsProcessed,
      items_succeeded: itemsSucceeded,
      items_failed: itemsFailed,
      error_message: errorMessage,
      error_details: details as any,
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
    description: 'Reconciles Clover catalog (stock/price/name/category/items) into inventory_items + SWIS push',
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
