'use client';

// ====================
// STOREFRONT SERVICE - PLATFORM-ALIGNED
// ====================

import { PublicApiSingleton } from '@/providers/base/UniversalSingleton';

// Service interfaces
interface ProductFilters {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sort?: 'featured' | 'newest' | 'price-low' | 'price-high' | 'rating';
}

interface ProductResponse {
  items: CatalogProduct[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  title?: string;
  brand?: string;
  description?: string;
  priceCents: number;
  salePriceCents?: number;
  stock: number;
  imageUrl?: string;
  tenantId: string;
  categoryName?: string;
  categorySlug?: string;
  condition?: string;
  availability?: 'in_stock' | 'out_of' | 'preorder';
  ratingAvg?: number;
  ratingCount?: number;
  isFeatured?: boolean;
  featuredTypes?: string[];
  hasVariants?: boolean;
  metadata?: Record<string, any>;
  price?: number;
  salePrice?: number;
  currency?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

interface ServiceMetrics {
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  apiCalls: number;
  errors: number;
  lastUpdated: string;
}

// Service implementation
class StorefrontService extends PublicApiSingleton {
  private static instance: StorefrontService;

  // TTL constants for different data types
  private readonly PRODUCTS_TTL = 5 * 60 * 1000; // 5 minutes for products
  private readonly CATEGORIES_TTL = 30 * 60 * 1000; // 30 minutes for categories
  private readonly FEATURED_PRODUCTS_TTL = 10 * 60 * 1000; // 10 minutes for featured products

  private constructor() {
    super('storefront-service');
  }

  static getInstance(): StorefrontService {
    if (!(globalThis as any).__storefrontServiceInstance) {
      (globalThis as any).__storefrontServiceInstance = new StorefrontService();
    }
    return (globalThis as any).__storefrontServiceInstance;
  }

  // Public API methods with caching
  async getProducts(tenantId: string, filters: ProductFilters = {}): Promise<ProductResponse> {
    const params = new URLSearchParams();
    if (filters.page) params.set('page', filters.page.toString());
    if (filters.limit) params.set('limit', filters.limit.toString());
    if (filters.category) params.set('category', filters.category);
    if (filters.search) params.set('search', filters.search);
    if (filters.sort) params.set('sort', filters.sort);

    const queryString = params.toString();
    const endpoint = `/api/storefront/${tenantId}/products${queryString ? `?${queryString}` : ''}`;
    const cacheKey = `products:${tenantId}:${queryString}`;

    try {
      const result = await this.makePublicRequest<ProductResponse>(endpoint, {}, cacheKey, this.PRODUCTS_TTL);
      return result.data || { items: [], pagination: { page: 1, limit: 10, totalItems: 0, totalPages: 0, hasMore: false } };
    } catch (error) {
      console.error('[StorefrontService] Failed to get products:', error);
      throw error;
    }
  }

  async getCategories(tenantId: string): Promise<Category[]> {
    try {
      const data = await this.makePublicRequest<{ categories: Category[] }>(
        `/api/storefront/${tenantId}/categories`,
        {},
        `categories:${tenantId}`,
        this.CATEGORIES_TTL
      );
      return data.data?.categories || [];
    } catch (error) {
      console.error('[StorefrontService] Failed to get categories:', error);
      throw error;
    }
  }

  async getFeaturedProducts(tenantId: string, filters: { limit?: number; search?: string } = {}): Promise<{ items: CatalogProduct[]; count: number; buckets: Record<string, CatalogProduct[]> }> {
    try {
      const params = new URLSearchParams();
      if (filters.limit) params.set('limit', filters.limit.toString());
      if (filters.search) params.set('search', filters.search);

      const queryString = params.toString();
      const endpoint = `/api/storefront/${tenantId}/featured-products${queryString ? `?${queryString}` : ''}`;
      const cacheKey = `featured-products:${tenantId}:${queryString}`;

      const data = await this.makePublicRequest<{
        success: boolean;
        items: CatalogProduct[];
        totalCount: number;
        bucketCounts: Record<string, number>;
      }>(endpoint, {}, cacheKey, this.FEATURED_PRODUCTS_TTL);

      // Transform response to match expected format
      return {
        items: data.data?.items || [],
        count: data.data?.totalCount || 0,
        buckets: {} as Record<string, CatalogProduct[]>
      };
    } catch (error) {
      console.error('[StorefrontService] Failed to get featured products:', error);
      throw error;
    }
  }

  /**
   * Get public tier information for a tenant
   * Uses the /api/tenants/:tenantId/tier/public endpoint
   */
  async getPublicTier(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makePublicRequest<any>(
        `/api/tenants/${tenantId}/tier/public`,
        {},
        `public-tier-${tenantId}`,
        10 * 60 * 1000 // 10 minutes TTL for tier information
      );

      return result;
    } catch (error) {
      console.error('[StorefrontService] Failed to get public tier:', error);
      return null;
    }
  }

  /**
   * Get public tenant profile
   * Uses the /api/public/tenant/:tenantId/profile endpoint
   */
  async getPublicTenantProfile(tenantId: string): Promise<any> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makePublicRequest<any>(
        `/public/tenant/${tenantId}/profile`,
        {},
        `public-tenant-profile-${tenantId}`,
        this.CATEGORIES_TTL
      );

      return response;
    } catch (error) {
      console.error('[StorefrontService] Failed to get public tenant profile:', error);
      return null;
    }
  }

  /**
   * Get batch store data for multiple stores
   * Uses the /api/stores/batch endpoint
   */
  async getBatchStores(storeIds: string[]): Promise<any[]> {
    try {
      if (!storeIds || storeIds.length === 0) {
        return [];
      }

      const response = await this.makePublicRequest<any[]>(
        '/stores/batch',
        {
          method: 'POST',
          body: JSON.stringify({ storeIds })
        },
        'batch-stores',
        this.CATEGORIES_TTL
      );

      return response.data || [];
    } catch (error) {
      console.error('[StorefrontService] Failed to get batch stores:', error);
      return [];
    }
  }

  /**
   * Get batch store categories stats
   * Uses the /api/storefront/:tenantId/storefront/categories-stats endpoint
   */
  async getBatchCategoriesStats(tenantId: string, storeIds: string[]): Promise<any[]> {
    try {
      if (!storeIds || storeIds.length === 0) {
        return [];
      }

      // Fetch stats for all stores in parallel
      const promises = storeIds.map(async (storeId) => {
        return await this.makePublicRequest<any>(
          `/storefront/${tenantId}/storefront/categories-stats`,
          {},
          `categories-stats-${storeId}`,
          this.CATEGORIES_TTL
        );
      });

      const results = await Promise.allSettled(promises);
      
      return results.map((result, index) => ({
        storeId: storeIds[index],
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
      }));
    } catch (error) {
      console.error('[StorefrontService] Failed to get batch categories stats:', error);
      return [];
    }
  }
}

// Export singleton instance
export const storefrontService = StorefrontService.getInstance();

// Export types
export type { CatalogProduct, Category, ProductFilters, ProductResponse, ServiceMetrics };
