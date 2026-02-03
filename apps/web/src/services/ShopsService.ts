/**
 * Universal Singleton Service for Shop Operations
 * Handles all shop-related API calls and data management
 */

import { UniversalSingleton } from '@/providers/base/UniversalSingleton';

// Shops API Singleton Class
class ShopsAPISingleton extends UniversalSingleton {
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
  ): Promise<{ success: boolean; data?: T; error?: string; status?: number }> {
    try {
      const response = await this.makeApiRequest<T>(url, options, cacheKey);
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error', status: error instanceof Error && 'status' in error ? (error as any).status : undefined };
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

class ShopsService {
  private static instance: ShopsService;
  private cache: Map<string, { data: any; timestamp: number }>;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.cache = new Map();
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
    const cacheKey = `shop:${identifier}`;
    const cached = this.getFromCache<Shop>(cacheKey);
    if (cached) return cached;

    try {
      const apiSingleton = ShopsAPISingleton.getInstance();
      const response = await apiSingleton.makeShopsApiRequest<Shop>(
        `/api/shops/resolve?identifier=${encodeURIComponent(identifier)}`,
        {},
        cacheKey
      );

      if (!response.success) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to resolve shop: ${response.error || 'Unknown error'}`);
      }

      const shop = response.data;
      if (!shop) {
        console.warn('Shop data is undefined');
        return null;
      }
      this.setCache(cacheKey, shop);
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
    const cacheKey = `products:${tenantId}:${JSON.stringify(filters)}`;
    const cached = this.getFromCache<ShopProductsResponse>(cacheKey);
    if (cached) return cached;

    try {
      const apiSingleton = ShopsAPISingleton.getInstance();
      const params = new URLSearchParams({
        tenantId,
        page: filters.page.toString(),
        limit: filters.limit.toString(),
        ...(filters.category && { category: filters.category }),
        ...(filters.search && { search: filters.search }),
        ...(filters.sort && filters.sort !== 'default' && { sort: filters.sort }),
      });

      const response = await apiSingleton.makeShopsApiRequest<any>(
        `/api/products?${params}`,
        {},
        `shop-products:${tenantId}:${JSON.stringify(filters)}`
      );

      if (!response.success) {
        throw new Error(`Failed to fetch products: ${response.error || 'Unknown error'}`);
      }

      const data = response.data;
      const result: ShopProductsResponse = {
        products: data.products || [],
        total: data.total || 0,
        categories: data.categories || [],
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching shop products:', error);
      return { products: [], total: 0, categories: [] };
    }
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
    const cacheKey = `reviews:${tenantId}:${page}:${limit}:${filter}:${sortBy}`;
    const cached = this.getFromCache<ShopReviewsResponse>(cacheKey);
    if (cached) return cached;

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
        cacheKey
      );

      if (!response.success) {
        throw new Error(`Failed to fetch reviews: ${response.error || 'Unknown error'}`);
      }

      const data = response.data;
      const result: ShopReviewsResponse = {
        reviews: data.reviews || [],
        total: data.total || 0,
      };

      this.setCache(cacheKey, result);
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

      if (!response.success) {
        throw new Error(`Failed to ${follow ? 'follow' : 'unfollow'} shop: ${response.error || 'Unknown error'}`);
      }

      // Clear relevant cache entries
      this.clearCachePattern(`shop:${tenantId}`);
      this.clearCachePattern(`shop:*`);

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

      // Clear review cache entries
      this.clearCachePattern('reviews:*');

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
    const cacheKey = `trending:${limit}:${region || 'all'}`;
    const cached = this.getFromCache<Shop[]>(cacheKey);
    if (cached) return cached;

    try {
      const apiSingleton = ShopsAPISingleton.getInstance();
      const params = new URLSearchParams({
        limit: limit.toString(),
        ...(region && { region }),
      });

      const response = await apiSingleton.makeShopsApiRequest<any>(
        `/api/shops/trending?${params}`,
        {},
        cacheKey
      );

      if (!response.success) {
        throw new Error(`Failed to fetch trending shops: ${response.error || 'Unknown error'}`);
      }

      const shops = response.data;
      this.setCache(cacheKey, shops);
      return shops;
    } catch (error) {
      console.error('Error fetching trending shops:', error);
      return [];
    }
  }

  /**
   * Search shops
   */
  async searchShops(query: string, limit: number = 20): Promise<Shop[]> {
    const cacheKey = `search:${query}:${limit}`;
    const cached = this.getFromCache<Shop[]>(cacheKey);
    if (cached) return cached;

    try {
      const apiSingleton = ShopsAPISingleton.getInstance();
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
      });

      const response = await apiSingleton.makeShopsApiRequest<any>(
        `/api/shops/search?${params}`,
        {},
        cacheKey
      );

      if (!response.success) {
        throw new Error(`Failed to search shops: ${response.error || 'Unknown error'}`);
      }

      const shops = response.data;
      this.setCache(cacheKey, shops);
      return shops;
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
    const cacheKey = `stats:${tenantId}`;
    const cached = this.getFromCache<{
      totalVariants: number;
      activeVariants: number;
      variantsOnSale: number;
      averagePrice: number;
      averageStock: number;
      parentProductsWithVariants: number;
    }>(cacheKey);
    if (cached) return cached;

    try {
      const apiSingleton = ShopsAPISingleton.getInstance();
      const response = await apiSingleton.makeShopsApiRequest<any>(
        `/api/shops/${tenantId}/stats`,
        {},
        cacheKey
      );

      if (!response.success) {
        throw new Error(`Failed to fetch shop stats: ${response.error || 'Unknown error'}`);
      }

      const stats = response.data;
      this.setCache(cacheKey, stats);
      return stats;
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
    const cacheKey = `categories:${params?.limit || 100}:${params?.minProducts || 1}`;
    const cached = this.getFromCache<Array<{
      category_type: 'product' | 'shop';
      category_name: string;
      category_slug: string;
      product_count: number;
      shop_count: number;
      avg_trending_score: number;
      products_in_stock: number;
    }>>(cacheKey);
    if (cached) return cached;

    try {
      const apiSingleton = ShopsAPISingleton.getInstance();
      const queryParams = new URLSearchParams({
        limit: (params?.limit || 100).toString(),
        minProducts: (params?.minProducts || 1).toString(),
      });

      const response = await apiSingleton.makeShopsApiRequest<any>(
        `/api/public/shops/categories?${queryParams}`,
        {},
        cacheKey
      );

      if (!response.success) {
        throw new Error(`Failed to fetch categories: ${response.error || 'Unknown error'}`);
      }

      const data = response.data;
      const rawCategories = data.success && data.data ? data.data : [];
      
      // Map to include all required CategoryAggregation fields
      const categories = rawCategories.map((cat: any) => ({
        category_type: cat.category_type as 'product' | 'shop',
        category_name: cat.category_name,
        category_slug: cat.category_slug,
        product_count: cat.product_count || 0,
        shop_count: cat.shop_count || 0,
        avg_trending_score: cat.avg_trending_score || 0,
        products_in_stock: cat.products_in_stock || 0,
      }));
      
      this.setCache(cacheKey, categories);
      return categories;
    } catch (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
  }

  /**
   * Get slug patterns for business name and location
   * Uses authenticated API request
   */
  async getSlugPatterns(params: {
    businessName: string;
    location?: {
      city?: string;
      state?: string;
      country?: string;
    };
    tenantId?: string;
  }): Promise<Array<{
    pattern: string;
    slug: string;
    isAvailable: boolean;
    description: string;
  }>> {
    const cacheKey = `patterns:${params.businessName}:${params.location?.city || ''}:${params.location?.state || ''}`;
    const cached = this.getFromCache<Array<{
      pattern: string;
      slug: string;
      isAvailable: boolean;
      description: string;
    }>>(cacheKey);
    if (cached) return cached;

    try {
      const apiSingleton = ShopsAPISingleton.getInstance();
      // Only access localStorage in browser environment
      const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
      
      const response = await apiSingleton.makeShopsApiRequest<any>(
        '/api/slugs/patterns',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: JSON.stringify({
            businessName: params.businessName,
            location: params.location || {},
          tenantId: params.tenantId,
        }),
      });

      if (!response.success) {
        throw new Error(`Failed to fetch slug patterns: ${response.error || 'Unknown error'}`);
      }

      const patterns = response.data?.patterns || [];
      
      this.setCache(cacheKey, patterns);
      return patterns;
    } catch (error) {
      console.error('Error fetching slug patterns:', error);
      throw error;
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

  // Cache management methods
  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.data as T;
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  private clearCachePattern(pattern: string): void {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache size (for debugging)
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

// Export singleton instance
export const shopsService = ShopsService.getInstance();
