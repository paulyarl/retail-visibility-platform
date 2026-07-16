import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import { ItemsSingletonService, Item } from './ItemsSingletonService';
import { platformDashboardService } from './PlatformDashboardSingletonService';
import { clientLogger } from '@/lib/client-logger';

export interface StockUpdateOptions {
  tenantId?: string;
  onSuccess?: (newStock: number) => void;
  onError?: (error: Error) => void;
  singletonRefresh?: () => Promise<void>; // Optional singleton refresh callback
}

/**
 * Stock Update Service
 * Extends AuthenticatedApiSingleton for platform-aligned stock management
 * Uses singleton pattern with proper caching and authentication
 * Composes ItemsSingletonService for item-related operations
 */
export class StockUpdateService extends TenantApiSingleton {
  private static instance: StockUpdateService;
  private itemsService: ItemsSingletonService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'stock-update*',
      'inventory-sync*',
      'stock-levels*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('stock-update*');
    await this.invalidateCachePattern('inventory-sync*');
    await this.invalidateCachePattern('stock-levels*');
  }

  private constructor() {
    super('stock-update-service');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes for stock updates
    this.itemsService = ItemsSingletonService.getInstance();
  }

  public static getInstance(): StockUpdateService {
    if (!StockUpdateService.instance) {
      StockUpdateService.instance = new StockUpdateService();
    }
    return StockUpdateService.instance;
  }
  /**
   * Update stock for a single item
   * Uses platform-aligned API calls with proper caching
   */
  async updateStock(
    itemId: string, 
    newStock: number, 
    options: StockUpdateOptions = {}
  ): Promise<void> {
    try {
      console.log(`[StockUpdateService] Updating stock for item ${itemId} to ${newStock}`);
      
      // Validate stock value
      if (newStock < 0) {
        throw new Error('Stock cannot be negative');
      }

      // Use ItemsSingletonService's makeDefaultRequest for platform alignment
      const result = await this.makeDefaultRequest<Item>(
        `/api/items/${itemId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ stock: newStock }),
        },
        `stock-update-${itemId}`
      );

      if (!result.success) {
        throw new Error(getErrorMessage(result.error) || `Failed to update stock (${result.status})`);
      }

      console.log(`[StockUpdateService] Stock update successful:`, result.data);

      // Invalidate relevant cache entries
      await this.invalidateStockCaches(itemId, options.tenantId);

      // Trigger singleton refresh if provided (for MV cache invalidation)
      if (options.singletonRefresh) {
        try {
          console.log(`[StockUpdateService] Triggering singleton refresh for MV cache invalidation`);
          await options.singletonRefresh();
          console.log(`[StockUpdateService] Singleton refresh completed`);
        } catch (refreshError) {
          clientLogger.warn(`[StockUpdateService] Singleton refresh failed:`, { detail: refreshError });
          // Don't fail the stock update if refresh fails
        }
      }

      // Call success callback
      if (options.onSuccess) {
        options.onSuccess(newStock);
      }

    } catch (error) {
      clientLogger.error(`[StockUpdateService] Failed to update stock:`, { detail: error });
      
      // Call error callback
      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error('Unknown error'));
      }
      
      throw error;
    }
  }

  /**
   * Bulk update stock for multiple items
   * Uses platform-aligned API calls with proper caching
   */
  async bulkUpdateStock(
    updates: Array<{ itemId: string; newStock: number }>,
    options: StockUpdateOptions = {}
  ): Promise<void> {
    try {
      console.log(`[StockUpdateService] Bulk updating stock for ${updates.length} items`);

      // Validate all stock values
      for (const update of updates) {
        if (update.newStock < 0) {
          throw new Error(`Stock cannot be negative for item ${update.itemId}`);
        }
      }

      // Call bulk update API (if available) or individual updates
      const updatePromises = updates.map(({ itemId, newStock }) =>
        this.updateStock(itemId, newStock, {
          onSuccess: undefined, // Don't call individual success callbacks for bulk updates
          onError: undefined,
          tenantId: options.tenantId
        })
      );

      await Promise.all(updatePromises);

      // Call success callback once for bulk operation
      if (options.onSuccess) {
        options.onSuccess(updates.length);
      }

    } catch (error) {
      clientLogger.error(`[StockUpdateService] Failed to bulk update stock:`, { detail: error });
      
      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error('Unknown error'));
      }
      
      throw error;
    }
  }

  /**
   * Get stock status with recommendations
   */
  getStockStatus(stock: number): {
    status: 'in_stock' | 'low_stock' | 'out_of_stock';
    color: string;
    message: string;
    recommendation: string;
  } {
    if (stock === 0) {
      return {
        status: 'out_of_stock',
        color: 'red',
        message: 'Out of Stock',
        recommendation: 'Restock immediately to enable featuring'
      };
    } else if (stock <= 5) {
      return {
        status: 'low_stock',
        color: 'amber',
        message: 'Low Stock',
        recommendation: 'Consider restocking soon'
      };
    } else {
      return {
        status: 'in_stock',
        color: 'green',
        message: 'In Stock',
        recommendation: 'Stock level is healthy'
      };
    }
  }

  /**
   * Invalidate relevant caches after stock update
   */
  private async invalidateStockCaches(itemId: string, tenantId?: string): Promise<void> {
    try {
      console.log(`[StockUpdateService] Invalidating caches for item ${itemId}`);
      
      // Invalidate specific item cache using itemsService
      await this.itemsService.invalidateCache(`item-${itemId}`);
      
      // Invalidate items complete cache for tenant using itemsService
      const targetTenantId = tenantId || 'unknown';
      await this.itemsService.invalidateCache(`items_complete_tenant_${targetTenantId}*`);
      
      // Invalidate stock-related caches using this service
      await this.invalidateCache(`stock-status-${itemId}`);
      await this.invalidateCache(`low-stock-items-${targetTenantId}`);
      
      // Invalidate platform dashboard cache since items affect stats
      await platformDashboardService.invalidateCache('platform-dashboard-complete');
      
      console.log(`[StockUpdateService] Cache invalidation completed for item ${itemId}`);
    } catch (error) {
      clientLogger.warn(`[StockUpdateService] Failed to invalidate caches:`, { detail: error });
      // Don't fail the stock update if cache invalidation fails
    }
  }
}
