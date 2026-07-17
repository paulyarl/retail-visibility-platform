/**
 * Admin Catalog Singleton Service
 * 
 * Extends AdminApiSingleton to provide cached admin catalog operations
 * Manages global product catalog browsing, search, and product management
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface GlobalCatalogProduct {
  id: string;
  product_slug: string;
  universal_sku: string | null;
  name: string;
  brand: string | null;
  category_path: string[];
  gtin_upc: string | null;
  description: string | null;
  images: Array<{ url: string; alt?: string }>;
  status: 'active' | 'inactive' | 'pending';
  source: 'platform' | 'merchant' | 'partner';
  catalog_metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface CatalogRegistryEntry {
  tenant_id: string;
  tenant_name: string;
  original_sku: string;
  product_slug: string;
  adopted_at: string;
}

export interface CatalogFilters {
  slugType?: 'upc' | 'lpc';
  category?: string;
  brand?: string;
  status?: 'active' | 'inactive' | 'pending';
  source?: 'platform' | 'merchant' | 'partner';
  search?: string;
  hasUpc?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'brand' | 'created_at' | 'adoption_count';
  sortOrder?: 'asc' | 'desc';
}

export interface CatalogStats {
  totalProducts: number;
  upcProducts: number;
  lpcProducts: number;
  totalBrands: number;
  totalCategories: number;
  activeProducts: number;
  pendingProducts: number;
  merchantSourced: number;
  platformSourced: number;
  partnerSourced: number;
  topAdoptedProducts: Array<{
    product_slug: string;
    name: string;
    adoption_count: number;
  }>;
}

export interface ProductDetail extends GlobalCatalogProduct {
  registry_entries: CatalogRegistryEntry[];
  adoption_count: number;
  availability_locations: number;
  slug_components: {
    type: 'upc' | 'lpc';
    sku: string | null;
    brand: string | null;
    category: string;
    identifier: string | null;
    name_hash: string;
  } | null;
}

class AdminCatalogSingletonService extends AdminApiSingleton {
  private static instance: AdminCatalogSingletonService;

  private constructor() {
    super('admin-catalog-singleton');
  }

  public static getInstance(): AdminCatalogSingletonService {
    if (!AdminCatalogSingletonService.instance) {
      AdminCatalogSingletonService.instance = new AdminCatalogSingletonService();
    }
    return AdminCatalogSingletonService.instance;
  }

  /**
   * Get all catalog products with filters
   */
  async getProducts(filters: CatalogFilters = {}): Promise<{
    products: GlobalCatalogProduct[];
    total: number;
    hasMore: boolean;
  } | null> {
    const params = new URLSearchParams();
    
    if (filters.slugType) params.set('slugType', filters.slugType);
    if (filters.category) params.set('category', filters.category);
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.status) params.set('status', filters.status);
    if (filters.source) params.set('source', filters.source);
    if (filters.search) params.set('search', filters.search);
    if (filters.hasUpc !== undefined) params.set('hasUpc', String(filters.hasUpc));
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);

    const result = await this.makeDefaultRequest<{
      data: GlobalCatalogProduct[];
      total: number;
    }>(
      `/api/admin/catalog/products?${params.toString()}`,
      {},
      `admin-catalog-products:${JSON.stringify(filters)}`
    );

    if (!result.success) {
      clientLogger.error('[AdminCatalog] Failed to get products:', { detail: result.error });
      return null;
    }

    const response = result.data;
    if (!response) {
      return null;
    }

    return {
      products: response.data,
      total: response.total,
      hasMore: (filters.page || 1) * (filters.limit || 50) < response.total
    };
  }

  /**
   * Get a single product with full details
   */
  async getProductDetail(productSlug: string): Promise<ProductDetail | null> {
    const result = await this.makeDefaultRequest<ProductDetail>(
      `/api/admin/catalog/products/${encodeURIComponent(productSlug)}`,
      {},
      `admin-catalog-product:${productSlug}`
    );

    if (!result.success) {
      clientLogger.error('[AdminCatalog] Failed to get product detail:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Get product by UPC
   */
  async getProductByUPC(upc: string): Promise<ProductDetail | null> {
    const result = await this.makeDefaultRequest<ProductDetail>(
      `/api/admin/catalog/products/upc/${encodeURIComponent(upc)}`,
      {},
      `admin-catalog-product-upc:${upc}`
    );

    if (!result.success) {
      clientLogger.error('[AdminCatalog] Failed to get product by UPC:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Search catalog products
   */
  async searchProducts(
    query: string,
    filters: Omit<CatalogFilters, 'search'> = {}
  ): Promise<{
    products: GlobalCatalogProduct[];
    total: number;
    hasMore: boolean;
  } | null> {
    const params = new URLSearchParams({ q: query });
    
    if (filters.slugType) params.set('slugType', filters.slugType);
    if (filters.category) params.set('category', filters.category);
    if (filters.brand) params.set('brand', filters.brand);
    if (filters.status) params.set('status', filters.status);
    if (filters.page) params.set('page', String(filters.page));
    if (filters.limit) params.set('limit', String(filters.limit));

    const result = await this.makeDefaultRequest<{
      data: GlobalCatalogProduct[];
      total: number;
    }>(
      `/api/admin/catalog/search?${params.toString()}`,
      {},
      `admin-catalog-search:${query}:${JSON.stringify(filters)}`
    );

    if (!result.success) {
      clientLogger.error('[AdminCatalog] Failed to search products:', { detail: result.error });
      return null;
    }

    const response = result.data;
    if (!response) {
      return null;
    }

    return {
      products: response.data,
      total: response.total,
      hasMore: (filters.page || 1) * (filters.limit || 50) < response.total
    };
  }

  /**
   * Get catalog statistics
   */
  async getCatalogStats(): Promise<CatalogStats | null> {
    const result = await this.makeDefaultRequest<CatalogStats>(
      '/api/admin/catalog/stats',
      {},
      'admin-catalog-stats'
    );

    if (!result.success) {
      clientLogger.error('[AdminCatalog] Failed to get stats:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Get all brands in catalog
   */
  async getBrands(): Promise<Array<{ brand: string; product_count: number }> | null> {
    const result = await this.makeDefaultRequest<Array<{ brand: string; product_count: number }>>(
      '/api/admin/catalog/brands',
      {},
      'admin-catalog-brands'
    );

    if (!result.success) {
      clientLogger.error('[AdminCatalog] Failed to get brands:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Get all categories in catalog
   */
  async getCategories(): Promise<Array<{ category: string; product_count: number }> | null> {
    const result = await this.makeDefaultRequest<Array<{ category: string; product_count: number }>>(
      '/api/admin/catalog/categories',
      {},
      'admin-catalog-categories'
    );

    if (!result.success) {
      clientLogger.error('[AdminCatalog] Failed to get categories:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Update product in catalog
   */
  async updateProduct(productSlug: string, data: Partial<GlobalCatalogProduct>): Promise<GlobalCatalogProduct | null> {
    const result = await this.makeDefaultRequest<GlobalCatalogProduct>(
      `/api/admin/catalog/products/${encodeURIComponent(productSlug)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data)
      },
      `admin-catalog-update:${productSlug}`
    );

    if (!result.success) {
      clientLogger.error('[AdminCatalog] Failed to update product:', { detail: result.error });
      return null;
    }

    await this.invalidateCatalogCache();
    return result.data || null;
  }

  /**
   * Merge duplicate products
   */
  async mergeProducts(params: {
    primarySlug: string;
    duplicateSlugs: string[];
    mergeStrategy: 'keep_primary' | 'combine_data';
  }): Promise<{ success: boolean; merged_count: number } | null> {
    const result = await this.makeDefaultRequest<{ success: boolean; merged_count: number }>(
      '/api/admin/catalog/products/merge',
      {
        method: 'POST',
        body: JSON.stringify(params)
      },
      `admin-catalog-merge:${params.primarySlug}`
    );

    if (!result.success) {
      clientLogger.error('[AdminCatalog] Failed to merge products:', { detail: result.error });
      return null;
    }

    await this.invalidateCatalogCache();
    return result.data || null;
  }

  /**
   * Bulk assign category to products
   */
  async bulkAssignCategory(productSlugs: string[], category: string): Promise<{
    success: number;
    failed: number;
  } | null> {
    const result = await this.makeDefaultRequest<{
      success: number;
      failed: number;
    }>(
      '/api/admin/catalog/products/bulk-category',
      {
        method: 'POST',
        body: JSON.stringify({ productSlugs, category })
      },
      'admin-catalog-bulk-category'
    );

    if (!result.success) {
      clientLogger.error('[AdminCatalog] Failed to bulk assign category:', { detail: result.error });
      return null;
    }

    await this.invalidateCatalogCache();
    return result.data || null;
  }

  /**
   * Get products pending review
   */
  async getPendingProducts(page: number = 1, limit: number = 50): Promise<{
    products: GlobalCatalogProduct[];
    total: number;
    hasMore: boolean;
  } | null> {
    return this.getProducts({ status: 'pending', page, limit });
  }

  /**
   * Approve pending product
   */
  async approveProduct(productSlug: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/admin/catalog/products/${encodeURIComponent(productSlug)}/approve`,
      {
        method: 'POST'
      },
      `admin-catalog-approve:${productSlug}`
    );

    if (!result.success) {
      clientLogger.error('[AdminCatalog] Failed to approve product:', { detail: result.error });
      return false;
    }

    await this.invalidateCatalogCache();
    return true;
  }

  /**
   * Reject pending product
   */
  async rejectProduct(productSlug: string, reason: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<{ success: boolean }>(
      `/api/admin/catalog/products/${encodeURIComponent(productSlug)}/reject`,
      {
        method: 'POST',
        body: JSON.stringify({ reason })
      },
      `admin-catalog-reject:${productSlug}`
    );

    if (!result.success) {
      clientLogger.error('[AdminCatalog] Failed to reject product:', { detail: result.error });
      return false;
    }

    await this.invalidateCatalogCache();
    return true;
  }

  /**
   * Invalidate catalog cache
   */
  public async invalidateCatalogCache(): Promise<void> {
    await this.invalidateCache('admin-catalog*');
  }

  /**
   * Invalidate specific product cache
   */
  public async invalidateProductCache(productSlug: string): Promise<void> {
    await this.invalidateCache(`admin-catalog-product:${productSlug}`);
  }
}

// Export singleton instance
export const adminCatalogService = AdminCatalogSingletonService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateCatalogCache = async (): Promise<void> => {
  const service = AdminCatalogSingletonService.getInstance();
  await service.invalidateCatalogCache();
};
