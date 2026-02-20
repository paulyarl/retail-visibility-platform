/**
 * Shops Service - Platform Standard Implementation
 * 
 * Extends PublicApiSingleton to provide cached shops operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 * Consolidates functionality from both ShopsService and ShopsSingletonService
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { Shop, ShopIdentifiers, ShopResolution, ShopUrls } from '@/types/shop';

// ====================
// INTERFACES
// ====================

// Re-export Shop interface for convenience
export type { Shop, ShopUrls };

// Check if ShopsAPISingleton exists, if not create a placeholder
export class ShopsAPISingleton extends PublicApiSingleton {
  private static instance: ShopsAPISingleton;

  private constructor() {
    super('shops-api-singleton');
  }

  public static getInstance(): ShopsAPISingleton {
    if (!ShopsAPISingleton.instance) {
      ShopsAPISingleton.instance = new ShopsAPISingleton();
    }
    return ShopsAPISingleton.instance;
  }

  /**
   * Make shops API request
   */
  protected async makeShopsApiRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string
  ): Promise<{ data: T }> {
    const response = await this.makeDefaultRequest<T>(url, options, cacheKey);
    return { data: response.data || null as T };
  }
}

// Create a compatible Shop interface for components that expect id/logoUrl
export interface ShopWithId extends Omit<Shop, 'imageUrl'> {
  id: string;
  logoUrl?: string;
}

export interface ShopDirectoryParams {
  limit?: number;
  offset?: number;
  search?: string;
  category?: string;
  region?: string;
}

export interface ShopDirectoryResponse {
  shops: Shop[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TrendingShopsParams {
  limit?: number;
  offset?: number;
  category?: string;
  region?: string;
}

export interface ShopCategoriesResponse {
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    count?: number;
  }>;
}

export interface ShopProductsResponse {
  products: ShopProduct[];
  total: number;
  categories: string[];
  pagination?: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ShopReviewsResponse {
  reviews: Array<{
    id: string;
    rating: number;
    comment: string;
    author: string;
    date: string;
    helpful: number;
  }>;
  averageRating: number;
  totalReviews: number;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ShopFilters {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sort?: 'name' | 'rating' | 'created' | 'default';
}

export interface ShopProduct {
  id: string;
  name: string;
  description?: string;
  price: number;
  salePrice?: number;
  imageUrl?: string;
  sku: string;
  stock: number;
  isActive: boolean;
  rating?: number;
  reviewCount?: number;
  category?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShopReview {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  content: string;
  helpful: number;
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
  response?: {
    content: string;
    createdAt: Date;
  };
}

// ====================
// MAIN SHOPS SERVICE
// ====================

class ShopsService extends PublicApiSingleton {
  private static instance: ShopsService;

  private constructor() {
    super('shops-singleton', {
      ttl: 5 * 60 * 1000 // 5 minutes for shops data
    });
  }

  static getInstance(): ShopsService {
    if (!ShopsService.instance) {
      ShopsService.instance = new ShopsService();
    }
    return ShopsService.instance;
  }

  // ====================
  // SHOP DIRECTORY OPERATIONS
  // ====================

  /**
   * Get shop directory with filtering and pagination
   */
  async getShopDirectory(params: ShopDirectoryParams = {}): Promise<ShopDirectoryResponse> {
    const queryParams = new URLSearchParams();
    
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.category) queryParams.append('category', params.category);
    if (params.region) queryParams.append('region', params.region);

    const endpoint = `/api/shops/directory?${queryParams.toString()}`;
    const cacheKey = `shop_directory_${queryParams.toString()}`;
    
    try {
      const response = await this.makeDefaultRequest<Shop[]>(
        endpoint,
        {},
        cacheKey,
        5 * 60 * 1000 // 5 minutes
      );

      return {
        shops: response.data || [],
        pagination: {
          page: Math.floor((params.offset || 0) / (params.limit || 10)) + 1,
          limit: params.limit || 10,
          total: (response as any).total || 0,
          totalPages: Math.ceil(((response as any).total || 0) / (params.limit || 10))
        }
      };
    } catch (error) {
      console.error('[ShopsService] Failed to get shop directory:', error);
      throw error;
    }
  }

  /**
   * Get trending shops
   */
  async getTrendingShops(params: TrendingShopsParams = {}): Promise<Shop[]> {
    const queryParams = new URLSearchParams();
    
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());
    if (params.category) queryParams.append('category', params.category);
    if (params.region) queryParams.append('region', params.region);

    const endpoint = `/api/shops/trending?${queryParams.toString()}`;
    const cacheKey = `trending_shops_${queryParams.toString()}`;
    
    try {
      const response = await this.makeDefaultRequest<Shop[]>(
        endpoint,
        {},
        cacheKey,
        10 * 60 * 1000 // 10 minutes
      );

      return response.data || [];
    } catch (error) {
      console.error('Failed to get trending shops', error);
      throw error;
    }
  }

  /**
   * Get shop categories
   */
  async getShopCategories(): Promise<ShopCategoriesResponse> {
    const endpoint = '/api/shops/categories';
    const cacheKey = 'shop_categories';
    
    try {
      const response = await this.makeDefaultRequest<any[]>(
        endpoint,
        {},
        cacheKey,
        60 * 60 * 1000 // 1 hour
      );

      return {
        categories: response.data || []
      };
    } catch (error) {
      console.error('Failed to get shop categories', error);
      throw error;
    }
  }

  /**
   * Get shop categories
   * Public endpoint - no authentication required
   */
  async getCategories(params?: {
    limit?: number;
    minProducts?: number;
  }): Promise<Array<{
    category_type: 'product' | 'shop';
    category_name: string;
    category_slug: string;
    product_count: number;
    shop_count: number;
    avg_trending_score: number;
    products_in_stock: number;
  }>> {
    const endpoint = '/api/shops/categories';
    const cacheKey = 'shop_categories';
    
    try {
      const response = await this.makeDefaultRequest<any[]>(
        endpoint,
        {},
        cacheKey,
        60 * 60 * 1000 // 1 hour
      );

      return response.data || [];
    } catch (error) {
      console.error('Error fetching shop categories:', error);
      return [];
    }
  }

  // ====================
  // SHOP IDENTIFICATION OPERATIONS
  // ====================

  /**
   * Get tenant auto ID for a given tenant ID
   */
  async getTenantAutoId(tenantId: string): Promise<string> {
    const cacheKey = `tenant_auto_id_${tenantId}`;
    
    try {
      const response = await this.makeDefaultRequest<{ data: { autoId: string } }>(
        `/api/tenant-auto-id/${tenantId}`,
        {},
        cacheKey,
        30 * 60 * 1000 // 30 minutes for identifiers
      );

      const autoId = (response.data as any)?.autoId || '';
      return autoId;
    } catch (error) {
      console.error('[ShopsService] Failed to get tenant auto ID:', error);
      throw error;
    }
  }

  /**
   * Get all shop identifiers (tenantId, slug, autoId)
   */
  async getShopIdentifiers(tenantId: string, slug?: string): Promise<ShopIdentifiers> {
    const cacheKey = `shop_identifiers_${tenantId}_${slug || 'no-slug'}`;
    
    try {
      const autoId = await this.getTenantAutoId(tenantId);
      const identifiers: ShopIdentifiers = {
        tenantId,
        slug,
        autoId
      };

      return identifiers;
    } catch (error) {
      console.error('Failed to get shop identifiers', error);
      throw error;
    }
  }

  /**
   * Resolve shop by any identifier (slug, tenantId, or autoId)
   */
  async resolveShop(identifier: string): Promise<ShopResolution> {
    const cacheKey = `resolve_shop_${identifier}`;
    
    try {
      const response = await this.makeDefaultRequest<{ data: Shop; resolved: any }>(
        `/api/shops/${identifier}`,
        {},
        cacheKey,
        15 * 60 * 1000 // 15 minutes for resolution
      );

      // Extract shop data from response, excluding the resolved field
      const { resolved, ...shopData } = response.data as any;
      
      const resolution: ShopResolution = {
        identifier,
        type: (resolved?.type as 'tenantId' | 'slug' | 'autoId') || ('tenantId' as const),
        found: response.success || false,
        shop: shopData
      };
      
      return resolution;
    } catch (error) {
      console.error('[ShopsService] Failed to resolve shop:', error);
      throw error;
    }
  }

  /**
   * Get shop details by identifier
   */
  async getShopByIdentifier(identifier: string): Promise<Shop | null> {
    const resolution = await this.resolveShop(identifier);
    return resolution.shop || null;
  }

  // ====================
  // SHOP PRODUCTS OPERATIONS
  // ====================

  /**
   * Get shop products with filtering and pagination
   */
  async getShopProducts(tenantId: string, filters: ShopFilters): Promise<ShopProductsResponse> {
    try {
      const params = new URLSearchParams({
        tenantId,
        page: (filters.page || 1).toString(),
        limit: (filters.limit || 10).toString(),
        ...(filters.category && { category: filters.category }),
        ...(filters.search && { search: filters.search }),
        ...(filters.sort && filters.sort !== 'default' && { sort: filters.sort }),
      });

      const response = await this.makeDefaultRequest<any>(
        `/api/products?${params}`,
        {},
        `shop-products:${tenantId}:${JSON.stringify(filters)}`
      );

      return {
        products: response.data?.products || [],
        total: response.data?.pagination?.total || 0,
        categories: response.data?.categories || [],
        pagination: {
          page: response.data?.pagination?.page || 1,
          limit: response.data?.pagination?.limit || 10,
          totalPages: response.data?.pagination?.totalPages || 0
        }
      };
    } catch (error) {
      console.error('[ShopsService] Failed to get shop products:', error);
      throw error;
    }
  }

  // ====================
  // SHOP REVIEWS OPERATIONS
  // ====================

  /**
   * Get shop reviews with pagination
   */
  async getShopReviews(tenantId: string, filters: ShopFilters): Promise<ShopReviewsResponse> {
    try {
      const params = new URLSearchParams({
        tenantId,
        page: (filters.page || 1).toString(),
        limit: (filters.limit || 10).toString(),
        ...(filters.sort && { sort: filters.sort }),
      });

      const response = await this.makeDefaultRequest<any>(
        `/api/reviews?${params}`,
        {},
        `shop-reviews:${tenantId}:${JSON.stringify(filters)}`
      );

      return {
        reviews: response.data?.reviews || [],
        averageRating: response.data?.averageRating || 0,
        totalReviews: response.data?.totalReviews || 0,
        pagination: {
          page: response.data?.pagination?.page || 1,
          limit: response.data?.pagination?.limit || 10,
          total: response.data?.pagination?.total || 0,
          totalPages: response.data?.pagination?.totalPages || 0
        }
      };
    } catch (error) {
      console.error('[ShopsService] Failed to get shop reviews:', error);
      throw error;
    }
  }

  /**
   * Mark review as helpful
   */
  async markReviewHelpful(reviewId: string, isHelpful: boolean): Promise<boolean> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/reviews/${reviewId}/helpful`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isHelpful }),
        },
        `helpful-review-${reviewId}`
      );

      return response.success || false;
    } catch (error) {
      console.error('[ShopsService] Failed to mark review helpful:', error);
      throw error;
    }
  }

  /**
   * Follow a shop
   */
  async followShop(tenantId: string): Promise<boolean> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/shops/${tenantId}/follow`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        `follow-shop-${tenantId}`
      );

      return response.success || false;
    } catch (error) {
      console.error('[ShopsService] Failed to follow shop:', error);
      throw error;
    }
  }

  // ====================
  // UTILITY METHODS
  // ====================

  /**
   * Get all possible URLs for a shop
   */
  getAllShopUrls(shop: Shop): string[] {
    const urls: string[] = [];
    
    if (shop.slug) {
      urls.push(`/shops/${shop.slug}`);
    }
    
    urls.push(`/shops/tid-${shop.tenantId}`);
    
    // Add autoId if available
    if (shop.autoId.length <= 8 && /^[A-Z0-9]+$/.test(shop.autoId)) {
      urls.push(`/shops/${shop.autoId}`);
    }
    
    return urls;
  }

  /**
   * Get shop URLs by tenant ID and optional slug
   */
  async getShopUrls(tenantId: string, slug?: string): Promise<ShopUrls> {
    const urls: ShopUrls = {
      slugUrl: slug ? `/directory/${slug}` : null,
      tenantIdUrl: `/directory/${tenantId}`,
      autoIdUrl: `/directory/${tenantId}`, // Fallback to tenantId
      canonicalUrl: slug ? `/directory/${slug}` : `/directory/${tenantId}`
    };
    
    return urls;
  }

  /**
   * Health check for the shops service
   */
  async healthCheck(): Promise<boolean> {
    try {
       const response = await this.makeDefaultRequest('/api/shops/health',{},"shop-healthcheck");
      if (!response.success){
        console.error('Health check failed', response.error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Health check failed', error);
      return false;
    }
  }
}

// Export singleton instance
export const shopsService = ShopsService.getInstance();

// Add to window for debugging (only in browser)
if (typeof window !== 'undefined') {
  (window as any).shopsService = shopsService;
}

export default ShopsService;
