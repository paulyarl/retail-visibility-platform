/**
 * Items Singleton Service
 *
 * Extends AuthenticatedApiSingleton to provide cached items operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { platformDashboardService } from './PlatformDashboardSingletonService';

export interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string;
  brand?: string;
  manufacturer?: string;
  condition?: 'new' | 'used' | 'refurbished';
  price: number | null;
  stock: number;
  status: 'active' | 'inactive' | 'archived' | 'draft' | 'syncing' | 'trashed';
  visibility: 'public' | 'private';
  categoryPath?: string[];
  tenantCategoryId?: string | null;
  tenantCategory?: {
    id: string;
    name: string;
    slug?: string;
    googleCategoryId?: string | null;
  };
  imageUrl?: string;
  images?: string[];
  metadata?: any;
  createdAt?: string;
  updatedAt?: string;
}

export interface ItemsStats {
  total: number;
  active: number;
  inactive: number;
  syncing: number;
  public: number;
  private: number;
  lowStock: number;
}

export interface ItemsPagination {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ItemsCompleteResponse {
  items: Item[];
  stats: ItemsStats;
  pagination: ItemsPagination;
  _timestamp: string;
}

export interface ItemsCompleteParams {
  tenant_id: string;
  page?: number;
  limit?: number;
  q?: string;
  status?: 'all' | 'active' | 'inactive' | 'syncing' | 'draft' | 'archived';
  visibility?: 'all' | 'public' | 'private';
  categoryId?: string;
  categoryFilter?: 'assigned' | 'unassigned';
}

class ItemsSingletonService extends TenantApiSingleton {
  private static instance: ItemsSingletonService;

  private constructor() {
    super('items-singleton', {
      ttl: 15 * 60 * 1000 // 15 minutes for items data (moderate cache)
    });
  }

  public static getInstance(): ItemsSingletonService {
    if (!ItemsSingletonService.instance) {
      ItemsSingletonService.instance = new ItemsSingletonService();
    }
    return ItemsSingletonService.instance;
  }

  /**
   * Get complete items data with caching
   * Uses the /api/items/complete endpoint
   */
  async getItemsComplete(params: ItemsCompleteParams): Promise<ItemsCompleteResponse | null> {
    // Build query string
    const queryParams = new URLSearchParams();
    queryParams.append('tenant_id', params.tenant_id);
    
    if (params.page) queryParams.append('page', params.page.toString());
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.q) queryParams.append('q', params.q);
    if (params.status && params.status !== 'all') queryParams.append('status', params.status);
    if (params.visibility && params.visibility !== 'all') queryParams.append('visibility', params.visibility);
    if (params.categoryId) queryParams.append('categoryId', params.categoryId);
    if (params.categoryFilter) queryParams.append('categoryFilter', params.categoryFilter);

    const queryString = queryParams.toString();
    const cacheKey = `items_complete_${queryString}`;

    const endpoint = `/api/items/complete?${queryString}`;
    
    const result = await this.makeDefaultRequest<ItemsCompleteResponse>(endpoint, {}, cacheKey);

    if (!result.success) {
      console.error('[ItemsSingleton] Failed to get items complete:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get items by ID with caching
   */
  async getItem(itemId: string): Promise<Item | null> {
    const result = await this.makeDefaultRequest<Item>(
      `/api/items/${itemId}`,
      {},
      `item-${itemId}`
    );

    if (!result.success) {
      console.error('[ItemsSingleton] Failed to get item:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Create new item
   * Note: This will invalidate relevant cache entries
   */
  async createItem(itemData: Partial<Item>, tenantId?: string): Promise<Item | null> {
    const result = await this.makeDefaultRequest<Item>(
      '/api/items',
      {
        method: 'POST',
        body: JSON.stringify(itemData),
      },
      'items-create'
    );

    if (!result.success) {
      console.error('[ItemsSingleton] Failed to create item:', result.error);
      return null;
    }

    // Invalidate items complete cache for this tenant
    const targetTenantId = tenantId || itemData.tenantCategoryId || 'unknown';
    await this.invalidateCache(`items_complete_tenant_${targetTenantId}*`);
    
    // Invalidate platform dashboard cache since items affect stats
    await platformDashboardService.invalidateStatsCache();
    
    return result.data || null;
  }

  /**
   * Update existing item
   * Note: This will invalidate relevant cache entries
   */
  async updateItem(itemId: string, itemData: Partial<Item>, tenantId?: string): Promise<Item | null> {
    const result = await this.makeDefaultRequest<Item>(
      `/api/items/${itemId}`,
      {
        method: 'PUT',
        body: JSON.stringify(itemData),
      },
      `item-update-${itemId}`
    );

    if (!result.success) {
      console.error('[ItemsSingleton] Failed to update item:', result.error);
      return null;
    }

    // Invalidate items complete cache for this tenant
    const targetTenantId = tenantId || itemData.tenantCategoryId || 'unknown';
    await this.invalidateCache(`items_complete_tenant_${targetTenantId}*`);
    
    // Invalidate platform dashboard cache since items affect stats
    await platformDashboardService.invalidateStatsCache();
    
    return result.data || null;
  }

  /**
   * Upload a single photo for an item
   * Uses the /api/items/:itemId/photos endpoint
   */
  async uploadPhoto(itemId: string, photoData: {
    tenantId: string;
    dataUrl: string;
    contentType: string;
    variant_id?: string | null;
  }): Promise<any> {
    if (!itemId) {
      throw new Error('Item ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/items/${itemId}/photos`,
      {
        method: 'POST',
        body: JSON.stringify(photoData)
      },
      `item-upload-photo-${itemId}`
    );

    if (!result.success) {
      console.error('[ItemsSingleton] Failed to upload photo:', result.error);
      throw result.error;
    }

    return result.data;
  }

  /**
   * Upload photos for an item
   * Note: This will invalidate relevant cache entries
   */
  async uploadPhotos(itemId: string, files: File[]): Promise<string[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));

    const result = await this.makeDefaultRequest<any>(
      `/api/items/${itemId}/photos`,
      {
        method: 'POST',
        body: formData,
      },
      `item-upload-photos-${itemId}`
    );

    if (!result.success) {
      console.error('[ItemsSingleton] Failed to upload photos:', result.error);
      throw result.error;
    }

    // Invalidate items complete cache for this tenant
    await this.invalidateCache(`items_complete_*`);
    
    return result.data?.urls || [];
  }

  /**
   * Get photos for an item
   */
  async getPhotos(itemId: string): Promise<any> {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/items/${itemId}/photos`,
        {},
        `item-photos-${itemId}`,
        15 * 60 * 1000 // 15 minutes
      );

      return result;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to get photos:', error);
      throw error;
    }
  }

  /**
   * Set primary photo for an item
   * Uses the /api/items/:itemId/photos/:photoId endpoint
   */
  async setPrimaryPhoto(itemId: string, photoId: string): Promise<any> {
    try {
      if (!itemId || !photoId) {
        throw new Error('Item ID and Photo ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/items/${itemId}/photos/${photoId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ position: 0 })
        },
        `item-set-primary-photo-${itemId}-${photoId}`
      );

      return result;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to set primary photo:', error);
      throw error;
    }
  }

  /**
   * Delete photo for an item
   * Uses the /api/items/:itemId/photos/:photoId endpoint
   */
  async deletePhoto(itemId: string, photoId: string): Promise<any> {
    try {
      if (!itemId || !photoId) {
        throw new Error('Item ID and Photo ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/items/${itemId}/photos/${photoId}`,
        {
          method: 'DELETE'
        },
        `item-delete-photo-${itemId}-${photoId}`
      );

      return result;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to delete photo:', error);
      throw error;
    }
  }

  /**
   * Migrate legacy photos for an item
   * Uses the /api/items/:itemId/photos/migrate-legacy endpoint
   */
  async migrateLegacyPhotos(itemId: string): Promise<any> {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/items/${itemId}/photos/migrate-legacy`,
        {
          method: 'POST',
          body: JSON.stringify({})
        },
        `item-migrate-photos-${itemId}`
      );

      return result;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to migrate legacy photos:', error);
      throw error;
    }
  }

  /**
   * Update photo metadata
   * Uses the /api/items/:itemId/photos/:photoId endpoint
   */
  async updatePhoto(itemId: string, photoId: string, photoData: {
    alt?: string | null;
    caption?: string | null;
  }): Promise<any> {
    try {
      if (!itemId || !photoId) {
        throw new Error('Item ID and Photo ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/items/${itemId}/photos/${photoId}`,
        {
          method: 'PUT',
          body: JSON.stringify(photoData)
        },
        `item-update-photo-${itemId}-${photoId}`
      );

      return result;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to update photo:', error);
      throw error;
    }
  }

  /**
   * Get trash capacity for a tenant
   */
  async getTrashCapacity(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/trash/capacity?tenantId=${tenantId}`,
        {},
        `items-trash-capacity-${tenantId}`,
        5 * 60 * 1000 // 5 minutes for capacity data
      );

      return result;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to get trash capacity:', error);
      throw error;
    }
  }

  /**
   * Get trashed items for a tenant
   */
  async getTrashedItems(tenantId: string, limit: number = 100): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/items?tenantId=${tenantId}&status=trashed&limit=${limit}`,
        {},
        `items-trashed-${tenantId}-${limit}`,
        5 * 60 * 1000 // 5 minutes for trash data
      );

      return result;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to get trashed items:', error);
      throw error;
    }
  }

  /**
   * Restore a trashed item
   */
  async restoreItem(itemId: string): Promise<void> {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      const result = await this.makeDefaultRequest<void>(
        `/api/items/${itemId}/restore`,
        { method: 'PATCH' },
        `item-restore-${itemId}`
      );
    } catch (error) {
      console.error('[ItemsSingleton] Failed to restore item:', error);
      throw error;
    }
  }

  /**
   * Purge a trashed item
   */
  async purgeItem(itemId: string): Promise<void> {
    try {
      if (!itemId) {
        throw new Error('Item ID is required');
      }

      const result = await this.makeDefaultRequest<void>(
        `/api/items/${itemId}/purge`,
        { method: 'DELETE' },
        `item-purge-${itemId}`
      );
    } catch (error) {
      console.error('[ItemsSingleton] Failed to purge item:', error);
      throw error;
    }
  }

  /**
   * Empty all trash
   */
  async emptyTrash(tenantId: string, itemIds: string[]): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await Promise.all(itemIds.map(itemId => 
        this.makeDefaultRequest<void>(
          `/api/items/${itemId}/purge`,
          { method: 'DELETE' },
          `item-purge-${itemId}`
        )
      ));
    } catch (error) {
      console.error('[ItemsSingleton] Failed to empty trash:', error);
      throw error;
    }
  }

  /**
   * Get my scan sessions for a tenant
   */
  async getMyScanSessions(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/scan/my-sessions?tenantId=${tenantId}`,
        {},
        `items-my-scan-sessions-${tenantId}`,
        10 * 60 * 1000 // 10 minutes for scan sessions
      );

      return result;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to get my scan sessions:', error);
      throw error;
    }
  }

  /**
   * Start a new scan session
   */
  async startScanSession(tenantId: string, deviceType: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        '/api/scan/start',
        { 
          method: 'POST',
          body: JSON.stringify({
            tenantId,
            deviceType
          })
        },
        `items-start-scan-session-${tenantId}`
      );

      return result;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to start scan session:', error);
      throw error;
    }
  }

  /**
   * Cancel a scan session
   */
  async cancelScanSession(sessionId: string): Promise<void> {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required');
      }

      await this.makeDefaultRequest<void>(
        `/api/scan/${sessionId}`,
        { method: 'DELETE' },
        `items-cancel-scan-session-${sessionId}`
      );
    } catch (error) {
      console.error('[ItemsSingleton] Failed to cancel scan session:', error);
      throw error;
    }
  }

  /**
   * Cleanup my scan sessions
   */
  async cleanupMyScanSessions(tenantId: string): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.makeDefaultRequest<void>(
        '/api/scan/cleanup-my-sessions',
        { 
          method: 'POST',
          body: JSON.stringify({ tenantId })
        },
        `items-cleanup-scan-sessions-${tenantId}`
      );
    } catch (error) {
      console.error('[ItemsSingleton] Failed to cleanup scan sessions:', error);
      throw error;
    }
  }

  /**
   * Delete item
   * Note: This will invalidate relevant cache entries
   */
  async deleteItem(itemId: string, tenantId?: string): Promise<boolean> {
    try {
      // First get the item to determine its tenant for cache invalidation
      const item = await this.getItem(itemId);
      const targetTenantId = tenantId || item?.tenantCategoryId || 'unknown';

      const result = await this.makeDefaultRequest<{ success: boolean }>(
        `/api/items/${itemId}`,
        {
          method: 'DELETE',
        },
        `item-delete-${itemId}`
      );

      // Invalidate items complete cache for this tenant
      await this.invalidateCache(`items_complete_tenant_${targetTenantId}*`);
      
      // Invalidate platform dashboard cache since items affect stats
      await platformDashboardService.invalidateStatsCache();

      return result.success || false;
    } catch (error) {
      console.error('[ItemsSingleton] Failed to delete item:', error);
      return false;
    }
  }

  /**
   * Invalidate items complete cache by tenant
   */
  public async invalidateItemsCompleteCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`items_complete_tenant_${tenantId}*`);
  }

}

// Export the class for extension
export { ItemsSingletonService };

// Export singleton instance
export const itemsSingletonService = ItemsSingletonService.getInstance();

// Export alias for backward compatibility
export const itemsService = itemsSingletonService;

// Export cache invalidation helper for external use
export const invalidateItemsCache = async (tenantId: string): Promise<void> => {
  const service = ItemsSingletonService.getInstance();
  await service.invalidateCache(`items_complete_tenant_${tenantId}*`);
};
