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
  backfillCartLogos
} from '@/lib/cart/cartManager';

export function useMultiCart(tenantId?: string) {
  const [carts, setCarts] = useState<CartSummary[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);

  // Load carts from localStorage
  const loadCarts = useCallback(async () => {
    try {
      // Migrate old carts on first load
      if (typeof window !== 'undefined' && !sessionStorage.getItem('carts_migrated')) {
        migrateOldCarts();
        sessionStorage.setItem('carts_migrated', 'true');
      }

      // Backfill tenant logos for existing carts (one-time)
      if (typeof window !== 'undefined' && !sessionStorage.getItem('logos_backfilled')) {
        await backfillCartLogos();
        sessionStorage.setItem('logos_backfilled', 'true');
      }

      const allCarts = getAllCarts(tenantId);
      setCarts(allCarts);
      setTotalItems(getTotalItemCount(tenantId));
    } catch (error) {
      console.error('[useMultiCart] Failed to load carts:', error);
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

  // Add item to cart with intelligent routing
  const addToCart = useCallback(async (
    tenantId: string,
    tenantName: string,
    gatewayType: string,
    item: Omit<CartItem, 'gateway_type'>,
    tenantLogo?: string
  ) => {
    try {
      addToCartManager(tenantId, tenantName, gatewayType, item, tenantLogo);
      loadCarts();
      return { success: true };
    } catch (error) {
      console.error('[useMultiCart] Failed to add to cart:', error);
      return { success: false, error };
    }
  }, [loadCarts]);

  // Update item quantity
  const updateQuantity = useCallback((
    tenantId: string,
    gatewayType: string,
    productId: string,
    quantity: number
  ) => {
    try {
      updateCartItemQuantity(tenantId, gatewayType, productId, quantity);
      loadCarts();
      return { success: true };
    } catch (error) {
      console.error('[useMultiCart] Failed to update quantity:', error);
      return { success: false, error };
    }
  }, [loadCarts]);

  // Remove item from cart
  const removeItem = useCallback((
    tenantId: string,
    gatewayType: string,
    productId: string
  ) => {
    try {
      removeFromCart(tenantId, gatewayType, productId);
      loadCarts();
      return { success: true };
    } catch (error) {
      console.error('[useMultiCart] Failed to remove item:', error);
      return { success: false, error };
    }
  }, [loadCarts]);

  // Clear specific cart
  const clearSpecificCart = useCallback((
    tenantId: string,
    gatewayType: string
  ) => {
    try {
      clearCart(tenantId, gatewayType);
      loadCarts();
      return { success: true };
    } catch (error) {
      console.error('[useMultiCart] Failed to clear cart:', error);
      return { success: false, error };
    }
  }, [loadCarts]);

  // Get specific cart
  const getCartByType = useCallback((gatewayType: string): CartSummary | undefined => {
    return carts.find(c => c.cart.gateway_type === gatewayType);
  }, [carts]);

  // Get cart by tenant and gateway type
  const getCartByGateway = useCallback((tenantId: string, gatewayType: string): CartSummary | undefined => {
    return carts.find(c => c.cart.tenant_id === tenantId && c.cart.gateway_type === gatewayType);
  }, [carts]);

  // Get cart count by gateway type
  const getCartCountByType = useCallback((gatewayType: string): number => {
    const cart = getCartByType(gatewayType);
    return cart?.item_count || 0;
  }, [getCartByType]);

  return {
    carts,
    totalItems,
    loading,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart: clearSpecificCart,
    getCartByType,
    getCartByGateway,
    getCartCountByType,
    refresh: loadCarts
  };
}
