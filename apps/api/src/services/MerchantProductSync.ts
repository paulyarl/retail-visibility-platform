/**
 * MerchantProductSync — Merchant API product write path.
 *
 * Spec: docs/LocalBiz/GMC_MERCHANT_API_SWIS_SPEC.md §5
 * Replaces services/GMCProductSync.ts (Content API) as the single sync impl.
 * Absorbs the variant mapping from VariantAwareGMCSync (itemGroupId + attrs).
 *
 * What changed vs the Content API version:
 * - products.insert/custombatch -> productInputs:insert (one call per product,
 *   concurrency-limited; Merchant API has no batch endpoint)
 * - channel:'online' -> includedDestinations on productAttributes
 * - price {value,currency} -> {amountMicros, currencyCode}
 * - gtin -> gtins[], availability 'in stock' -> 'in_stock' (feed-spec value)
 * - delete -> productInputs.delete on the encoded name
 */

import { prisma } from '../prisma';
import { getEffectivePlatform } from '../utils/effectiveFlags';
import { canonicalStorefrontBaseUrl, resolveStorefrontCanonical } from '../lib/storefront-url';
import { validateProductForGMC } from './GMCValidationService';
import { logger } from '../logger';
import {
  MerchantContext,
  MerchantApiError,
  getMerchantContext,
  ensurePrimaryDataSource,
  insertProductInput,
  deleteProductInput,
  insertLocalInventory,
  deleteLocalInventory,
  type LocalInventoryInput,
} from '../lib/google/merchant-api';

const GMC_SYNCABLE_PRODUCT_TYPES = ['physical', 'hybrid'] as const;
const CONTENT_LANGUAGE = 'en';
const FEED_LABEL = 'US';
const CURRENCY = 'USD';
const SYNC_CONCURRENCY = 10;
const MAX_ADDITIONAL_IMAGES = 10;

export interface SyncResult {
  success: boolean;
  productId: string;
  offerId: string;
  error?: string;
  product?: string; // processed product resource name
  variantsSynced?: number;
  variantsFailed?: number;
  validationWarnings?: Array<{ field: string; message: string }>;
}

export interface BatchSyncResult {
  success: boolean;
  total: number;
  synced: number;
  failed: number;
  results: SyncResult[];
  validationSummary?: { errors: number; warnings: number };
}

/** Feature flag gate — defaults to the new path (legacy Content API is being decommissioned). */
export async function isMerchantApiEnabled(): Promise<boolean> {
  try {
    const eff = await getEffectivePlatform('FF_MERCHANT_API');
    return eff?.effectiveOn ?? true;
  } catch {
    return true;
  }
}

function toMicros(cents: number | null | undefined): string {
  return String(Math.round((cents ?? 0) * 10000));
}

function mapAvailability(stockQuantity: number | null | undefined): string {
  return (stockQuantity ?? 0) > 0 ? 'in_stock' : 'out_of_stock';
}

function mapCondition(condition: string | null | undefined): string {
  switch (condition) {
    case 'refurbished': return 'REFURBISHED';
    case 'used': return 'USED';
    default: return 'NEW';
  }
}

interface MerchantSettings {
  fulfillmentMode?: string;
  pickupMethod?: string;
  pickupSla?: string;
  /** spec §6.4: merchant opted in to broadcasting in-store stock */
  swisEnabled?: boolean;
  storeCode?: string;
}

/**
 * Convert an inventory item (+ optional variant) to a Merchant API
 * ProductInput. Ported from GMCProductSync.convertToGoogleProduct.
 */
export function convertToProductInput(
  item: any,
  websiteUrl: string,
  options?: { variant?: any; localDestinations?: boolean } & MerchantSettings,
): Record<string, unknown> {
  const variant = options?.variant;
  const offerId = variant
    ? (variant.sku || `${item.sku || item.id}-${variant.id.slice(-6)}`)
    : (item.sku || item.id);

  const attrs: Record<string, unknown> = {
    title: variant ? `${item.name || item.title} - ${variant.variant_name}` : (item.name || item.title),
    description: item.description || item.name || '',
    link: item.product_url || `${websiteUrl}/products/${item.id}`,
    imageLink: (variant?.image_url) || item.image_url || item.primary_image_url || '',
    availability: variant
      ? mapAvailability(variant.stock ?? variant.stock_quantity)
      : mapAvailability(item.stock_quantity ?? item.stock),
    condition: mapCondition(item.condition),
  };

  // Price (micros). Variant price overrides parent.
  const priceCents = variant?.price_cents != null ? variant.price_cents : item.price_cents;
  attrs.price = { amountMicros: toMicros(priceCents), currencyCode: CURRENCY };

  const saleCents = variant?.sale_price_cents ?? item.sale_price_cents;
  if (saleCents != null && saleCents < (priceCents ?? 0)) {
    attrs.salePrice = { amountMicros: toMicros(saleCents), currencyCode: CURRENCY };
  }

  // Destinations — online always; local only for SWIS-selected items (spec §6.4)
  const destinations = ['FREE_LISTINGS', 'SHOPPING_ADS'];
  if (options?.localDestinations) destinations.push('FREE_LOCAL_LISTINGS');
  attrs.includedDestinations = destinations;

  // Pickup intent (in-store pickup scenarios) — stays a product attribute for
  // online offers; the local-inventory instance carries its own (spec §5.4).
  const mode = options?.fulfillmentMode || 'standard';
  if (mode === 'pickup_only' || mode === 'shipping_and_pickup') {
    attrs.pickupMethod = options?.pickupMethod || 'buy';
    attrs.pickupSla = options?.pickupSla || 'same day';
  }

  const gtin = item.gtin || item.upc || item.barcode;
  if (item.brand) attrs.brand = item.brand;
  if (gtin) attrs.gtins = [gtin];
  if (item.mpn) attrs.mpn = item.mpn;

  const additional = (item.additional_images || []).slice(0, MAX_ADDITIONAL_IMAGES);
  if (additional.length > 0) attrs.additionalImageLinks = additional;

  if (item.google_product_category_id) {
    attrs.googleProductCategory = item.google_product_category_id;
  }
  if (item.category_path) attrs.productTypes = [item.category_path];

  if (variant) {
    attrs.itemGroupId = item.sku || item.id;
    const variantAttrs = variant.attributes || {};
    const attrMap: Record<string, string> = {
      color: 'color', size: 'size', pattern: 'pattern',
      material: 'material', gender: 'gender', age_group: 'ageGroup',
    };
    for (const [key, apiKey] of Object.entries(attrMap)) {
      if (variantAttrs[key]) attrs[apiKey] = variantAttrs[key];
    }
  }

  // Badge types -> custom labels (same mapping as the Content API version)
  const badgeTypes: string[] = item.featured_type_array || (item.featured_type ? [item.featured_type] : []);
  for (let i = 0; i < Math.min(badgeTypes.length, 5); i++) {
    attrs[`customLabel${i}`] = badgeTypes[i];
  }

  const input: Record<string, unknown> = {
    offerId,
    contentLanguage: CONTENT_LANGUAGE,
    feedLabel: FEED_LABEL,
    productAttributes: attrs,
  };

  // identifierExists isn't a ProductAttributes field in Merchant API — the
  // generic customAttributes channel is the documented escape hatch for
  // attributes the typed schema doesn't expose.
  if (!gtin && !item.mpn) {
    input.customAttributes = [{ name: 'identifier exists', value: 'no' }];
  }

  return input;
}

async function getMerchantSettings(tenantId: string): Promise<MerchantSettings> {
  const merchantLink = await prisma.google_merchant_links_list.findFirst({
    where: { is_active: true, google_oauth_accounts_list: { tenant_id: tenantId } },
    select: { fulfillment_mode: true, pickup_only: true, pickup_method: true, pickup_sla: true, swis_enabled: true, store_code: true },
  });
  return {
    fulfillmentMode: merchantLink?.fulfillment_mode || (merchantLink?.pickup_only ? 'pickup_only' : 'standard'),
    pickupMethod: merchantLink?.pickup_method || undefined,
    pickupSla: merchantLink?.pickup_sla || undefined,
    swisEnabled: merchantLink?.swis_enabled ?? false,
    storeCode: merchantLink?.store_code || undefined,
  };
}

async function resolveWebsiteUrl(tenantId: string): Promise<string | null> {
  const canonicalBase = canonicalStorefrontBaseUrl(await resolveStorefrontCanonical(tenantId));
  if (canonicalBase) return canonicalBase;
  const profile = await prisma.tenant_business_profiles_list.findFirst({
    where: { tenant_id: tenantId },
    select: { website: true },
  });
  return profile?.website || null;
}

async function markItemSync(itemId: string, ok: boolean, error?: string): Promise<void> {
  const item = await prisma.inventory_items.findUnique({ where: { id: itemId }, select: { metadata: true, sku: true } });
  const metadata = { ...(item?.metadata as any || {}) };
  if (ok) {
    metadata.gmc_sync_error = null;
    metadata.gmc_item_id = item?.sku || itemId;
  } else {
    metadata.gmc_sync_error = error || 'unknown_error';
  }
  const now = new Date();
  await prisma.inventory_items.update({
    where: { id: itemId },
    data: {
      sync_status: ok ? 'success' : 'error',
      synced_at: ok ? now : null,
      metadata,
      updated_at: now,
    } as any,
  });

  // Durable per-destination state (spec §6.5) — the retry job sweeps this,
  // not the item row. Product-level rows carry product_variant_id NULL.
  const stateId = `sync_${itemId}_online`;
  const existing = await prisma.gmc_item_sync_state.findUnique({ where: { id: stateId } });
  if (existing) {
    await prisma.gmc_item_sync_state.update({
      where: { id: stateId },
      data: ok
        ? { status: 'synced', last_synced_at: now, last_attempt_at: now, last_error: null, retry_count: 0, updated_at: now }
        : { status: 'error', last_error: error || 'unknown_error', last_error_at: now, last_attempt_at: now, retry_count: { increment: 1 }, updated_at: now },
    });
  } else {
    await prisma.gmc_item_sync_state.create({
      data: {
        id: stateId,
        inventory_item_id: itemId,
        destination: 'online',
        google_id: item?.sku || itemId,
        status: ok ? 'synced' : 'error',
        last_error: ok ? null : (error || 'unknown_error'),
        last_error_at: ok ? null : now,
        retry_count: ok ? 0 : 1,
        last_attempt_at: now,
        last_synced_at: ok ? now : null,
      },
    });
  }
}

async function syncOneItem(
  tenantId: string,
  ctx: MerchantContext,
  dataSource: string,
  websiteUrl: string,
  settings: MerchantSettings,
  item: any,
): Promise<SyncResult> {
  const offerId = item.sku || item.id;
  const variants = await prisma.product_variants.findMany({
    where: { parent_item_id: item.id, is_active: true },
    take: 100,
  });

  // spec §6.4: the local destination is per-product selection + account opt-in
  const localActive = !!item.swis_listed && !!settings.swisEnabled && !!settings.storeCode;

  const inputs = [
    convertToProductInput(item, websiteUrl, { ...settings, localDestinations: localActive }),
    ...variants.map(v => convertToProductInput(item, websiteUrl, { ...settings, variant: v, localDestinations: localActive })),
  ];

  let variantsSynced = 0;
  let variantsFailed = 0;
  let product: string | undefined;

  for (const [index, input] of inputs.entries()) {
    try {
      const result = await insertProductInput(ctx.token, ctx.merchantId, dataSource, input);
      if (index === 0) product = result?.product || undefined;
      else variantsSynced++;
    } catch (err) {
      if (index === 0) throw err;
      variantsFailed++;
      logger.error(`[MerchantProductSync] Variant ${(input as any).offerId} failed:`, undefined, { error: { name: (err as any)?.name || 'Error', message: (err as any)?.message || String(err), stack: (err as any)?.stack } });
    }
  }

  // Local inventory upsert for SWIS-selected items — per storeCode, parent
  // offer only in v1 (variant local inventory uses the same path with the
  // variant offerId; scheduled for the multi-offer pass).
  if (localActive) {
    await upsertLocalInventoryForItem(tenantId, item.id, settings.storeCode!);
  }

  return { success: true, productId: item.id, offerId, product, variantsSynced, variantsFailed };
}

/** Sync a single item to Merchant Center. */
export async function syncProductToMerchant(tenantId: string, itemId: string): Promise<SyncResult> {
  try {
    const ctx = await getMerchantContext(tenantId);
    if (!ctx) return { success: false, productId: itemId, offerId: '', error: 'No valid access token or merchant link' };

    const item = await prisma.inventory_items.findUnique({ where: { id: itemId } });
    if (!item) return { success: false, productId: itemId, offerId: '', error: 'Item not found' };

    const websiteUrl = await resolveWebsiteUrl(tenantId);
    if (!websiteUrl) {
      return { success: false, productId: itemId, offerId: '', error: 'Storefront not published: tenant needs a domain, subdomain, or website before GMC sync' };
    }

    const validation = validateProductForGMC(item);
    if (validation.errors > 0) {
      const error = `Validation failed: ${validation.issues.filter(i => i.severity === 'error').map(i => i.message).join('; ')}`;
      await markItemSync(itemId, false, error);
      return { success: false, productId: itemId, offerId: item.sku || itemId, error };
    }

    const dataSource = await ensurePrimaryDataSource(ctx.token, ctx.merchantId, CONTENT_LANGUAGE, FEED_LABEL);
    const settings = await getMerchantSettings(tenantId);
    const result = await syncOneItem(tenantId, ctx, dataSource, websiteUrl, settings, item);
    await markItemSync(itemId, true);
    result.validationWarnings = validation.issues
      .filter(i => i.severity === 'warning')
      .map(i => ({ field: i.field, message: i.message }));
    return result;
  } catch (error: any) {
    logger.error(`[MerchantProductSync] Error syncing ${itemId}:`, undefined, { error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack } });
    try { await markItemSync(itemId, false, error?.message); } catch { /* ignore secondary failure */ }
    return { success: false, productId: itemId, offerId: '', error: error?.message };
  }
}

/** Batch sync — concurrency-limited per-product inserts (no custombatch). */
export async function batchSyncToMerchant(tenantId: string, itemIds?: string[]): Promise<BatchSyncResult> {
  try {
    const ctx = await getMerchantContext(tenantId);
    if (!ctx) {
      return { success: false, total: 0, synced: 0, failed: 1, results: [{ success: false, productId: '', offerId: '', error: 'No valid access token or merchant link' }] };
    }

    // Unified eligibility (spec §6.5): Google shows exactly what the public
    // catalog shows — active + public + syncable types only.
    const whereClause: any = {
      tenant_id: tenantId,
      item_status: 'active',
      visibility: 'public',
      product_type: { in: [...GMC_SYNCABLE_PRODUCT_TYPES] },
      google_online_excluded: { not: true },
    };
    if (itemIds?.length) whereClause.id = { in: itemIds };

    const items = await prisma.inventory_items.findMany({ where: whereClause, take: 1000 });
    if (items.length === 0) return { success: true, total: 0, synced: 0, failed: 0, results: [] };

    const websiteUrl = await resolveWebsiteUrl(tenantId);
    if (!websiteUrl) {
      return { success: false, total: items.length, synced: 0, failed: items.length, results: [{ success: false, productId: '', offerId: '', error: 'Storefront not published' }] };
    }

    const dataSource = await ensurePrimaryDataSource(ctx.token, ctx.merchantId, CONTENT_LANGUAGE, FEED_LABEL);
    const settings = await getMerchantSettings(tenantId);

    // Badge labels for all items in one query
    const badges = await prisma.featured_products.findMany({
      where: { inventory_item_id: { in: items.map(i => i.id) }, is_active: true },
      select: { inventory_item_id: true, featured_type: true },
    });
    const badgesByItem = new Map<string, string[]>();
    for (const b of badges) {
      const arr = badgesByItem.get(b.inventory_item_id) || [];
      arr.push(b.featured_type);
      badgesByItem.set(b.inventory_item_id, arr);
    }

    const results: SyncResult[] = new Array(items.length);
    let totalValidationErrors = 0;
    let totalValidationWarnings = 0;
    let cursor = 0;

    const workers = Array.from({ length: SYNC_CONCURRENCY }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        const item: any = { ...items[i], featured_type_array: badgesByItem.get(items[i].id) || [] };

        const validation = validateProductForGMC(item);
        totalValidationErrors += validation.errors;
        totalValidationWarnings += validation.warnings;
        if (validation.errors > 0) {
          const error = `Validation failed: ${validation.issues.filter(x => x.severity === 'error').map(x => x.message).join('; ')}`;
          await markItemSync(item.id, false, error);
          results[i] = { success: false, productId: item.id, offerId: item.sku || item.id, error };
          continue;
        }

        try {
          const result = await syncOneItem(tenantId, ctx, dataSource, websiteUrl, settings, item);
          await markItemSync(item.id, true);
          results[i] = result;
        } catch (err: any) {
          await markItemSync(item.id, false, err?.message);
          results[i] = { success: false, productId: item.id, offerId: item.sku || item.id, error: err?.message };
        }
      }
    });
    await Promise.all(workers);

    const synced = results.filter(r => r?.success).length;
    const failed = results.filter(r => r && !r.success).length;
    return {
      success: failed === 0,
      total: items.length,
      synced,
      failed,
      results,
      validationSummary: { errors: totalValidationErrors, warnings: totalValidationWarnings },
    };
  } catch (error: any) {
    logger.error('[MerchantProductSync] Batch sync error:', undefined, { error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack } });
    // failed:1 — a batch-level error must not report as a clean 0/0 run; the
    // scheduled job and callers count `failed` to detect silent breakage.
    return { success: false, total: 0, synced: 0, failed: 1, results: [{ success: false, productId: '', offerId: '', error: error?.message }] };
  }
}

/**
 * Delete an item's offers (parent + active variants) from Merchant Center.
 * Idempotent — 404s are treated as success. Clears local sync state.
 */
export async function deleteFromMerchant(tenantId: string, itemId: string): Promise<SyncResult> {
  try {
    const ctx = await getMerchantContext(tenantId);
    if (!ctx) return { success: false, productId: itemId, offerId: '', error: 'No valid access token' };

    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { sku: true, swis_listed: true },
    });
    if (!item) return { success: false, productId: itemId, offerId: '', error: 'Item not found' };

    const variants = await prisma.product_variants.findMany({
      where: { parent_item_id: itemId },
      select: { sku: true, id: true },
    });

    const offerIds = [
      item.sku || itemId,
      ...variants.map(v => v.sku || `${item.sku || itemId}-${v.id.slice(-6)}`),
    ];

    let firstError: string | undefined;
    for (const offerId of offerIds) {
      try {
        await deleteProductInput(ctx.token, ctx.merchantId, offerId, CONTENT_LANGUAGE, FEED_LABEL);
      } catch (err: any) {
        firstError = firstError || err?.message;
        logger.error(`[MerchantProductSync] Delete ${offerId} failed:`, undefined, { error: { name: err?.name || 'Error', message: err?.message || String(err), stack: err?.stack } });
      }
    }

    // SWIS-selected items also drop their local inventory instances — an
    // eligibility loss is a full removal, not an online-only one (spec §6.5).
    if (item.swis_listed) {
      const link = await prisma.google_merchant_links_list.findFirst({
        where: { is_active: true, google_oauth_accounts_list: { tenant_id: tenantId } },
        select: { store_code: true },
      });
      if (link?.store_code) {
        for (const offerId of offerIds) {
          try {
            await deleteLocalInventory(ctx.token, ctx.merchantId, offerId, link.store_code, CONTENT_LANGUAGE, FEED_LABEL);
          } catch (err: any) {
            firstError = firstError || err?.message;
            logger.error(`[MerchantProductSync] Local inventory delete ${offerId} failed:`, undefined, { error: { name: err?.name || 'Error', message: err?.message || String(err), stack: err?.stack } });
          }
        }
      }
    }

    if (!firstError) {
      await prisma.inventory_items.update({
        where: { id: itemId },
        data: { sync_status: null, synced_at: null, updated_at: new Date() },
      });
    }

    return { success: !firstError, productId: itemId, offerId: item.sku || itemId, error: firstError };
  } catch (error: any) {
    logger.error(`[MerchantProductSync] Error deleting ${itemId}:`, undefined, { error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack } });
    return { success: false, productId: itemId, offerId: '', error: error?.message };
  }
}

/**
 * Local inventory upsert for a SWIS-selected item (Phase 2 callers).
 * Caller supplies the resolved storeCode; gating (swis_listed/swis_enabled/
 * readiness) is enforced upstream per spec §6.2/§6.4.
 */
export async function upsertLocalInventoryForItem(
  tenantId: string,
  itemId: string,
  storeCode: string,
): Promise<SyncResult> {
  try {
    const ctx = await getMerchantContext(tenantId);
    if (!ctx) return { success: false, productId: itemId, offerId: '', error: 'No valid access token' };

    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { sku: true, price_cents: true, sale_price_cents: true, stock: true },
    });
    if (!item) return { success: false, productId: itemId, offerId: '', error: 'Item not found' };

    const settings = await getMerchantSettings(tenantId);
    const inventory: LocalInventoryInput = {
      storeCode,
      price: { amountMicros: toMicros(item.price_cents), currencyCode: CURRENCY },
      availability: mapAvailability(item.stock) === 'in_stock' ? 'IN_STOCK' : 'OUT_OF_STOCK',
      quantity: Math.max(0, item.stock ?? 0),
    };
    if (item.sale_price_cents != null && item.sale_price_cents < (item.price_cents ?? 0)) {
      inventory.salePrice = { amountMicros: toMicros(item.sale_price_cents), currencyCode: CURRENCY };
    }
    const mode = settings.fulfillmentMode || 'standard';
    if (mode === 'pickup_only' || mode === 'shipping_and_pickup') {
      inventory.pickupMethod = settings.pickupMethod || 'buy';
      inventory.pickupSla = settings.pickupSla || 'same day';
    }

    const offerId = item.sku || itemId;
    await insertLocalInventory(ctx.token, ctx.merchantId, offerId, inventory, CONTENT_LANGUAGE, FEED_LABEL);
    return { success: true, productId: itemId, offerId };
  } catch (error: any) {
    const message = error instanceof MerchantApiError ? error.message : (error?.message || 'local inventory failed');
    logger.error(`[MerchantProductSync] Local inventory ${itemId}:`, undefined, { error: { name: error?.name || 'Error', message, stack: error?.stack } });
    return { success: false, productId: itemId, offerId: '', error: message };
  }
}

export async function deleteLocalInventoryForItem(
  tenantId: string,
  itemId: string,
  storeCode: string,
): Promise<SyncResult> {
  try {
    const ctx = await getMerchantContext(tenantId);
    if (!ctx) return { success: false, productId: itemId, offerId: '', error: 'No valid access token' };
    const item = await prisma.inventory_items.findUnique({ where: { id: itemId }, select: { sku: true } });
    const offerId = item?.sku || itemId;
    await deleteLocalInventory(ctx.token, ctx.merchantId, offerId, storeCode, CONTENT_LANGUAGE, FEED_LABEL);
    return { success: true, productId: itemId, offerId };
  } catch (error: any) {
    logger.error(`[MerchantProductSync] Local inventory delete ${itemId}:`, undefined, { error: { name: error?.name || 'Error', message: error?.message || String(error), stack: error?.stack } });
    return { success: false, productId: itemId, offerId: '', error: error?.message };
  }
}
