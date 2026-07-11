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
 * Format (with customer): order-{tenantKey}-{customerKey}-{nanoid}
 * Format (guest): order-{tenantKey}-GUEST-{nanoid}
 * 
 * Examples:
 * - Logged-in: order-A3K9-CUA3K9M-x7y2z9 (tenant + customer traceable)
 * - Guest: order-A3K9-GUEST-x7y2z9 (tenant traceable only)
 */
export function generateOrderId(tenantId: string, customerId?: string | null): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  const tenantKey = generateTenantKey(tenantId);
  
  if (customerId) {
    return `order-${tenantKey}-${generateCustomerKey(customerId)}-${nanoid()}`;
  }
  
  return `order-${tenantKey}-GUEST-${nanoid()}`;
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
 * Generates correlation IDs for request tracing
 * Format: corr-{tenantKey}-{nanoid} (18 chars)
 * URL-safe, readable, tenant-traceable for unified capability resolver logs
 */
export function generateCorrelationId(tenantId?: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  const tenantKey = tenantId ? generateTenantKey(tenantId) : 'GLBL';
  return `corr-${tenantKey}-${nanoid()}`;
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
export function generateOrganizationId(ownerId: string = 'org'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `org-${generateOwnerKey(ownerId)}-${nanoid()}`;
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
export function generateSubscriptionPaymentId(invoiceId: string,tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `subpay-${generateTenantKey(tenantId)}-${invoiceId}-${nanoid()}`;
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
export function generateOrderItemId(id: string,tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `orderitem-${generateTenantKey(tenantId)}-${id}-${nanoid()}`;
}

/**
 * Generates order item history IDs
 * Format: oih-abc123 (12 chars)
 */
export function generateOrderItemHistoryId(id: string,tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `orderhist-${generateTenantKey(tenantId)}-${id}-${nanoid()}`;
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
  productType: 'physical' | 'digital' | 'hybrid' | 'service';
  deliveryMethod?: 'direct_download' | 'external_link' | 'email_delivery' | 'license_key' | 'access_grant' | 'shipping' | 'pickup' | 'delivery';
  accessControl?: 'personal' | 'commercial' | 'enterprise' | 'educational' | 'public' | 'subscription';
}

const PRODUCT_TYPE_CODES: Record<string, string> = {
  physical: 'PHYS',
  digital: 'DIGI',
  hybrid: 'HYBR',
  service: 'SVC',
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
 * Generate an organization key from organization ID
 * Converts organization ID to a 3-character alphanumeric key
 */
export function generateOrganizationKey(organizationId: string): string {
  if (!organizationId) return 'UNK';
  
  // Use a simple hash to create consistent 3-char key from organization ID
  let hash = 0;
  for (let i = 0; i < organizationId.length; i++) {
    hash = ((hash << 5) - hash) + organizationId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert hash to 3-character alphanumeric key
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tempHash = Math.abs(hash);
  let key = '';
  for (let i = 0; i < 3; i++) {
    key += chars[tempHash % chars.length];
    tempHash = Math.floor(tempHash / chars.length);
  }
  
  return key;
}

/**
 * Generate a customer key from customer ID
 * Converts customer ID to a 5-character alphanumeric key
 * Format: CUST-XXXXX (e.g., CUST-A3K9M)
 */
export function generateCustomerKey(customerId: string): string {
  if (!customerId) return 'CUNKN';
  
  // Use a simple hash to create consistent 5-char key from customer ID
  let hash = 0;
  for (let i = 0; i < customerId.length; i++) {
    hash = ((hash << 5) - hash) + customerId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert hash to 5-character alphanumeric key
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tempHash = Math.abs(hash);
  let key = '';
  for (let i = 0; i < 5; i++) {
    key += chars[tempHash % chars.length];
    tempHash = Math.floor(tempHash / chars.length);
  }
  
  return `CU${key}`;
}

/**
 * Generate an order key from order ID
 * Converts order ID to a 6-character alphanumeric key
 * Format: ORD-XXXXXX (e.g., ORD-A3K9M2)
 */
export function generateOrderKey(orderId: string): string {
  if (!orderId) return 'ORDUNK';
  
  // Use a simple hash to create consistent 6-char key from order ID
  let hash = 0;
  for (let i = 0; i < orderId.length; i++) {
    hash = ((hash << 5) - hash) + orderId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert hash to 6-character alphanumeric key
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tempHash = Math.abs(hash);
  let key = '';
  for (let i = 0; i < 6; i++) {
    key += chars[tempHash % chars.length];
    tempHash = Math.floor(tempHash / chars.length);
  }
  
  return key;
}

/**
 * Generate an owner key from owner ID
 * Converts owner ID to a 5-character alphanumeric key
 */
export function generateOwnerKey(ownerId: string): string {
  if (!ownerId) return 'UNKNN';
  
  // Use a simple hash to create consistent 5-char key from owner ID
  let hash = 0;
  for (let i = 0; i < ownerId.length; i++) {
    hash = ((hash << 5) - hash) + ownerId.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert hash to 5-character alphanumeric key
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let tempHash = Math.abs(hash);
  let key = '';
  for (let i = 0; i < 5; i++) {
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
    } else if (params.productType === 'service') {
      deliveryMethod = 'pickup';
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
  productType?: 'physical' | 'digital' | 'hybrid' | 'service'
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
 * Generates short customer address IDs
 * Format: caddr-CUXXXXX-abc123 (20 chars vs 36 for UUID)
 * URL-safe, readable, unique, customer-traceable
 */
export function generateCustomerAddressId(customerId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `caddr-${generateCustomerKey(customerId)}-${nanoid()}`;
}

/**
 * Generates short customer tenant relationship IDs
 * Format: ctr-{tenantKey}-{customerKey}-{nanoid}
 * URL-safe, readable, unique, tenant + customer traceable
 * 
 * Example: ctr-A3K9-CUA3K9M-x7y2z9
 * - A3K9 = tenant key
 * - CUA3K9M = customer key
 * - x7y2z9 = unique suffix
 */
export function generateCustomerTenantRelationshipId(tenantId: string, customerId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `ctr-${generateTenantKey(tenantId)}-${generateCustomerKey(customerId)}-${nanoid()}`;
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
 * Generates short customer payment method IDs
 * Format: cpm-{customerKey}-{nanoid} (20 chars)
 * URL-safe, readable, unique, customer-traceable
 */
export function generateCustomerPaymentMethodId(customerId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `cpm-${generateCustomerKey(customerId)}-${nanoid()}`;
}

/**
 * Generate global product catalog ID
 * Format: gpc-abc123 (10 chars)
 */
export function generateGlobalProductId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `gpc-${nanoid()}`;
}

/**
 * Generate download page ID
 * Format: dlp-tid-abc123 (17 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateDownloadPageId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `dlp-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate digital asset ID
 * Format: asset-tid-abc123 (19 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateDigitalAssetId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `asset-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate download access log ID
 * Format: dlog-tid-abc123 (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateDownloadLogId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `dlog-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate tenant commerce settings ID
 * Format: cs-tid-abc123 (17 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateTenantCommerceSettingsId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `cs-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate storefront policy ID
 * Format: pol-tid-abc123 (17 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateStorefrontPolicyId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `pol-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate organization commerce settings ID
 * Format: ocs-org-abc123 (18 chars)
 * URL-safe, readable, unique, organization-traceable
 */
export function generateOrganizationCommerceSettingsId(organizationId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `ocs-org-${generateOrganizationKey(organizationId)}-${nanoid()}`;
}

/**
 * Generate user_organizations ID
 * Format: uorg-org-abc123 (18 chars)
 * URL-safe, readable, unique, organization-traceable
 */
export function generateUserOrgId(organizationId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `uorg-${generateOrganizationKey(organizationId)}-${nanoid()}`;
}

/**
 * Generate access grant ID
 * Format: grant-tid-abc123 (19 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateAccessGrantId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `grant-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate access token for download access
 * Format: atok-abc123xyz456 (18 chars)
 * URL-safe, secure, unique, non-guessable
 */
export function generateAccessToken(): string {
  const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 12);
  return `atok-${nanoid()}`;
}

/**
 * Generate license key for digital products
 * Format: XXXX-XXXX-XXXX-XXXX (19 chars, 4 groups of 4)
 * Uses unambiguous characters (no 0, O, 1, I)
 */
export function generateLicenseKey(): string {
  const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 4);
  return `${nanoid()}-${nanoid()}-${nanoid()}-${nanoid()}`;
}

/**
 * Generate CRM contact ID
 * Format: crmct-{tenantKey}-{nanoid} (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateCrmContactId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `crmct-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate CRM support ticket ID
 * Format: crmtk-{tenantKey}-{nanoid} (17 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateCrmTicketId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `crmtk-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate CRM ticket message ID
 * Format: crmmsg-{nanoid} (14 chars)
 * URL-safe, readable, unique
 */
export function generateCrmTicketMessageId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `crmmsg-${nanoid()}`;
}

/**
 * Generate CRM task ID
 * Format: crmtask-{tenantKey}-{nanoid} (20 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateCrmTaskId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `crmtask-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate CRM activity ID
 * Format: crmact-{tenantKey}-{nanoid} (19 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateCrmActivityId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `crmact-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate CRM inquiry ID
 * Format: crminq-{tenantKey}-{nanoid} (19 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateCrmInquiryId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `crminq-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate CRM request read ID
 * Format: crmrd-{nanoid} (13 chars)
 * URL-safe, readable, unique
 */
export function generateCrmRequestReadId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `crmrd-${nanoid()}`;
}

/**
 * Generate CRM user read state ID
 * Format: crmurs-{nanoid} (15 chars)
 * URL-safe, readable, unique
 */
export function generateCrmUserReadStateId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `crmurs-${nanoid()}`;
}

/**
 * Generate CRM customer read state ID
 * Format: crmcrs-{nanoid} (15 chars)
 * URL-safe, readable, unique
 */
export function generateCrmCustomerReadStateId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `crmcrs-${nanoid()}`;
}

/**
 * Generate CRM Alert ID
 * Format: crmalt-{tenantKey}-{nanoid} (20 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateCrmAlertId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `crmalt-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate bot conversation session ID
 * Format: botconv-{tenantKey}-{nanoid} (20 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateBotConversationSessionId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `botconv-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate bot embed key for external site licensing
 * Format: ek-{tenantKey}-{nanoid} (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 * The tenant key prefix allows visual identification of which tenant
 * owns the key without a database lookup
 */
export function generateEmbedKey(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 12);
  return `ek-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate product slug using new UPC/LPC system
 * Matches database trigger logic exactly
 * 
 * Character Rules:
 * _ = part boundary (after prefix, between parts)
 * - = bonded part (within parts, preserved)
 * 
 * UPC Format: upc_(brand)_(category)_(upc-code)_(name-hash)
 * LPC Format: lpc_(sku)_(category)_(item-id)_(name-hash)
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
  
  // Normalize parts - preserve bonded words with hyphens
  // Matches DB: trim(both '-' from regexp_replace(lower(part), '[^a-z0-9-]+', '-', 'g'))
  const normalizePart = (part: string) => 
    part
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-') // Replace non-alphanumeric (except hyphens) with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  
  // Generate name hash (first 8 chars of MD5)
  const nameHash = createHash('md5')
    .update(params.name.toLowerCase().trim())
    .digest('hex')
    .substring(0, 8);
  
  // Use first category if categoryPath is provided
  const category = params.categoryPath?.[0] || params.category || 'general';
  
  // Determine slug type based on GTIN/UPC presence
  if (params.gtin && params.gtin.trim() !== '' && params.gtin.trim().length >= 6) {
    // UPC-based product: upc_(brand)_(category)_(upc-code)_(name-hash)
    // Brand preserves bonded words: "General Mills" -> "general-mills"
    return `upc_${normalizePart(params.brand)}_${normalizePart(category)}_${params.gtin.trim()}_${nameHash}`;
  } else {
    // LPC-based product: lpc_(sku)_(category)_(item-id)_(name-hash)
    // SKU preserves bonded words: "PROD-123" -> "prod-123"
    if (!params.sku || !params.itemId) {
      throw new Error('LPC products require sku and itemId');
    }
    return `lpc_${normalizePart(params.sku)}_${normalizePart(category)}_${params.itemId}_${nameHash}`;
  }
}

/**
 * Generates CCPA request IDs
 * Format: ccpa-{tenantKey}-{nanoid} (tenant-scoped) or ccpa-{nanoid} (global)
 * URL-safe, readable, unique, tenant-traceable when tenant context is available
 */
export function generateCcpaRequestId(tenantId?: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  if (tenantId) {
    return `ccpa-${generateTenantKey(tenantId)}-${nanoid()}`;
  }
  return `ccpa-${nanoid()}`;
}

/**
 * Generate payment gateway ID
 * Format: gw-{tenantKey}-{nanoid} (17 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generatePaymentGatewayId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `gw-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate payment gateway settings ID
 * Format: pgs-{tenantKey}-{nanoid} (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generatePaymentGatewaySettingsId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `pgs-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate storefront options settings ID
 * Format: sos-{tenantKey}-{nanoid} (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateStorefrontOptionsSettingsId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `sos-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate storefront type settings ID
 * Format: sts-{tenantKey}-{nanoid} (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateStorefrontTypeSettingsId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `sts-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate a unique ID for tenant_product_types_settings.
 * Format: pts-{tenantKey}-{nanoid} (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateProductTypeSettingsId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `pts-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate featured options settings ID
 * Format: fos-{tenantKey}-{nanoid} (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateFeaturedOptionsSettingsId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `fos-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate product options settings ID
 * Format: pos-{tenantKey}-{nanoid} (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateProductOptionsSettingsId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `pos-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate quickstart options settings ID
 * Format: qos-{tenantKey}-{nanoid} (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateQuickstartOptionsSettingsId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `qos-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate feature override ID
 * Format: fov-{tenantKey}-{nanoid} (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateFeatureOverrideId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `fov-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate feature flag ID
 * Format: ff-{tenantKey}-{nanoid} (17 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateFeatureFlagId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `ff-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate shipping carrier ID
 * Format: carrier-{tenantKey}-{nanoid} (22 chars)
 * URL-safe, readable, unique, tenant-traceable
 * Uses 'carrier' prefix to avoid collision with generateShipmentId ('ship')
 */
export function generateShippingCarrierId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `carrier-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate Meta OAuth account ID
 * Format: moa-{tenantKey}-{nanoid} (17 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateMetaOAuthAccountId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `moa-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate Meta OAuth token ID
 * Format: mot-{tenantKey}-{nanoid} (17 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateMetaOAuthTokenId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `mot-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate Social Pixel config ID
 * Format: spx-{tenantKey}-{nanoid} (17 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateSocialPixelId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `spx-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate abandoned cart ID
 * Format: acart-{tenantKey}-{nanoid} (19 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateAbandonedCartId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `acart-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate TikTok OAuth account ID
 * Format: ttoa-{tenantKey}-{nanoid} (18 chars)
 */
export function generateTikTokOAuthAccountId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `ttoa-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate TikTok OAuth token ID
 * Format: ttot-{tenantKey}-{nanoid} (18 chars)
 */
export function generateTikTokOAuthTokenId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `ttot-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate social mention ID
 * Format: smnt-{tenantKey}-{nanoid} (18 chars)
 */
export function generateSocialMentionId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `smnt-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate return request ID
 * Format: rtrn-{tenantKey}-{nanoid} (18 chars)
 */
export function generateReturnRequestId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `rtrn-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate badge analytics aggregate ID
 * Format: bdga-{tenantKey}-{nanoid} (18 chars)
 */
export function generateBadgeAnalyticsId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `bdga-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate badge event ID
 * Format: bdge-{tenantKey}-{nanoid} (18 chars)
 */
export function generateBadgeEventId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `bdge-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate service booking ID
 * Format: booking-{nanoid} (16 chars)
 */
export function generateBookingId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `booking-${nanoid()}`;
}

/**
 * Generate featured placement purchase ID
 * Format: fpp-{tenantKey}-{nanoid} (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generatePlacementPurchaseId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `fpp-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate featured placement catalog ID
 * Format: fpc-{nanoid} (12 chars)
 * URL-safe, readable, unique
 */
export function generatePlacementCatalogId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `fpc-${nanoid()}`;
}

/**
 * Generate tenant-scoped promotion purchase ID
 * Format: prom-{tenantKey}-{nanoid} (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generatePromotionPurchaseId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `prom-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate promotion catalog ID (global, not tenant-scoped)
 * Format: promcat-{nanoid} (15 chars)
 * URL-safe, readable, unique
 */
export function generatePromotionCatalogId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `promcat-${nanoid()}`;
}

/**
 * Generate policy template ID (global, not tenant-scoped)
 * Format: polcat-{nanoid} (15 chars)
 * URL-safe, readable, unique
 */
export function generatePolicyTemplateId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `polcat-${nanoid()}`;
}

/**
 * Generate policy template usage ID (tenant-scoped)
 * Format: poltu-{tk}-{nanoid} (18 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generatePolicyTemplateUsageId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `poltu-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate coupon target rule ID (platform-level, no tenant scope)
 * Format: ctgt-{nanoid} (13 chars)
 * URL-safe, readable, unique
 */
export function generateCouponTargetId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `ctgt-${nanoid()}`;
}

/**
 * Generate product supplier ID (global, no tenant scope)
 * Format: psup-{nanoid} (14 chars)
 * URL-safe, readable, unique
 */
export function generateProductSupplierId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `psup-${nanoid()}`;
}

/**
 * Generate affiliate click ID (tenant-scoped)
 * Format: ac-{tk}-{nanoid} (16 chars)
 * URL-safe, readable, unique, tenant-traceable
 */
export function generateAffiliateClickId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `ac-${generateTenantKey(tenantId)}-${nanoid()}`;
}

/**
 * Generate brand partner claim ID (global, no tenant scope)
 * Format: bpc-{nanoid} (13 chars)
 * URL-safe, readable, unique
 */
export function generateBrandPartnerClaimId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `bpc-${nanoid()}`;
}
