/**
 * Tenant-Aware Storefront Service
 * 
 * Extends TenantApiSingleton to provide tenant-specific storefront operations
 * Uses tenant context for proper cache isolation
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

export interface StorefrontCategory {
  id: string;
  name: string;
  slug: string;
  count: number;
  googleCategoryId?: string | null;
}

export interface StorefrontProduct {
  id: string;
  sku: string;
  name: string;
  title?: string;
  description?: string;
  price: number;
  priceCents?: number;
  currency: string;
  stock: number;
  image_url?: string;
  images?: string[];
  category?: string;
  categoryName?: string;
  tenantCategoryId?: string | null;
  visibility: 'public' | 'private';
  status: 'active' | 'inactive' | 'draft' | 'archived';
  featured?: boolean;
  featuredAt?: string;
  defaultGatewayType?: string | null;
  hasActivePaymentGateway?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface StorefrontProductsResponse {
  items: StorefrontProduct[];
  total?: number;
  count?: number;
  page?: number;
  limit?: number;
  hasMore?: boolean;
  pagination?: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface StorefrontCategoriesResponse {
  categories: StorefrontCategory[];
  uncategorizedCount: number;
}

class TenantStorefrontService extends TenantApiSingleton {
  private static instance: TenantStorefrontService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-storefront-service*',
      'storefront-config*',
      'storefront-operations*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('tenant-storefront-service*');
    await this.invalidateCachePattern('storefront-config*');
    await this.invalidateCachePattern('storefront-operations*');
  }

  private constructor() {
    super('tenant-storefront', {
      ttl: 5 * 60 * 1000 // 5 minutes for storefront data
    });
  }

  public static getInstance(): TenantStorefrontService {
    if (!TenantStorefrontService.instance) {
      TenantStorefrontService.instance = new TenantStorefrontService();
    }
    return TenantStorefrontService.instance;
  }

  /**
   * Get storefront categories with product counts for a specific tenant
   * Uses the /api/storefront/:tenantId/categories endpoint with tenant context
   */
  async getStorefrontCategories(tenantId: string): Promise<StorefrontCategoriesResponse> {
    if (!tenantId) {
      console.error('[TenantStorefrontService] getStorefrontCategories: tenantId is required');
      return { categories: [], uncategorizedCount: 0 };
    }

    try {
      const result = await this.makeDefaultRequest<StorefrontCategoriesResponse>(
        `/api/storefront/${tenantId}/categories`,
        {},
        `storefront-categories-${tenantId}`,
        this.cacheTTL
      );

      if (!result.success) {
        console.error('[TenantStorefrontService] Failed to get storefront categories:', result.error);
        return { categories: [], uncategorizedCount: 0 };
      }

      return result.data || { categories: [], uncategorizedCount: 0 };
    } catch (error) {
      console.error('[TenantStorefrontService] Failed to get storefront categories:', error);
      return { categories: [], uncategorizedCount: 0 };
    }
  }

  /**
   * Get storefront products with pagination and filtering for a specific tenant
   * Uses the /api/storefront/:tenantId/products endpoint with tenant context
   */
  async getStorefrontProducts(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      search?: string;
      category?: string;
      visibility?: 'public' | 'private';
      sortBy?: 'name' | 'price' | 'created' | 'featured';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<StorefrontProductsResponse> {
    if (!tenantId) {
      console.error('[TenantStorefrontService] getStorefrontProducts: tenantId is required');
      return { items: [], total: 0, page: 1, limit: 20, hasMore: false };
    }

    const {
      page = 1,
      limit = 20,
      search,
      category,
      visibility,
      sortBy,
      sortOrder
    } = options;

    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (page) queryParams.append('page', page.toString());
      if (limit) queryParams.append('limit', limit.toString());
      if (search) queryParams.append('search', search);
      if (category) queryParams.append('category', category);
      if (visibility) queryParams.append('visibility', visibility);
      if (sortBy) queryParams.append('sortBy', sortBy);
      if (sortOrder) queryParams.append('sortOrder', sortOrder);

      const queryString = queryParams.toString();
      const endpoint = `/api/storefront/${tenantId}/products${queryString ? `?${queryString}` : ''}`;
      const cacheKey = `storefront-products-${tenantId}-${queryString}`;

      const result = await this.makeDefaultRequest<StorefrontProductsResponse>(
        endpoint,
        {},
        cacheKey,
        this.cacheTTL
      );

      if (!result.success) {
        console.error('[TenantStorefrontService] Failed to get storefront products:', result.error);
        return { items: [], total: 0, page: 1, limit: 20, hasMore: false };
      }

      return result.data || { items: [], total: 0, page: 1, limit: 20, hasMore: false };
    } catch (error) {
      console.error('[TenantStorefrontService] Failed to get storefront products:', error);
      return { items: [], total: 0, page: 1, limit: 20, hasMore: false };
    }
  }

  /**
   * Get featured products for a specific tenant
   * Uses the /api/storefront/:tenantId/featured endpoint with tenant context
   */
  async getFeaturedProducts(
    tenantId: string,
    options: {
      limit?: number;
      search?: string;
      category?: string;
    } = {}
  ): Promise<StorefrontProductsResponse> {
    if (!tenantId) {
      console.error('[TenantStorefrontService] getFeaturedProducts: tenantId is required');
      return { items: [], count: 0 };
    }

    const { limit = 10, search, category } = options;

    try {
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (limit) queryParams.append('limit', limit.toString());
      if (search) queryParams.append('search', search);
      if (category) queryParams.append('category', category);

      const queryString = queryParams.toString();
      const endpoint = `/api/storefront/${tenantId}/featured${queryString ? `?${queryString}` : ''}`;
      const cacheKey = `storefront-featured-${tenantId}-${queryString}`;

      const result = await this.makeDefaultRequest<StorefrontProductsResponse>(
        endpoint,
        {},
        cacheKey,
        this.cacheTTL
      );

      if (!result.success) {
        console.error('[TenantStorefrontService] Failed to get featured products:', result.error);
        return { items: [], count: 0 };
      }

      return result.data || { items: [], count: 0 };
    } catch (error) {
      console.error('[TenantStorefrontService] Failed to get featured products:', error);
      return { items: [], count: 0 };
    }
  }
}

// Export the singleton instance
export const tenantStorefrontService = TenantStorefrontService.getInstance();
