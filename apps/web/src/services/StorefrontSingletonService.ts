/**
 * Storefront Singleton Service
 * 
 * Extends UniversalSingletonClient to provide cached storefront operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { PublicApiSingleton } from '@/providers/base/UniversalSingleton';

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
    super('storefront-singleton');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes for storefront data
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
      const result = await this.makePublicRequest<{
        categories: StorefrontCategory[];
        uncategorizedCount: number;
      }>(
        `/api/storefront/${tenantId}/categories`,
        {},
        `storefront-categories-${tenantId}`
      );
      
      return {
        categories: result.categories || [],
        uncategorizedCount: result.uncategorizedCount || 0
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
      currentPage: number;
      totalPages: number;
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
      
      const result = await this.makePublicRequest<{
        items: StorefrontProduct[];
        pagination?: {
          totalItems: number;
          currentPage: number;
          totalPages: number;
        };
        total?: number;
      }>(endpoint, {}, `storefront-products-${tenantId}-${options.page || 1}-${options.limit || 10}-${options.search || ''}-${options.category || ''}`);
      
      return result || { items: [] };
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
      
      const result = await this.makePublicRequest<{
        items: StorefrontProduct[];
        count?: number;
      }>(endpoint, {}, `featured-products-${tenantId}-${options.limit || 10}-${options.search || ''}`);
      
      return result || { items: [] };
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
      const result = await this.makePublicRequest<DirectoryListing>(
        `/api/directory/${tenantId}`,
        {},
        `directory-listing-${tenantId}`
      );
      
      return result || null;
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
      const result = await this.makePublicRequest<{
        pagination?: {
          totalItems: number;
        };
      }>(
        `/api/storefront/${tenantId}/products?page=1&limit=1`,
        {},
        `total-product-count-${tenantId}`
      );
      
      return result?.pagination?.totalItems || 0;
    } catch (error) {
      console.error('[StorefrontSingleton] Failed to get total product count:', error);
      return 0;
    }
  }

}

// Export singleton instance
export const storefrontService = StorefrontSingletonService.getInstance();
