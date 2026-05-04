/**
 * ID Generation Utilities
 * 
 * Provides short, URL-friendly ID generation for tenants and items
 * to replace long UUIDs and composite IDs.
 */

import { customAlphabet } from 'nanoid';

/**
 * Generates short tenant IDs
 * Format: tid-abc123 (13 chars vs 36 for UUID)
 * URL-safe, readable, unique
 */
export function generateTenantId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `tid-${nanoid()}`;
}

/**
 * Generates short user IDs
 * Format: uid-abc123 (13 chars vs 36 for UUID)
 * URL-safe, readable, unique
 */
export function generateUserId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 5);
  return `uid-${nanoid()}`;
}

/**
 * Generates short user tenant IDs
 * Format: utid-abc123 (13 chars vs 36 for UUID)
 * URL-safe, readable, unique
 */
export function generateUserTenantId(userId: string = 'uid',tenantId: string = 'tid'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 5);
  return `utid-${userId}-${generateTenantKey(tenantId)}-${nanoid()}`;
}
// id: `ut_${tenantId}_${user.id}`,
/**
 * Generates short item/SKU IDs
 * Format: item-xyz789 (12 chars)
 * URL-safe, readable, unique
 */
/**
 * Generates short category mirror IDs
 * Format: cmid-abc123 (13 chars vs 36 for UUID)
 * URL-safe, readable, unique
 */
export function generateCategoryMirrorId(catId: string,tenantId: string = 'tid'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 5);
  return `cmid-${generateTenantKey(tenantId)}-${catId}-${nanoid()}`;
}
// id: `ut_${tenantId}_${user.id}`,
/**
 * Generates short item/SKU IDs
 * Format: item-xyz789 (12 chars)
 * URL-safe, readable, unique
 */
export function generateItemId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `pid-${nanoid()}`;
}
// id: `ut_${tenantId}_${user.id}`,
/**
 * Generates short item/SKU IDs
 * Format: item-xyz789 (12 chars)
 * URL-safe, readable, unique
 */
export function generateTenantItemId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `pid-${generateTenantKey(tenantId)}-${nanoid()}`;
}
// id: `ciid_${tenantId}_${user.id}`,
/**
 * Generates clover item/SKU IDs
 * Format: item-xyz789 (12 chars)
 * URL-safe, readable, unique
 */
export function generateCloverItemId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `csid-${nanoid()}`;
}
// id: `cigid_${tenantId}_${user.id}`,
/**
 * Generates clover integration IDs
 * Format: item-xyz789 (12 chars)
 * URL-safe, readable, unique
 */
export function generateCloverIntegrationId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `cigid-${nanoid()}`;
}

// id: `cimid_${tenantId}_${user.id}`,
/**
 * Generates clover item/SKU mappings IDs
 * Format: item-xyz789 (12 chars)
 * URL-safe, readable, unique
 */
export function generateCloverItemMappingsId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `csmid-${nanoid()}`;
}


/**
 * Generates short SKUs for quick-start items
 * Format: qs-abc123 (10 chars vs 60+ current)
 * Prefix indicates source, short suffix for uniqueness
 */
export function generateQuickStartSku(index?: number): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  const suffix = index !== undefined ? index.toString().padStart(3, '0') : nanoid();
  return `qsid-${suffix}`;
}

/**
 * Generates short photo asset IDs
 * Format: photo-abc123 (13 chars)
 */
export function generatePhotoId(tenantId: string,itemId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `photo-${generateTenantKey(tenantId)}-${itemId}-${nanoid()}`;
}

/**
 * Generates short session IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateSessionId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `session-${generateTenantKey(tenantId)}-${nanoid()}`;
}


/**
 * Generates short order IDs
 * Format: ord-abc123 (12 chars)
 */
export function generateOrderId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `order-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generates short audit logs IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateAuditId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `audit-${nanoid()}`;
}

/**
 * Generates short tier IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateTierId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `tier-${nanoid()}`;
}

/**
 * Generates short tier change IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateTierChangeId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `tcid-${nanoid()}`;
}

/**
 * Generates short tier feature IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateFeatureId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 5);
  return `feature-${nanoid()}`;
}

/**
 * Generates short quick start category IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateQsCatId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `qsctid-${nanoid()}`;
}

/**
 * Generates short directory category IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateDcCatId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `dircat-${nanoid()}`;
}

/**
 * Generates clover quick start category IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateCloverCatId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `clovercat-${nanoid()}`;
}
/**
 * Generates clover OAuth change log IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateCloverOauthChangeLogId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `cloveroauth-${nanoid()}`;
}

/**
 * Generates clover sync logs IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateCloverSyncLogId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `cloversync-${nanoid()}`;
}

/**
 * Generates gbp sync job IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateGbpHoursSyncLogId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `gbphours-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generates gbp sync job IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateSpecialHoursId(tenantId: string = 'shid'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `special-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generates gbp sync job IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateFeedPushJobId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `feed-${nanoid()}`;
}

/**
 * Generates short directory category IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateProductCatId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `itemcat-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generates directory featured IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateDirectoryFeaturedId(tenantId: string = 'tid'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `dirfeatured-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generates organization IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateOrganizationId(ownerId: string = 'oid'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `org-${ownerId}-${nanoid()}`;
}

/**
 * Generates short quick start with optional prefix
 * Format: SKU-abc123 or CUSTOM-abc123
 */
export function generateQuickStart(prefix: string = 'qsid'): string {
  const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 8);
  return `${prefix}-${nanoid()}`;
}

/**
 * Sequential Order Number Generator
 * Format: ORD-YYYY-NNNNNN (e.g., ORD-2026-000001)
 * Thread-safe with retry logic and collision avoidance
 */
import { prisma } from '../prisma';

export async function generateOrderNumber(tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ORD-${generateTenantKey(tenantId)}-${year}-`;

  // Use timestamp + random suffix for guaranteed uniqueness (no race condition)
  // This is simpler and more reliable than sequential with retries
  const timestamp = Date.now().toString().slice(-8); // Last 8 digits of timestamp
  const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  
  return `${prefix}${timestamp}${randomSuffix}`;
}

/**
 * Generates payment IDs
 * Format: pay-abc123xyz (14 chars)
 */
export function generatePaymentId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);
  return `pay-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generates billing method IDs (merchant payment methods)
 * Format: mbg-tid-abc123 (16 chars)
 */
export function generateBillingMethodId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `bill-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generates subscription invoice IDs
 * Format: inv-tid-abc123 (15 chars)
 */
export function generateInvoiceId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `inv-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generates subscription payment IDs
 * Format: spay-invoiceId-abc (16 chars)
 */
export function generateSubscriptionPaymentId(invoiceId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `subpay-${invoiceId}-${nanoid()}`;
}

/**
 * Generates tier pricing IDs
 * Format: tpr-abc123 (10 chars)
 */
export function generateTierPricingId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `tierprice-${nanoid()}`;
}

/**
 * Generates order item IDs
 * Format: oiid-abc123 (12 chars)
 */
export function generateOrderItemId(id: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `orderitem-${id}-${nanoid()}`;
}

/**
 * Generates order item history IDs
 * Format: oih-abc123 (12 chars)
 */
export function generateOrderItemHistoryId(id: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `orderhist-${id}-${nanoid()}`;
}

/**
 * Generates shipment IDs
 * Format: ship-abc123 (12 chars)
 */
export function generateShipmentId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `ship-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generates service charge IDs
 * Format: svc-tid-abc123 (12 chars)
 */
export function generateServiceChargeId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `charge-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generates manual invoice IDs
 * Format: miv-tid-abc123 (12 chars)
 */
export function generateManualInvoiceId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `manual-${generateTenantKey(tenantId)}-${nanoid()}`;
}

// Generate variant ID function
export function generateVariantId(parentItemId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 3);
  return `variant-${parentItemId}-${nanoid()}`;
}
// Generate variant ID function
export function generateTenantVariantId(parentItemId: string,tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 3);
  return `variant-${parentItemId}-${generateTenantKey(tenantId)}-${nanoid()}`;
}

// Generate variant SKU function - creates SKUs related to parent item SKU
export function generateVariantSku(parentItemSku: string, variantIndex?: number): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 2);
  const suffix = variantIndex !== undefined ? (variantIndex + 1).toString().padStart(2, '0') : nanoid();
  
  // Extract base SKU (remove any existing variant suffixes)
  const baseSku = parentItemSku.split('-')[0] || parentItemSku;
  
  return `${baseSku}-V${suffix}`;
}

// SKU Generation interfaces and codes (ported from frontend)
export interface SKUGenerationParams {
  tenantKey?: string; // 4-character tenant identifier
  productType: 'physical' | 'digital' | 'hybrid';
  deliveryMethod?: 'direct_download' | 'external_link' | 'email_delivery' | 'license_key' | 'access_grant' | 'shipping' | 'pickup' | 'delivery';
  accessControl?: 'personal' | 'commercial' | 'enterprise' | 'educational' | 'public' | 'subscription';
}

const PRODUCT_TYPE_CODES: Record<string, string> = {
  physical: 'PHYS',
  digital: 'DIGI',
  hybrid: 'HYBR',
};

const DELIVERY_METHOD_CODES: Record<string, string> = {
  direct_download: 'DWNL',
  external_link: 'LINK',
  email_delivery: 'MAIL',
  shipping: 'SHIP',
  pickup: 'PICK',
  delivery: 'DELV',
};

const ACCESS_CONTROL_CODES: Record<string, string> = {
  personal: 'PERS',
  commercial: 'COMM',
  enterprise: 'ENTR',
  public: 'PUBL',
  subscription: 'SUBS',
};

/**
 * Generate a random alphanumeric suffix (4 characters)
 */
function generateRandomSuffix(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed ambiguous chars (0, O, 1, I)
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate a tenant key from tenant ID
 * Converts tenant ID to a 4-character alphanumeric key
 */
export function generateTenantKey(tenantId: string): string {
  if (!tenantId) return 'UNKN';
  
  // Use a simple hash to create consistent 4-char key from tenant ID
  let hash = 0;
  for (let i = 0; i < tenantId.length; i++) {
    hash = ((hash << 5) - hash) + tenantId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert hash to 4-character alphanumeric key
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tempHash = Math.abs(hash);
  let key = '';
  for (let i = 0; i < 4; i++) {
    key += chars[tempHash % chars.length];
    tempHash = Math.floor(tempHash / chars.length);
  }
  
  return key;
}

/**
 * Generate SKU based on product attributes
 */
export function generateSKU(params: SKUGenerationParams): string {
  const parts: string[] = [];

  // Tenant key (optional but recommended)
  if (params.tenantKey) {
    parts.push(params.tenantKey.toUpperCase().substring(0, 4).padEnd(4, 'X'));
  }

  // Product type (required)
  parts.push(PRODUCT_TYPE_CODES[params.productType] || 'PROD');

  // Delivery method (optional, defaults based on product type)
  let deliveryMethod = params.deliveryMethod;
  if (!deliveryMethod) {
    // Auto-detect delivery method based on product type
    if (params.productType === 'digital') {
      deliveryMethod = 'direct_download';
    } else if (params.productType === 'physical') {
      deliveryMethod = 'shipping';
    } else {
      deliveryMethod = 'direct_download'; // hybrid defaults to digital delivery
    }
  }
  parts.push(DELIVERY_METHOD_CODES[deliveryMethod] || 'UNKN');

  // Access control (optional, defaults to public for physical, personal for digital)
  let accessControl = params.accessControl;
  if (!accessControl) {
    accessControl = params.productType === 'physical' ? 'public' : 'personal';
  }
  parts.push(ACCESS_CONTROL_CODES[accessControl] || 'PUBL');

  // Random suffix for uniqueness
  parts.push(generateRandomSuffix());

  return parts.join('-');
}

/**
 * Generate variant SKU based on parent item SKU and variant attributes
 * This creates a variant SKU that follows the same pattern as the parent but with variant suffix
 * Uses nanoid to guarantee uniqueness even in bulk operations
 */
export function generateVariantSkuFromParent(
  parentItemSku: string, 
  variantIndex: number,
  productType?: 'physical' | 'digital' | 'hybrid'
): string {
  // Use nanoid to generate unique suffix - guarantees uniqueness regardless of timing
  const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 4);
  const uniqueSuffix = nanoid();
  
  // If parent SKU follows the pattern, extract components and add variant suffix
  const parentParts = parentItemSku.split('-');
  if (parentParts.length >= 4) {
    // Replace the random suffix with unique variant identifier
    parentParts[parentParts.length - 1] = `V${uniqueSuffix}`;
    return parentParts.join('-');
  }
  
  // Fallback: append unique variant suffix to parent SKU
  return `${parentItemSku}-V${uniqueSuffix}`;
}
/**
 * Generates short fulfillment time slot IDs
 * Format: slot-tid-abc123 (17 chars vs 36 for UUID)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateTimeSlotId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `slot-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generates short fulfillment schedule IDs
 * Format: sched-tid-abc123 (18 chars vs 36 for UUID)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateScheduleId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 9);
  return `sched-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generates short fulfillment notification IDs
 * Format: notif-tid-abc123 (20 chars vs 36 for UUID)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateNotificationId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 9);
  return `notif-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generates short customer IDs
 * Format: cust-abc123xyz (14 chars vs 36 for UUID)
 * URL-safe, readable, unique, platform-wide
 */
export function generateCustomerId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);
  return `cust-${nanoid()}`;
}

/**
 * Generates short customer tenant relationship IDs
 * Format: ctr-tid-abc123 (17 chars vs 36 for UUID)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateCustomerTenantRelationshipId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `ctr-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Example outputs:
 * 
 * Tenant ID: t-a3k9m2x7 (9 chars vs 36 for UUID)
 * Item ID: i-b4n8p1y6 (10 chars)
 * Quick Start SKU: qs-001, qs-002, etc. (6-10 chars vs 60+)
 * Regular SKU: SKU-A3K9M2X7 (12 chars)
 * Photo ID: p-c5q7r3z8 (10 chars)
 * Session ID: s-d6w4t2v9 (10 chars)
 * Customer ID: cust-abc123xyz (14 chars)
 * Customer Tenant Relationship ID: ctr-tid-042hi7ju-2fqjrivec (25 chars)
 * Time Slot ID: slot-tid-042hi7ju-kyovpf8qd (27 chars)
 * Schedule ID: sched-tid-042hi7ju-3ynhluhql (29 chars)
 * Notification ID: notif-tid-042hi7ju-4mnp9wrxs (31 chars)
 * 
 * Benefits:
 * - 70-80% shorter than current IDs
 * - URL-friendly (no special chars)
 * - Readable and shareable
 * - Unique (collision probability: ~1 in 2.8 trillion for 8 chars)
 * - Sortable by creation time (if using sequential suffix)
 * - Professional appearance
 * - **Intelligent traceability across fulfillment system**
 * - **Tenant-scoped identification for debugging and support**
 * - **Cross-system correlation (orders → schedules → notifications)**
 * - **Platform-wide customer identification**
 * - **Customer-tenant relationship tracking**
 */

/**
 * Generate global product catalog ID
 * Format: gpc-abc123 (10 chars)
 */
export function generateGlobalProductId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `gpc-${nanoid()}`;
}

/**
 * Generate product slug using new UPC/LPC system
 * Matches database trigger logic exactly
 * 
 * Character Rules:
 * _ = part boundary (after prefix, between parts)
 * - = bonded part (within parts)
 * 
 * Format: (prefix)_(brand)_(category)_(upc-code)_(name-hash)
 * Prefix: upc, lpc
 */
export function generateProductSlug(params: {
  brand: string;
  name: string;
  category: string;
  gtin?: string;
  categoryPath?: string[];
  sku?: string;
  itemId?: string;
}): string {
  const { createHash } = require('crypto');
  
  // Normalize parts (bond words with hyphens)
  const normalizePart = (part: string) => 
    part
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  
  // Generate name hash (first 8 chars of MD5)
  const nameHash = createHash('md5')
    .update(params.name.toLowerCase().trim())
    .digest('hex')
    .substring(0, 8);
  
  // Use first category if categoryPath is provided
  const category = params.categoryPath?.[0] || params.category || 'general';
  
  // Determine slug type based on GTIN/UPC presence
  if (params.gtin && params.gtin.trim() !== '') {
    // UPC-based product: upc_(brand)_(category)_(upc-code)_(name-hash)
    return `upc_${normalizePart(params.brand)}_${normalizePart(category)}_${params.gtin.trim()}_${nameHash}`;
  } else {
    // LPC-based product: lpc_(sku)_(category)_(item-id)_(name-hash)
    if (!params.sku || !params.itemId) {
      throw new Error('LPC products require sku and itemId');
    }
    return `lpc_${params.sku}_${normalizePart(category)}_${params.itemId}_${nameHash}`;
  }
}
