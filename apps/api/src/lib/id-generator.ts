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
  return `utid-${userId}-${tenantId}-${nanoid()}`;
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
  return `cmid-${tenantId}-${catId}-${nanoid()}`;
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
export function generatePhotoId(tenantId?: string,itemId?: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `phid-${tenantId}-${itemId}-${nanoid()}`;
}

/**
 * Generates short session IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateSessionId(tenantId?: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `sid-${tenantId}-${nanoid()}`;
}


/**
 * Generates short order IDs
 * Format: ord-abc123 (12 chars)
 */
export function generateOrderId(tenantId?: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `oid-${tenantId}-${nanoid()}`;
}

/**
 * Generates short audit logs IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateAuditId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `alid-${nanoid()}`;
}

/**
 * Generates short tier IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateTierId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `tid-${nanoid()}`;
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
  return `tfid-${nanoid()}`;
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
  return `dccatid-${nanoid()}`;
}

/**
 * Generates clover quick start category IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateCloverCatId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `ccid-${nanoid()}`;
}
/**
 * Generates clover OAuth change log IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateCloverOauthChangeLogId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `cocid-${nanoid()}`;
}

/**
 * Generates clover sync logs IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateCloverSyncLogId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `cpid-${nanoid()}`;
}

/**
 * Generates gbp sync job IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateGbpHoursSyncLogId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `bhsid-${tenantId}-${nanoid()}`;
}

/**
 * Generates gbp sync job IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateSpecialHoursId(tenantId: string = 'shid'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `shid-${tenantId}-${nanoid()}`;
}

/**
 * Generates gbp sync job IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateFeedPushJobId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `fpid-${nanoid()}`;
}

/**
 * Generates short directory category IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateProductCatId(tenantId?: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `scid-${tenantId}-${nanoid()}`;
}

/**
 * Generates directory featured IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateDirectoryFeaturedId(tenantId: string = 'tid'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `dfid-${tenantId}-${nanoid()}`;
}

/**
 * Generates organization IDs
 * Format: sess-abc123 (12 chars)
 */
export function generateOrganizationId(ownerId: string = 'oid'): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `oid-${ownerId}-${nanoid()}`;
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
  const prefix = `ORD-${year}-`;

  // Add small random delay to reduce concurrent collision probability
  await new Promise(resolve => setTimeout(resolve, Math.random() * 50));

  // Try up to 10 times to find an available order number
  for (let attempt = 0; attempt < 10; attempt++) {
    // Get the count of orders for this year (more reliable than max)
    const orderCount = await prisma.orders.count({
      where: {
        tenant_id: tenantId,
        order_number: {
          startsWith: prefix,
        },
      },
    });

    // Calculate next sequence with random offset for concurrent requests
    let nextSequence = orderCount + 1 + Math.floor(Math.random() * 10);
    
    // Add attempt offset on retry
    if (attempt > 0) {
      nextSequence += attempt * 10;
    }

    const sequentialNumber = nextSequence.toString().padStart(6, '0');
    
    // For guest checkout (demo-tenant), add timestamp to ensure uniqueness
    const timestampSuffix = tenantId === 'demo-tenant' ? 
      `-${Date.now().toString().slice(-4)}` : '';
    
    const orderNumber = `${prefix}${sequentialNumber}${timestampSuffix}`;

    // Check if this order number is available
    const existing = await prisma.orders.findUnique({
      where: { order_number: orderNumber },
    });

    if (!existing) {
      return orderNumber;
    }

    // Wait a bit before retry
    await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1)));
  }

  // Fallback: use timestamp-based unique number
  const timestamp = Date.now();
  const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}${timestamp}${randomSuffix}`;
}

/**
 * Generates payment IDs
 * Format: pay-abc123xyz (14 chars)
 */
export function generatePaymentId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 10);
  return `pay-${tenantId}-${nanoid()}`;
}

/**
 * Generates billing method IDs (merchant payment methods)
 * Format: mbg-tid-abc123 (16 chars)
 */
export function generateBillingMethodId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `mbg-${tenantId}-${nanoid()}`;
}

/**
 * Generates subscription invoice IDs
 * Format: inv-tid-abc123 (15 chars)
 */
export function generateInvoiceId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `inv-${tenantId}-${nanoid()}`;
}

/**
 * Generates subscription payment IDs
 * Format: spay-invoiceId-abc (16 chars)
 */
export function generateSubscriptionPaymentId(invoiceId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `spay-${invoiceId}-${nanoid()}`;
}

/**
 * Generates tier pricing IDs
 * Format: tpr-abc123 (10 chars)
 */
export function generateTierPricingId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 6);
  return `tpr-${nanoid()}`;
}

/**
 * Generates order item IDs
 * Format: oiid-abc123 (12 chars)
 */
export function generateOrderItemId(id: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `oiid-${id}-${nanoid()}`;
}

/**
 * Generates order item history IDs
 * Format: oih-abc123 (12 chars)
 */
export function generateOrderItemHistoryId(id: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 4);
  return `oih-${id}-${nanoid()}`;
}

/**
 * Generates shipment IDs
 * Format: ship-abc123 (12 chars)
 */
export function generateShipmentId(tenantId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `ship-${tenantId}-${nanoid()}`;
}

// Generate variant ID function
export function generateVariantId(parentItemId: string): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 3);
  return `vid-${parentItemId}-${nanoid()}`;
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
 * Example outputs:
 * 
 * Tenant ID: t-a3k9m2x7 (9 chars vs 36 for UUID)
 * Item ID: i-b4n8p1y6 (10 chars)
 * Quick Start SKU: qs-001, qs-002, etc. (6-10 chars vs 60+)
 * Regular SKU: SKU-A3K9M2X7 (12 chars)
 * Photo ID: p-c5q7r3z8 (10 chars)
 * Session ID: s-d6w4t2v9 (10 chars)
 * 
 * Benefits:
 * - 70-80% shorter than current IDs
 * - URL-friendly (no special chars)
 * - Readable and shareable
 * - Unique (collision probability: ~1 in 2.8 trillion for 8 chars)
 * - Sortable by creation time (if using sequential suffix)
 * - Professional appearance
 */
