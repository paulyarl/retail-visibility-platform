/**
 * Square Stock Sync — POS → platform lane for Square merchants
 * (POS_STOCK_SYNC_SPEC.md §6, sprint P2.2/P2.3).
 *
 * Pulls batchRetrieveInventoryCounts for mapped variations at the
 * integration's location, reconciles into inventory_items.stock, and
 * pushes dirty SWIS-listed items. Shares PosStockSyncService with the
 * Clover lane — Square owns no stock-write logic of its own.
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';
import { unifiedConfig } from '../../config/unifiedConfig';
import { SquareOAuthService } from './SquareOAuthService';
import { SquareClientService } from './square-client';
import posStockSyncService, { type PosStockDiff } from '../PosStockSyncService';
import crypto from 'crypto';

const squareOAuth = new SquareOAuthService();

export interface SquareIntegrationRow {
  id: string;
  tenant_id: string;
  merchant_id: string;
  location_id: string | null;
}

/** counts → diffs, joined through the mapping table rows the caller loaded. */
export function buildStockDiffs(
  counts: Array<{ catalogObjectId?: string; quantity?: string; state?: string }>,
  mappings: Array<{ square_item_variation_id: string | null; inventory_item_id: string }>,
): { diffs: PosStockDiff[]; unmatched: number } {
  const byVariation = new Map(
    mappings
      .filter((m) => m.square_item_variation_id)
      .map((m) => [m.square_item_variation_id!, m.inventory_item_id]),
  );
  const diffs: PosStockDiff[] = [];
  let unmatched = 0;
  for (const c of counts) {
    if (c.state !== 'IN_STOCK') continue;
    const itemId = c.catalogObjectId ? byVariation.get(c.catalogObjectId) : undefined;
    if (!itemId) {
      unmatched++;
      continue;
    }
    diffs.push({
      inventoryItemId: itemId,
      newStock: parseInt(c.quantity || '0', 10) || 0,
      source: 'square_poll',
      posItemId: c.catalogObjectId,
    });
  }
  return { diffs, unmatched };
}

/** SKU-join Square catalog variations → square_product_mappings_list. */
export async function mapSquareCatalogToInventory(
  tenantId: string,
  integrationId: string,
  client: SquareClientService,
): Promise<{ matched: number; unmatched: number }> {
  const catalogApi = client.getCatalogApi();
  const variations: Array<{ id: string; sku: string | null; name: string | null }> = [];
  let cursor: string | undefined;
  do {
    const res = await catalogApi.listCatalog({ cursor, types: 'ITEM_VARIATION' });
    for (const obj of res.objects || []) {
      const d = (obj as any).itemVariationData || (obj as any).item_variation_data || {};
      variations.push({ id: (obj as any).id, sku: d.sku || null, name: d.name || null });
    }
    cursor = res.cursor;
  } while (cursor);

  let matched = 0;
  let unmatched = 0;
  for (const v of variations) {
    const item = v.sku
      ? await prisma.inventory_items.findFirst({
          where: { tenant_id: tenantId, sku: v.sku },
          select: { id: true },
        })
      : null;
    if (item) matched++;
    else unmatched++;
    const existingMap = await prisma.square_product_mappings_list.findFirst({
      where: { integration_id: integrationId, square_item_variation_id: v.id },
      select: { id: true },
    });
    const mapData = {
      inventory_item_id: item?.id || '',
      sync_status: item ? 'matched' : 'unmatched',
      sync_error: item ? null : `no inventory_items sku match for '${v.sku}'`,
      last_synced_at: new Date(),
      updated_at: new Date(),
    };
    if (existingMap) {
      await prisma.square_product_mappings_list.update({
        where: { id: existingMap.id },
        data: mapData,
      });
    } else {
      await prisma.square_product_mappings_list.create({
        data: {
          id: crypto.randomBytes(12).toString('hex'),
          tenant_id: tenantId,
          integration_id: integrationId,
          square_catalog_object_id: v.id,
          square_item_variation_id: v.id,
          ...mapData,
        },
      });
    }
  }
  return { matched, unmatched };
}

/** Per-integration stock pull → reconcile → SWIS push → sync log. */
export async function syncSquareIntegration(
  integration: SquareIntegrationRow,
): Promise<{ updated: number; skipped: number; swisPushed: number; error?: string }> {
  const startedAt = Date.now();
  let status = 'success';
  let itemsProcessed = 0;
  let itemsSucceeded = 0;
  let itemsFailed = 0;
  let errorMessage: string | null = null;
  let swisPushed = 0;
  let swisSkipped = 0;

  try {
    const accessToken = await squareOAuth.getValidAccessToken(integration.tenant_id);
    const client = new SquareClientService({
      accessToken,
      environment: (unifiedConfig.squareEnvironment || 'sandbox') as 'sandbox' | 'production',
    } as any);

    const mappings = await prisma.square_product_mappings_list.findMany({
      where: {
        integration_id: integration.id,
        sync_status: 'matched',
        square_item_variation_id: { not: null },
        inventory_item_id: { not: '' },
      },
      select: { square_item_variation_id: true, inventory_item_id: true },
    });
    itemsProcessed = mappings.length;

    const locationId = integration.location_id;
    if (mappings.length > 0 && locationId) {
      const inventoryApi = client.getInventoryApi();
      const counts: any[] = [];
      let cursor: string | undefined;
      const variationIds = mappings.map((m) => m.square_item_variation_id!);
      // batchRetrieveInventoryCounts accepts up to 1000 ids per call.
      for (let i = 0; i < variationIds.length; i += 1000) {
        do {
          const res = await inventoryApi.batchRetrieveInventoryCounts({
            catalogObjectIds: variationIds.slice(i, i + 1000),
            locationIds: [locationId],
            cursor,
          });
          counts.push(...(res.counts || res.counts_list || []));
          cursor = res.cursor;
        } while (cursor);
      }

      const { diffs, unmatched } = buildStockDiffs(counts, mappings);
      itemsFailed += unmatched;
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
    if (/\b401\b|unauthorized/i.test(errorMessage || '')) {
      status = 'token_expired';
      errorMessage = 'square access token rejected — reconnect required';
    }
  }

  await prisma.square_integrations_list.update({
    where: { id: integration.id },
    data: { last_sync_at: new Date(), last_error: errorMessage },
  });

  await prisma.square_sync_logs_list.create({
    data: {
      id: crypto.randomBytes(12).toString('hex'),
      tenant_id: integration.tenant_id,
      integration_id: integration.id,
      sync_type: 'inventory',
      direction: 'pull',
      operation: 'stock_sync_poll',
      status,
      error_message: errorMessage,
      response_payload: {
        itemsProcessed,
        itemsSucceeded,
        itemsFailed,
        swisPushed,
        swisSkipped,
      } as any,
      items_affected: itemsSucceeded,
      duration_ms: Date.now() - startedAt,
      updated_at: new Date(),
    } as any,
  });

  return { updated: itemsSucceeded, skipped: itemsFailed, swisPushed, error: errorMessage || undefined };
}

/**
 * Persist the OAuth exchange into square_integrations_list + run the
 * first catalog mapping. Called from the OAuth callback — best-effort by
 * contract: the connection exists in oauth_tokens regardless, so a
 * partial failure here is logged, never thrown back at the redirect.
 */
export async function provisionSquareIntegration(tenantId: string): Promise<{
  integrationId: string | null;
  matched: number;
  unmatched: number;
}> {
  try {
    const accessToken = await squareOAuth.getValidAccessToken(tenantId);
    const tokenRow = await prisma.oauth_tokens.findFirst({
      where: { tenant_id: tenantId, gateway_type: 'square' },
      select: { merchant_id: true },
    });
    const environment = (unifiedConfig.squareEnvironment || 'sandbox') as 'sandbox' | 'production';
    const client = new SquareClientService({ accessToken, environment } as any);

    const locations = await client.listLocations();
    const active = (locations.locations || []).find((l: any) => l.status === 'ACTIVE')
      || (locations.locations || [])[0];

    const existing = await prisma.square_integrations_list.findFirst({
      where: { tenant_id: tenantId },
    });
    const data = {
      access_token: accessToken,
      merchant_id: tokenRow?.merchant_id || 'unknown',
      location_id: active?.id || null,
      scopes: ['ITEMS_READ', 'INVENTORY_READ', 'MERCHANT_PROFILE_READ'],
      mode: environment,
      enabled: true,
      last_error: null,
      updated_at: new Date(),
    };
    const integration = existing
      ? await prisma.square_integrations_list.update({ where: { id: existing.id }, data })
      : await prisma.square_integrations_list.create({
          data: {
            id: crypto.randomBytes(12).toString('hex'),
            tenant_id: tenantId,
            ...data,
          },
        });

    const mapping = await mapSquareCatalogToInventory(tenantId, integration.id, client);
    return { integrationId: integration.id, ...mapping };
  } catch (err) {
    logger.warn('[Square] provisionSquareIntegration failed (non-fatal)', undefined, {
      tenantId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { integrationId: null, matched: 0, unmatched: 0 };
  }
}
