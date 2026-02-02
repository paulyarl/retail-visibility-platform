/**
 * Universal Singleton Cart Service
 * Multi-shop cart support with platform-wide cart management
 */

import { CartItem, ShopCart, PlatformCart } from '@/types/cart';

export interface ShopCartService {
  addToCart(shopId: string, productId: string, quantity: number): Promise<void>;
  removeFromCart(shopId: string, productId: string): Promise<void>;
  updateQuantity(shopId: string, productId: string, quantity: number): Promise<void>;
  getShopCart(shopId: string): Promise<ShopCart>;
  updateShopCart(shopId: string, items: CartItem[]): Promise<void>;
  clearShopCart(shopId: string): Promise<void>;
  getPlatformCart(): Promise<PlatformCart>;
  mergeCarts(carts: Record<string, ShopCart>): Promise<PlatformCart>;
}

class PlatformCartService implements ShopCartService {
  private static instance: PlatformCartService;
  private carts: Map<string, ShopCart> = new Map();
  private readonly STORAGE_KEY = 'platform_shopping_cart';

  private constructor() {
    this.loadCartsFromStorage();
  }

  static getInstance(): PlatformCartService {
    if (!PlatformCartService.instance) {
      PlatformCartService.instance = new PlatformCartService();
    }
    return PlatformCartService.instance;
  }

  private loadCartsFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        this.carts = new Map(Object.entries(data.carts || {}));
      }
    } catch (error) {
      console.error('Error loading carts from storage:', error);
    }
  }

  private saveCartsToStorage(): void {
    try {
      const data = {
        carts: Object.fromEntries(this.carts),
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving carts to storage:', error);
    }
  }

  async addToCart(shopId: string, productId: string, quantity: number): Promise<void> {
    const shopCart = this.carts.get(shopId) || {
      shopId,
      items: [],
      totalItems: 0,
      totalPrice: 0,
      lastUpdated: new Date().toISOString()
    };

    const existingItem = shopCart.items.find((item: CartItem) => item.productId === productId);
    
    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.lastAdded = new Date().toISOString();
    } else {
      // In a real implementation, we'd fetch product details
      const newItem: CartItem = {
        productId,
        quantity,
        price: 0, // Would fetch from API
        addedAt: new Date().toISOString(),
        lastAdded: new Date().toISOString()
      };
      shopCart.items.push(newItem);
    }

    this.recalculateShopCart(shopCart);
    this.carts.set(shopId, shopCart);
    this.saveCartsToStorage();
  }

  async removeFromCart(shopId: string, productId: string): Promise<void> {
    const shopCart = this.carts.get(shopId);
    if (!shopCart) return;

    shopCart.items = shopCart.items.filter((item: CartItem) => item.productId !== productId);
    this.recalculateShopCart(shopCart);
    
    if (shopCart.items.length === 0) {
      this.carts.delete(shopId);
    } else {
      this.carts.set(shopId, shopCart);
    }
    
    this.saveCartsToStorage();
  }

  async updateQuantity(shopId: string, productId: string, quantity: number): Promise<void> {
    const shopCart = this.carts.get(shopId);
    if (!shopCart) return;

    const item = shopCart.items.find((item: CartItem) => item.productId === productId);
    if (!item) return;

    if (quantity <= 0) {
      await this.removeFromCart(shopId, productId);
    } else {
      item.quantity = quantity;
      item.lastAdded = new Date().toISOString();
      this.recalculateShopCart(shopCart);
      this.carts.set(shopId, shopCart);
      this.saveCartsToStorage();
    }
  }

  async getShopCart(shopId: string): Promise<ShopCart> {
    return this.carts.get(shopId) || {
      shopId,
      items: [],
      totalItems: 0,
      totalPrice: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  async updateShopCart(shopId: string, items: CartItem[]): Promise<void> {
    const shopCart: ShopCart = {
      shopId,
      items: items.map(item => ({
        ...item,
        lastAdded: item.lastAdded || new Date().toISOString()
      })),
      totalItems: 0,
      totalPrice: 0,
      lastUpdated: new Date().toISOString()
    };

    this.recalculateShopCart(shopCart);
    this.carts.set(shopId, shopCart);
    this.saveCartsToStorage();
  }

  async clearShopCart(shopId: string): Promise<void> {
    this.carts.delete(shopId);
    this.saveCartsToStorage();
  }

  async getPlatformCart(): Promise<PlatformCart> {
    const carts = Object.fromEntries(this.carts);
    return this.mergeCarts(carts);
  }

  async mergeCarts(carts: Record<string, ShopCart>): Promise<PlatformCart> {
    const platformCart: PlatformCart = {
      shops: carts,
      totalItems: 0,
      totalPrice: 0,
      lastUpdated: new Date().toISOString()
    };

    // Calculate totals across all shops
    Object.values(carts).forEach(shopCart => {
      platformCart.totalItems += shopCart.totalItems;
      platformCart.totalPrice += shopCart.totalPrice;
    });

    return platformCart;
  }

  private recalculateShopCart(shopCart: ShopCart): void {
    shopCart.totalItems = shopCart.items.reduce((sum: number, item: CartItem) => sum + item.quantity, 0);
    shopCart.totalPrice = shopCart.items.reduce((sum: number, item: CartItem) => sum + (item.price * item.quantity), 0);
    shopCart.lastUpdated = new Date().toISOString();
  }

  // Utility methods
  async getCartItemCount(shopId?: string): Promise<number> {
    if (shopId) {
      const cart = await this.getShopCart(shopId);
      return cart.totalItems;
    }
    
    const platformCart = await this.getPlatformCart();
    return platformCart.totalItems;
  }

  async isCartEmpty(shopId?: string): Promise<boolean> {
    const itemCount = await this.getCartItemCount(shopId);
    return itemCount === 0;
  }

  async getCartSummary(): Promise<{
    totalShops: number;
    totalItems: number;
    totalPrice: number;
  }> {
    const platformCart = await this.getPlatformCart();
    return {
      totalShops: Object.keys(platformCart.shops).length,
      totalItems: platformCart.totalItems,
      totalPrice: platformCart.totalPrice
    };
  }
}

// Export singleton instance
export const cartService = PlatformCartService.getInstance();

// React hook for cart functionality
import { useState, useEffect } from 'react';

export function usePlatformCart(shopId?: string) {
  const [cart, setCart] = useState<ShopCart | PlatformCart | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCart = async () => {
      setLoading(true);
      try {
        if (shopId) {
          const shopCart = await cartService.getShopCart(shopId);
          setCart(shopCart);
        } else {
          const platformCart = await cartService.getPlatformCart();
          setCart(platformCart);
        }
      } catch (error) {
        console.error('Error loading cart:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCart();
  }, [shopId]);

  const addToCart = async (productId: string, quantity: number) => {
    if (!shopId) throw new Error('Shop ID is required for adding to cart');
    await cartService.addToCart(shopId, productId, quantity);
    // Reload cart
    const updatedCart = await cartService.getShopCart(shopId);
    setCart(updatedCart);
  };

  const removeFromCart = async (productId: string) => {
    if (!shopId) throw new Error('Shop ID is required for removing from cart');
    await cartService.removeFromCart(shopId, productId);
    // Reload cart
    const updatedCart = await cartService.getShopCart(shopId);
    setCart(updatedCart);
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (!shopId) throw new Error('Shop ID is required for updating quantity');
    await cartService.updateQuantity(shopId, productId, quantity);
    // Reload cart
    const updatedCart = await cartService.getShopCart(shopId);
    setCart(updatedCart);
  };

  const clearCart = async () => {
    if (!shopId) throw new Error('Shop ID is required for clearing cart');
    await cartService.clearShopCart(shopId);
    // Reload cart
    const updatedCart = await cartService.getShopCart(shopId);
    setCart(updatedCart);
  };

  return {
    cart,
    loading,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    isEmpty: cart ? ('totalItems' in cart ? cart.totalItems === 0 : (cart as any).items.length === 0) : true
  };
}
