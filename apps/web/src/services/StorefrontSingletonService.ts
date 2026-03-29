/**
 * Storefront Singleton Service
 * 
 * Extends PublicApiSingleton to provide cached storefront operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { getErrorMessage, getErrorStatus } from '@/providers/base/FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';

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
  category?: string;
  subcategory?: string;
  payment_gateway_type?: string | null;
  has_active_payment_gateway?: boolean;
  isActive?: boolean;
  isFeatured?: boolean;
  isArchived?: boolean;
  isAvailable?: boolean;
  isDeleted?: boolean;
  isPublished?: boolean;
  isHidden?: boolean;
  isDraft?: boolean;
  isInactive?: boolean;

  // Enhanced fields from new API
  imageGallery?: Array<{
    id: string;
    url: string;
    position: number;
    alt?: string;
    caption?: string;
    variant_id?: string;
    createdAt: string;
    isPrimary: boolean;
  }>;
  variants?: Array<{
    id: string;
    sku: string;
    variant_name: string;
    price_cents: number;
    sale_price_cents?: number;
    stock: number;
    image_url?: string;
    attributes: Record<string, any>;
    sort_order: number;
    is_active: boolean;
    is_on_sale: boolean;
    discount_percentage: number;
  }>;
  hasVariants?: boolean;
  productType?: 'physical' | 'digital' | 'hybrid';
  digitalDeliveryMethod?: string;
  digitalAssets?: any[];
  licenseType?: string;
  accessDurationDays?: number;
  downloadLimit?: number;
  isOnSale?: boolean;
  discountPercentage?: number;
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

    protected defaultContext: AppContext = AppContext.STORE;
    protected defaultIsolation: CacheIsolation = CacheIsolation.STORE;
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
      
      // console.log('[StorefrontSingleton] getStorefrontCategories result:', {
      //   success: result.success,
      //   hasData: !!result.data,
      //   categoriesCount: result.data?.categories?.length || 0,
      //   categories: result.data?.categories?.map((c: any) => ({
      //     name: c.name,
      //     count: c.count,
      //     id: c.id
      //   })),
      //   uncategorizedCount: result.data?.uncategorizedCount || 0,
      //   fullData: JSON.stringify(result.data, null, 2)
      // });
      
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
          // console.log(`[StorefrontSingleton] Clearing old cached data (missing featuredTypes/payment fields)`);
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
   * Get featured products grouped by type for storefront display
   * Uses the public /api/directory/featured-products endpoint
   */
  async getFeaturedProductsByType(
    tenantId: string,
    type?: string,
    limit: number = 10
  ): Promise<Record<string, StorefrontProduct[]>> {
    // console.log('[StorefrontSingleton] getFeaturedProductsByType called:', {
    //   tenantId,
    //   type,
    //   limit,
    //   hasTenantId: !!tenantId
    // });
    
    if (!tenantId) {
      // console.error('[StorefrontSingleton] getFeaturedProductsByType: tenantId is required');
      return {};
    }

    try {
      const endpoint = `/api/directory/featured-products?tenantId=${tenantId}&limit=${limit}`;
      const cacheKey = `featured-products-by-type-${tenantId}-${limit}`;
      
      // console.log('[StorefrontSingleton] Making request:', {
      //   endpoint,
      //   cacheKey
      // });
      
      // Type for the API response structure
      type ApiResponse = {
        success: boolean;
        data: {
          totalCount: number;
          buckets: Record<string, StorefrontProduct[]>;
          bucketCounts: Record<string, number>;
          shops: Array<{id: string; name: string; slug: string; logo?: string; tier: string}>;
        };
      };
      
      const result = await this.makeDefaultRequest<ApiResponse>(
        endpoint,
        {},
        cacheKey,
        this.cacheTTL
      ) as any;  // Cast to any to handle nested response structure
      
      // console.log('[StorefrontSingleton] Request result:', {
      //   success: result.success,
      //   hasData: !!result.data,
      //   error: result.error,
      //   hasBuckets: result.data?.data?.buckets ? true : false,
      //   bucketKeys: result.data?.data?.buckets ? Object.keys(result.data.data.buckets) : []
      // });
      
      if (!result.success) {
        console.warn('[StorefrontSingleton] Failed to get featured products by type:', result.error);
        return {};
      }
      
      // The API returns { success: true, data: { buckets: {...}, bucketCounts: {...}, shops: [...] } }
      // makeDefaultRequest wraps this in another layer: { success: true, data: { success: true, data: { buckets: {...} } } }
      // So we need to extract: result.data.data.buckets
      const groupedProducts: Record<string, StorefrontProduct[]> = result.data?.data?.buckets || {};
      
      // If a specific type is requested, return only that type
      if (type && groupedProducts[type]) {
        // console.log('[StorefrontSingleton] Returning specific type:', {
        //   type,
        //   count: groupedProducts[type]?.length || 0
        // });
        return { [type]: groupedProducts[type] };
      }
      
      // console.log('[StorefrontSingleton] Returning all types:', {
      //   types: Object.keys(groupedProducts),
      //   counts: Object.fromEntries(
      //     Object.entries(groupedProducts).map(([k, v]) => [k, (v as any[])?.length || 0])
      //   )
      // });
      
      return groupedProducts;
    } catch (error) {
      console.error('[StorefrontSingleton] Failed to get featured products by type:', error);
      return {};
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
        if (getErrorStatus(result.error) === 404) {
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
export const storefrontSingletonService = StorefrontSingletonService.getInstance();
