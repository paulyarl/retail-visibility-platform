/**
 * Google Merchant Center - Product Feed Sync Service
 * 
 * Syncs products from platform to Google Merchant Center:
 * - Push individual products
 * - Batch product uploads
 * - Inventory/stock updates
 * - Price updates
 * 
 * Uses Content API for Shopping v2.1
 */

import { prisma } from '../prisma';
import { decryptToken, refreshAccessToken, encryptToken } from '../lib/google/oauth';

const GMC_API_BASE = 'https://shoppingcontent.googleapis.com';
const CONTENT_API_VERSION = 'v2.1';

interface ProductData {
  id: string;
  offerId: string;
  title: string;
  description: string;
  link: string;
  imageLink: string;
  additionalImageLinks?: string[];
  price: {
    value: string;
    currency: string;
  };
  salePrice?: {
    value: string;
    currency: string;
  };
  availability: 'in_stock' | 'out_of_stock' | 'preorder' | 'backorder';
  condition: 'new' | 'refurbished' | 'used';
  brand?: string;
  gtin?: string;
  mpn?: string;
  googleProductCategory?: string;
  productType?: string;
  identifierExists?: boolean;
}

interface SyncResult {
  success: boolean;
  productId: string;
  offerId: string;
  error?: string;
  googleProductId?: string;
}

interface BatchSyncResult {
  success: boolean;
  total: number;
  synced: number;
  failed: number;
  results: SyncResult[];
}

/**
 * Get valid GMC access token for a tenant
 */
async function getValidAccessToken(tenantId: string): Promise<{ token: string; merchantId: string } | null> {
  try {
    // Get OAuth account for tenant
    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: {
        google_oauth_tokens_list: true,
        google_merchant_links_list: {
          where: { is_active: true },
          take: 1,
        },
      },
    });

    if (!account?.google_oauth_tokens_list) {
      console.log(`[GMCProductSync] No OAuth token for tenant ${tenantId}`);
      return null;
    }

    const merchantLink = account.google_merchant_links_list[0];
    if (!merchantLink) {
      console.log(`[GMCProductSync] No merchant link for tenant ${tenantId}`);
      return null;
    }

    const tokenRecord = account.google_oauth_tokens_list;

    // Check if token is expired
    const now = new Date();
    if (tokenRecord.expires_at <= now) {
      console.log('[GMCProductSync] Token expired, refreshing...');
      
      const refreshToken = decryptToken(tokenRecord.refresh_token_encrypted);
      const newTokens = await refreshAccessToken(refreshToken);
      
      if (!newTokens) {
        console.error('[GMCProductSync] Failed to refresh token');
        return null;
      }

      const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000);
      await prisma.google_oauth_tokens_list.update({
        where: { account_id: account.id },
        data: {
          access_token_encrypted: encryptToken(newTokens.access_token),
          expires_at: newExpiresAt,
          updated_at: new Date(),
        },
      });

      return { token: newTokens.access_token, merchantId: merchantLink.merchant_id };
    }

    return { 
      token: decryptToken(tokenRecord.access_token_encrypted), 
      merchantId: merchantLink.merchant_id 
    };
  } catch (error) {
    console.error(`[GMCProductSync] Error getting token for tenant ${tenantId}:`, error);
    return null;
  }
}

/**
 * Convert platform inventory item to Google Product format
 */
function convertToGoogleProduct(
  item: any,
  tenantId: string,
  websiteUrl: string,
  options?: { fulfillmentMode?: string; pickupMethod?: string; pickupSla?: string },
  targetCountry: string = 'US',
  contentLanguage: string = 'en'
): any {
  const normalizedCondition = (() => {
    const c = item?.condition;
    if (c === 'brand_new') return 'new';
    if (c === 'refurbished') return 'refurbished';
    if (c === 'used') return 'used';
    if (c === 'new') return 'new';
    return 'new';
  })();

  const price = item.price_cents ? (item.price_cents / 100).toFixed(2) : '0.00';
  const salePrice = item.sale_price_cents ? (item.sale_price_cents / 100).toFixed(2) : null;
  const availability = item.stock_quantity > 0 ? 'in stock' : 'out of stock';
  
  // Build product link
  const productLink = item.product_url || `${websiteUrl}/products/${item.id}`;
  
  // Build image link
  const imageLink = item.image_url || item.primary_image_url || '';
  
  // Additional images
  const additionalImages = (item.additional_images || []).slice(0, 10); // GMC allows max 10 additional images

  const googleProduct: any = {
    offerId: item.sku || item.id,
    title: item.name || item.title,
    description: item.description || item.name || '',
    link: productLink,
    imageLink: imageLink,
    contentLanguage: contentLanguage,
    targetCountry: targetCountry,
    channel: 'online',
    availability: availability,
    condition: normalizedCondition,
    price: {
      value: price,
      currency: 'USD',
    },
  };

  // Add sale price if available (Google will show strikethrough pricing)
  if (salePrice && parseFloat(salePrice) < parseFloat(price)) {
    googleProduct.salePrice = {
      value: salePrice,
      currency: 'USD',
    };
  }

  // Pickup intent (in-store pickup scenarios)
  const mode = options?.fulfillmentMode || 'standard';
  if (mode === 'pickup_only' || mode === 'shipping_and_pickup') {
    googleProduct.pickupMethod = options?.pickupMethod || 'buy';
    googleProduct.pickupSla = options?.pickupSla || 'same day';
  }

  // Add optional fields if present
  if (item.brand) googleProduct.brand = item.brand;
  if (item.gtin || item.upc || item.barcode) googleProduct.gtin = item.gtin || item.upc || item.barcode;
  if (item.mpn) googleProduct.mpn = item.mpn;
  if (additionalImages.length > 0) googleProduct.additionalImageLinks = additionalImages;
  
  // Google Product Category (if set)
  if (item.google_product_category_id) {
    googleProduct.googleProductCategory = item.google_product_category_id;
  }
  
  // Product type (breadcrumb path)
  if (item.category_path) {
    googleProduct.productTypes = [item.category_path];
  }

  // Identifier exists flag
  if (!item.gtin && !item.mpn && !item.brand) {
    googleProduct.identifierExists = false;
  }

  return googleProduct;
}

/**
 * Insert or update a single product in Google Merchant Center
 */
export async function syncProduct(
  tenantId: string,
  itemId: string
): Promise<SyncResult> {
  try {
    const auth = await getValidAccessToken(tenantId);
    if (!auth) {
      return { success: false, productId: itemId, offerId: '', error: 'No valid access token or merchant link' };
    }

    // Get the inventory item
    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      return { success: false, productId: itemId, offerId: '', error: 'Item not found' };
    }

    // Check if item is public (visibility = 'public')
    if (item.visibility !== 'public') {
      return { success: false, productId: itemId, offerId: item.sku || '', error: 'Item is not public' };
    }

    // Get tenant business profile for website and subdomain
    const businessProfile = await prisma.tenant_business_profiles_list.findFirst({
      where: { tenant_id: tenantId },
      select: { website: true }
    });

    // Get tenant subdomain for custom URL generation
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { subdomain: true }
    });

    // Build website URL with subdomain support
    let websiteUrl: string;
    if (tenant?.subdomain) {
      // Use tenant subdomain: https://{subdomain}.visibleshelf.com
      websiteUrl = `https://${tenant.subdomain}.visibleshelf.com`;
    } else {
      // Fallback to business profile website or default store URL
      websiteUrl = businessProfile?.website || `https://visibleshelf.com/store/${tenantId}`;
    }

    // Get merchant link settings (pickup-only, etc.)
    const merchantLink = await prisma.google_merchant_links_list.findFirst({
      where: {
        is_active: true,
        google_oauth_accounts_list: { tenant_id: tenantId },
      },
      select: {
        fulfillment_mode: true,
        pickup_only: true,
        pickup_method: true,
        pickup_sla: true,
      },
    });

    const googleProduct = convertToGoogleProduct(item, tenantId, websiteUrl, {
      fulfillmentMode: merchantLink?.fulfillment_mode || (merchantLink?.pickup_only ? 'pickup_only' : 'standard'),
      pickupMethod: merchantLink?.pickup_method || undefined,
      pickupSla: merchantLink?.pickup_sla || undefined,
    });

    // Use Content API products.insert (upserts by offerId)
    const response = await fetch(
      `${GMC_API_BASE}/content/${CONTENT_API_VERSION}/${auth.merchantId}/products`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(googleProduct),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[GMCProductSync] Failed to sync product ${itemId}:`, error);
      return { 
        success: false, 
        productId: itemId, 
        offerId: googleProduct.offerId, 
        error: `API error: ${response.status} - ${error}` 
      };
    }

    const result = await response.json() as { id?: string };
    
    // Update item with sync status
    await prisma.inventory_items.update({
      where: { id: itemId },
      data: {
        sync_status: 'success',
        synced_at: new Date(),
        updated_at: new Date(),
      },
    });

    console.log(`[GMCProductSync] Synced product ${itemId} to GMC`);
    return { 
      success: true, 
      productId: itemId, 
      offerId: googleProduct.offerId,
      googleProductId: result.id 
    };
  } catch (error: any) {
    console.error(`[GMCProductSync] Error syncing product ${itemId}:`, error);
    return { success: false, productId: itemId, offerId: '', error: error.message };
  }
}

/**
 * Batch sync multiple products to Google Merchant Center
 */
export async function batchSyncProducts(
  tenantId: string,
  itemIds?: string[]
): Promise<BatchSyncResult> {
  const results: SyncResult[] = [];
  
  try {
    const auth = await getValidAccessToken(tenantId);
    if (!auth) {
      return { 
        success: false, 
        total: 0, 
        synced: 0, 
        failed: 0, 
        results: [{ success: false, productId: '', offerId: '', error: 'No valid access token or merchant link' }] 
      };
    }

    // Get items to sync
    // Use visibility='public' for public items and exclude trashed items
    const whereClause: any = {
      tenant_id: tenantId,
      visibility: 'public',
      item_status: { not: 'trashed' },
    };

    if (itemIds && itemIds.length > 0) {
      whereClause.id = { in: itemIds };
    }

    const items = await prisma.inventory_items.findMany({
      where: whereClause,
      take: 1000, // GMC batch limit
    });

    if (items.length === 0) {
      return { success: true, total: 0, synced: 0, failed: 0, results: [] };
    }

    // Get tenant business profile for website and subdomain
    const businessProfile = await prisma.tenant_business_profiles_list.findFirst({
      where: { tenant_id: tenantId },
      select: { website: true }
    });

    // Get tenant subdomain for custom URL generation
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { subdomain: true }
    });

    // Build website URL with subdomain support
    let websiteUrl: string;
    if (tenant?.subdomain) {
      // Use tenant subdomain: https://{subdomain}.visibleshelf.com
      websiteUrl = `https://${tenant.subdomain}.visibleshelf.com`;
    } else {
      // Fallback to business profile website or default store URL
      websiteUrl = businessProfile?.website || `https://visibleshelf.com/store/${tenantId}`;
    }

    // Get merchant link settings (pickup-only, etc.)
    const merchantLink = await prisma.google_merchant_links_list.findFirst({
      where: {
        is_active: true,
        google_oauth_accounts_list: { tenant_id: tenantId },
      },
      select: {
        fulfillment_mode: true,
        pickup_only: true,
        pickup_method: true,
        pickup_sla: true,
      },
    });

    const merchantSettings = {
      fulfillmentMode: merchantLink?.fulfillment_mode || (merchantLink?.pickup_only ? 'pickup_only' : 'standard'),
      pickupMethod: merchantLink?.pickup_method || undefined,
      pickupSla: merchantLink?.pickup_sla || undefined,
    };

    // Build batch entries
    const batchEntries = items.map((item, index) => ({
      batchId: index + 1,
      merchantId: auth.merchantId,
      method: 'insert',
      product: convertToGoogleProduct(item, tenantId, websiteUrl, merchantSettings),
    }));

    // Use Content API products.custombatch for batch operations
    const response = await fetch(
      `${GMC_API_BASE}/content/${CONTENT_API_VERSION}/products/batch`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entries: batchEntries }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(`[GMCProductSync] Batch sync failed:`, error);
      return { 
        success: false, 
        total: items.length, 
        synced: 0, 
        failed: items.length, 
        results: [{ success: false, productId: '', offerId: '', error: `API error: ${response.status}` }] 
      };
    }

    const batchResult = await response.json() as { entries?: any[] };
    const entries = batchResult.entries || [];

    let synced = 0;
    let failed = 0;

    // Process batch results
    for (const entry of entries) {
      const item = items[entry.batchId - 1];
      if (!item) continue;

      if (entry.errors) {
        failed++;
        results.push({
          success: false,
          productId: item.id,
          offerId: item.sku || item.id,
          error: entry.errors.map((e: any) => e.message).join(', '),
        });

        // Update item sync status
        await prisma.inventory_items.update({
          where: { id: item.id },
          data: {
            sync_status: 'error',
            updated_at: new Date(),
          },
        });
      } else {
        synced++;
        results.push({
          success: true,
          productId: item.id,
          offerId: item.sku || item.id,
          googleProductId: entry.product?.id,
        });

        // Update item with GMC sync status
        await prisma.inventory_items.update({
          where: { id: item.id },
          data: {
            sync_status: 'success',
            synced_at: new Date(),
            updated_at: new Date(),
          },
        });
      }
    }

    console.log(`[GMCProductSync] Batch sync complete: ${synced} synced, ${failed} failed`);
    return { success: failed === 0, total: items.length, synced, failed, results };
  } catch (error: any) {
    console.error(`[GMCProductSync] Batch sync error:`, error);
    return { 
      success: false, 
      total: 0, 
      synced: 0, 
      failed: 0, 
      results: [{ success: false, productId: '', offerId: '', error: error.message }] 
    };
  }
}

/**
 * Update inventory/stock for a product
 */
export async function updateInventory(
  tenantId: string,
  itemId: string,
  quantity: number
): Promise<SyncResult> {
  try {
    const auth = await getValidAccessToken(tenantId);
    if (!auth) {
      return { success: false, productId: itemId, offerId: '', error: 'No valid access token' };
    }

    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { sku: true },
    });

    if (!item) {
      return { success: false, productId: itemId, offerId: '', error: 'Item not found' };
    }

    const offerId = item.sku || itemId;
    const availability = quantity > 0 ? 'in stock' : 'out of stock';

    // Use inventory update endpoint
    const response = await fetch(
      `${GMC_API_BASE}/content/${CONTENT_API_VERSION}/${auth.merchantId}/products/online:en:US:${offerId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          availability: availability,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, productId: itemId, offerId, error: `API error: ${response.status}` };
    }

    console.log(`[GMCProductSync] Updated inventory for ${itemId}: ${availability}`);
    return { success: true, productId: itemId, offerId };
  } catch (error: any) {
    console.error(`[GMCProductSync] Error updating inventory:`, error);
    return { success: false, productId: itemId, offerId: '', error: error.message };
  }
}

/**
 * Update price for a product
 */
export async function updatePrice(
  tenantId: string,
  itemId: string,
  priceCents: number,
  currency: string = 'USD'
): Promise<SyncResult> {
  try {
    const auth = await getValidAccessToken(tenantId);
    if (!auth) {
      return { success: false, productId: itemId, offerId: '', error: 'No valid access token' };
    }

    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { sku: true },
    });

    if (!item) {
      return { success: false, productId: itemId, offerId: '', error: 'Item not found' };
    }

    const offerId = item.sku || itemId;
    const priceValue = (priceCents / 100).toFixed(2);

    // Use product update endpoint
    const response = await fetch(
      `${GMC_API_BASE}/content/${CONTENT_API_VERSION}/${auth.merchantId}/products/online:en:US:${offerId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${auth.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price: {
            value: priceValue,
            currency: currency,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return { success: false, productId: itemId, offerId, error: `API error: ${response.status}` };
    }

    console.log(`[GMCProductSync] Updated price for ${itemId}: ${priceValue} ${currency}`);
    return { success: true, productId: itemId, offerId };
  } catch (error: any) {
    console.error(`[GMCProductSync] Error updating price:`, error);
    return { success: false, productId: itemId, offerId: '', error: error.message };
  }
}

/**
 * Delete a product from Google Merchant Center
 */
export async function deleteProduct(
  tenantId: string,
  itemId: string
): Promise<SyncResult> {
  try {
    const auth = await getValidAccessToken(tenantId);
    if (!auth) {
      return { success: false, productId: itemId, offerId: '', error: 'No valid access token' };
    }

    const item = await prisma.inventory_items.findUnique({
      where: { id: itemId },
      select: { sku: true },
    });

    if (!item) {
      return { success: false, productId: itemId, offerId: '', error: 'Item not found' };
    }

    const offerId = item.sku || itemId;

    // Delete product from GMC
    const response = await fetch(
      `${GMC_API_BASE}/content/${CONTENT_API_VERSION}/${auth.merchantId}/products/online:en:US:${offerId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${auth.token}`,
        },
      }
    );

    if (!response.ok && response.status !== 404) {
      const error = await response.text();
      return { success: false, productId: itemId, offerId, error: `API error: ${response.status}` };
    }

    // Update item to clear GMC fields
    await prisma.inventory_items.update({
      where: { id: itemId },
      data: {
        sync_status: null,
        synced_at: null,
        updated_at: new Date(),
      },
    });

    console.log(`[GMCProductSync] Deleted product ${itemId} from GMC`);
    return { success: true, productId: itemId, offerId };
  } catch (error: any) {
    console.error(`[GMCProductSync] Error deleting product:`, error);
    return { success: false, productId: itemId, offerId: '', error: error.message };
  }
}

/**
 * Get GMC sync status for a tenant
 */
export async function getGMCSyncStatus(tenantId: string): Promise<{
  hasGMCConnection: boolean;
  hasMerchantLink: boolean;
  hasSubdomain: boolean;
  subdomain: string | null;
  merchantId: string | null;
  merchantName: string | null;
  fulfillmentMode: string | null;
  pickupOnly: boolean;
  pickupMethod: string | null;
  pickupSla: string | null;
  totalProducts: number;
  syncedProducts: number;
  pendingProducts: number;
  errorProducts: number;
  lastSyncAt: Date | null;
  // Domain validation warnings
  domainValidation?: {
    hasWebsiteConfigured: boolean;
    websiteUrl: string | null;
    willCauseMismatchedDomains: boolean;
    complianceOptions: {
      configureDomain: {
        title: string;
        description: string;
        actionRequired: string;
        difficulty: 'easy' | 'medium' | 'hard';
      };
      useSubdomain: {
        title: string;
        description: string;
        actionRequired: string;
        difficulty: 'easy' | 'medium' | 'hard';
      };
      customDomainHosting: {
        title: string;
        description: string;
        actionRequired: string;
        difficulty: 'easy' | 'medium' | 'hard';
        pricing: string;
        available: boolean;
      };
    };
  };
}> {
  try {
    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: {
        google_oauth_tokens_list: true,
        google_merchant_links_list: {
          where: { is_active: true },
          take: 1,
        },
      },
    });

    const merchantLink = account?.google_merchant_links_list[0];

    // Get tenant subdomain for GMC compliance check
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { subdomain: true }
    });

    // Get product sync stats using existing fields
    const [total, synced, pending, errors] = await Promise.all([
      prisma.inventory_items.count({
        where: { tenant_id: tenantId },
      }),
      prisma.inventory_items.count({
        where: { tenant_id: tenantId, sync_status: 'success' },
      }),
      prisma.inventory_items.count({
        where: { tenant_id: tenantId, sync_status: 'pending' },
      }),
      prisma.inventory_items.count({
        where: { tenant_id: tenantId, sync_status: 'error' },
      }),
    ]);

    return {
      hasGMCConnection: !!account?.google_oauth_tokens_list,
      hasMerchantLink: !!merchantLink,
      hasSubdomain: !!tenant?.subdomain,
      subdomain: tenant?.subdomain || null,
      merchantId: merchantLink?.merchant_id || null,
      merchantName: merchantLink?.merchant_name || null,
      fulfillmentMode: merchantLink?.fulfillment_mode || (merchantLink?.pickup_only ? 'pickup_only' : 'standard'),
      pickupOnly: !!merchantLink?.pickup_only,
      pickupMethod: merchantLink?.pickup_method || null,
      pickupSla: merchantLink?.pickup_sla || null,
      totalProducts: total,
      syncedProducts: synced,
      pendingProducts: pending,
      errorProducts: errors,
      lastSyncAt: merchantLink?.last_sync_at || null,
    };
  } catch (error) {
    console.error(`[GMCProductSync] Error getting sync status:`, error);
    return {
      hasGMCConnection: false,
      hasMerchantLink: false,
      hasSubdomain: false,
      subdomain: null,
      merchantId: null,
      merchantName: null,
      fulfillmentMode: null,
      pickupOnly: false,
      pickupMethod: null,
      pickupSla: null,
      totalProducts: 0,
      syncedProducts: 0,
      pendingProducts: 0,
      errorProducts: 0,
      lastSyncAt: null,
    };
  }
}

