/**
 * Cross-Tenant Product Service
 * Leverage product_slug for cross-tenant product discovery and analytics
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface CrossTenantProduct {
  inventory_item_id: string;
  product_slug: string;
  product_name: string;
  product_title: string;
  brand_normalized: string;
  category_normalized: string;
  list_price_cents: number;
  current_price_cents: number;
  is_on_sale: boolean;
  discount_percentage: number;
  stock: number;
  in_stock: boolean;
  image_url: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_city: string;
  tenant_state: string;
  tenant_latitude: number;
  tenant_longitude: number;
  store_average_rating: number;
  store_review_count: number;
  distance_km?: number;
}

export interface BrandAnalytics {
  brand: string;
  product_count: number;
  tenant_count: number;
  inventory_item_count: number;
  total_stock: number;
  avg_price_cents: number;
  min_price_cents: number;
  max_price_cents: number;
  total_views: number;
  total_purchases: number;
  total_revenue_cents: number;
  avg_store_rating: number;
  brand_tier: 'hot' | 'trending' | 'popular' | 'standard';
  refreshed_at: string;
}

export interface CategoryAnalytics {
  category: string;
  product_count: number;
  tenant_count: number;
  inventory_item_count: number;
  total_stock: number;
  avg_price_cents: number;
  total_views: number;
  total_purchases: number;
  total_revenue_cents: number;
  category_tier: 'hot' | 'trending' | 'popular' | 'standard';
  refreshed_at: string;
}

export interface PlatformProductAnalytics {
  product_slug: string;
  product_name: string;
  brand_normalized: string;
  category_normalized: string;
  slug_type: 'upc' | 'lpc';
  tenant_adoption_count: number;
  total_inventory_items: number;
  total_platform_stock: number;
  avg_platform_price_cents: number;
  min_platform_price_cents: number;
  max_platform_price_cents: number;
  total_views: number;
  total_unique_viewers: number;
  total_purchases: number;
  total_revenue_cents: number;
  avg_store_rating: number;
  total_reviews: number;
  demand_tier: 'high_demand' | 'medium_demand' | 'high_interest' | 'medium_interest' | 'standard';
  availability_tier: 'high_availability' | 'medium_availability' | 'low_availability' | 'out_of_stock';
  price_tier: 'premium' | 'mid_range' | 'value' | 'budget';
  refreshed_at: string;
}

export interface TrendingProduct {
  product_slug: string;
  product_name: string;
  brand_normalized: string;
  category_normalized: string;
  tenant_adoption_count: number;
  total_platform_stock: number;
  total_purchases: number;
  total_views: number;
  demand_tier: string;
  platform_trending_score: number;
  image_url: string;
  list_price_cents: number;
  current_price_cents: number;
}

class CrossTenantProductService extends PublicApiSingleton {
  private static instance: CrossTenantProductService;

  private constructor() {
    super("cross-tenant-product-service");
  }

  static getInstance(): CrossTenantProductService {
    if (!CrossTenantProductService.instance) {
      CrossTenantProductService.instance = new CrossTenantProductService();
    }
    return CrossTenantProductService.instance;
  }

  /**
   * Find all stores carrying the same product (by product_slug)
   * Enables "Available Nearby" feature for shoppers
   */
  async getProductsBySlug(
    productSlug: string,
    options?: {
      excludeTenantId?: string;
      latitude?: number;
      longitude?: number;
      radius?: number;
      limit?: number;
    }
  ): Promise<{
    product_slug: string;
    total_stores: number;
    nearby_stores: number;
    products: CrossTenantProduct[];
  }> {
    const params = new URLSearchParams();
    if (options?.excludeTenantId) params.set('excludeTenantId', options.excludeTenantId);
    if (options?.latitude) params.set('latitude', String(options.latitude));
    if (options?.longitude) params.set('longitude', String(options.longitude));
    if (options?.radius) params.set('radius', String(options.radius));
    if (options?.limit) params.set('limit', String(options.limit));

    const cachekey = `product-by-slug-${productSlug}-${options?.excludeTenantId || ''}-${options?.latitude || ''}-${options?.longitude || ''}-${options?.radius || ''}-${options?.limit || ''}`;

    const response = await this.makeDefaultRequest<{
      success: boolean;
      data: {
        product_slug: string;
        total_stores: number;
        nearby_stores: number;
        products: CrossTenantProduct[];
      };
    }>(`/api/cross-tenant/products/${productSlug}?${params.toString()}`, {}, cachekey);

    if (!response.success){
      console.error('[CrossTenantProductService] Failed to get products by slug:', response.error);
      return {
        product_slug: productSlug,
        total_stores: 0,
        nearby_stores: 0,
        products: []
      };
    }

    return {
      product_slug: response.data?.data?.product_slug||'',
      total_stores: response.data?.data?.total_stores||0,
      nearby_stores: response.data?.data?.nearby_stores||0,
      products: response.data?.data?.products||[]
    };
  }

  /**
   * Get platform-wide brand performance analytics
   */
  async getBrandAnalytics(options?: {
    limit?: number;
    tier?: 'hot' | 'trending' | 'popular' | 'standard';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<BrandAnalytics[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.tier) params.set('tier', options.tier);
    if (options?.sortBy) params.set('sortBy', options.sortBy);
    if (options?.sortOrder) params.set('sortOrder', options.sortOrder);
    
    const cachekey = `brand-analytics-${options?.limit || ''}-${options?.tier || ''}-${options?.sortBy || ''}-${options?.sortOrder || ''}`;

    const response = await this.makeDefaultRequest<{
      success: boolean;
      data: BrandAnalytics[];
    }>(`/api/cross-tenant/analytics/brands?${params.toString()}`, {}, cachekey);

    if (!response.success){
      console.error('[CrossTenantProductService] Failed to get brand analytics:', response.error);
      return [];
    }

    return {
      ...response.data?.data||[]
    };
  }

  /**
   * Get platform-wide category performance analytics
   */
  async getCategoryAnalytics(options?: {
    limit?: number;
    tier?: 'hot' | 'trending' | 'popular' | 'standard';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<CategoryAnalytics[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.tier) params.set('tier', options.tier);
    if (options?.sortBy) params.set('sortBy', options.sortBy);
    if (options?.sortOrder) params.set('sortOrder', options.sortOrder);

    const cachekey = `category-analytics-${options?.limit || ''}-${options?.tier || ''}-${options?.sortBy || ''}-${options?.sortOrder || ''}`;

    const response = await this.makeDefaultRequest<{
      success: boolean;
      data: CategoryAnalytics[];
    }>(`/api/cross-tenant/analytics/categories?${params.toString()}`, {}, cachekey);

    if (!response.success){
      console.error('[CrossTenantProductService] Failed to get category analytics:', response.error);
      return [];
    }

    return response.data?.data||[];
  }

  /**
   * Get platform-wide product performance analytics
   */
  async getProductAnalytics(options?: {
    limit?: number;
    demandTier?: string;
    priceTier?: string;
    availabilityTier?: string;
    brand?: string;
    category?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<PlatformProductAnalytics[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.demandTier) params.set('demandTier', options.demandTier);
    if (options?.priceTier) params.set('priceTier', options.priceTier);
    if (options?.availabilityTier) params.set('availabilityTier', options.availabilityTier);
    if (options?.brand) params.set('brand', options.brand);
    if (options?.category) params.set('category', options.category);
    if (options?.sortBy) params.set('sortBy', options.sortBy);
    if (options?.sortOrder) params.set('sortOrder', options.sortOrder);

    const cachekey = `product-analytics-${options?.limit || ''}-${options?.demandTier || ''}-${options?.priceTier || ''}-${options?.availabilityTier || ''}-${options?.brand || ''}-${options?.category || ''}-${options?.sortBy || ''}-${options?.sortOrder || ''}`;

    const response = await this.makeDefaultRequest<{
      success: boolean;
      data: PlatformProductAnalytics[];
    }>(`/api/cross-tenant/analytics/products?${params.toString()}`, {}, cachekey);

    if (!response.success){
        console.error('[CrossTenantProductService] Failed to get product analytics:', response.error);
      return [];
    }

    return response.data?.data||[];
  }

  /**
   * Get platform-wide trending products
   */
  async getTrendingProducts(options?: {
    limit?: number;
    category?: string;
    brand?: string;
  }): Promise<TrendingProduct[]> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.category) params.set('category', options.category);
    if (options?.brand) params.set('brand', options.brand);

    const cachekey = `trending-products-${options?.limit || ''}-${options?.category || ''}-${options?.brand || ''}`;

    const response = await this.makeDefaultRequest<{
      success: boolean;
      data: TrendingProduct[];
    }>(`/api/cross-tenant/trending?${params.toString()}`, {}, cachekey);

    if (!response.success){
      console.error('[CrossTenantProductService] Failed to get trending products:', response.error);
      return [];
    }

    return response.data?.data||[];
  }

  /**
   * Search products across all tenants
   */
  async searchProducts(options: {
    q?: string;
    brand?: string;
    category?: string;
    limit?: number;
  }): Promise<PlatformProductAnalytics[]> {
    const params = new URLSearchParams();
    if (options.q) params.set('q', options.q);
    if (options.brand) params.set('brand', options.brand);
    if (options.category) params.set('category', options.category);
    if (options.limit) params.set('limit', String(options.limit));
    
    const cachekey = `search-products-${options.q || ''}-${options.brand || ''}-${options.category || ''}-${options.limit || ''}`;

    const response = await this.makeDefaultRequest<{
      success: boolean;
      data: PlatformProductAnalytics[];
    }>(`/api/cross-tenant/search?${params.toString()}`, {}, cachekey);

    if (!response.success){
      console.error('[CrossTenantProductService] Failed to search products:', response.error);
      return [];
      // throw new Error(response?.error || 'Failed to search products');
    }

    return response.data?.data||[];
  }
}

export const crossTenantProductService = CrossTenantProductService.getInstance();
export default CrossTenantProductService;
