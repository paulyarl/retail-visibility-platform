/**
 * Universal Singleton Cart Service
 * Multi-shop cart support with platform-wide cart management
 * Uses PublicApiSingleton for automatic caching and API integration
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
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

class PlatformCartService extends PublicApiSingleton implements ShopCartService {
  public getServiceCachePatterns(): string[] {
    throw new Error('Method not implemented.');
  }
  public invalidateServiceCaches(customerId?: string, ...params: any[]): Promise<void> {
    throw new Error('Method not implemented.');
  }
  private static instance: PlatformCartService;
  private carts: Map<string, ShopCart> = new Map();
  private readonly STORAGE_KEY = 'platform_shopping_cart';

  private constructor() {
    super('platform-cart-service');
    this.cacheTTL = 15 * 60 * 1000; // 15 minutes for cart data
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

  async addToCart(shopId: string, productId: string, quantity: number, productDetails?: Partial<CartItem>): Promise<void> {
    try {
      // Sync with server first
      await this.makeDefaultRequest<void>(
        `/api/carts/${shopId}/items`,
        {
          method: 'POST',
          body: JSON.stringify({ 
            productId, 
            quantity,
            productDetails // Include digital product details
          })
        },
        `cart-add-${shopId}-${productId}`
      );
    } catch (error) {
      console.warn('Failed to sync cart with server, using local fallback:', error);
    }

    // Local storage fallback
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
      // Update digital product details if provided
      if (productDetails) {
        existingItem.productType = productDetails.productType;
        existingItem.digitalDeliveryMethod = productDetails.digitalDeliveryMethod;
        existingItem.hasDownloadPage = productDetails.hasDownloadPage;
        existingItem.downloadPageId = productDetails.downloadPageId;
        existingItem.requiresLicenseKey = productDetails.requiresLicenseKey;
        existingItem.accessDurationDays = productDetails.accessDurationDays;
        existingItem.downloadLimit = productDetails.downloadLimit;
      }
    } else {
      // Create new item with digital product details
      const newItem: CartItem = {
        productId,
        quantity,
        price: productDetails?.price || 0,
        addedAt: new Date().toISOString(),
        lastAdded: new Date().toISOString(),
        productName: productDetails?.productName,
        productImage: productDetails?.productImage,
        productSku: productDetails?.productSku,
        // Digital product fields
        productType: productDetails?.productType,
        digitalDeliveryMethod: productDetails?.digitalDeliveryMethod,
        hasDownloadPage: productDetails?.hasDownloadPage,
        downloadPageId: productDetails?.downloadPageId,
        requiresLicenseKey: productDetails?.requiresLicenseKey,
        accessDurationDays: productDetails?.accessDurationDays,
        downloadLimit: productDetails?.downloadLimit
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
    hasDigitalProducts: boolean;
    hasPhysicalProducts: boolean;
    requiresShipping: boolean;
  }> {
    const platformCart = await this.getPlatformCart();
    const allItems = Object.values(platformCart.shops).flatMap(shop => shop.items);
    
    const hasDigitalProducts = allItems.some(item => 
      item.productType === 'digital' || item.productType === 'hybrid'
    );
    const hasPhysicalProducts = allItems.some(item => 
      item.productType === 'physical' || item.productType === 'hybrid'
    );
    
    return {
      totalShops: Object.keys(platformCart.shops).length,
      totalItems: platformCart.totalItems,
      totalPrice: platformCart.totalPrice,
      hasDigitalProducts,
      hasPhysicalProducts,
      requiresShipping: hasPhysicalProducts
    };
  }

  // Digital product specific methods
  async getDigitalCartItems(shopId?: string): Promise<CartItem[]> {
    const cart = shopId 
      ? await this.getShopCart(shopId)
      : await this.getPlatformCart();
    
    const items = shopId 
      ? (cart as ShopCart).items 
      : Object.values((cart as PlatformCart).shops).flatMap(shop => shop.items);
    
    return items.filter(item => 
      item.productType === 'digital' || item.productType === 'hybrid'
    );
  }

  async getPhysicalCartItems(shopId?: string): Promise<CartItem[]> {
    const cart = shopId 
      ? await this.getShopCart(shopId)
      : await this.getPlatformCart();
    
    const items = shopId 
      ? (cart as ShopCart).items 
      : Object.values((cart as PlatformCart).shops).flatMap(shop => shop.items);
    
    return items.filter(item => 
      item.productType === 'physical' || item.productType === 'hybrid'
    );
  }

  async hasDigitalProducts(shopId?: string): Promise<boolean> {
    const digitalItems = await this.getDigitalCartItems(shopId);
    return digitalItems.length > 0;
  }

  async hasLicenseKeyProducts(shopId?: string): Promise<boolean> {
    const digitalItems = await this.getDigitalCartItems(shopId);
    return digitalItems.some(item => item.requiresLicenseKey === true);
  }

  async getCartDigitalSummary(shopId?: string): Promise<{
    totalDigitalItems: number;
    totalDownloadPages: number;
    requiresLicenseActivation: boolean;
    accessDurations: Array<{ productId: string; productName?: string; durationDays?: number }>;
    downloadLimits: Array<{ productId: string; productName?: string; limit?: number }>;
  }> {
    const digitalItems = await this.getDigitalCartItems(shopId);
    
    const uniqueDownloadPages = new Set(
      digitalItems
        .filter(item => item.downloadPageId)
        .map(item => item.downloadPageId)
    );
    
    const requiresLicenseActivation = digitalItems.some(
      item => item.requiresLicenseKey === true
    );
    
    const accessDurations = digitalItems
      .filter(item => item.accessDurationDays !== undefined)
      .map(item => ({
        productId: item.productId,
        productName: item.productName,
        durationDays: item.accessDurationDays
      }));
    
    const downloadLimits = digitalItems
      .filter(item => item.downloadLimit !== undefined)
      .map(item => ({
        productId: item.productId,
        productName: item.productName,
        limit: item.downloadLimit
      }));
    
    return {
      totalDigitalItems: digitalItems.length,
      totalDownloadPages: uniqueDownloadPages.size,
      requiresLicenseActivation,
      accessDurations,
      downloadLimits
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
