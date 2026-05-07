/**
 * Auto-generate SKU based on product attributes
 * Pattern: {TenantKey}-{ProductType}-{DeliveryMethod}-{AccessControl}-{Random}
 * 
 * This mirrors the frontend SKU generator for consistency
 */

export interface SKUGenerationParams {
  tenantId: string; // Full tenant ID to generate key from
  productType?: 'physical' | 'digital' | 'hybrid';
  deliveryMethod?: 'direct_download' | 'external_link' | 'email_delivery' | 'shipping' | 'pickup' | 'delivery';
  accessControl?: 'personal' | 'commercial' | 'enterprise' | 'public' | 'subscription';
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
export function generateAutoSKU(params: SKUGenerationParams): string {
  const parts: string[] = [];

  // Tenant key (required)
  const tenantKey = generateTenantKey(params.tenantId);
  parts.push(tenantKey);

  // Product type (defaults to physical)
  const productType = params.productType || 'physical';
  parts.push(PRODUCT_TYPE_CODES[productType] || 'PROD');

  // Delivery method (optional, defaults based on product type)
  let deliveryMethod = params.deliveryMethod;
  if (!deliveryMethod) {
    // Auto-detect delivery method based on product type
    if (productType === 'digital') {
      deliveryMethod = 'direct_download';
    } else if (productType === 'physical') {
      deliveryMethod = 'shipping';
    } else {
      deliveryMethod = 'direct_download'; // hybrid defaults to digital delivery
    }
  }
  parts.push(DELIVERY_METHOD_CODES[deliveryMethod] || 'UNKN');

  // Access control (optional, defaults to public for physical, personal for digital)
  let accessControl = params.accessControl;
  if (!accessControl) {
    accessControl = productType === 'physical' ? 'public' : 'personal';
  }
  parts.push(ACCESS_CONTROL_CODES[accessControl] || 'PUBL');

  // Random suffix for uniqueness
  parts.push(generateRandomSuffix());

  return parts.join('-');
}

/**
 * Legacy function for backward compatibility
 * Generates quick-start SKU using new system
 */
export function generateQuickStartSku(tenantId: string, index?: number): string {
  // Use new auto-SKU system for quick-start products
  return generateAutoSKU({
    tenantId,
    productType: 'physical', // Quick-start defaults to physical
    deliveryMethod: 'shipping',
    accessControl: 'public',
  });
}
