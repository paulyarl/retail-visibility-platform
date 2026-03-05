/**
 * Storefront Singleton Service
 * 
 * Extends PublicApiSingleton to provide cached storefront operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface StorefrontCategory {
  id: string;
  name: string;
  slug: string;
  productCount?: number;
  is_primary?: boolean;
  type?: string;
}

export interface StorefrontProduct {
  id: string;
  sku: string;
  name: string;
  title: string;
  price: number;
  currency: string;
  imageUrl?: string;
  payment_gateway_type?: string | null;
  has_active_payment_gateway?: boolean;
  [key: string]: any;
}

export interface DirectoryListing {
  listing?: {
    slug?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

class StorefrontSingletonService extends PublicApiSingleton {
  private static instance: StorefrontSingletonService;

  private constructor() {
    super('storefront-singleton', {
      ttl: 5 * 60 * 1000 // 5 minutes for storefront data
    });
  }

  public static getInstance(): StorefrontSingletonService {
    if (!StorefrontSingletonService.instance) {
      StorefrontSingletonService.instance = new StorefrontSingletonService();
    }
    return StorefrontSingletonService.instance;
  }

  /**
   * Get storefront categories with product counts
   * Uses the /api/storefront/:tenantId/categories endpoint
   */
  async getStorefrontCategories(tenantId: string): Promise<{
    categories: StorefrontCategory[];
    uncategorizedCount: number;
  }> {
    if (!tenantId) {
      console.error('[StorefrontSingleton] getStorefrontCategories: tenantId is required');
      return { categories: [], uncategorizedCount: 0 };
    }

    try {
      const result = await this.makeDefaultRequest<{
        categories: StorefrontCategory[];
        uncategorizedCount: number;
      }>(
        `/api/storefront/${tenantId}/categories`,
        {},
        `storefront-categories-${tenantId}`,
        this.cacheTTL
      );
      
      return {
        categories: result.data?.categories || [],
        uncategorizedCount: result.data?.uncategorizedCount || 0
      };
    } catch (error) {
      console.error('[StorefrontSingleton] Failed to get storefront categories:', error);
      return { categories: [], uncategorizedCount: 0 };
    }
  }

  /**
   * Get storefront products with pagination and filtering
   * Uses the /api/storefront/:tenantId/products endpoint
   */
  async getStorefrontProducts(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      category?: string;
    } = {}
  ): Promise<{
    items: StorefrontProduct[];
    pagination?: {
      totalItems: number;
    };
    total?: number;
  }> {
    if (!tenantId) {
      console.error('[StorefrontSingleton] getStorefrontProducts: tenantId is required');
      return { items: [] };
    }

    try {
      const queryParams = new URLSearchParams();
      if (options.page) queryParams.append('page', options.page.toString());
      if (options.limit) queryParams.append('limit', options.limit.toString());
      if (options.search) queryParams.append('search', options.search);
      if (options.category) queryParams.append('category', options.category);

      const endpoint = `/api/storefront/${tenantId}/products?${queryParams.toString()}`;
      
      const result = await this.makeDefaultRequest<{
        items: StorefrontProduct[];
        pagination?: {
          totalItems: number;
        };
      }>(endpoint, {}, `storefront-products-${tenantId}-${queryParams.toString()}`, this.cacheTTL);
      
      return {
        items: result.data?.items || [],
        pagination: result.data?.pagination,
        total: result.data?.pagination?.totalItems
      };
    } catch (error) {
      console.error('[StorefrontSingleton] Failed to get storefront products:', error);
      return { items: [] };
    }
  }

  /**
   * Get featured products for a storefront
   * Uses the /api/storefront/:tenantId/featured-products endpoint
   */
  async getFeaturedProducts(
    tenantId: string,
    options: {
      limit?: number;
      search?: string;
    } = {}
  ): Promise<{
    items: StorefrontProduct[];
    count?: number;
  }> {
    if (!tenantId) {
      console.error('[StorefrontSingleton] getFeaturedProducts: tenantId is required');
      return { items: [] };
    }

    try {
      const queryParams = new URLSearchParams();
      if (options.limit) queryParams.append('limit', options.limit.toString());
      if (options.search) queryParams.append('search', options.search);

      const endpoint = `/api/storefront/${tenantId}/featured-products?${queryParams.toString()}`;
      const cacheKey = `featured-products-${tenantId}-${options.limit || 10}-${options.search || ''}`;
      
      // Clear old cache that doesn't have new fields (featuredTypes, hasActivePaymentGateway)
      const cached = this.cache.get(cacheKey);
      if (cached && cached.data && cached.data.items && cached.data.items.length > 0) {
        const firstItem = cached.data.items[0];
        if (!('featuredTypes' in firstItem) || !('hasActivePaymentGateway' in firstItem)) {
          console.log(`[StorefrontSingleton] Clearing old cached data (missing featuredTypes/payment fields)`);
          this.cache.delete(cacheKey);
        }
      }
      
      const result = await this.makeDefaultRequest<{
        items: StorefrontProduct[];
        count?: number;
      }>(endpoint, {}, cacheKey, this.cacheTTL);
      
      return result.data || { items: [] };
    } catch (error) {
      console.error('[StorefrontSingleton] Failed to get featured products:', error);
      return { items: [] };
    }
  }

  /**
   * Get directory listing for a tenant
   * Uses the /api/directory/:tenantId endpoint
   */
  async getDirectoryListing(tenantId: string): Promise<DirectoryListing | null> {
    if (!tenantId) {
      console.error('[StorefrontSingleton] getDirectoryListing: tenantId is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<DirectoryListing>(
        `/api/directory/${tenantId}`,
        {},
        `directory-listing-${tenantId}`,
        this.cacheTTL
      );
      
      if (!result.success) {
        // Handle 404 or other errors gracefully - tenant might not have directory listing
        if (result.error?.status === 404) {
          console.log(`[StorefrontSingleton] No directory listing found for tenant ${tenantId}`);
        } else {
          console.warn(`[StorefrontSingleton] Failed to get directory listing:`, result.error);
        }
        return null;
      }
      
      return result.data || null;
    } catch (error) {
      console.error('[StorefrontSingleton] Failed to get directory listing:', error);
      return null;
    }
  }

  /**
   * Get total product count for a storefront
   * Uses the /api/storefront/:tenantId/products endpoint with limit=1
   */
  async getTotalProductCount(tenantId: string): Promise<number> {
    if (!tenantId) {
      console.error('[StorefrontSingleton] getTotalProductCount: tenantId is required');
      return 0;
    }

    try {
      const result = await this.makeDefaultRequest<{
        pagination?: {
          totalItems: number;
        };
      }>(
        `/api/storefront/${tenantId}/products?page=1&limit=1`,
        {},
        `total-product-count-${tenantId}`,
        this.cacheTTL
      );
      
      return result.data?.pagination?.totalItems || 0;
    } catch (error) {
      console.error('[StorefrontSingleton] Failed to get total product count:', error);
      return 0;
    }
  }

}

// Export singleton instance
export const storefrontService = StorefrontSingletonService.getInstance();
