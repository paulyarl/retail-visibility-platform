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
import { evaluateGMCSyncGate } from '../lib/google/capability-gate';
import { findGoogleToken, resolveGoogleAccessToken } from '../lib/google/token-store';
import { canonicalStorefrontBaseUrl, platformApex, resolveStorefrontCanonical } from '../lib/storefront-url';
import { validateProductForGMC } from './GMCValidationService';
import { logger } from '../logger';

const GMC_API_BASE = 'https://shoppingcontent.googleapis.com';
const CONTENT_API_VERSION = 'v2.1';

/** Product types that can be synced to Google Merchant Center */
const GMC_SYNCABLE_PRODUCT_TYPES = ['physical', 'hybrid'] as const;

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
  customLabel0?: string;
  customLabel1?: string;
  customLabel2?: string;
  customLabel3?: string;
  customLabel4?: string;
}

interface SyncResult {
  success: boolean;
  productId: string;
  offerId: string;
  error?: string;
  googleProductId?: string;
  variantsSynced?: number;
  variantsFailed?: number;
  validationWarnings?: Array<{ field: string; message: string }>;
}

interface BatchSyncResult {
  success: boolean;
  total: number;
  synced: number;
  failed: number;
  results: SyncResult[];
  validationSummary?: {
    errors: number;
    warnings: number;
  };
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
        google_merchant_links_list: {
          where: { is_active: true },
          take: 1,
        },
      },
    });

    const tokenRecord = await findGoogleToken('gmc', { tenantId });
    if (!tokenRecord) {
      console.log(`[GMCProductSync] No OAuth token for tenant ${tenantId}`);
      return null;
    }

    const merchantLink = account?.google_merchant_links_list[0];
    if (!merchantLink) {
      console.log(`[GMCProductSync] No merchant link for tenant ${tenantId}`);
      return null;
    }

    const token = await resolveGoogleAccessToken('gmc', tokenRecord);
    if (!token) {
      logger.error('[GMCProductSync] Failed to refresh token', undefined);
      return null;
    }

    return { token, merchantId: merchantLink.merchant_id };
  } catch (error) {
    logger.error(`[GMCProductSync] Error getting token for tenant ${tenantId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return null;
  }
}

/**
 * Convert platform inventory item to Google Product format.
 * If `variant` is provided, adds variant-specific GMC fields (itemGroupId, color, size, etc.).
 */
function convertToGoogleProduct(
  item: any,
  tenantId: string,
  websiteUrl: string,
  options?: { fulfillmentMode?: string; pickupMethod?: string; pickupSla?: string; variant?: any },
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

  // Map badge types to GMC custom labels (custom_label_0 through custom_label_4)
  // This enables badge-based filtering and reporting in Google Shopping campaigns
  const badgeTypes: string[] = item.featured_type_array || (item.featured_type ? [item.featured_type] : []);
  if (badgeTypes.length > 0) {
    const labelFields = ['customLabel0', 'customLabel1', 'customLabel2', 'customLabel3', 'customLabel4'] as const;
    for (let i = 0; i < Math.min(badgeTypes.length, 5); i++) {
      googleProduct[labelFields[i]] = badgeTypes[i];
    }
  }

  // Variant-specific GMC fields
  const variant = options?.variant;
  if (variant) {
    // itemGroupId links variant to the parent product
    googleProduct.itemGroupId = item.sku || item.id;

    // Override offerId, title, price, availability, and image with variant values
    googleProduct.offerId = variant.sku || `${item.sku || item.id}-${variant.id.slice(-6)}`;
    googleProduct.title = `${item.name || item.title} - ${variant.variant_name}`;
    if (variant.price_cents != null) {
      const vPrice = (variant.price_cents / 100).toFixed(2);
      googleProduct.price = { value: vPrice, currency: 'USD' };
      if (variant.sale_price_cents != null) {
        const vSale = (variant.sale_price_cents / 100).toFixed(2);
        if (parseFloat(vSale) < parseFloat(vPrice)) {
          googleProduct.salePrice = { value: vSale, currency: 'USD' };
        }
      }
    }
    googleProduct.availability = variant.stock != null && variant.stock > 0 ? 'in stock' : 'out of stock';
    if (variant.image_url) {
      googleProduct.imageLink = variant.image_url;
    }

    // Map variant attributes to GMC fields
    const attrs = variant.attributes || {};
    const attrMap: Record<string, string> = {
      color: 'color',
      size: 'size',
      pattern: 'pattern',
      material: 'material',
      gender: 'gender',
      age_group: 'ageGroup',
    };
    for (const [key, gmcKey] of Object.entries(attrMap)) {
      const val = attrs[key] || attrs[key.toLowerCase()];
      if (val) googleProduct[gmcKey] = val;
    }
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

    // Fetch active badge assignments for GMC custom_label mapping
    const badges = await prisma.featured_products.findMany({
      where: {
        inventory_item_id: itemId,
        is_active: true,
      },
      select: { featured_type: true },
    });
    (item as any).featured_type_array = badges.map(b => b.featured_type);

    // Resolve Google product category from platform_categories based on item's category_path
    const catPath = (item as any).category_path as string[] | undefined;
    if (catPath && catPath.length > 0 && !(item as any).google_product_category_id) {
      const platformCats = await prisma.platform_categories.findMany({
        where: { is_active: true },
        select: { name: true, google_category_id: true },
      });
      const googleCatByPlatformName = new Map<string, string>();
      for (const pc of platformCats) {
        if (pc.google_category_id) {
          googleCatByPlatformName.set(pc.name.toLowerCase(), pc.google_category_id);
        }
      }
      for (let i = catPath.length - 1; i >= 0; i--) {
        const gcid = googleCatByPlatformName.get(catPath[i].toLowerCase());
        if (gcid) {
          (item as any).google_product_category_id = gcid;
          break;
        }
      }
    }

    // Check if item is public (visibility = 'public')
    if (item.visibility !== 'public') {
      return { success: false, productId: itemId, offerId: item.sku || '', error: 'Item is not public' };
    }

    // Check if item product type is syncable to Google Shopping
    const productType = (item as any).product_type || 'physical';
    if (!GMC_SYNCABLE_PRODUCT_TYPES.includes(productType as 'physical' | 'hybrid')) {
      return { success: false, productId: itemId, offerId: item.sku || '', error: `Product type '${productType}' is not syncable to Google Shopping (only physical and hybrid)` };
    }

    // Pre-sync validation (warnings only, don't block)
    const validation = validateProductForGMC(item);
    const validationWarnings = validation.issues
      .filter(i => i.severity === 'warning')
      .map(i => ({ field: i.field, message: i.message }));
    if (validation.errors > 0) {
      const errorMessages = validation.issues
        .filter(i => i.severity === 'error')
        .map(i => i.message)
        .join('; ');
      return {
        success: false,
        productId: itemId,
        offerId: item.sku || '',
        error: `Validation failed: ${errorMessages}`,
        validationWarnings,
      };
    }

    // Get tenant business profile for the external-website fallback
    const businessProfile = await prisma.tenant_business_profiles_list.findFirst({
      where: { tenant_id: tenantId },
      select: { website: true }
    });

    // Build website URL from the tenant's canonical ladder.
    // GMC requires product links to point to a domain the merchant controls —
    // the platform /store/{tenantId} path causes mismatched-domain errors.
    // Prefer the tenant's ACTIVE CUSTOM DOMAIN (their own domain, and the
    // canonical storefront surface once live), then the platform subdomain;
    // the tenant's external website stays the last resort (its products may
    // not live there at all).
    const canonicalBase = canonicalStorefrontBaseUrl(
      await resolveStorefrontCanonical(tenantId)
    );
    let websiteUrl: string;
    if (canonicalBase) {
      websiteUrl = canonicalBase;
    } else if (businessProfile?.website) {
      websiteUrl = businessProfile.website;
    } else {
      return { success: false, productId: itemId, offerId: item.sku || '', error: 'Storefront not published: tenant must have an active custom domain, a subdomain, or a website configured before GMC sync (fallback URL causes mismatched domain errors)' };
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
      logger.error(`[GMCProductSync] Failed to sync product ${itemId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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

    // Sync product variants as separate GMC entries (linked via itemGroupId)
    const variants = await prisma.product_variants.findMany({
      where: { parent_item_id: itemId, is_active: true },
      take: 100,
    });

    let variantSynced = 0;
    let variantFailed = 0;

    for (const variant of variants) {
      try {
        const variantProduct = convertToGoogleProduct(item, tenantId, websiteUrl, {
          fulfillmentMode: merchantLink?.fulfillment_mode || (merchantLink?.pickup_only ? 'pickup_only' : 'standard'),
          pickupMethod: merchantLink?.pickup_method || undefined,
          pickupSla: merchantLink?.pickup_sla || undefined,
          variant,
        });

        const variantResponse = await fetch(
          `${GMC_API_BASE}/content/${CONTENT_API_VERSION}/${auth.merchantId}/products`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${auth.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(variantProduct),
          }
        );

        if (variantResponse.ok) {
          variantSynced++;
        } else {
          variantFailed++;
          const vError = await variantResponse.text();
          logger.error(`[GMCProductSync] Failed to sync variant ${variant.id}:`, undefined, { error: { name: (vError as any)?.name || 'Error', message: (vError as any)?.message || String(vError), stack: (vError as any)?.stack } });
        }
      } catch (variantError) {
        variantFailed++;
        logger.error(`[GMCProductSync] Error syncing variant ${variant.id}:`, undefined, { error: { name: (variantError as any)?.name || 'Error', message: (variantError as any)?.message || String(variantError), stack: (variantError as any)?.stack } });
      }
    }

    if (variants.length > 0) {
      console.log(`[GMCProductSync] Variant sync for ${itemId}: ${variantSynced} synced, ${variantFailed} failed`);
    }

    return { 
      success: true, 
      productId: itemId, 
      offerId: googleProduct.offerId,
      googleProductId: result.id,
      variantsSynced: variantSynced,
      variantsFailed: variantFailed,
      validationWarnings,
    };
  } catch (error: any) {
    logger.error(`[GMCProductSync] Error syncing product ${itemId}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    // Use visibility='public' for public items, exclude trashed items,
    // and only sync product types that are valid for Google Shopping (physical, hybrid)
    const whereClause: any = {
      tenant_id: tenantId,
      visibility: 'public',
      item_status: { not: 'trashed' },
      product_type: { in: [...GMC_SYNCABLE_PRODUCT_TYPES] },
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

    // Fetch active badge assignments for all items (for GMC custom_label mapping)
    const itemIdsList = items.map(i => i.id);
    const allBadges = await prisma.featured_products.findMany({
      where: {
        inventory_item_id: { in: itemIdsList },
        is_active: true,
      },
      select: { inventory_item_id: true, featured_type: true },
    });
    const badgesByItem = new Map<string, string[]>();
    for (const b of allBadges) {
      const arr = badgesByItem.get(b.inventory_item_id) || [];
      arr.push(b.featured_type);
      badgesByItem.set(b.inventory_item_id, arr);
    }
    for (const item of items) {
      (item as any).featured_type_array = badgesByItem.get(item.id) || [];
    }

    // Resolve Google product category IDs from platform_categories
    // Match item.category_path entries against platform_categories.name → google_category_id
    const platformCats = await prisma.platform_categories.findMany({
      where: { is_active: true },
      select: { name: true, google_category_id: true },
    });
    const googleCatByPlatformName = new Map<string, string>();
    for (const pc of platformCats) {
      if (pc.google_category_id) {
        googleCatByPlatformName.set(pc.name.toLowerCase(), pc.google_category_id);
      }
    }
    for (const item of items) {
      const catPath = (item as any).category_path as string[] | undefined;
      if (catPath && catPath.length > 0 && !(item as any).google_product_category_id) {
        // Try matching from most specific (last) to least specific (first)
        for (let i = catPath.length - 1; i >= 0; i--) {
          const gcid = googleCatByPlatformName.get(catPath[i].toLowerCase());
          if (gcid) {
            (item as any).google_product_category_id = gcid;
            break;
          }
        }
      }
    }

    // Get tenant business profile for the external-website fallback
    const businessProfile = await prisma.tenant_business_profiles_list.findFirst({
      where: { tenant_id: tenantId },
      select: { website: true }
    });

    // Build website URL from the tenant's canonical ladder — see syncProduct.
    const canonicalBase = canonicalStorefrontBaseUrl(
      await resolveStorefrontCanonical(tenantId)
    );
    let websiteUrl: string;
    if (canonicalBase) {
      websiteUrl = canonicalBase;
    } else if (businessProfile?.website) {
      websiteUrl = businessProfile.website;
    } else {
      return {
        success: false,
        total: 0,
        synced: 0,
        failed: 0,
        results: [{ success: false, productId: '', offerId: '', error: 'Storefront not published: tenant must have an active custom domain, a subdomain, or a website configured before GMC sync' }]
      };
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

    // Fetch active variants for all items (for variant-aware batch sync)
    const allVariants = await prisma.product_variants.findMany({
      where: { parent_item_id: { in: itemIdsList }, is_active: true },
      take: 2000,
    });
    const variantsByItem = new Map<string, any[]>();
    for (const v of allVariants) {
      const arr = variantsByItem.get(v.parent_item_id) || [];
      arr.push(v);
      variantsByItem.set(v.parent_item_id, arr);
    }

    // Build batch entries (parent products + variant products)
    const batchEntries: any[] = [];
    let batchId = 0;
    let synced = 0;
    let failed = 0;
    let totalValidationErrors = 0;
    let totalValidationWarnings = 0;

    for (const item of items) {
      // Pre-sync validation for this item
      const validation = validateProductForGMC(item);
      totalValidationErrors += validation.errors;
      totalValidationWarnings += validation.warnings;

      // Skip items with validation errors (they would be rejected by Google)
      if (validation.errors > 0) {
        const errorMessages = validation.issues
          .filter(i => i.severity === 'error')
          .map(i => i.message)
          .join('; ');
        results.push({
          success: false,
          productId: item.id,
          offerId: item.sku || item.id,
          error: `Validation failed: ${errorMessages}`,
          validationWarnings: validation.issues
            .filter(i => i.severity === 'warning')
            .map(i => ({ field: i.field, message: i.message })),
        });
        failed++;
        continue;
      }

      // Parent product entry
      batchEntries.push({
        batchId: ++batchId,
        merchantId: auth.merchantId,
        method: 'insert',
        product: convertToGoogleProduct(item, tenantId, websiteUrl, merchantSettings),
      });

      // Variant product entries
      const variants = variantsByItem.get(item.id) || [];
      for (const variant of variants) {
        batchEntries.push({
          batchId: ++batchId,
          merchantId: auth.merchantId,
          method: 'insert',
          product: convertToGoogleProduct(item, tenantId, websiteUrl, { ...merchantSettings, variant }),
        });
      }
    }

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
      logger.error(`[GMCProductSync] Batch sync failed:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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

    const processedItemIds = new Set<string>();

    // Process batch results
    for (const entry of entries) {
      const batchEntry = batchEntries[(entry as any).batchId - 1];
      if (!batchEntry) continue;

      const offerId = batchEntry.product.offerId;
      const isVariant = !!batchEntry.product.itemGroupId;
      const productId = isVariant ? offerId : (items.find(i => (i.sku || i.id) === offerId)?.id || offerId);

      if (entry.errors) {
        failed++;
        if (!isVariant) {
          results.push({
            success: false,
            productId,
            offerId,
            error: entry.errors.map((e: any) => e.message).join(', '),
          });

          // Update item sync status
          await prisma.inventory_items.update({
            where: { id: productId },
            data: {
              sync_status: 'error',
              updated_at: new Date(),
            },
          });
        }
      } else {
        synced++;
        if (!isVariant && !processedItemIds.has(productId)) {
          processedItemIds.add(productId);
          results.push({
            success: true,
            productId,
            offerId,
            googleProductId: entry.product?.id,
          });

          // Update item with GMC sync status
          await prisma.inventory_items.update({
            where: { id: productId },
            data: {
              sync_status: 'success',
              synced_at: new Date(),
              updated_at: new Date(),
            },
          });
        }
      }
    }

    const totalEntries = batchEntries.length;
    console.log(`[GMCProductSync] Batch sync complete: ${synced} synced, ${failed} failed (${totalEntries} total entries including variants)`);
    return {
      success: failed === 0,
      total: items.length,
      synced,
      failed,
      results,
      validationSummary: { errors: totalValidationErrors, warnings: totalValidationWarnings },
    };
  } catch (error: any) {
    logger.error(`[GMCProductSync] Batch sync error:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error(`[GMCProductSync] Error updating inventory:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error(`[GMCProductSync] Error updating price:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    logger.error(`[GMCProductSync] Error deleting product:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
  // Canonical storefront resolution — custom-domain aware. `storefrontBaseUrl`
  // is the address GMC product links actually use (active custom domain →
  // platform subdomain → null for a path-only tenant); the raw platform
  // subdomain stays in `hasSubdomain`/`subdomain` above.
  storefrontKind: 'custom' | 'subdomain' | 'path' | null;
  storefrontHost: string | null;
  storefrontBaseUrl: string | null;
  platformSubdomainUrl: string | null;
  customDomain: string | null;
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
  storefrontReady: boolean;
  syncableProducts: number;
  gmcSyncAllowed: boolean;
  gmcSyncGateReason: string;
}> {
  try {
    const account = await prisma.google_oauth_accounts_list.findFirst({
      where: { tenant_id: tenantId },
      include: {
        google_oauth_tokens_list: { where: { provider: 'gmc' }, take: 1 },
        google_merchant_links_list: {
          where: { is_active: true },
          take: 1,
        },
      },
    });

    const merchantLink = account?.google_merchant_links_list[0];

    // Canonical ladder — the same resolution syncProduct uses for the product
    // link, so "storefront ready" can't disagree with what the sync accepts.
    const canon = await resolveStorefrontCanonical(tenantId);

    // Entitlement gate — surfaced so the client can hide sync actions instead of
    // letting the merchant click into a 403.
    const gate = await evaluateGMCSyncGate(tenantId);
    const canonicalBase = canonicalStorefrontBaseUrl(canon);
    // Absolute platform address, apex derived from config (staging serves on
    // visibleshelf.store) — never a hardcoded literal.
    const platformSubdomainUrl = canon?.subdomain
      ? `https://${canon.subdomain}.${platformApex()}`
      : null;

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
      hasGMCConnection: (account?.google_oauth_tokens_list?.length || 0) > 0,
      hasMerchantLink: !!merchantLink,
      hasSubdomain: !!canon?.subdomain,
      subdomain: canon?.subdomain ?? null,
      storefrontKind: canon?.kind ?? null,
      storefrontHost: canon?.host ?? null,
      storefrontBaseUrl: canonicalBase,
      platformSubdomainUrl,
      customDomain: canon?.kind === 'custom' ? canon.host : null,
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
      storefrontReady: !!canonicalBase,
      syncableProducts: await prisma.inventory_items.count({
        where: {
          tenant_id: tenantId,
          visibility: 'public',
          item_status: { not: 'trashed' },
          product_type: { in: [...GMC_SYNCABLE_PRODUCT_TYPES] },
        },
      }),
      gmcSyncAllowed: gate.allowed,
      gmcSyncGateReason: gate.reason,
    };
  } catch (error) {
    logger.error(`[GMCProductSync] Error getting sync status:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return {
      hasGMCConnection: false,
      hasMerchantLink: false,
      hasSubdomain: false,
      subdomain: null,
      storefrontKind: null,
      storefrontHost: null,
      storefrontBaseUrl: null,
      platformSubdomainUrl: null,
      customDomain: null,
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
      storefrontReady: false,
      syncableProducts: 0,
      gmcSyncAllowed: false,
      gmcSyncGateReason: 'error',
    };
  }
}

