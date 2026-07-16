import { clientLogger } from '@/lib/client-logger';

/**
 * Multi-Cart Manager
 * Handles cart management per tenant (gateway selection at checkout)
 */

let trackCartTimer: ReturnType<typeof setTimeout> | null = null;

async function trackCartWithServer(tenantId: string, cart: Cart): Promise<void> {
  if (typeof window === 'undefined') return;
  if (cart.items.length === 0) return;

  try {
    const cartId = getCartKey(tenantId);
    const customerEmail = localStorage.getItem('customer_email') || undefined;
    const customerName = localStorage.getItem('customer_name') || undefined;
    const customerId = localStorage.getItem('customer_id') || undefined;

    const { checkoutService } = await import('@/services/CheckoutService');
    await checkoutService.trackCart({
      tenantId,
      cartId,
      customerEmail,
      customerName,
      customerId,
      items: cart.items.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        price_cents: item.price_cents,
        product_image: item.product_image,
        variant_id: item.variant_id,
        variant_name: item.variant_name,
      })),
    });
  } catch {
    // Silent fail — tracking is best-effort
  }
}

export interface CartItem {
  product_id: string;
  product_name: string;
  product_sku?: string;
  product_image?: string;
  quantity: number;
  price_cents: number; // unit_price_cents (effective price: sale price if on sale, otherwise list price)
  list_price_cents?: number; // Original list price (only set when item is on sale)
  discount_cents?: number; // Total discount amount (list_price - unit_price) * quantity
  // Gateway suggestion from product assignment (optional, used at checkout)
  suggested_gateway_type?: string;
  suggested_gateway_id?: string;
  // Product variant fields
  variant_id?: string; // Variant identifier if product has variants
  variant_name?: string; // Display name like "Large - Blue"
  variant_attributes?: Record<string, string>; // Attributes like {size: "Large", color: "Blue"}
  // Stock info for validation
  stock?: number; // Available stock for this item/variant
  // Product type for type-aware cart display
  productType?: string; // 'physical' | 'digital' | 'service' | 'hybrid'
}

export interface Cart {
  tenant_id: string;
  tenant_name: string;
  tenant_logo?: string;
  items: CartItem[];
  created_at: string;
  updated_at: string;
}

export interface CartSummary {
  key: string;
  cart: Cart;
  item_count: number;
  total_cents: number;
}

/**
 * Generate cart key based on tenant only
 */
export function getCartKey(tenantId: string): string {
  return `cart_${tenantId}`;
}

/**
 * Parse cart key to extract tenant
 */
export function parseCartKey(key: string): { tenantId: string } | null {
  const match = key.match(/^cart_([^_]+)$/);
  if (!match) return null;
  
  return {
    tenantId: match[1]
  };
}

/**
 * Get a specific tenant's cart
 */
export function getCart(tenantId: string): Cart | null {
  // Check if we're in the browser
  if (typeof window === 'undefined') return null;
  
  const key = getCartKey(tenantId);
  const data = localStorage.getItem(key);
  
  if (!data) return null;
  
  try {
    return JSON.parse(data);
  } catch (error) {
    clientLogger.error('[Cart] Failed to parse cart:', { detail: error });
    return null;
  }
}

/**
 * Get all carts (optionally filtered by tenant)
 */
export function getAllCarts(tenantId?: string): CartSummary[] {
  // Check if we're in the browser
  if (typeof window === 'undefined') return [];
  
  const carts: CartSummary[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('cart_')) continue;
    
    // Skip old gateway-wrapped cart keys (they have multiple underscores)
    if (key.match(/^cart_[^_]+_[^_]+/)) continue;
    
    const parsed = parseCartKey(key);
    if (!parsed) continue;
    
    // Filter by tenant if specified
    if (tenantId && parsed.tenantId !== tenantId) continue;
    
    const cart = getCart(parsed.tenantId);
    if (!cart || cart.items.length === 0) continue;
    
    const total_cents = cart.items.reduce(
      (sum, item) => sum + (item.price_cents * item.quantity),
      0
    );
    
    const item_count = cart.items.reduce(
      (sum, item) => sum + item.quantity,
      0
    );
    
    carts.push({
      key,
      cart,
      item_count,
      total_cents
    });
  }
  
  return carts;
}

/**
 * Save cart
 */
export function saveCart(cart: Cart): void {
  // Check if we're in the browser
  if (typeof window === 'undefined') return;
  
  const key = getCartKey(cart.tenant_id);
  cart.updated_at = new Date().toISOString();
  localStorage.setItem(key, JSON.stringify(cart));

  // Debounced server tracking for abandoned cart recovery
  if (trackCartTimer) clearTimeout(trackCartTimer);
  trackCartTimer = setTimeout(() => {
    trackCartWithServer(cart.tenant_id, cart);
  }, 5000);
}

/**
 * Add item to cart (tenant-based, no gateway routing)
 */
export function addToCart(
  tenantId: string,
  tenantName: string,
  item: Omit<CartItem, 'suggested_gateway_type' | 'suggested_gateway_id'> & { 
    suggested_gateway_type?: string; 
    suggested_gateway_id?: string;
  },
  tenantLogo?: string
): void {
  // Get or create cart
  let cart = getCart(tenantId);
  
  if (!cart) {
    // Create new cart
    cart = {
      tenant_id: tenantId,
      tenant_name: tenantName,
      tenant_logo: tenantLogo,
      items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  } else if (tenantLogo && !cart.tenant_logo) {
    // Update existing cart with logo if not already set
    cart.tenant_logo = tenantLogo;
  }
  
  // Normalize productType to a known value
  const validProductTypes = ['physical', 'digital', 'service', 'hybrid'];
  const normalizedItem = {
    ...item,
    productType: validProductTypes.includes(item.productType as string)
      ? item.productType
      : 'physical',
  };

  // Check if item already exists
  // Match by product_id AND variant_id to allow multiple variants of same product
  const existingIndex = cart.items.findIndex(
    i => i.product_id === normalizedItem.product_id && 
         i.variant_id === normalizedItem.variant_id
  );
  
  if (existingIndex >= 0) {
    // Update quantity
    cart.items[existingIndex].quantity += normalizedItem.quantity;
  } else {
    // Add new item
    cart.items.push(normalizedItem);
  }
  
  saveCart(cart);
  
  // Dispatch custom event for same-tab updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cart-updated', { 
      detail: { tenantId, action: 'add' } 
    }));
  }
}

/**
 * Update item quantity
 */
export function updateCartItemQuantity(
  tenantId: string,
  productId: string,
  quantity: number,
  variantId?: string
): void {
  const cart = getCart(tenantId);
  if (!cart) return;
  
  const itemIndex = cart.items.findIndex(i => 
    i.product_id === productId && i.variant_id === variantId
  );
  if (itemIndex < 0) return;
  
  if (quantity <= 0) {
    // Remove item
    cart.items.splice(itemIndex, 1);
  } else {
    // Update quantity
    cart.items[itemIndex].quantity = quantity;
  }
  
  if (cart.items.length === 0) {
    // Remove empty cart
    clearCart(tenantId);
  } else {
    saveCart(cart);
    
    // Dispatch custom event for same-tab updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cart-updated', { 
        detail: { tenantId, action: 'update' } 
      }));
    }
  }
}

/**
 * Remove item from cart
 */
export function removeFromCart(
  tenantId: string,
  productId: string,
  variantId?: string
): void {
  updateCartItemQuantity(tenantId, productId, 0, variantId);
}

/**
 * Clear specific cart
 */
export function clearCart(tenantId: string): void {
  // Check if we're in the browser
  if (typeof window === 'undefined') return;
  
  const key = getCartKey(tenantId);
  localStorage.removeItem(key);
  
  // Dispatch custom event for same-tab updates
  window.dispatchEvent(new CustomEvent('cart-updated', { 
    detail: { tenantId, action: 'clear' } 
  }));
}

/**
 * Clear all carts (optionally filtered by tenant)
 */
export function clearAllCarts(tenantId?: string): void {
  const carts = getAllCarts(tenantId);
  carts.forEach(({ cart }) => {
    clearCart(cart.tenant_id);
  });
}

/**
 * Get total item count across all carts
 */
export function getTotalItemCount(tenantId?: string): number {
  const carts = getAllCarts(tenantId);
  return carts.reduce((sum, { item_count }) => sum + item_count, 0);
}

/**
 * Get total value across all carts
 */
export function getTotalValue(tenantId?: string): number {
  const carts = getAllCarts(tenantId);
  return carts.reduce((sum, { total_cents }) => sum + total_cents, 0);
}

/**
 * Migrate cart data to include tenant logos
 * Fetches missing logos from tenant API
 */
export async function migrateCartLogos(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  const carts = getAllCarts();
  
  for (const { cart } of carts) {
    // Skip if cart already has a logo
    if (cart.tenant_logo) continue;
    
    try {
      // Use tenantPublicService to fetch tenant data
      const { tenantPublicService } = await import('@/services/TenantPublicService');
      const tenantData = await tenantPublicService.getPublicTenantInfo(cart.tenant_id);
      
      if (tenantData && tenantData.metadata?.logo_url) {
        // Update cart with logo
        cart.tenant_logo = tenantData.metadata.logo_url;
        saveCart(cart);
      }
    } catch (error) {
      clientLogger.error(`[Cart] Failed to fetch logo for tenant ${cart.tenant_id}:`, { detail: error });
    }
  }
}

/**
 * Migrate old gateway-wrapped carts to tenant-wrapped carts
 * Merges multiple gateway carts into single tenant cart
 */
export function migrateOldCarts(): void {
  const oldKeys: string[] = [];
  
  // Find old gateway-wrapped cart keys (format: cart_{tenantId}_{gatewayType})
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    // Match gateway-wrapped keys (have two or more underscores after 'cart_')
    if (key?.match(/^cart_[^_]+_[^_]+/)) {
      oldKeys.push(key);
    }
  }
  
  // Group old carts by tenant
  const cartsByTenant: Record<string, Cart> = {};
  
  oldKeys.forEach(oldKey => {
    try {
      const data = localStorage.getItem(oldKey);
      if (!data) return;
      
      const oldCart = JSON.parse(data);
      const match = oldKey.match(/^cart_([^_]+)_/);
      if (!match) return;
      
      const tenantId = match[1];
      
      // Get or create merged cart for this tenant
      if (!cartsByTenant[tenantId]) {
        cartsByTenant[tenantId] = {
          tenant_id: tenantId,
          tenant_name: oldCart.tenant_name || 'Store',
          tenant_logo: oldCart.tenant_logo,
          items: [],
          created_at: oldCart.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
      }
      
      // Merge items, converting gateway_type to suggested_gateway_type
      oldCart.items?.forEach((item: any) => {
        const migratedItem: CartItem = {
          product_id: item.product_id,
          product_name: item.product_name,
          product_sku: item.product_sku,
          product_image: item.product_image,
          quantity: item.quantity,
          price_cents: item.price_cents,
          list_price_cents: item.list_price_cents,
          discount_cents: item.discount_cents,
          suggested_gateway_type: item.gateway_type,
          suggested_gateway_id: item.gateway_id,
          variant_id: item.variant_id,
          variant_name: item.variant_name,
          variant_attributes: item.variant_attributes
        };
        cartsByTenant[tenantId].items.push(migratedItem);
      });
      
      // Remove old cart
      localStorage.removeItem(oldKey);
      console.log(`[Cart] Migrated gateway-wrapped cart: ${oldKey}`);
    } catch (error) {
      clientLogger.error(`[Cart] Failed to migrate ${oldKey}:`, { detail: error });
    }
  });
  
  // Save merged carts
  Object.values(cartsByTenant).forEach(cart => {
    if (cart.items.length > 0) {
      saveCart(cart);
      console.log(`[Cart] Created tenant-wrapped cart for ${cart.tenant_id} with ${cart.items.length} items`);
    }
  });
}

export function validateFulfillmentMethod(
  items: CartItem[],
  fulfillmentMethod: string
): { valid: boolean; reason?: string } {
  if (!items.length || !fulfillmentMethod) return { valid: true };

  const types = items.map(i => i.productType || 'physical');
  const isDigitalOnly = types.length > 0 && types.every(t => t === 'digital');
  const isServiceOnly = types.length > 0 && types.every(t => t === 'service');

  if (isDigitalOnly && ['pickup', 'delivery', 'shipping'].includes(fulfillmentMethod)) {
    return { valid: false, reason: 'Digital-only orders do not require a physical fulfillment method' };
  }
  if (isServiceOnly && fulfillmentMethod === 'shipping') {
    return { valid: false, reason: 'Service-only orders cannot use shipping fulfillment' };
  }

  return { valid: true };
}
