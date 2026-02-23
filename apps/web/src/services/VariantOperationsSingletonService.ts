/**
 * Variant Operations Singleton Service
 * 
 * Handles bulk variant operations with automatic caching and error handling.
 * Extends UniversalSingleton for authenticated requests.
 * 
 * Features:
 * - Bulk featured type operations
 * - Bulk sale price operations
 * - Bulk inventory operations
 * - Automatic caching with appropriate TTLs
 * - Error handling and logging
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface BulkFeaturedTypeOperation {
  variantIds: string[];
  featuredType: string;
  priority?: number;
  autoUnfeature?: boolean;
}

export interface BulkSalePriceOperation {
  variantIds: string[];
  salePrice: number;
  salePriceType?: 'percentage' | 'fixed';
  startDate?: string;
  endDate?: string;
}

export interface BulkInventoryOperation {
  variantIds: string[];
  operation: 'add' | 'subtract' | 'set';
  quantity: number;
  reason?: string;
}

export interface VariantOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  message?: string;
  errors?: string[];
  details?: any[];
}

class VariantOperationsSingletonService extends AdminApiSingleton {
  private static instance: VariantOperationsSingletonService;
  
  // Different TTLs for different operations
  private readonly CACHE_TTL_SHORT = 1 * 60 * 1000; // 1 minute for real-time operations
  private readonly CACHE_TTL_MEDIUM = 5 * 60 * 1000; // 5 minutes for semi-static data

  static getInstance(): VariantOperationsSingletonService {
    if (!VariantOperationsSingletonService.instance) {
      VariantOperationsSingletonService.instance = new VariantOperationsSingletonService();
    }
    return VariantOperationsSingletonService.instance;
  }

  protected constructor() {
    super('variant-operations-service', {
      ttl: 5 * 60 * 1000 // 5 minutes for variant operations
    });
  }

  /**
   * Bulk update featured type for variants
   * Authenticated endpoint for variant management
   */
  async bulkUpdateFeaturedType(operation: BulkFeaturedTypeOperation): Promise<VariantOperationResult | null> {
    try {
      if (!operation.variantIds || operation.variantIds.length === 0) {
        throw new Error('Variant IDs are required');
      }

      const response = await this.makeDefaultRequest<VariantOperationResult>(
        '/api/variants/bulk/featured-type',
        {
          method: 'POST',
          body: JSON.stringify({
            variantIds: operation.variantIds,
            featuredType: operation.featuredType,
            priority: operation.priority || 3,
            autoUnfeature: operation.autoUnfeature !== false
          })
        },
        `bulk-featured-type-${operation.variantIds.join('-')}`,
        this.CACHE_TTL_SHORT
      );

      // Add success message if not provided
      if (response.data && !response.data.message) {
        response.data.message = `Successfully updated featured type for ${response.data.processed} variants${response.data.failed > 0 ? ` (${response.data.failed} failed)` : ''}`;
      }

      // Invalidate cache for affected variants
      operation.variantIds.forEach(variantId => {
        this.invalidateCache(`variant-${variantId}`);
      });

      return response.data || null;
    } catch (error) {
      console.error('[VariantOperationsSingleton] Failed to bulk update featured type:', error);
      return null;
    }
  }

  /**
   * Bulk update sale price for variants
   * Authenticated endpoint for variant management
   */
  async bulkUpdateSalePrice(operation: BulkSalePriceOperation): Promise<VariantOperationResult | null> {
    try {
      if (!operation.variantIds || operation.variantIds.length === 0) {
        throw new Error('Variant IDs are required');
      }

      const response = await this.makeDefaultRequest<VariantOperationResult>(
        '/api/variants/bulk/sale-price',
        {
          method: 'POST',
          body: JSON.stringify({
            variantIds: operation.variantIds,
            salePrice: operation.salePrice,
            salePriceType: operation.salePriceType || 'fixed',
            startDate: operation.startDate,
            endDate: operation.endDate
          })
        },
        `bulk-sale-price-${operation.variantIds.join('-')}`,
        this.CACHE_TTL_SHORT
      );

      // Add success message if not provided
      if (response.data && !response.data.message) {
        response.data.message = `Successfully updated sale price for ${response.data.processed} variants${response.data.failed > 0 ? ` (${response.data.failed} failed)` : ''}`;
      }

      // Invalidate cache for affected variants
      operation.variantIds.forEach(variantId => {
        this.invalidateCache(`variant-${variantId}`);
      });

      return response.data || null;
    } catch (error) {
      console.error('[VariantOperationsSingleton] Failed to bulk update sale price:', error);
      return null;
    }
  }

  /**
   * Bulk update inventory for variants
   * Authenticated endpoint for variant management
   */
  async bulkUpdateInventory(operation: BulkInventoryOperation): Promise<VariantOperationResult | null> {
    try {
      if (!operation.variantIds || operation.variantIds.length === 0) {
        throw new Error('Variant IDs are required');
      }

      const response = await this.makeDefaultRequest<VariantOperationResult>(
        '/api/variants/bulk/inventory',
        {
          method: 'POST',
          body: JSON.stringify({
            variantIds: operation.variantIds,
            operation: operation.operation,
            quantity: operation.quantity,
            reason: operation.reason
          })
        },
        `bulk-inventory-${operation.variantIds.join('-')}`,
        this.CACHE_TTL_SHORT
      );

      // Add success message if not provided
      if (response.data && !response.data.message) {
        response.data.message = `Successfully updated inventory for ${response.data.processed} variants${response.data.failed > 0 ? ` (${response.data.failed} failed)` : ''}`;
      }

      // Invalidate cache for affected variants
      operation.variantIds.forEach(variantId => {
        this.invalidateCache(`variant-${variantId}`);
      });

      return response.data || null;
    } catch (error) {
      console.error('[VariantOperationsSingleton] Failed to bulk update inventory:', error);
      return null;
    }
  }

  /**
   * Bulk delete variants
   * Authenticated endpoint for variant management
   */
  async bulkDeleteVariants(variantIds: string[]): Promise<VariantOperationResult | null> {
    try {
      if (!variantIds || variantIds.length === 0) {
        throw new Error('Variant IDs are required');
      }

      const response = await this.makeDefaultRequest<VariantOperationResult>(
        '/api/variants/bulk/delete',
        {
          method: 'POST',
          body: JSON.stringify({ variantIds })
        },
        `bulk-delete-${variantIds.join('-')}`,
        this.CACHE_TTL_SHORT
      );

      // Add success message if not provided
      if (response.data && !response.data.message) {
        response.data.message = `Successfully deleted ${response.data.processed} variants${response.data.failed > 0 ? ` (${response.data.failed} failed)` : ''}`;
      }

      // Invalidate cache for affected variants
      variantIds.forEach(variantId => {
        this.invalidateCache(`variant-${variantId}`);
      });

      return response.data || null;
    } catch (error) {
      console.error('[VariantOperationsSingleton] Failed to bulk delete variants:', error);
      return null;
    }
  }

  /**
   * Bulk activate/deactivate variants
   * Authenticated endpoint for variant management
   */
  async bulkUpdateVariantStatus(variantIds: string[], active: boolean): Promise<VariantOperationResult | null> {
    try {
      if (!variantIds || variantIds.length === 0) {
        throw new Error('Variant IDs are required');
      }

      const response = await this.makeDefaultRequest<VariantOperationResult>(
        '/api/variants/bulk/status',
        {
          method: 'POST',
          body: JSON.stringify({ variantIds, active })
        },
        `bulk-status-${variantIds.join('-')}`,
        this.CACHE_TTL_SHORT
      );

      // Add success message if not provided
      if (response.data && !response.data.message) {
        const action = active ? 'activated' : 'deactivated';
        response.data.message = `Successfully ${action} ${response.data.processed} variants${response.data.failed > 0 ? ` (${response.data.failed} failed)` : ''}`;
      }

      // Invalidate cache for affected variants
      variantIds.forEach(variantId => {
        this.invalidateCache(`variant-${variantId}`);
      });

      return response.data || null;
    } catch (error) {
      console.error('[VariantOperationsSingleton] Failed to bulk update variant status:', error);
      return null;
    }
  }
}

// Export singleton instance
export const variantOperationsService = VariantOperationsSingletonService.getInstance();
