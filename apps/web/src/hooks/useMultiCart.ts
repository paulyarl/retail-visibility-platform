/**
 * React Hook for Multi-Cart Management
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Cart,
  CartSummary,
  CartItem,
  getAllCarts,
  addToCart as addToCartManager,
  updateCartItemQuantity,
  removeFromCart,
  clearCart,
  getTotalItemCount,
  migrateOldCarts,
  migrateCartLogos
} from '@/lib/cart/cartManager';
import { clientLogger } from '@/lib/client-logger';

export function useMultiCart(tenantId?: string) {
  const [carts, setCarts] = useState<CartSummary[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load carts from localStorage
  const loadCarts = useCallback(async () => {
    try {
      // Migrate old gateway-wrapped carts on first load
      if (typeof window !== 'undefined' && !sessionStorage.getItem('tenant_carts_migrated')) {
        migrateOldCarts();
        sessionStorage.setItem('tenant_carts_migrated', 'true');
      }

      // Backfill tenant logos for existing carts (one-time)
      if (typeof window !== 'undefined' && !sessionStorage.getItem('logos_backfilled')) {
        await migrateCartLogos();
        sessionStorage.setItem('logos_backfilled', 'true');
      }

      const allCarts = getAllCarts(tenantId);
      setCarts(allCarts);
      setTotalItems(getTotalItemCount(tenantId));
    } catch (error) {
      clientLogger.error('[useMultiCart] Failed to load carts:', { detail: error });
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  // Load carts on mount and when tenantId changes
  useEffect(() => {
    loadCarts();
  }, [loadCarts]);

  // Listen for storage events (cart updates in other tabs)
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('cart_')) {
        loadCarts();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [loadCarts]);

  // Listen for custom cart-updated events (same-tab updates)
  useEffect(() => {
    const handleCartUpdate = () => {
      loadCarts();
    };

    window.addEventListener('cart-updated', handleCartUpdate);
    return () => window.removeEventListener('cart-updated', handleCartUpdate);
  }, [loadCarts]);

  // Add item to cart (tenant-based, no gateway routing)
  const addToCart = useCallback(async (
    tenantId: string,
    tenantName: string,
    item: Omit<CartItem, 'suggested_gateway_type' | 'suggested_gateway_id'> & {
      suggested_gateway_type?: string;
      suggested_gateway_id?: string;
    },
    tenantLogo?: string
  ) => {
    try {
      addToCartManager(tenantId, tenantName, item, tenantLogo);
      loadCarts();
      return { success: true };
    } catch (error) {
      clientLogger.error('[useMultiCart] Failed to add to cart:', { detail: error });
      return { success: false, error };
    }
  }, [loadCarts]);

  // Update item quantity
  const updateQuantity = useCallback((
    tenantId: string,
    productId: string,
    quantity: number,
    variantId?: string
  ) => {
    try {
      updateCartItemQuantity(tenantId, productId, quantity, variantId);
      loadCarts();
      return { success: true };
    } catch (error) {
      clientLogger.error('[useMultiCart] Failed to update quantity:', { detail: error });
      return { success: false, error };
    }
  }, [loadCarts]);

  // Remove item from cart
  const removeItem = useCallback((
    tenantId: string,
    productId: string,
    variantId?: string
  ) => {
    try {
      removeFromCart(tenantId, productId, variantId);
      loadCarts();
      return { success: true };
    } catch (error) {
      clientLogger.error('[useMultiCart] Failed to remove item:', { detail: error });
      return { success: false, error };
    }
  }, [loadCarts]);

  // Clear specific cart
  const clearSpecificCart = useCallback((
    tenantId: string
  ) => {
    try {
      clearCart(tenantId);
      loadCarts();
      return { success: true };
    } catch (error) {
      clientLogger.error('[useMultiCart] Failed to clear cart:', { detail: error });
      return { success: false, error };
    }
  }, [loadCarts]);

  // Get cart by tenant
  const getCartByTenant = useCallback((tenantId: string): CartSummary | undefined => {
    return carts.find(c => c.cart.tenant_id === tenantId);
  }, [carts]);

  // Get cart count by tenant
  const getCartCountByTenant = useCallback((tenantId: string): number => {
    const cart = getCartByTenant(tenantId);
    return cart?.item_count || 0;
  }, [getCartByTenant]);

  return {
    carts,
    totalItems,
    loading,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart: clearSpecificCart,
    getCartByTenant,
    getCartCountByTenant,
    refresh: loadCarts
  };
}
