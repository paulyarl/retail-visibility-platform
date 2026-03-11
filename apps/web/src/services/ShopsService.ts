/**
 * Shops Service - Platform Standard Implementation
 * 
 * Extends PublicApiSingleton to provide cached shops operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 * Consolidates functionality from both ShopsService and ShopsSingletonService
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton'; 
import { Shop, ShopIdentifiers, ShopResolution, ShopUrls } from '../types/shop';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientTenantContextManager } from '@/lib/clientTenantContext';

// ====================
// INTERFACES
// ====================

// Re-export Shop interface for convenience
export type { Shop, ShopUrls };

// Check if ShopsAPISingleton exists, if not create a placeholder
export class ShopsAPISingleton extends PublicApiSingleton {

    protected defaultContext: AppContext = AppContext.SHOP;
    protected defaultIsolation: CacheIsolation = CacheIsolation.SHOP;
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

  protected constructor() {
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
    // Use tenant-aware cache key on client-side, basic on server-side
    const cacheKey = typeof window !== 'undefined' 
      ? clientTenantContextManager.getTenantAwareCacheKey(`shop_directory_${queryParams.toString()}`)
      : `shop_directory_${queryParams.toString()}`;
    
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
    // Use tenant-aware cache key on client-side, basic on server-side
    const cacheKey = typeof window !== 'undefined' 
      ? clientTenantContextManager.getTenantAwareCacheKey(`trending_shops_${queryParams.toString()}`)
      : `trending_shops_${queryParams.toString()}`;
    
    try {
      const response = await this.makeDefaultRequest<Shop[]>(
        endpoint,
        {},
        cacheKey,
        10 * 60 * 1000 // 10 minutes
      );

      // Debug: Log the response structure
     /*  console.log('[ShopsService] getTrendingShops response structure:', {
        response,
        responseType: typeof response,
        hasData: 'data' in response,
        dataIsArray: 'data' in response && Array.isArray(response.data),
        isArray: Array.isArray(response),
        dataValue: response?.data,
        dataType: typeof response?.data,
        dataKeys: response?.data ? Object.keys(response.data) : 'no data property',
        // Check if data is a string that needs parsing
        dataIsString: typeof response?.data === 'string',
        dataAsString: typeof response?.data === 'string' ? (response.data as string).substring(0, 100) + '...' : 'not string',
        // Expand the data object to see its structure
        dataExpanded: response?.data ? JSON.stringify(response.data, null, 2) : 'no data'
      }); */
      
      // Handle the correct API response structure
      let shops: Shop[] = [];
      if (response?.success && response?.data) {
        const responseData = response.data as any; // Type assertion for dynamic structure
        // Check if data is a string that needs parsing
        if (typeof responseData === 'string') {
          try {
            const parsedData = JSON.parse(responseData);
            if (Array.isArray(parsedData)) {
              shops = parsedData;
              // console.log('[ShopsService] Parsed response.data string to array, length:', shops.length);
            } else {
              console.warn('[ShopsService] Parsed data is not an array:', parsedData);
            }
          } catch (parseError) {
            console.error('[ShopsService] Failed to parse response.data string:', parseError);
          }
        } else if (Array.isArray(responseData)) {
          shops = responseData;
//          console.log('[ShopsService] Using response.data array, length:', shops.length);
        } else if (responseData?.data && Array.isArray(responseData.data)) {
          // Handle double-wrapped response: { success: true, data: { data: [...] } }
          shops = responseData.data;
//          console.log('[ShopsService] Using double-wrapped response.data.data array, length:', shops.length);
        } else if (responseData?.shops && Array.isArray(responseData.shops)) {
          // Handle shops-wrapped response: { success: true, data: { shops: [...] } }
          shops = responseData.shops;
//          console.log('[ShopsService] Using response.data.shops array, length:', shops.length);
        } else {
          console.warn('[ShopsService] response.data is neither array nor string:', typeof responseData);
          console.log('[ShopsService] Available data properties:', responseData ? Object.keys(responseData) : 'no data');
        }
      } else {
        console.warn('[ShopsService] Unexpected response structure:', response);
        shops = [];
      }

      return shops;
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
    // Use tenant-aware cache key on client-side, basic on server-side
    const cacheKey = typeof window !== 'undefined' 
      ? clientTenantContextManager.getTenantAwareCacheKey(`tenant_auto_id_${tenantId}`)
      : `tenant_auto_id_${tenantId}`;
    
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
    // Use tenant-aware cache key on client-side, basic on server-side
    const cacheKey = typeof window !== 'undefined' 
      ? clientTenantContextManager.getTenantAwareCacheKey(`shop_identifiers_${tenantId}_${slug || 'no-slug'}`)
      : `shop_identifiers_${tenantId}_${slug || 'no-slug'}`;
    
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
    // Use tenant-aware cache key to prevent cross-tenant contamination
    // For server-side rendering, fall back to basic cache key without tenant context
    let cacheKey: string;
    
    if (typeof window !== 'undefined') {
      // Client-side - use tenant context
      cacheKey = clientTenantContextManager.getTenantAwareCacheKey(`resolve_shop_${identifier}`);
    } else {
      // Server-side - use basic cache key but with timestamp to avoid contamination
      const timestamp = Date.now();
      cacheKey = `resolve_shop_${identifier}_${timestamp}`;
    }
    
    try {
      // console.log('[ShopsService] Making request to resolve shop:', identifier);
      const tenantId = await this.resolveIdentifier(identifier,AppContext.TENANT);
      if (!tenantId) {
        console.error('[ShopsService] Failed to resolve tenant ID for identifier:', identifier);
        throw new Error('Failed to resolve shop');
      }
      const response = await this.makeDefaultRequest<{ shop: any; metadata?: any }>(
        `/api/public/shops/id/${tenantId}`,
        {},
        cacheKey,
        15 * 60 * 1000 // 15 minutes for resolution
      );
      
      // console.log('[ShopsService] API Response:', {
      //   success: response.success,
      //   hasData: !!response.data,
      //   dataKeys: response.data ? Object.keys(response.data) : 'null',
      //   fullData: JSON.stringify(response.data, null, 2)
      // });
      
      if (!response.success) {
        console.log('[ShopsService] API request failed:', response.error);
     //   throw new Error('Failed to resolve shop');
      }

      // Extract shop data from response
      // API returns: { success: true, shop: {...}, metadata: {...} }
      const shopData = response.data;
      
      // console.log('[ShopsService] Shop data extracted:', {
      //   hasShopProperty: !!shopData?.shop,
      //   shopKeys: shopData?.shop ? Object.keys(shopData.shop) : 'null',
      //   shopData: JSON.stringify(shopData?.shop, null, 2)
      // });
      
      // The actual shop data is in shopData.shop (from /api/public/shops/:identifier)
      const actualShopData = shopData?.shop;
      
      /* console.log('[ShopsService] Final shop data:', {
        hasActualData: !!actualShopData,
        hasId: !!actualShopData?.id,
        shopId: actualShopData?.id,
        shopName: actualShopData?.name
      }); */
      
      // If no shop data is found, return a not-found resolution
      if (!actualShopData || !actualShopData.id) {
       /*  console.log(`[ShopsService] No shop found for identifier: ${identifier}`, {
          hasActualShopData: !!actualShopData,
          hasId: !!actualShopData?.id,
          actualShopDataKeys: actualShopData ? Object.keys(actualShopData) : 'null'
        }); */
        return {
          identifier,
          type: 'tenantId' as const,
          found: false,
          shop: undefined
        };
      }
      
      const resolution: ShopResolution = {
        identifier,
        type: 'tenantId' as const,
        found: response.success || false,
        shop: actualShopData?.id ? {
          ...actualShopData,
          tenantId: actualShopData.id, // Map id to tenantId for Shop interface
        } as unknown as Shop : undefined
      };
      
      /* console.log('[ShopsService] Resolution created:', {
        identifier: resolution.identifier,
        found: resolution.found,
        hasShop: !!resolution.shop,
        shopTenantId: resolution.shop?.tenantId
      }); */
      
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
      slugUrl: slug ? `/shops/${slug}` : null,
      tenantIdUrl: `/shops/tid-${tenantId}`,
      autoIdUrl: `/shops/${tenantId}`, // Fallback to tenantId
      canonicalUrl: slug ? `/shops/${slug}` : `/shops/tid-${tenantId}`
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
