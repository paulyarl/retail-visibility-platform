import { api } from '@/lib/api';

export interface StockUpdateOptions {
  tenantId?: string;
  onSuccess?: (newStock: number) => void;
  onError?: (error: Error) => void;
  singletonRefresh?: () => Promise<void>; // Optional singleton refresh callback
}

/**
 * Reusable stock update service
 * Can be used across the platform for quick stock changes
 */
export class StockUpdateService {
  /**
   * Update stock for a single item
   */
  static async updateStock(
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

      // Call the items API to update stock
      const response = await api.put(`/api/items/${itemId}`, {
        stock: newStock
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `Failed to update stock (${response.status})`);
      }

      const result = await response.json();
      console.log(`[StockUpdateService] Stock update successful:`, result);

      // Trigger singleton refresh if provided (for MV cache invalidation)
      if (options.singletonRefresh) {
        try {
          console.log(`[StockUpdateService] Triggering singleton refresh for MV cache invalidation`);
          await options.singletonRefresh();
          console.log(`[StockUpdateService] Singleton refresh completed`);
        } catch (refreshError) {
          console.warn(`[StockUpdateService] Singleton refresh failed:`, refreshError);
          // Don't fail the stock update if refresh fails
        }
      }

      // Call success callback
      if (options.onSuccess) {
        options.onSuccess(newStock);
      }

    } catch (error) {
      console.error(`[StockUpdateService] Failed to update stock:`, error);
      
      // Call error callback
      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error('Unknown error'));
      }
      
      throw error;
    }
  }

  /**
   * Bulk update stock for multiple items
   */
  static async bulkUpdateStock(
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
          onError: undefined
        })
      );

      await Promise.all(updatePromises);

      // Call success callback once for bulk operation
      if (options.onSuccess) {
        options.onSuccess(updates.length);
      }

    } catch (error) {
      console.error(`[StockUpdateService] Failed to bulk update stock:`, error);
      
      if (options.onError) {
        options.onError(error instanceof Error ? error : new Error('Unknown error'));
      }
      
      throw error;
    }
  }

  /**
   * Get stock status with recommendations
   */
  static getStockStatus(stock: number): {
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
}
