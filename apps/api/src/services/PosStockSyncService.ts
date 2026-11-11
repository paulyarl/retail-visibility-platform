/**
 * PosStockSyncService — shared reconcile core for POS → platform stock sync
 * (POS_STOCK_SYNC_SPEC.md §3).
 *
 * Every producer lane (Clover poll, Clover webhook, Square poll) builds
 * diffs and calls reconcileStock — no lane owns stock-update logic, so
 * dedup/logging/item-mutation rules stay identical across providers.
 *
 * The lane boundary lives inside the service: reconcileStock writes
 * inventory_items.stock and returns swisDirty; callers then fire
 * swisPushForDirty so each run exercises the full POS → platform → SWIS
 * chain without the reconcile depending on Google.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { upsertLocalInventoryForItem } from './MerchantProductSync';

export type PosStockSource =
  | 'clover_poll'
  | 'clover_webhook'
  | 'square_poll'
  /** File-path ingestion (NRS pricebook etc.) — POS_INGESTION_PARTNER_PATH_SPEC. */
  | 'file_import';

export interface PosStockDiff {
  inventoryItemId: string;
  newStock: number;
  source: PosStockSource;
  /** Provider-side id (clover_item_id / square variation id) — log only. */
  posItemId?: string;
}

/**
 * Full-field POS diff — the wide vocabulary lanes reconcile on. Mirrors the
 * demo scenario vocabulary: stock_update, price_update, name change, and
 * category_items_moved all ride the same diff. Only fields actually present
 * are compared/written; absent fields leave the item alone.
 */
export interface PosItemDiff {
  inventoryItemId: string;
  source: PosStockSource;
  /** Provider-side id (clover_item_id / square variation id) — log only. */
  posItemId?: string;
  name?: string;
  priceCents?: number;
  salePriceCents?: number | null;
  stock?: number;
  /** VS directory_category id resolved from the POS category mapping. */
  directoryCategoryId?: string | null;
}

export interface ReconcileResult {
  updated: number;
  /** Already in sync — processed successfully, nothing to write. */
  skipped: number;
  /** Real misses — item not found or write errored. */
  failed: number;
  /** swis_listed items whose stock changed — the downstream hand-off. */
  swisDirty: string[];
}

export interface SwisPushResult {
  pushed: number;
  /** Items failing the SWIS gate or with no usable merchant link. */
  skipped: number;
  errors: Array<{ itemId: string; error: string }>;
}

class PosStockSyncService {
  /**
   * Apply stock diffs to inventory_items. Unchanged values skip silently —
   * the SWIS push stays bounded because only real movement produces dirty
   * items. Per-item idempotent: a mid-run crash just means the next run
   * redoes the untouched tail.
   */
  async reconcileStock(
    tenantId: string,
    diffs: PosStockDiff[],
    _ctx?: unknown,
  ): Promise<ReconcileResult> {
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const swisDirty: string[] = [];

    for (const diff of diffs) {
      const newStock = Math.max(0, Math.floor(diff.newStock));
      try {
        const item = await prisma.inventory_items.findUnique({
          where: { id: diff.inventoryItemId },
          select: { id: true, stock: true, swis_listed: true },
        });
        if (!item) {
          failed++;
          continue;
        }
        if ((item.stock ?? 0) === newStock) {
          skipped++;
          continue;
        }
        await prisma.inventory_items.update({
          where: { id: item.id },
          data: { stock: newStock },
        });
        updated++;
        if (item.swis_listed) swisDirty.push(item.id);
      } catch (err) {
        failed++;
        logger.warn('[PosStockSync] reconcile item failed (non-fatal)', undefined, {
          tenantId,
          inventoryItemId: diff.inventoryItemId,
          source: diff.source,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { updated, skipped, failed, swisDirty };
  }

  /**
   * Apply full-field POS diffs to inventory_items. Same contract as
   * reconcileStock — unchanged items skip, per-item idempotent — but diffs
   * carry every Clover-owned field. A swis_listed item goes dirty when its
   * price OR stock moves (both ride the local-inventory payload); name and
   * category changes stay catalog-side.
   */
  async reconcileItems(
    tenantId: string,
    diffs: PosItemDiff[],
    _ctx?: unknown,
  ): Promise<ReconcileResult> {
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const swisDirty: string[] = [];

    for (const diff of diffs) {
      try {
        const item = await prisma.inventory_items.findUnique({
          where: { id: diff.inventoryItemId },
          select: {
            id: true, name: true, price_cents: true, sale_price_cents: true,
            stock: true, directory_category_id: true, swis_listed: true,
          },
        });
        if (!item) {
          failed++;
          continue;
        }

        const data: Record<string, unknown> = {};
        let priceMoved = false;
        let stockMoved = false;
        if (diff.name !== undefined && diff.name !== item.name) data.name = diff.name;
        if (diff.priceCents !== undefined && diff.priceCents !== item.price_cents) {
          data.price_cents = diff.priceCents;
          data.price = diff.priceCents / 100;
          priceMoved = true;
        }
        if (diff.salePriceCents !== undefined && diff.salePriceCents !== item.sale_price_cents) {
          data.sale_price_cents = diff.salePriceCents;
          priceMoved = true;
        }
        if (diff.stock !== undefined) {
          const newStock = Math.max(0, Math.floor(diff.stock));
          if (newStock !== (item.stock ?? 0)) {
            data.stock = newStock;
            stockMoved = true;
          }
        }
        if (diff.directoryCategoryId !== undefined && diff.directoryCategoryId !== item.directory_category_id) {
          data.directory_category_id = diff.directoryCategoryId;
        }

        if (Object.keys(data).length === 0) {
          skipped++;
          continue;
        }
        data.updated_at = new Date();
        await prisma.inventory_items.update({ where: { id: item.id }, data });
        updated++;
        if (item.swis_listed && (stockMoved || priceMoved)) swisDirty.push(item.id);
      } catch (err) {
        failed++;
        logger.warn('[PosStockSync] reconcile item failed (non-fatal)', undefined, {
          tenantId,
          inventoryItemId: diff.inventoryItemId,
          source: diff.source,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { updated, skipped, failed, swisDirty };
  }

  /**
   * Push the dirty items into Google's local-inventory instance — the
   * downstream hand-off. Resolves the tenant's active merchant link
   * (store_code + swis_enabled) once, then upserts per item. Same gate as
   * evaluateSwisReadiness's selectedCount: swis_listed + active + public +
   * physical/hybrid. Best-effort throughout: push failures are collected
   * for the caller's sync log, never thrown — a bad GMC call must not
   * roll back the stock reconcile that already committed.
   */
  async swisPushForDirty(tenantId: string, itemIds: string[]): Promise<SwisPushResult> {
    const result: SwisPushResult = { pushed: 0, skipped: 0, errors: [] };
    if (itemIds.length === 0) return result;

    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: {
        google_merchant_links_list: { where: { is_active: true }, take: 1 },
      },
    });
    const link = account?.google_merchant_links_list?.[0];
    if (!link || !link.swis_enabled || !link.store_code) {
      // No SWIS lane on this tenant — nothing to push; not an error.
      return { ...result, skipped: itemIds.length };
    }

    const items = await prisma.inventory_items.findMany({
      where: {
        id: { in: itemIds },
        tenant_id: tenantId,
        swis_listed: true,
        item_status: 'active',
        visibility: 'public',
        product_type: { in: ['physical', 'hybrid'] },
      },
      select: { id: true },
    });
    const eligible = new Set(items.map((i: any) => i.id));

    for (const itemId of itemIds) {
      if (!eligible.has(itemId)) {
        result.skipped++;
        continue;
      }
      try {
        const res = await upsertLocalInventoryForItem(tenantId, itemId, link.store_code);
        if (res.success) {
          result.pushed++;
        } else {
          result.errors.push({ itemId, error: res.error || 'unknown' });
        }
      } catch (err) {
        result.errors.push({
          itemId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }
}

export const posStockSyncService = new PosStockSyncService();
export default posStockSyncService;
