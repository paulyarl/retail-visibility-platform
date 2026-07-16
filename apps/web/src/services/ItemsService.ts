/**
 * Items Service - Authenticated API Pattern
 * 
 * Manages item operations for tenant inventory management
 * Extends AuthenticatedApiSingleton for consistent caching and metrics
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

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
  product_type?: 'physical' | 'digital' | 'hybrid' | 'service';
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
class ItemsService extends TenantApiSingleton {
  private static instance: ItemsService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'items-service*',
      'tenant-items*',
      'item-management*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('items-service*');
    await this.invalidateCachePattern('tenant-items*');
    await this.invalidateCachePattern('item-management*');
  }

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
    const response = await this.makeDefaultRequest<CloneProductResponse>(
      '/api/clone/product',
      {
        method: 'POST',
        body: JSON.stringify(request)
      },
      `clone-product-${request.productId}`,
      this.CLONE_TTL
    );

    if (!response.success) {
      clientLogger.error('[ItemsService] Failed to clone product:', { detail: response.error });
      throw response.error;
    }

    // Invalidate items cache for this tenant
    await this.invalidateCache(`items-${request.tenantId}`);
    
    return response.data || {
      product: {} as Item,
      success: false,
      message: 'No data returned'
    };
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
    const params = new URLSearchParams();
    if (options.page) params.append('page', options.page.toString());
    if (options.pageSize) params.append('pageSize', options.pageSize.toString());
    if (options.search) params.append('search', options.search);
    if (options.category) params.append('category', options.category);
    if (options.status) params.append('status', options.status);
    if (options.visibility) params.append('visibility', options.visibility);

    const cacheKey = `items-${tenantId}-${params.toString()}`;
    
    const response = await this.makeDefaultRequest<{
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

    if (!response.success) {
      clientLogger.error('[ItemsService] Failed to get items:', { detail: response.error });
      return {
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        totalPages: 0
      };
    }

    return response.data || {
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0
    };
  }

  /**
   * Get item by ID
   */
  async getItem(tenantId: string, itemId: string): Promise<Item | null> {
    const response = await this.makeDefaultRequest<Item>(
      `/api/tenants/${tenantId}/items/${itemId}`,
      {},
      `item-${itemId}`,
      this.ITEMS_TTL
    );

    if (!response.success) {
      clientLogger.error('[ItemsService] Failed to get item:', { detail: response.error });
      return null;
    }

    return response.data || null;
  }

  /**
   * Create a new item
   */
  async createItem(tenantId: string, itemData: Partial<Item>): Promise<Item | null> {
    const response = await this.makeDefaultRequest<Item>(
      `/api/tenants/${tenantId}/items`,
      {
        method: 'POST',
        body: JSON.stringify(itemData)
      },
      `create-item-${tenantId}`,
      this.CLONE_TTL
    );

    if (!response.success) {
      clientLogger.error('[ItemsService] Failed to create item:', { detail: response.error });
      throw response.error;
    }

    // Invalidate items cache for this tenant
    await this.invalidateCache(`items-${tenantId}*`);
    
    return response.data || null;
  }

  /**
   * Create item using legacy endpoint (for bulk upload compatibility)
   * Uses the /api/items?tenantId=${tenantId} endpoint
   */
  async createItemLegacy(tenantId: string, itemData: Partial<Item>): Promise<Item | null> {
    const response = await this.makeDefaultRequest<Item>(
      `/api/items?tenantId=${tenantId}`,
      {
        method: 'POST',
        body: JSON.stringify(itemData)
      },
      `create-item-legacy-${tenantId}`,
      this.CLONE_TTL
    );

    if (!response.success) {
      clientLogger.error('[ItemsService] Failed to create item (legacy):', { detail: response.error });
      throw response.error;
    }

    // Invalidate items cache for this tenant
    await this.invalidateCache(`items-${tenantId}*`);
    
    return response.data || null;
  }

  /**
   * Create items in bulk
   */
  async createItemBulk(tenantId: string, itemData: Partial<Item>[]): Promise<Item[]> {
    const response = await this.makeDefaultRequest<Item[]>(
      `/api/tenants/${tenantId}/items/bulk`,
      {
        method: 'POST',
        body: JSON.stringify(itemData)
      },
      `create-item-bulk-${tenantId}`,
      this.CLONE_TTL
    );

    if (!response.success) {
      clientLogger.error('[ItemsService] Failed to create items in bulk:', { detail: response.error });
      throw response.error;
    }

    // Invalidate items cache for this tenant
    await this.invalidateCache(`items-${tenantId}*`);
    
    return response.data || [];
  }

  /**
   * Update an existing item
   */
  async updateItem(tenantId: string, itemId: string, itemData: Partial<Item>): Promise<Item | null> {
    const response = await this.makeDefaultRequest<Item>(
      `/api/tenants/${tenantId}/items/${itemId}`,
      {
        method: 'PUT',
        body: JSON.stringify(itemData)
      },
      `update-item-${itemId}`,
      0 // No caching for write operations
    );

    if (!response.success) {
      clientLogger.error('[ItemsService] Failed to update item:', { detail: response.error });
      return null;
    }

    // Invalidate relevant caches
    await this.invalidateCache(`items-${tenantId}`);
    await this.invalidateCache(`item-${itemId}`);
    
    return response.data || null;
  }

  /**
   * Delete an item
   */
  async deleteItem(tenantId: string, itemId: string): Promise<boolean> {
    try {
      await this.makeDefaultRequest<void>(
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
      clientLogger.error('[ItemsService] Failed to delete item:', { detail: error });
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
      const result = await this.makeDefaultRequest<any>(
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
      clientLogger.error('[ItemsService] Failed to quick start tenant:', { detail: error });
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
