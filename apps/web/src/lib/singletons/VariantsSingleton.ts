/**
 * Variants Singleton Service
 * 
 * Extends UniversalSingleton for variant management
 * Handles variant fetching, creation, and updates with automatic caching
 */

import { useState } from 'react';
import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

// Import ProductVariant from the components to ensure consistency
export type { ProductVariant } from '@/components/items/ProductVariants';

export interface VariantCreateData {
  variant_name: string;
  sku: string;
  price_cents: number;
  stock: number;
  attributes: Record<string, string>;
}

export interface VariantUpdateData {
  variant_name?: string;
  sku?: string;
  price_cents?: number;
  stock?: number;
  attributes?: Record<string, string>;
}

export interface VariantResult {
  success: boolean;
  variants?: any[];
  variant?: any;
  error?: string;
  message?: string;
}

// ====================
// VARIANTS SINGLETON
// ====================

class VariantsSingleton extends TenantApiSingleton {
  protected static instances: Map<string, VariantsSingleton> = new Map();

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'variants*',
      'product-variants*',
      'variant-operations*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('variants*');
    await this.invalidateCachePattern('product-variants*');
    await this.invalidateCachePattern('variant-operations*');
  }

  private constructor(tenantId: string) {
    super(`variants-service-${tenantId}`);
  }

  static getInstance(tenantId: string): VariantsSingleton {
    if (!this.instances.has(tenantId)) {
      this.instances.set(tenantId, new VariantsSingleton(tenantId));
    }
    return this.instances.get(tenantId)!;
  }

  /**
   * Fetch variants for an item
   */
  async fetchItemVariants(itemId: string): Promise<VariantResult> {
    try {
      const response = await this.makeDefaultRequest(
        `/api/items/${itemId}/variants`,
        { method: 'GET' }
      ) as any;

      // console.log('[VariantsSingleton] Fetched variants for item:', itemId, response.variants?.length || 0);
      
      return {
        success: true,
        variants: response.variants || [],
        message: 'Variants fetched successfully',
      };
    } catch (error) {
      console.error('[VariantsSingleton] Error fetching variants:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch variants',
      };
    }
  }

  /**
   * Create a new variant for an item
   */
  async createVariant(itemId: string, data: VariantCreateData): Promise<VariantResult> {
    try {
      const response = await this.makeDefaultRequest(
        `/api/items/${itemId}/variants`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      ) as any;

      // Invalidate cache after creating variant
      this.invalidateCache(`/api/items/${itemId}/variants`);

      // console.log('[VariantsSingleton] Variant created successfully:', itemId);
      
      return {
        success: true,
        variant: response.variant || response,
        message: 'Variant created successfully',
      };
    } catch (error) {
      console.error('[VariantsSingleton] Error creating variant:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create variant',
      };
    }
  }

  /**
   * Update an existing variant
   */
  async updateVariant(variantId: string, data: VariantUpdateData): Promise<VariantResult> {
    try {
      const response = await this.makeDefaultRequest(
        `/api/variants/${variantId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      ) as any;

      // Invalidate all variant caches after update
      this.clearCache();

      // console.log('[VariantsSingleton] Variant updated successfully:', variantId);
      
      return {
        success: true,
        variant: response.variant || response,
        message: 'Variant updated successfully',
      };
    } catch (error) {
      console.error('[VariantsSingleton] Error updating variant:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update variant',
      };
    }
  }

  /**
   * Delete a variant
   */
  async deleteVariant(variantId: string): Promise<VariantResult> {
    try {
      await this.makeDefaultRequest(
        `/api/variants/${variantId}`,
        { method: 'DELETE' }
      );

      // Invalidate all variant caches after deletion
      this.clearCache();

      // console.log('[VariantsSingleton] Variant deleted successfully:', variantId);
      
      return {
        success: true,
        message: 'Variant deleted successfully',
      };
    } catch (error) {
      console.error('[VariantsSingleton] Error deleting variant:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete variant',
      };
    }
  }

  /**
   * Create multiple variants at once (bulk operation)
   */
  async createBulkVariants(itemId: string, variants: VariantCreateData[]): Promise<VariantResult> {
    try {
      const response = await this.makeDefaultRequest(
        `/api/items/${itemId}/variants/bulk`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ variants }),
        }
      ) as any;

      // Invalidate cache after bulk creation
      this.invalidateCache(`/api/items/${itemId}/variants`);

      // console.log('[VariantsSingleton] Bulk variants created successfully:', itemId, variants.length);
      
      return {
        success: true,
        variants: response.variants || [],
        message: `${variants.length} variants created successfully`,
      };
    } catch (error) {
      console.error('[VariantsSingleton] Error creating bulk variants:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create bulk variants',
      };
    }
  }

  /**
   * Update multiple variants at once (bulk operation)
   */
  async updateBulkVariants(updates: Array<{ variantId: string; data: VariantUpdateData }>): Promise<VariantResult> {
    try {
      const response = await this.makeDefaultRequest(
        `/api/variants/bulk`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ updates }),
        }
      ) as any;

      // Invalidate all variant caches after bulk update
      this.clearCache();

      // console.log('[VariantsSingleton] Bulk variants updated successfully:', updates.length);
      
      return {
        success: true,
        variants: response.variants || [],
        message: `${updates.length} variants updated successfully`,
      };
    } catch (error) {
      console.error('[VariantsSingleton] Error updating bulk variants:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update bulk variants',
      };
    }
  }

  /**
   * Bulk operations for variants with explicit actions (update, delete, create)
   */
  async bulkVariantOperations(
    operations: Array<{
      action: 'update' | 'delete' | 'create';
      variantId?: string;
      data?: any;
    }>, 
    parentItemId?: string
  ): Promise<VariantResult> {
    try {
      const response = await this.makeDefaultRequest(
        `/api/variants-singleton/bulk/operations`,
        {
          method: 'PUT',
          body: JSON.stringify({
            operations,
            parentItemId
          })
        }
      ) as any;

      // console.log('[VariantsSingleton] Raw API response type:', typeof response);
      // console.log('[VariantsSingleton] Raw API response keys:', response ? Object.keys(response) : 'null');
      // console.log('[VariantsSingleton] Raw API response:', JSON.stringify(response));

      // Handle response - API may wrap response in "data" object
      const apiData = response.data || response;
      // console.log('[VariantsSingleton] apiData:', JSON.stringify(apiData));
      // console.log('[VariantsSingleton] apiData.variants:', JSON.stringify(apiData.variants));
      
      // Invalidate all variant caches after bulk operations
      this.clearCache();

      // console.log('[VariantsSingleton] Bulk variant operations completed:', operations.length);
      
      const result = {
        success: apiData.success || false,
        variants: apiData.variants || [],
        success_count: apiData.success_count || 0,
        error_count: apiData.error_count || 0,
        message: `Bulk operations completed: ${apiData.success_count || 0} successful, ${apiData.error_count || 0} failed`,
      };
      
      // console.log('[VariantsSingleton] Returning result:', JSON.stringify(result));
      return result;
    } catch (error) {
      console.error('[VariantsSingleton] Error performing bulk variant operations:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to perform bulk variant operations',
      };
    }
  }

  /**
   * Get variant statistics for an item
   */
  async getVariantStats(itemId: string): Promise<VariantResult> {
    try {
      const response = await this.makeDefaultRequest(
        `/api/items/${itemId}/variants/stats`,
        { method: 'GET' }
      ) as any;

      // console.log('[VariantsSingleton] Variant stats fetched:', itemId);
      
      return {
        success: true,
        variants: response.variants || [],
        message: 'Variant stats fetched successfully',
      };
    } catch (error) {
      console.error('[VariantsSingleton] Error fetching variant stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch variant stats',
      };
    }
  }
}

// ====================
// HOOK
// ====================

export function useVariantsSingleton(tenantId: string) {
  const [service] = useState(() => VariantsSingleton.getInstance(tenantId));
  
  return {
    actions: service,
    fetchItemVariants: service.fetchItemVariants.bind(service),
    createVariant: service.createVariant.bind(service),
    updateVariant: service.updateVariant.bind(service),
    deleteVariant: service.deleteVariant.bind(service),
    createBulkVariants: service.createBulkVariants.bind(service),
    updateBulkVariants: service.updateBulkVariants.bind(service),
    getVariantStats: service.getVariantStats.bind(service),
  };
}

export default VariantsSingleton;
