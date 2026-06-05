/**
 * Admin Cached Products Service
 *
 * Extends AdminApiSingleton to provide admin-level cached products operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 * Provides admin operations for managing cached products
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface CachedProduct {
  id: string;
  businessType: string;
  categoryName: string;
  googleCategoryId: string | null;
  productName: string;
  priceCents: number;
  brand: string | null;
  description: string | null;
  skuPattern: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  enhancedDescription: string | null;
  features: any;
  specifications: any;
  generationSource: string;
  hasImage: boolean;
  imageQuality: string | null;
  usageCount: number;
  qualityScore: number | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface FilterOption {
  value: string;
  count: number;
}

export interface CachedProductsResponse {
  products: CachedProduct[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  businessTypes: FilterOption[];
  categories: FilterOption[];
}

class AdminCachedProductsService extends AdminApiSingleton {
  private static instance: AdminCachedProductsService;
  protected cacheTTL: number = 10 * 60 * 1000; // 10 minutes for cached products

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'admin-cached-products*',
      'cached-products*',
      'admin-products*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(): Promise<void> {
    await this.invalidateCachePattern('admin-cached-products*');
    await this.invalidateCachePattern('cached-products*');
    await this.invalidateCachePattern('admin-products*');
  }

  protected constructor() {
    super('admin-cached-products', {
      ttl: 10 * 60 * 1000 // 10 minutes for cached products
    });
  }

  public static getInstance(): AdminCachedProductsService {
    if (!AdminCachedProductsService.instance) {
      AdminCachedProductsService.instance = new AdminCachedProductsService();
    }
    return AdminCachedProductsService.instance;
  }

  /**
   * Get cached products with pagination and filtering
   * Uses the /api/admin/cached-products endpoint
   */
  async getCachedProducts(params: {
    page?: number;
    pageSize?: number;
    search?: string;
    businessType?: string;
    categoryName?: string;
    hasImage?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<CachedProductsResponse> {
    try {
      const queryParams = new URLSearchParams();
      
      if (params.page) queryParams.set('page', params.page.toString());
      if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString());
      if (params.search) queryParams.set('search', params.search);
      if (params.businessType) queryParams.set('businessType', params.businessType);
      if (params.categoryName) queryParams.set('categoryName', params.categoryName);
      if (params.hasImage) queryParams.set('hasImage', params.hasImage);
      if (params.sortBy) queryParams.set('sortBy', params.sortBy);
      if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

      const result = await this.makeDefaultRequest<{
        products: CachedProduct[];
        total: number;
        page: number;
        pageSize: number;
        totalPages: number;
        businessTypes: FilterOption[];
        categories: FilterOption[];
      }>(
        `/api/admin/cached-products?${queryParams}`,
        {},
        `cached-products-${JSON.stringify(params)}`,
        this.cacheTTL
      );
      
      if (!result.success) {
        console.error('[AdminCachedProducts] Failed to get cached products:', result.error);
        throw new Error('Failed to fetch cached products');
      }

      return result.data || {
        products: [],
        total: 0,
        page: 1,
        pageSize: 50,
        totalPages: 0,
        businessTypes: [],
        categories: []
      };
    } catch (error) {
      console.error('[AdminCachedProducts] Failed to get cached products:', error);
      throw error;
    }
  }

  /**
   * Delete a single cached product
   * Uses the DELETE /api/admin/cached-products/{id} endpoint
   */
  async deleteCachedProduct(id: string): Promise<boolean> {
    if (!id) {
      console.error('[AdminCachedProducts] Product ID is required');
      return false;
    }

    try {
      const result = await this.makeDefaultRequest(
        `/api/admin/cached-products/${id}`,
        {
          method: 'DELETE'
        },
        `delete-cached-product-${id}`,
        0 // No cache for delete operations
      );
      
      if (!result.success) {
        console.error('[AdminCachedProducts] Failed to delete cached product:', result.error);
        return false;
      }

      // Invalidate relevant caches after deletion
      await this.invalidateServiceCaches();
      
      return true;
    } catch (error) {
      console.error('[AdminCachedProducts] Failed to delete cached product:', error);
      return false;
    }
  }

  /**
   * Bulk delete cached products
   * Uses the DELETE /api/admin/cached-products/bulk endpoint
   */
  async bulkDeleteCachedProducts(ids: string[]): Promise<{ success: number; failed: string[] }> {
    if (!ids || ids.length === 0) {
      console.error('[AdminCachedProducts] Product IDs are required');
      return { success: 0, failed: [] };
    }

    try {
      const result = await this.makeDefaultRequest(
        '/api/admin/cached-products/bulk',
        {
          method: 'DELETE',
          body: JSON.stringify({ ids })
        },
        'bulk-delete-cached-products',
        0 // No cache for delete operations
      );
      
      if (!result.success) {
        console.error('[AdminCachedProducts] Failed to bulk delete cached products:', result.error);
        return { success: 0, failed: ids };
      }

      // Invalidate relevant caches after deletion
      await this.invalidateServiceCaches();
      
      return (result.data as { success: number; failed: string[] }) || { success: 0, failed: ids };
    } catch (error) {
      console.error('[AdminCachedProducts] Failed to bulk delete cached products:', error);
      return { success: 0, failed: ids };
    }
  }

  /**
   * Update a cached product
   * Uses the PUT /api/admin/cached-products/{id} endpoint
   */
  async updateCachedProduct(id: string, formData: Partial<CachedProduct>): Promise<CachedProduct | null> {
    if (!id) {
      console.error('[AdminCachedProducts] Product ID is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<CachedProduct>(
        `/api/admin/cached-products/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(formData)
        },
        `update-cached-product-${id}`,
        0 // No cache for update operations
      );
      
      if (!result.success) {
        console.error('[AdminCachedProducts] Failed to update cached product:', result.error);
        return null;
      }

      // Invalidate relevant caches after update
      await this.invalidateServiceCaches();
      
      return result.data || null;
    } catch (error) {
      console.error('[AdminCachedProducts] Failed to update cached product:', error);
      return null;
    }
  }

  /**
   * Get filter options for cached products
   * Uses the /api/admin/cached-products/filters endpoint
   */
  async getFilterOptions(): Promise<{ businessTypes: FilterOption[]; categories: FilterOption[] }> {
    try {
      const result = await this.makeDefaultRequest<{
        businessTypes: FilterOption[];
        categories: FilterOption[];
      }>(
        '/api/admin/cached-products/filters',
        {},
        'cached-products-filters',
        30 * 60 * 1000 // 30 minutes for filter options
      );
      
      if (!result.success) {
        console.error('[AdminCachedProducts] Failed to get filter options:', result.error);
        return { businessTypes: [], categories: [] };
      }

      return result.data || { businessTypes: [], categories: [] };
    } catch (error) {
      console.error('[AdminCachedProducts] Failed to get filter options:', error);
      return { businessTypes: [], categories: [] };
    }
  }
}

// Export singleton instance
export const adminCachedProductsService = AdminCachedProductsService.getInstance();
