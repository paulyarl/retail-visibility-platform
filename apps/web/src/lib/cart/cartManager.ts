/**
 * Multi-Cart Manager
 * Handles intelligent cart routing based on tenant + gateway type
 */

export interface CartItem {
  product_id: string;
  product_name: string;
  product_sku?: string;
  product_image?: string;
  quantity: number;
  price_cents: number; // unit_price_cents (effective price: sale price if on sale, otherwise list price)
  list_price_cents?: number; // Original list price (only set when item is on sale)
  discount_cents?: number; // Total discount amount (list_price - unit_price) * quantity
  gateway_type: string;
  gateway_id?: string;
  gateway_display_name?: string;
  // Product variant fields
  variant_id?: string; // Variant identifier if product has variants
  variant_name?: string; // Display name like "Large - Blue"
  variant_attributes?: Record<string, string>; // Attributes like {size: "Large", color: "Blue"}
}

export interface Cart {
  tenant_id: string;
  tenant_name: string;
  tenant_logo?: string;
  gateway_type: string;
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
 * Generate cart key based on tenant + gateway type
 */
export function getCartKey(tenantId: string, gatewayType: string): string {
  return `cart_${tenantId}_${gatewayType}`;
}

/**
 * Parse cart key to extract tenant and gateway type
 */
export function parseCartKey(key: string): { tenantId: string; gatewayType: string } | null {
  const match = key.match(/^cart_([^_]+)_(.+)$/);
  if (!match) return null;
  
  return {
    tenantId: match[1],
    gatewayType: match[2]
  };
}

/**
 * Get a specific cart
 */
export function getCart(tenantId: string, gatewayType: string): Cart | null {
  // Check if we're in the browser
  if (typeof window === 'undefined') return null;
  
  const key = getCartKey(tenantId, gatewayType);
  const data = localStorage.getItem(key);
  
  if (!data) return null;
  
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('[Cart] Failed to parse cart:', error);
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
    
    const parsed = parseCartKey(key);
    if (!parsed) continue;
    
    // Filter by tenant if specified
    if (tenantId && parsed.tenantId !== tenantId) continue;
    
    const cart = getCart(parsed.tenantId, parsed.gatewayType);
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
  
  const key = getCartKey(cart.tenant_id, cart.gateway_type);
  cart.updated_at = new Date().toISOString();
  localStorage.setItem(key, JSON.stringify(cart));
}

/**
 * Add item to cart (intelligent routing)
 */
export function addToCart(
  tenantId: string,
  tenantName: string,
  gatewayType: string,
  item: Omit<CartItem, 'gateway_type'>,
  tenantLogo?: string
): void {
  // Get or create cart
  let cart = getCart(tenantId, gatewayType);
  
  if (!cart) {
    // Create new cart
    cart = {
      tenant_id: tenantId,
      tenant_name: tenantName,
      tenant_logo: tenantLogo,
      gateway_type: gatewayType,
      items: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  } else if (tenantLogo && !cart.tenant_logo) {
    // Update existing cart with logo if not already set
    cart.tenant_logo = tenantLogo;
  }
  
  // Check if item already exists
  // Match by product_id, gateway_id, AND variant_id to allow multiple variants of same product
  const existingIndex = cart.items.findIndex(
    i => i.product_id === item.product_id && 
         i.gateway_id === item.gateway_id &&
         i.variant_id === item.variant_id
  );
  
  if (existingIndex >= 0) {
    // Update quantity
    cart.items[existingIndex].quantity += item.quantity;
  } else {
    // Add new item
    cart.items.push({
      ...item,
      gateway_type: gatewayType
    });
  }
  
  saveCart(cart);
  
  // Dispatch custom event for same-tab updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cart-updated', { 
      detail: { tenantId, gatewayType, action: 'add' } 
    }));
  }
}

/**
 * Update item quantity
 */
export function updateCartItemQuantity(
  tenantId: string,
  gatewayType: string,
  productId: string,
  quantity: number
): void {
  const cart = getCart(tenantId, gatewayType);
  if (!cart) return;
  
  const item = cart.items.find(i => i.product_id === productId);
  if (!item) return;
  
  if (quantity <= 0) {
    // Remove item
    cart.items = cart.items.filter(i => i.product_id !== productId);
  } else {
    // Update quantity
    item.quantity = quantity;
  }
  
  if (cart.items.length === 0) {
    // Remove empty cart
    clearCart(tenantId, gatewayType);
  } else {
    saveCart(cart);
    
    // Dispatch custom event for same-tab updates
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('cart-updated', { 
        detail: { tenantId, gatewayType, action: 'update' } 
      }));
    }
  }
}

/**
 * Remove item from cart
 */
export function removeFromCart(
  tenantId: string,
  gatewayType: string,
  productId: string
): void {
  updateCartItemQuantity(tenantId, gatewayType, productId, 0);
}

/**
 * Clear specific cart
 */
export function clearCart(tenantId: string, gatewayType: string): void {
  // Check if we're in the browser
  if (typeof window === 'undefined') return;
  
  const key = getCartKey(tenantId, gatewayType);
  localStorage.removeItem(key);
  
  // Dispatch custom event for same-tab updates
  window.dispatchEvent(new CustomEvent('cart-updated', { 
    detail: { tenantId, gatewayType, action: 'clear' } 
  }));
}

/**
 * Clear all carts (optionally filtered by tenant)
 */
export function clearAllCarts(tenantId?: string): void {
  const carts = getAllCarts(tenantId);
  carts.forEach(({ cart }) => {
    clearCart(cart.tenant_id, cart.gateway_type);
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
 * Backfill tenant logos for existing carts
 */
export async function backfillCartLogos(): Promise<void> {
  // Check if we're in the browser
  if (typeof window === 'undefined') return;
  
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
  const carts = getAllCarts();
  
  for (const { cart } of carts) {
    // Skip if cart already has a logo
    if (cart.tenant_logo) continue;
    
    try {
      // Fetch tenant data to get logo
      const response = await fetch(`${apiBaseUrl}/api/tenants/${cart.tenant_id}`);
      if (response.ok) {
        const tenantData = await response.json();
        const logoUrl = tenantData.metadata?.logo_url;
        
        if (logoUrl) {
          // Update cart with logo
          cart.tenant_logo = logoUrl;
          saveCart(cart);
        }
      }
    } catch (error) {
      console.error(`[Cart] Failed to fetch logo for tenant ${cart.tenant_id}:`, error);
    }
  }
}

/**
 * Migrate old single-cart format to multi-cart
 */
export function migrateOldCarts(): void {
  const oldKeys: string[] = [];
  
  // Find old cart keys (format: cart_{tenantId})
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.match(/^cart_[^_]+$/)) {
      oldKeys.push(key);
    }
  }
  
  // Migrate each old cart
  oldKeys.forEach(oldKey => {
    try {
      const data = localStorage.getItem(oldKey);
      if (!data) return;
      
      const oldCart = JSON.parse(data);
      const tenantId = oldKey.replace('cart_', '');
      
      // Group items by gateway type
      const itemsByType: Record<string, CartItem[]> = {};
      
      oldCart.items?.forEach((item: CartItem) => {
        const type = item.gateway_type || 'default';
        if (!itemsByType[type]) itemsByType[type] = [];
        itemsByType[type].push(item);
      });
      
      // Create new carts
      Object.entries(itemsByType).forEach(([type, items]) => {
        const newCart: Cart = {
          tenant_id: tenantId,
          tenant_name: oldCart.tenant_name || 'Store',
          gateway_type: type,
          items,
          created_at: oldCart.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        saveCart(newCart);
      });
      
      // Remove old cart
      localStorage.removeItem(oldKey);
      console.log(`[Cart] Migrated old cart: ${oldKey}`);
    } catch (error) {
      console.error(`[Cart] Failed to migrate ${oldKey}:`, error);
    }
  });
}
