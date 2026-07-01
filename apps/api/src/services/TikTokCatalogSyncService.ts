/**
 * TikTok Shop Catalog Sync Service
 * Phase 2B: TikTok Shop Integration
 *
 * Syncs products from platform to TikTok Shop:
 * - Push individual products via Product API
 * - Batch product uploads
 * - Inventory/stock updates
 * - Price updates
 *
 * Follows MetaCatalogSyncService.ts pattern.
 */

import { prisma } from '../prisma';
import { decryptToken, refreshAccessToken, encryptToken } from '../lib/tiktok/oauth';
import { generateTikTokProductFeed } from '../lib/tiktok/feed-generator';
import { logger } from '../logger';

const TIKTOK_API_URL = 'https://open.tiktokglobalshop.com/api/v1';
const TIKTOK_APP_KEY = process.env.TIKTOK_APP_KEY || '';

interface SyncResult {
  success: boolean;
  productId: string;
  skuId: string;
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
 * Get valid TikTok access token for a tenant, refreshing if needed
 */
async function getValidAccessToken(tenantId: string): Promise<{ token: string; shopId: string } | null> {
  try {
    const account = await prisma.tiktok_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: {
        tiktok_oauth_tokens_list: true,
      },
    });

    if (!account?.tiktok_oauth_tokens_list) {
      logger.info('TikTok catalog sync: no OAuth token', undefined, { tenantId });
      return null;
    }

    if (!account.shop_id) {
      logger.info('TikTok catalog sync: no shop_id set', undefined, { tenantId });
      return null;
    }

    const tokenRecord = account.tiktok_oauth_tokens_list;
    let token = decryptToken(tokenRecord.access_token_encrypted);

    const now = new Date();
    const expiresSoon = new Date(tokenRecord.expires_at.getTime() - 5 * 60 * 1000);
    if (expiresSoon <= now && tokenRecord.refresh_token_encrypted) {
      const refreshToken = decryptToken(tokenRecord.refresh_token_encrypted);
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        token = refreshed.access_token;
        const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
        const newRefreshExpiresAt = new Date(Date.now() + refreshed.refresh_expires_in * 1000);
        await prisma.tiktok_oauth_tokens_list.update({
          where: { id: tokenRecord.id },
          data: {
            access_token_encrypted: encryptToken(refreshed.access_token),
            refresh_token_encrypted: refreshed.refresh_token ? encryptToken(refreshed.refresh_token) : tokenRecord.refresh_token_encrypted,
            expires_at: newExpiresAt,
            refresh_expires_at: newRefreshExpiresAt,
            updated_at: new Date(),
          },
        });
        logger.info('TikTok catalog sync: refreshed token', undefined, { tenantId });
      } else {
        logger.warn('TikTok catalog sync: token refresh failed', undefined, { tenantId });
        return null;
      }
    } else if (tokenRecord.expires_at <= now) {
      logger.warn('TikTok catalog sync: token expired and no refresh token', undefined, { tenantId });
      return null;
    }

    return { token, shopId: account.shop_id };
  } catch (error) {
    logger.error('TikTok catalog sync: error getting token', undefined, {
      tenantId,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Sync a single product to TikTok Shop
 */
export async function syncProduct(tenantId: string, item: any): Promise<SyncResult> {
  const auth = await getValidAccessToken(tenantId);
  if (!auth) {
    return {
      success: false,
      productId: item.id,
      skuId: item.sku || item.id,
      error: 'Not authenticated to TikTok Shop',
    };
  }

  const feedItem = convertToTikTokProduct(item);

  try {
    const params = new URLSearchParams({
      app_key: TIKTOK_APP_KEY,
      access_token: auth.token,
      shop_id: auth.shopId,
    });

    const response = await fetch(`${TIKTOK_API_URL}/products/create?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(feedItem),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn('TikTok product sync failed', undefined, { productId: item.id, error: errorText });
      return {
        success: false,
        productId: item.id,
        skuId: item.sku || item.id,
        error: errorText,
      };
    }

    const result = await response.json() as any;
    if (result.code !== 0) {
      return {
        success: false,
        productId: item.id,
        skuId: item.sku || item.id,
        error: result.message || 'TikTok API error',
      };
    }

    return {
      success: true,
      productId: item.id,
      skuId: item.sku || item.id,
    };
  } catch (error) {
    logger.error('TikTok product sync error', undefined, { productId: item.id, error: error instanceof Error ? error.message : String(error) });
    return {
      success: false,
      productId: item.id,
      skuId: item.sku || item.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Batch sync multiple products to TikTok Shop
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
        skuId: item.sku || item.id,
        error: 'Not authenticated to TikTok Shop',
      })),
    };
  }

  const BATCH_SIZE = 50;
  const results: SyncResult[] = [];

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    for (const item of batch) {
      try {
        const feedItem = convertToTikTokProduct(item);
        const params = new URLSearchParams({
          app_key: TIKTOK_APP_KEY,
          access_token: auth.token,
          shop_id: auth.shopId,
        });

        const response = await fetch(`${TIKTOK_API_URL}/products/create?${params.toString()}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedItem),
        });

        if (!response.ok) {
          const errorText = await response.text();
          results.push({
            success: false,
            productId: item.id,
            skuId: item.sku || item.id,
            error: errorText,
          });
          continue;
        }

        const result = await response.json() as any;
        if (result.code !== 0) {
          results.push({
            success: false,
            productId: item.id,
            skuId: item.sku || item.id,
            error: result.message || 'TikTok API error',
          });
        } else {
          results.push({
            success: true,
            productId: item.id,
            skuId: item.sku || item.id,
          });
        }
      } catch (error) {
        results.push({
          success: false,
          productId: item.id,
          skuId: item.sku || item.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  const synced = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  logger.info('TikTok batch sync complete', undefined, { tenantId, synced, failed });

  return {
    success: failed === 0,
    total: items.length,
    synced,
    failed,
    results,
  };
}

/**
 * Update inventory (stock levels) for products in TikTok Shop
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
        skuId: item.sku || item.id,
        error: 'Not authenticated to TikTok Shop',
      })),
    };
  }

  const results: SyncResult[] = [];

  for (const item of items) {
    try {
      const params = new URLSearchParams({
        app_key: TIKTOK_APP_KEY,
        access_token: auth.token,
        shop_id: auth.shopId,
      });

      const response = await fetch(`${TIKTOK_API_URL}/inventory/update?${params.toString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku_id: item.sku || item.id,
          stock_quantity: item.stock ?? 0,
        }),
      });

      results.push({
        success: response.ok,
        productId: item.id,
        skuId: item.sku || item.id,
        error: response.ok ? undefined : await response.text(),
      });
    } catch (error) {
      results.push({
        success: false,
        productId: item.id,
        skuId: item.sku || item.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const synced = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    success: failed === 0,
    total: items.length,
    synced,
    failed,
    results,
  };
}

/**
 * Full catalog sync — fetch all active/public products and push to TikTok
 */
export async function fullCatalogSync(tenantId: string): Promise<BatchSyncResult> {
  await generateTikTokProductFeed(tenantId);

  const items = await prisma.inventory_items.findMany({
    where: {
      tenant_id: tenantId,
      item_status: 'active',
      visibility: 'public',
    },
  });

  logger.info('TikTok full catalog sync starting', undefined, { tenantId, itemCount: items.length });

  return batchSyncProducts(tenantId, items);
}

/**
 * Convert platform inventory item to TikTok Shop product format
 */
function convertToTikTokProduct(item: any): any {
  const priceCents = Number(item.price_cents) || 0;
  const salePriceCents = Number(item.sale_price_cents) || 0;
  const stock = item.stock ?? 0;
  const metadata = item.metadata as any || {};
  const baseUrl = process.env.WEB_URL || 'https://visibleshelf.com';
  const currency = item.currency || 'USD';

  const product: any = {
    sku_id: item.sku || item.id,
    product_id: item.id,
    title: item.name || item.title || '',
    description: (item.description || item.name || '').slice(0, 5000),
    main_image_url: item.image_url || metadata.primary_image_url || '',
    sub_image_urls: Array.isArray(metadata.additional_images) ? metadata.additional_images.slice(0, 5) : [],
    category_id: metadata.tiktok_category_id || '0',
    brand: item.brand || 'Unknown',
    price: { amount: (priceCents / 100).toFixed(2), currency },
    stock_quantity: stock,
    status: stock > 0 ? 'PUBLISHED' : 'UNPUBLISHED',
    condition: 'NEW',
    package_weight: { value: String(metadata.weight || '1'), unit: 'KILOGRAM' },
    package_length: { value: String(metadata.length || '10'), unit: 'CENTIMETER' },
    package_width: { value: String(metadata.width || '10'), unit: 'CENTIMETER' },
    package_height: { value: String(metadata.height || '10'), unit: 'CENTIMETER' },
    product_url: metadata.product_url || `${baseUrl}/products/${item.id}`,
  };

  if (salePriceCents > 0 && salePriceCents < priceCents) {
    product.sale_price = { amount: (salePriceCents / 100).toFixed(2), currency };
  }

  return product;
}
