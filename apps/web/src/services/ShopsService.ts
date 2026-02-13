/**
 * Universal Singleton Service for Shop Operations
 * Handles all shop-related API calls and data management
 */

import { UniversalSingleton, PublicApiSingleton } from '@/providers/base/UniversalSingleton';
import { CategoryAggregation } from '@/types/scope';

// Shops API Singleton Class
class ShopsAPISingleton extends PublicApiSingleton {
  private static instance: ShopsAPISingleton;

  private constructor() {
    super('shops-service', { encrypt: false });
  }

  public static getInstance(): ShopsAPISingleton {
    if (!ShopsAPISingleton.instance) {
      ShopsAPISingleton.instance = new ShopsAPISingleton();
    }
    return ShopsAPISingleton.instance;
  }

  async makeShopsApiRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string
  ): Promise<T> {
    return this.makePublicRequest<T>(url, options, cacheKey);
  }

  /**
   * Resolve shop identifier with priority order
   */
  async getShopByIdentifier(identifier: string): Promise<Shop | null> {
    const cacheKey = `shop:${identifier}`;

    try {
      const shop = await this.makeShopsApiRequest<Shop>(
        `/api/shops/resolve?identifier=${encodeURIComponent(identifier)}`,
        {},
        cacheKey
      );

      return shop;
    } catch (error) {
      console.error('Error resolving shop identifier:', identifier, error);
      return null;
    }
  }

  /**
   * Get shop products with filtering and pagination
   */
  async getShopProducts(tenantId: string, filters: ShopFilters): Promise<ShopProductsResponse> {
    try {
      const params = new URLSearchParams({
        tenantId,
        page: filters.page.toString(),
        limit: filters.limit.toString(),
        ...(filters.category && { category: filters.category }),
        ...(filters.search && { search: filters.search }),
        ...(filters.sort && filters.sort !== 'default' && { sort: filters.sort }),
      });

      const data = await this.makeShopsApiRequest<any>(
        `/api/products?${params}`,
        {},
        `shop-products:${tenantId}:${JSON.stringify(filters)}`
      );

      const result: ShopProductsResponse = {
        products: data.products || [],
        total: data.total || 0,
        categories: data.categories || [],
      };

      return result;
    } catch (error) {
      console.error('Error fetching shop products:', error);
      return { products: [], total: 0, categories: [] };
    }
  }
}

// Export the ShopsAPISingleton class
export { ShopsAPISingleton };

export interface Shop {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description?: string;
  bannerUrl?: string;
  logoUrl?: string;
  tagline?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  isVerified: boolean;
  isActive: boolean;
  rating?: number;
  reviewCount?: number;
  productCount?: number;
  followerCount?: number;
  createdAt: Date;
  updatedAt: Date;
  // Shop hours
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
  // Social links
  facebook?: string;
  instagram?: string;
  twitter?: string;
  linkedin?: string;
  youtube?: string;
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

export interface ShopFilters {
  category?: string;
  search?: string;
  sort?: string;
  page: number;
  limit: number;
}

export interface ShopProductsResponse {
  products: ShopProduct[];
  total: number;
  categories: string[];
}

export interface ShopReviewsResponse {
  reviews: ShopReview[];
  total: number;
}

class ShopsService extends PublicApiSingleton {
  private static instance: ShopsService;
  private apiSingleton: ShopsAPISingleton;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    super('shops-service-main');
    this.apiSingleton = ShopsAPISingleton.getInstance();
  }

  static getInstance(): ShopsService {
    if (!ShopsService.instance) {
      ShopsService.instance = new ShopsService();
    }
    return ShopsService.instance;
  }

  /**
   * Resolve shop identifier with priority order
   */
  async getShopByIdentifier(identifier: string): Promise<Shop | null> {
    return this.apiSingleton.getShopByIdentifier(identifier);
  }

  /**
   * Get shop products with filtering and pagination
   */
  async getShopProducts(tenantId: string, filters: ShopFilters): Promise<ShopProductsResponse> {
    return this.apiSingleton.getShopProducts(tenantId, filters);
  }

  /**
   * Get shop reviews with filtering and pagination
   */
  async getShopReviews(
    tenantId: string, 
    page: number = 1, 
    limit: number = 10,
    filter: 'all' | '5' | '4' | '3' | '2' | '1' = 'all',
    sortBy: 'recent' | 'helpful' | 'rating-high' | 'rating-low' = 'recent'
  ): Promise<ShopReviewsResponse> {
    try {
      const apiSingleton = ShopsAPISingleton.getInstance();
      const params = new URLSearchParams({
        tenantId,
        page: page.toString(),
        limit: limit.toString(),
        filter,
        sort: sortBy,
      });

      const response = await apiSingleton.makeShopsApiRequest<any>(
        `/api/shops/${tenantId}/reviews?${params}`,
        {},
        `reviews:${tenantId}:${page}:${limit}:${filter}:${sortBy}`
      );

      const data = response;
      const result: ShopReviewsResponse = {
        reviews: data.reviews || [],
        total: data.total || 0,
      };

      return result;
    } catch (error) {
      console.error('Error fetching shop reviews:', error);
      return { reviews: [], total: 0 };
    }
  }

  /**
   * Follow/unfollow a shop
   */
  async followShop(tenantId: string, follow: boolean): Promise<boolean> {
    try {
      const apiSingleton = ShopsAPISingleton.getInstance();
      const response = await apiSingleton.makeShopsApiRequest<any>(
        `/api/shops/${tenantId}/follow`,
        { method: follow ? 'POST' : 'DELETE' },
        `follow-shop:${tenantId}`
      );

      // Cache invalidation handled automatically by makePublicRequest
      return true;
    } catch (error) {
      console.error('Error following/unfollowing shop:', error);
      return false;
    }
  }

  /**
   * Mark a review as helpful
   */
  async markReviewHelpful(reviewId: string): Promise<boolean> {
    try {
      const apiSingleton = ShopsAPISingleton.getInstance();
      const response = await apiSingleton.makeShopsApiRequest<any>(
        `/api/reviews/${reviewId}/helpful`,
        { method: 'POST' },
        `helpful-review:${reviewId}`
      );

      if (!response.success) {
        throw new Error(`Failed to mark review as helpful: ${response.error || 'Unknown error'}`);
      }

      // Cache invalidation handled automatically by makePublicRequest
      return true;
    } catch (error) {
      console.error('Error marking review as helpful:', error);
      return false;
    }
  }

  
  /**
   * Get trending shops
   */
  async getTrendingShops(limit: number = 10, region?: string): Promise<Shop[]> {
    try {
      const apiSingleton = ShopsAPISingleton.getInstance();
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(region && { region }),
      });

      const shops = await apiSingleton.makeShopsApiRequest<Shop[]>(
        `/api/public/shops/trending?${params}`,
        {},
        `trending:${limit}:${region || 'all'}`
      );

      return shops;
    } catch (error) {
      console.log('Error fetching trending shops:', error);
      console.error('Error fetching trending shops:', error);
      return [];
    }
  }

  /**
   * Search shops
   */
  async searchShops(query: string, limit: number = 20): Promise<Shop[]> {
    try {
      const response = await this.makePublicRequest<{
        success: boolean;
        data: Shop[];
      }>('/api/shops/search', {
        method: 'POST',
        body: JSON.stringify({ query, limit }),
      }, `search:${query}:${limit}`);

      return response.data || [];
    } catch (error) {
      console.error('Error searching shops:', error);
      return [];
    }
  }

  /**
   * Get shop statistics
   */
  async getShopStats(tenantId: string): Promise<{
    totalVariants: number;
    activeVariants: number;
    variantsOnSale: number;
    averagePrice: number;
    averageStock: number;
    parentProductsWithVariants: number;
  }> {
    try {
      const response = await this.makePublicRequest<{
        totalVariants: number;
        activeVariants: number;
        variantsOnSale: number;
        averagePrice: number;
        averageStock: number;
        parentProductsWithVariants: number;
      }>(`/api/shops/${tenantId}/stats`, {}, `stats:${tenantId}`);

      return response || {
        totalVariants: 0,
        activeVariants: 0,
        variantsOnSale: 0,
        averagePrice: 0,
        averageStock: 0,
        parentProductsWithVariants: 0,
      };
    } catch (error) {
      console.error('Error fetching shop stats:', error);
      return {
        totalVariants: 0,
        activeVariants: 0,
        variantsOnSale: 0,
        averagePrice: 0,
        averageStock: 0,
        parentProductsWithVariants: 0,
      };
    }
  }

  /**
   * Get shop categories (simple version for dropdowns/filters)
   * Public endpoint - no authentication required
   */
  async getShopCategories(): Promise<Array<{
    shop_category: string;
    count?: number;
  }>> {
    try {
      const response = await this.makePublicRequest<{
        success: boolean;
        data?: Array<{
          shop_category: string;
          count?: number;
        }>;
      }>('/api/shops/categories', {}, 'shop-categories');

      const categories = response.data || [];
      return categories;
    } catch (error) {
      console.error('Error fetching shop categories:', error);
      return [];
    }
  }

  /**
   * Get shop categories
   * Public endpoint - no authentication required
   */
  async getCategories(params?: {
    limit?: number;
    minProducts?: number;
  }): Promise<CategoryAggregation[]> {
    try {
      const response = await this.makePublicRequest<{
        success: boolean;
        data?: CategoryAggregation[];
      }>('/api/shops/categories', {
        method: 'POST',
        body: JSON.stringify(params),
      }, `categories:${params?.limit || 100}:${params?.minProducts || 1}`);

      return response.data || [];
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  /**
   * Get shop hours status for public display
   * Public endpoint - no authentication required
   */
  async getShopHoursStatus(tenantId: string): Promise<{
    isOpen: boolean;
    hours?: {
      monday?: string;
      tuesday?: string;
      wednesday?: string;
      thursday?: string;
      friday?: string;
      saturday?: string;
      sunday?: string;
    };
    timezone?: string;
    nextOpenTime?: string;
    nextCloseTime?: string;
  }> {
    try {
      const response = await this.makePublicRequest<{
        isOpen: boolean;
        hours?: {
          monday?: string;
          tuesday?: string;
          wednesday?: string;
          thursday?: string;
          friday?: string;
          saturday?: string;
          sunday?: string;
        };
        timezone?: string;
        nextOpenTime?: string;
        nextCloseTime?: string;
      }>(`/api/shops/${tenantId}/hours-status`, {}, `hours-status-${tenantId}`);

      return response || {
        isOpen: false,
      };
    } catch (error) {
      console.error('Error fetching shop hours status:', error);
      return {
        isOpen: false,
      };
    }
  }

  /**
   * Generate shop URL based on available identifiers
   */
  generateShopUrl(shop: Shop): string {
    // Priority: slug > tenantId with prefix > autoId
    if (shop.slug) {
      return `/shops/${shop.slug}`;
    }
    
    if (shop.tenantId) {
      return `/shops/tid-${shop.tenantId}`;
    }
    
    // Fallback to ID (should not happen in normal operation)
    return `/shops/${shop.id}`;
  }

  /**
   * Get all possible URLs for a shop (for redirects, SEO, etc.)
   */
  getAllShopUrls(shop: Shop): string[] {
    const urls: string[] = [];
    
    if (shop.slug) {
      urls.push(`/shops/${shop.slug}`);
    }
    
    urls.push(`/shops/tid-${shop.tenantId}`);
    
    // Add autoId if available
    if (shop.id.length <= 8 && /^[A-Z0-9]+$/.test(shop.id)) {
      urls.push(`/shops/${shop.id}`);
    }
    
    return urls;
  }

}

// Export singleton instance
export const shopsService = ShopsService.getInstance();

// Add to window for debugging (only in browser)
if (typeof window !== 'undefined') {
  (window as any).shopsService = shopsService;
}
