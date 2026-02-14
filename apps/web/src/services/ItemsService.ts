/**
 * Items Service - Authenticated API Pattern
 * 
 * Manages item operations for tenant inventory management
 * Extends AuthenticatedApiSingleton for consistent caching and metrics
 */

import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';

export interface Item {
  id: string;
  name: string;
  sku: string;
  description?: string;
  price?: number;
  priceCents?: number;
  salePrice?: number;
  salePriceCents?: number;
  stock?: number;
  imageUrl?: string;
  brand?: string;
  category?: string;
  status: 'active' | 'inactive' | 'draft';
  visibility: 'public' | 'private';
  createdAt: string;
  updatedAt: string;
  tenantId: string;
}

export interface CloneProductRequest {
  productId: string;
  tenantId: string;
}

export interface CloneProductResponse {
  product: Item;
  success: boolean;
  message: string;
}

/**
 * Items Service - Authenticated API Pattern
 * 
 * Manages item operations for tenant inventory management
 * Uses AuthenticatedApiSingleton for consistent caching and metrics
 */
class ItemsService extends AuthenticatedApiSingleton {
  private static instance: ItemsService;

  // TTL constants for different data types
  private readonly ITEMS_TTL = 5 * 60 * 1000; // 5 minutes for items
  private readonly CLONE_TTL = 0; // No caching for write operations

  private constructor() {
    super('items-service');
  }

  static getInstance(): ItemsService {
    if (!ItemsService.instance) {
      ItemsService.instance = new ItemsService();
    }
    return ItemsService.instance;
  }

  /**
   * Clone a product
   */
  async cloneProduct(request: CloneProductRequest): Promise<CloneProductResponse> {
    try {
      const response = await this.makeAuthenticatedRequest<CloneProductResponse>(
        '/api/clone/product',
        {
          method: 'POST',
          body: JSON.stringify(request)
        },
        `clone-product-${request.productId}`,
        this.CLONE_TTL
      );

      // Invalidate items cache for this tenant
      await this.invalidateCache(`items-${request.tenantId}`);
      
      return response;
    } catch (error) {
      console.error('[ItemsService] Failed to clone product:', error);
      throw error;
    }
  }

  /**
   * Get items for a tenant
   */
  async getItems(tenantId: string, options: {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
    status?: string;
    visibility?: string;
  } = {}): Promise<{
    items: Item[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    try {
      const params = new URLSearchParams();
      if (options.page) params.append('page', options.page.toString());
      if (options.pageSize) params.append('pageSize', options.pageSize.toString());
      if (options.search) params.append('search', options.search);
      if (options.category) params.append('category', options.category);
      if (options.status) params.append('status', options.status);
      if (options.visibility) params.append('visibility', options.visibility);

      const cacheKey = `items-${tenantId}-${params.toString()}`;
      
      const response = await this.makeAuthenticatedRequest<{
        items: Item[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
      }>(
        `/api/tenants/${tenantId}/items?${params}`,
        {},
        cacheKey,
        this.ITEMS_TTL
      );

      return response || {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0
      };
    } catch (error) {
      console.error('[ItemsService] Failed to get items:', error);
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0
      };
    }
  }

  /**
   * Get item by ID
   */
  async getItem(tenantId: string, itemId: string): Promise<Item | null> {
    try {
      const response = await this.makeAuthenticatedRequest<Item>(
        `/api/tenants/${tenantId}/items/${itemId}`,
        {},
        `item-${itemId}`,
        this.ITEMS_TTL
      );

      return response;
    } catch (error) {
      console.error('[ItemsService] Failed to get item:', error);
      return null;
    }
  }

  /**
   * Create a new item
   */
  async createItem(tenantId: string, itemData: Partial<Item>): Promise<Item | null> {
    try {
      const response = await this.makeAuthenticatedRequest<Item>(
        `/api/tenants/${tenantId}/items`,
        {
          method: 'POST',
          body: JSON.stringify(itemData)
        },
        `create-item-${tenantId}`,
        0 // No caching for write operations
      );

      // Invalidate items cache for this tenant
      await this.invalidateCache(`items-${tenantId}`);
      
      return response;
    } catch (error) {
      console.error('[ItemsService] Failed to create item:', error);
      return null;
    }
  }

  /**
   * Update an existing item
   */
  async updateItem(tenantId: string, itemId: string, itemData: Partial<Item>): Promise<Item | null> {
    try {
      const response = await this.makeAuthenticatedRequest<Item>(
        `/api/tenants/${tenantId}/items/${itemId}`,
        {
          method: 'PUT',
          body: JSON.stringify(itemData)
        },
        `update-item-${itemId}`,
        0 // No caching for write operations
      );

      // Invalidate relevant caches
      await this.invalidateCache(`items-${tenantId}`);
      await this.invalidateCache(`item-${itemId}`);
      
      return response;
    } catch (error) {
      console.error('[ItemsService] Failed to update item:', error);
      return null;
    }
  }

  /**
   * Delete an item
   */
  async deleteItem(tenantId: string, itemId: string): Promise<boolean> {
    try {
      await this.makeAuthenticatedRequest<void>(
        `/api/tenants/${tenantId}/items/${itemId}`,
        { method: 'DELETE' },
        `delete-item-${itemId}`,
        0 // No caching for write operations
      );

      // Invalidate relevant caches
      await this.invalidateCache(`items-${tenantId}`);
      await this.invalidateCache(`item-${itemId}`);
      
      return true;
    } catch (error) {
      console.error('[ItemsService] Failed to delete item:', error);
      return false;
    }
  }

  /**
   * Invalidate items cache for a tenant
   */
  async invalidateItemsCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`items-${tenantId}`);
  }

  /**
   * Quick start tenant setup
   * Initialize a tenant with products and categories based on business type
   */
  async quickStartTenant(tenantId: string, businessType?: string): Promise<any> {
    try {
      const result = await this.makeAuthenticatedRequest<any>(
        `/api/v1/tenants/${tenantId}/quick-start`,
        {
          method: 'POST',
          body: JSON.stringify({ businessType })
        },
        `quick-start-tenant-${tenantId}`,
        0 // No caching for write operations
      );

      // Invalidate items cache for this tenant since we're adding new items
      await this.invalidateItemsCache(tenantId);

      return result;
    } catch (error) {
      console.error('[ItemsService] Failed to quick start tenant:', error);
      throw error;
    }
  }

  /**
   * Invalidate specific item cache
   */
  async invalidateItemCache(itemId: string): Promise<void> {
    await this.invalidateCache(`item-${itemId}`);
  }
}

// Export singleton instance
export const itemsService = ItemsService.getInstance();
