/**
 * Item Update Service
 * 
 * Handles item mutation operations with automatic cache invalidation.
 * Extends UniversalSingleton for consistent architecture.
 * 
 * Features:
 * - Update item details
 * - Create new items
 * - Delete items
 * - Automatic cache invalidation in ProductSingleton and PhotoSingleton
 * - Performance metrics tracking
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

// ====================
// TYPES
// ====================

export interface ItemUpdateData {
  sku?: string;
  name?: string;
  brand?: string;
  manufacturer?: string;
  condition?: 'new' | 'used' | 'refurbished';
  mpn?: string;
  price_cents?: number;
  salePriceCents?: number;
  stock?: number;
  description?: string;
  metadata?: Record<string, any>;
  itemStatus?: string;
  item_status?: string;
  tenantCategoryId?: string | null;
  payment_gateway_type?: string;
  payment_gateway_id?: string;
  has_variants?: boolean;
  product_type?: string;
  digital_delivery_method?: string;
  digital_assets?: any;
  license_type?: string;
  access_duration_days?: number;
  download_limit?: number;
  [key: string]: any;
}

export interface ItemUpdateResult {
  success: boolean;
  item?: any;
  message?: string;
  error?: string;
}

// ====================
// ITEM UPDATE SERVICE
// ====================

class ItemUpdateService extends TenantApiSingleton {
  protected static instances: Map<string, ItemUpdateService> = new Map();

  private constructor(tenantId: string) {
    super(`item-update-service-${tenantId}`);
  }

  static getInstance(tenantId: string): ItemUpdateService {
    if (!this.instances.has(tenantId)) {
      this.instances.set(tenantId, new ItemUpdateService(tenantId));
    }
    return this.instances.get(tenantId)!;
  }

  static destroyInstance(tenantId: string): void {
    this.instances.delete(tenantId);
  }

  // ====================
  // UPDATE METHODS
  // ====================

  /**
   * Update an existing item
   * Automatically invalidates ProductSingleton and PhotoSingleton caches
   */
  async updateItem(itemId: string, data: ItemUpdateData): Promise<ItemUpdateResult> {
    try {
      const updatedItem = await this.makeDefaultRequest(
        `/api/items/${itemId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      ) as any;

     // console.log('[ItemUpdateService] API Response:', updatedItem);

      // API returns item data directly, not wrapped in success property
      // Check if there's an error property in the response
      if (updatedItem.error) {
        throw new Error(updatedItem.error || `Failed to update item`);
      }

      // The API returns the item data directly
      const result = updatedItem;

      // Invalidate caches after successful update
      await this.invalidateRelatedCaches(itemId);

      // console.log('[ItemUpdateService] Item updated successfully:', itemId);
      return {
        success: true,
        item: result,
        message: 'Item updated successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update item';
      console.error('[ItemUpdateService] Error updating item:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Create a new item
   * Automatically invalidates ProductSingleton cache
   */
  async createItem(data: ItemUpdateData): Promise<ItemUpdateResult> {
    try {
      const newItem = await this.makeDefaultRequest(
        `/api/items`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      ) as any;

      if (!newItem.success) {
        throw new Error(newItem.error || `Failed to create item`);
      }

      const result = newItem.data;

      // Invalidate ProductSingleton cache to include new item
      await this.invalidateProductCache();

    //  console.log('[ItemUpdateService] Item created successfully:', result.item?.id);
      return {
        success: true,
        item: result.item || result,
        message: 'Item created successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create item';
      console.error('[ItemUpdateService] Error creating item:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Delete an item (soft delete to trash)
   * Automatically invalidates caches
   */
  async deleteItem(itemId: string): Promise<ItemUpdateResult> {
    try {
      const response = await this.makeDefaultRequest(
        `/api/items/${itemId}`,
        {
          method: 'DELETE',
        }
      ) as { success: boolean; error?: string };

      if (!response.success) {
        throw new Error(response.error || `Failed to delete item`);
      }

      // Invalidate caches after successful deletion
      await this.invalidateRelatedCaches(itemId);

    //  console.log('[ItemUpdateService] Item deleted successfully:', itemId);
      return {
        success: true,
        message: 'Item moved to trash',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete item';
      console.error('[ItemUpdateService] Error deleting item:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Restore an item from trash
   * Automatically invalidates caches
   */
  async restoreItem(itemId: string): Promise<ItemUpdateResult> {
    try {
      const restoredItem = await this.makeDefaultRequest(
        `/api/items/${itemId}/restore`,
        {
          method: 'PATCH',
        }
      ) as { success: boolean; error?: string };

      if (!restoredItem.success) {
        throw new Error(restoredItem.error || `Failed to restore item`);
      }

      // Invalidate caches after successful restore
      await this.invalidateRelatedCaches(itemId);

     // console.log('[ItemUpdateService] Item restored successfully:', itemId);
      return {
        success: true,
        message: 'Item restored from trash',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to restore item';
      console.error('[ItemUpdateService] Error restoring item:', error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  // ====================
  // CACHE INVALIDATION
  // ====================

  /**
   * Invalidate related caches after item mutation
   * Clears ProductSingleton and PhotoSingleton caches
   */
  private async invalidateRelatedCaches(itemId: string): Promise<void> {
    try {
      // Invalidate ProductSingleton cache
      // Note: ProductSingleton doesn't have direct invalidation methods
      // We clear the entire cache to ensure fresh data
      await this.invalidateProductCache();

      // Invalidate PhotoSingleton cache for this item
      await this.invalidatePhotoCache(itemId);

    //  console.log('[ItemUpdateService] Related caches invalidated for item:', itemId);
    } catch (error) {
      console.error('[ItemUpdateService] Error invalidating caches:', error);
    }
  }

  /**
   * Invalidate ProductSingleton cache
   * Forces fresh fetch on next product request
   */
  private async invalidateProductCache(): Promise<void> {
    try {
      // Clear all product-related cache keys
      await this.clearCache();
      // console.log('[ItemUpdateService] ProductSingleton cache invalidated');
    } catch (error) {
      console.error('[ItemUpdateService] Error invalidating product cache:', error);
    }
  }

  /**
   * Invalidate PhotoSingleton cache for specific item
   */
  private async invalidatePhotoCache(itemId: string): Promise<void> {
    try {
      // Import PhotoSingleton dynamically to avoid circular dependencies
      const PhotoSingleton = (await import('./PhotoSingleton')).default;
      const tenantId = this.singletonKey.replace('item-update-service-', '');
      const photoSingleton = PhotoSingleton.getInstance(tenantId);
      await photoSingleton.invalidateItemCache(itemId);
      // console.log('[ItemUpdateService] PhotoSingleton cache invalidated for item:', itemId);
    } catch (error) {
      console.error('[ItemUpdateService] Error invalidating photo cache:', error);
    }
  }

  // ====================
  // METRICS
  // ====================

  /**
   * Get performance metrics
   */
  getMetrics() {
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: this.cacheHits + this.cacheMisses > 0 
        ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100 
        : 0,
      apiCalls: this.apiCalls,
      cacheSize: this.cache.size,
      inMemoryCacheSize: this.cache.size,
      persistentCacheSize: 0, // Managed by CacheManager
      errors: 0, // TODO: Track errors
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.apiCalls = 0;
    console.log('[ItemUpdateService] Metrics reset');
  }
}

export default ItemUpdateService;
