/**
 * Meta Commerce Catalog Sync Service
 * Phase 2A: Meta Commerce Integration
 *
 * Syncs products from platform to Meta Commerce Manager:
 * - Push individual products via Catalog Batch API
 * - Batch product uploads
 * - Inventory/stock updates
 * - Price updates
 *
 * Follows GMCProductSync.ts pattern.
 * Uses Meta Graph API v21.0 Catalog Batch API.
 */

import { prisma } from '../prisma';
import { decryptToken } from '../lib/meta/oauth';
import { generateMetaProductFeed } from '../lib/meta/feed-generator';

const META_GRAPH_URL = 'https://graph.facebook.com/v21.0';

interface SyncResult {
  success: boolean;
  productId: string;
  retailerId: string;
  error?: string;
}

interface BatchSyncResult {
  success: boolean;
  total: number;
  synced: number;
  failed: number;
  results: SyncResult[];
}

/**
 * Get valid Meta access token for a tenant
 */
async function getValidAccessToken(tenantId: string): Promise<{ token: string; catalogId: string } | null> {
  try {
    const account = await prisma.meta_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: {
        meta_oauth_tokens_list: true,
      },
    });

    if (!account?.meta_oauth_tokens_list) {
      console.log(`[MetaCatalogSync] No OAuth token for tenant ${tenantId}`);
      return null;
    }

    if (!account.catalog_id) {
      console.log(`[MetaCatalogSync] No catalog_id set for tenant ${tenantId}`);
      return null;
    }

    const tokenRecord = account.meta_oauth_tokens_list;
    const token = decryptToken(tokenRecord.access_token_encrypted);

    // Meta long-lived tokens don't have a refresh flow — we just check expiry
    const now = new Date();
    if (tokenRecord.expires_at <= now) {
      console.warn(`[MetaCatalogSync] Token expired for tenant ${tenantId} — re-authorization required`);
      return null;
    }

    return { token, catalogId: account.catalog_id };
  } catch (error) {
    console.error(`[MetaCatalogSync] Error getting token for tenant ${tenantId}:`, error);
    return null;
  }
}

/**
 * Sync a single product to Meta Commerce via Catalog Batch API
 */
export async function syncProduct(tenantId: string, item: any): Promise<SyncResult> {
  const auth = await getValidAccessToken(tenantId);
  if (!auth) {
    return {
      success: false,
      productId: item.id,
      retailerId: item.sku || item.id,
      error: 'Not authenticated to Meta Commerce',
    };
  }

  const feedItem = convertToMetaBatchRequest(item, 'CREATE');

  try {
    const response = await fetch(`${META_GRAPH_URL}/${auth.catalogId}/items_batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: auth.token,
        item_type: 'PRODUCT_ITEM',
        requests: [feedItem],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MetaCatalogSync] Product sync failed for ${item.id}:`, errorText);
      return {
        success: false,
        productId: item.id,
        retailerId: item.sku || item.id,
        error: errorText,
      };
    }

    const result = await response.json() as any;
    if (result.errors?.length > 0) {
      return {
        success: false,
        productId: item.id,
        retailerId: item.sku || item.id,
        error: JSON.stringify(result.errors),
      };
    }

    return {
      success: true,
      productId: item.id,
      retailerId: item.sku || item.id,
    };
  } catch (error) {
    console.error(`[MetaCatalogSync] Product sync error for ${item.id}:`, error);
    return {
      success: false,
      productId: item.id,
      retailerId: item.sku || item.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch sync multiple products to Meta Commerce
 */
export async function batchSyncProducts(tenantId: string, items: any[]): Promise<BatchSyncResult> {
  const auth = await getValidAccessToken(tenantId);
  if (!auth) {
    return {
      success: false,
      total: items.length,
      synced: 0,
      failed: items.length,
      results: items.map(item => ({
        success: false,
        productId: item.id,
        retailerId: item.sku || item.id,
        error: 'Not authenticated to Meta Commerce',
      })),
    };
  }

  // Meta Batch API allows up to 1000 items per request
  const BATCH_SIZE = 500;
  const results: SyncResult[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const requests = batch.map(item => convertToMetaBatchRequest(item, 'CREATE'));

    try {
      const response = await fetch(`${META_GRAPH_URL}/${auth.catalogId}/items_batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: auth.token,
          item_type: 'PRODUCT_ITEM',
          requests,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[MetaCatalogSync] Batch sync failed for batch ${i}:`, errorText);
        batch.forEach(item => {
          results.push({
            success: false,
            productId: item.id,
            retailerId: item.sku || item.id,
            error: errorText,
          });
        });
        continue;
      }

      const result = await response.json() as any;
      const errors = result.errors || [];

      batch.forEach((item, idx) => {
        const itemError = errors.find((e: any) => e.line_number === idx);
        results.push({
          success: !itemError,
          productId: item.id,
          retailerId: item.sku || item.id,
          error: itemError ? JSON.stringify(itemError) : undefined,
        });
      });
    } catch (error) {
      console.error(`[MetaCatalogSync] Batch sync error for batch ${i}:`, error);
      batch.forEach(item => {
        results.push({
          success: false,
          productId: item.id,
          retailerId: item.sku || item.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }
  }

  const synced = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.info(`[MetaCatalogSync] Batch sync complete for tenant ${tenantId}: ${synced} synced, ${failed} failed`);

  return {
    success: failed === 0,
    total: items.length,
    synced,
    failed,
    results,
  };
}

/**
 * Update inventory (stock levels) for products in Meta catalog
 */
export async function updateInventory(tenantId: string, items: any[]): Promise<BatchSyncResult> {
  const auth = await getValidAccessToken(tenantId);
  if (!auth) {
    return {
      success: false,
      total: items.length,
      synced: 0,
      failed: items.length,
      results: items.map(item => ({
        success: false,
        productId: item.id,
        retailerId: item.sku || item.id,
        error: 'Not authenticated to Meta Commerce',
      })),
    };
  }

  const requests = items.map(item => ({
    method: 'UPDATE' as const,
    retailer_id: item.sku || item.id,
    data: {
      availability: (item.stock ?? 0) > 0 ? 'in stock' : 'out of stock',
    },
  }));

  try {
    const response = await fetch(`${META_GRAPH_URL}/${auth.catalogId}/items_batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: auth.token,
        item_type: 'PRODUCT_ITEM',
        requests,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        total: items.length,
        synced: 0,
        failed: items.length,
        results: items.map(item => ({
          success: false,
          productId: item.id,
          retailerId: item.sku || item.id,
          error: errorText,
        })),
      };
    }

    return {
      success: true,
      total: items.length,
      synced: items.length,
      failed: 0,
      results: items.map(item => ({
        success: true,
        productId: item.id,
        retailerId: item.sku || item.id,
      })),
    };
  } catch (error) {
    return {
      success: false,
      total: items.length,
      synced: 0,
      failed: items.length,
      results: items.map(item => ({
        success: false,
        productId: item.id,
        retailerId: item.sku || item.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })),
    };
  }
}

/**
 * Update pricing for products in Meta catalog
 */
export async function updatePricing(tenantId: string, items: any[]): Promise<BatchSyncResult> {
  const auth = await getValidAccessToken(tenantId);
  if (!auth) {
    return {
      success: false,
      total: items.length,
      synced: 0,
      failed: items.length,
      results: items.map(item => ({
        success: false,
        productId: item.id,
        retailerId: item.sku || item.id,
        error: 'Not authenticated to Meta Commerce',
      })),
    };
  }

  const requests = items.map(item => {
    const priceCents = Number(item.price_cents) || 0;
    const data: any = {
      price: `${(priceCents / 100).toFixed(2)} USD`,
    };
    const salePriceCents = Number(item.sale_price_cents) || 0;
    if (salePriceCents > 0 && salePriceCents < priceCents) {
      data.sale_price = `${(salePriceCents / 100).toFixed(2)} USD`;
    }
    return {
      method: 'UPDATE' as const,
      retailer_id: item.sku || item.id,
      data,
    };
  });

  try {
    const response = await fetch(`${META_GRAPH_URL}/${auth.catalogId}/items_batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: auth.token,
        item_type: 'PRODUCT_ITEM',
        requests,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        total: items.length,
        synced: 0,
        failed: items.length,
        results: items.map(item => ({
          success: false,
          productId: item.id,
          retailerId: item.sku || item.id,
          error: errorText,
        })),
      };
    }

    return {
      success: true,
      total: items.length,
      synced: items.length,
      failed: 0,
      results: items.map(item => ({
        success: true,
        productId: item.id,
        retailerId: item.sku || item.id,
      })),
    };
  } catch (error) {
    return {
      success: false,
      total: items.length,
      synced: 0,
      failed: items.length,
      results: items.map(item => ({
        success: false,
        productId: item.id,
        retailerId: item.sku || item.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })),
    };
  }
}

/**
 * Full catalog sync — fetch all active/public products and push to Meta
 */
export async function fullCatalogSync(tenantId: string): Promise<BatchSyncResult> {
  const feed = await generateMetaProductFeed(tenantId);

  // Fetch full items from DB for sync
  const items = await prisma.inventory_items.findMany({
    where: {
      tenant_id: tenantId,
      item_status: 'active',
      visibility: 'public',
    },
  });

  console.info(`[MetaCatalogSync] Starting full catalog sync for tenant ${tenantId}: ${items.length} items`);

  return batchSyncProducts(tenantId, items);
}

/**
 * Convert platform inventory item to Meta Catalog Batch API request format
 */
function convertToMetaBatchRequest(item: any, method: 'CREATE' | 'UPDATE'): any {
  const priceCents = Number(item.price_cents) || 0;
  const salePriceCents = Number(item.sale_price_cents) || 0;
  const inStock = (item.stock ?? 0) > 0;

  const normalizedCondition = (() => {
    const c = item?.condition;
    if (c === 'brand_new' || c === 'new') return 'new';
    if (c === 'refurbished') return 'refurbished';
    if (c === 'used') return 'used';
    return 'new';
  })();

  const metadata = item.metadata as any || {};
  const baseUrl = process.env.WEB_URL || 'https://visibleshelf.com';

  const data: any = {
    retailer_id: item.sku || item.id,
    name: item.name || item.title || '',
    description: (item.description || item.name || '').slice(0, 9999),
    availability: inStock ? 'in stock' : 'out of stock',
    condition: normalizedCondition,
    price: `${(priceCents / 100).toFixed(2)} USD`,
    currency: 'USD',
    url: metadata.product_url || `${baseUrl}/products/${item.id}`,
    image_url: item.image_url || metadata.primary_image_url || '',
    brand: item.brand || 'Unknown',
    item_group_id: item.id,
  };

  if (salePriceCents > 0 && salePriceCents < priceCents) {
    data.sale_price = `${(salePriceCents / 100).toFixed(2)} USD`;
  }

  if (metadata.color) data.color = metadata.color;
  if (metadata.size) data.size = metadata.size;
  if (metadata.gtin) data.gtin = metadata.gtin;
  if (metadata.mpn) data.mpn = metadata.mpn;
  if (metadata.google_product_category) data.google_product_category = metadata.google_product_category;

  if (metadata.additional_images && Array.isArray(metadata.additional_images)) {
    data.additional_image_urls = metadata.additional_images.slice(0, 10);
  }

  return {
    method,
    retailer_id: item.sku || item.id,
    data,
  };
}
