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
import { canonicalStorefrontBaseUrl, platformApex, resolveStorefrontCanonical } from '../lib/storefront-url';
import { logger } from '../logger';

/** Product types that can be synced to Google Merchant Center */
const GMC_SYNCABLE_PRODUCT_TYPES = ['physical', 'hybrid'] as const;

/**
 * Convert platform inventory item to Google Product format.
 * If `variant` is provided, adds variant-specific GMC fields (itemGroupId, color, size, etc.).
 */
export function convertToGoogleProduct(
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
  const gtin = item.gtin || item.upc || item.barcode;
  if (item.brand) googleProduct.brand = item.brand;
  if (gtin) googleProduct.gtin = gtin;
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

  // Identifier exists flag.
  // Google requires a GTIN for branded products unless the product genuinely has
  // none — the store-brand / private-label case (an independent grocer's own
  // label has no manufacturer GTIN). `brand` is NOT a substitute for a GTIN, so
  // the flag must be declared whenever we have neither a GTIN nor an MPN.
  // Previously brand also had to be absent, so store-branded goods synced with a
  // "Missing GTIN" disapproval instead.
  if (!gtin && !item.mpn) {
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

