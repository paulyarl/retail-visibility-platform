/**
 * Enhanced Product Service
 * 
 * Provides comprehensive product data operations with variant support
 * Leverages mv_global_discovery for rich product information
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '../utils/contextCacheManager';

// Enhanced interfaces based on mv_global_discovery schema
export interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  color?: string;
  size?: string;
  material?: string;
  style?: string;
  format?: string;
  edition?: string;
  language?: string;
  cover?: string;
  price_cents: number;
  inventory_quantity: number;
  image_url?: string;
  weight?: number;
  dimensions?: string;
  isbn?: string;
  publication_date?: string;
  metadata?: Record<string, any>;
}

export interface FeaturedType {
  type: 'featured' | 'trending' | 'new' | 'premium' | 'staff_pick' | 'bestseller' | 'gift_idea' | 'popular';
  label: string;
  priority: number;
  active: boolean;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  google_category_id?: string;
  parent_category_id?: string;
  level: number;
  path: string[];
}

export interface TrendingProduct {
  inventory_item_id: string;
  product_name: string;
  product_title: string;
  image_url: string;
  current_price_cents: number;
  trending_score: number;
  view_count: number;
  product_category: string;
  tenant_name: string;
  tenant_city: string;
  tenant_state: string;
}

export interface EnhancedProduct {
  // Core product fields from mv_global_discovery
  inventory_item_id: string;
  product_name: string;
  product_title: string;
  product_description: string;
  marketing_description?: string;
  sku: string;
  brand: string;
  manufacturer?: string;
  condition: string;
  gtin?: string;
  mpn?: string;
  stock: number;
  quantity?: number;
  availability: string;
  item_status: string;
  visibility: string;
  
  // Pricing
  list_price_cents: number;
  sale_price_cents?: number;
  current_price_cents: number;
  price: string;
  is_on_sale: boolean;
  discount_percentage: string;
  currency: string;
  
  // Media
  image_url?: string;
  image_urls: string[];
  video_url?: string;
  gallery_urls?: string[];
  thumbnail_url?: string;
  featured_image_url?: string;
  
  // Rich metadata
  product_metadata: {
    features?: string[];
    specifications?: Record<string, any>;
    enhancedDescription?: string;
  };
  
  // Category information
  product_type: string;
  product_category: string;
  product_category_slug: string;
  product_google_category_id: string;
  product_parent_category_id?: string;
  categoryName?: string; // Human-readable category name
  
  // Tenant information
  tenant_id: string;
  tenant_name: string;
  tenant_slug?: string;
  subscription_tier: string;
  shop_category: string;
  tenant_city: string;
  tenant_state: string;
  tenant_country: string;
  tenant_zip: string;
  tenant_address: string;
  tenant_latitude?: number;
  tenant_longitude?: number;
  tenant_logo_url?: string;
  
  // Analytics and engagement
  view_count: number;
  unique_viewers: number;
  engagement_count: number;
  conversion_count: number;
  revenue_cents: number;
  units_sold: number;
  trending_score: string;
  
  // Ratings and reviews
  product_average_rating?: string;
  product_review_count?: string;
  store_average_rating: string;
  store_review_count: string;
  average_rating: string;
  review_count: string;
  
  // Featured status
  featured_type?: string;
  featured_type_array?: string[];
  featured_priority?: number;
  featured_at?: string;
  featured_until?: string;
  featured_is_active?: boolean;
  is_actively_featured: boolean;
  
  // Variants
  variants: ProductVariant[];
  
  // Timestamps
  created_at: string;
  updated_at: string;
  published_at?: string;
  archived_at?: string;
  mv_refreshed_at: string;
}

/**
 * Enhanced Product Service
 * 
 * Handles comprehensive product data operations with variant support
 * and rich metadata from mv_global_discovery
 */
class EnhancedProductService extends PublicApiSingleton {
  private static instance: EnhancedProductService;

  // Override base class defaults for product data
  protected defaultContext: AppContext = AppContext.PRODUCT;
  protected defaultIsolation: CacheIsolation = CacheIsolation.PRODUCT;

  private constructor() {
    super('enhanced-product-service', { encrypt: false });
  }

  public static getInstance(): EnhancedProductService {
    if (!EnhancedProductService.instance) {
      EnhancedProductService.instance = new EnhancedProductService();
    }
    return EnhancedProductService.instance;
  }

  /**
   * Fetch comprehensive product data with variants
   */
  async fetchProductWithVariants(id: string): Promise<EnhancedProduct | null> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/public/products/${id}?include=variants,metadata,analytics,store`,
        {},
        `enhanced-product-v2-${id}`, // Changed cache key to force refresh
        this.cacheTTL
      );
      
      if (!response.success) {
        console.error('[EnhancedProductService] Failed to fetch product:', response.error);
        return null;
      }

      // The API response is double-nested: { success, data: { success, data: product } }
      const productData = response.data?.data || response.data;
      return this.transformProductData(productData);
    } catch (error) {
      console.warn(`Failed to fetch product with variants: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * Fetch product variants
   */
  async fetchProductVariants(productId: string): Promise<ProductVariant[]> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/public/products/${productId}/variants`,
        {},
        `product-variants-${productId}`,
        this.cacheTTL
      );
      
      if (!response.success) {
        console.warn('[EnhancedProductService] Failed to fetch variants:', response.error);
        return [];
      }
      
      return response.data.variants || [];
    } catch (error) {
      console.warn(`Failed to fetch product variants: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Fetch category recommendations
   */
  async fetchCategoryRecommendations(categoryId: string, limit: number = 8): Promise<EnhancedProduct[]> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/public/categories/${categoryId}/recommendations?limit=${limit}`,
        {},
        `category-recommendations-${categoryId}`,
        this.cacheTTL
      );
      
      if (!response.success) {
        console.warn('[EnhancedProductService] Failed to fetch category recommendations:', response.error);
        return [];
      }
      
      return response.data.products.map((product: any) => this.transformProductData(product));
    } catch (error) {
      console.warn(`Failed to fetch category recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Fetch trending products
   */
  async fetchTrendingProducts(location?: { lat: number; lng: number }, limit: number = 10): Promise<TrendingProduct[]> {
    try {
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      if (location?.lat && location?.lng) {
        params.append('lat', location.lat.toString());
        params.append('lng', location.lng.toString());
      }
      
      const response = await this.makeDefaultRequest<any>(
        `/api/public/trending/products?${params}`,
        {},
        `trending-products-${location?.lat || 'global'}-${location?.lng || 'global'}`,
        5 * 60 * 1000 // 5 minutes cache for trending
      );
      
      if (!response.success) {
        console.warn('[EnhancedProductService] Failed to fetch trending products:', response.error);
        return [];
      }
      
      return response.data.products || [];
    } catch (error) {
      console.warn(`Failed to fetch trending products: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Fetch product category hierarchy
   */
  async fetchCategoryHierarchy(categoryId: string): Promise<ProductCategory[]> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/public/categories/${categoryId}/hierarchy`,
        {},
        `category-hierarchy-${categoryId}`,
        30 * 60 * 1000 // 30 minutes cache
      );
      
      if (!response.success) {
        console.warn('[EnhancedProductService] Failed to fetch category hierarchy:', response.error);
        return [];
      }
      
      return response.data.categories || [];
    } catch (error) {
      console.warn(`Failed to fetch category hierarchy: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return [];
    }
  }

  /**
   * Transform raw product data to enhanced format
   */
  private transformProductData(data: any): EnhancedProduct {
    return {
      // Core fields - map API response to expected interface
      inventory_item_id: data.id,
      product_name: data.name,
      product_title: data.title,
      product_description: data.description,
      marketing_description: data.description, // Use description for both
      sku: data.sku,
      brand: data.brand,
      manufacturer: data.manufacturer,
      condition: data.condition,
      gtin: data.gtin,
      mpn: data.mpn,
      stock: data.stock,
      quantity: data.quantity,
      availability: data.availability,
      item_status: data.itemStatus, // Map camelCase
      visibility: data.visibility,
      
      // Pricing - map from API response
      list_price_cents: data.listPriceCents || data.priceCents || data.price * 100,
      sale_price_cents: data.salePriceCents || data.priceCents || data.price * 100,
      current_price_cents: data.priceCents || data.salePriceCents || data.price * 100,
      price: data.price,
      is_on_sale: data.isOnSale || false,
      discount_percentage: data.discountPercentage || data.discount_percentage || '0',
      currency: data.currency,
      
      // Media - map from API response
      image_url: data.imageUrl,
      image_urls: data.images?.map((img: any) => img.url) || [data.imageUrl],
      video_url: data.video_url,
      gallery_urls: data.imageGallery || [],
      thumbnail_url: data.imageUrl,
      featured_image_url: data.imageUrl,
      
      // Metadata - map from API response
      product_metadata: {
        features: data.metadata?.features || [],
        specifications: data.metadata?.specifications || {},
        enhancedDescription: data.description
      },
      
      // Category - map from API response
      product_type: data.tenantCategoryId,
      product_category: data.tenantCategory?.name || data.tenantCategoryId,
      product_category_slug: data.tenantCategory?.slug,
      product_google_category_id: data.tenantCategory?.googleCategoryId || data.tenantCategoryId,
      product_parent_category_id: undefined,
      // Also expose as categoryName for convenience
      categoryName: data.tenantCategory?.name,
      
      // Tenant - map from API response (store object or tenant object)
      tenant_id: data.tenant?.id || data.store?.id || data.tenantId || data.tenant_id,
      tenant_name: data.tenant?.name || data.store?.name || data.tenantName || data.tenant_name,
      tenant_slug: data.tenant?.slug || data.store?.slug || data.tenantSlug || data.tenant_slug,
      subscription_tier: data.tenant?.subscriptionTier || data.store?.subscription_tier || data.subscriptionTier || data.subscription_tier,
      shop_category: data.tenant?.shop_category || data.store?.shop_category || data.shopCategory || data.shop_category,
      tenant_city: data.tenant?.city || data.store?.city || data.tenantCity || data.tenant_city,
      tenant_state: data.tenant?.state || data.store?.state || data.tenantState || data.tenant_state,
      tenant_country: data.tenant?.country || data.store?.country || data.tenantCountry || data.tenant_country,
      tenant_zip: data.tenant?.zipCode || data.store?.zip || data.tenantZip || data.tenant_zip,
      tenant_address: data.tenant?.address || data.store?.address || data.tenantAddress || data.tenant_address,
      tenant_latitude: data.tenant?.latitude || data.store?.latitude || data.tenantLatitude || data.tenant_latitude,
      tenant_longitude: data.tenant?.longitude || data.store?.longitude || data.tenantLongitude || data.tenant_longitude,
      tenant_logo_url: data.tenant?.logoUrl || data.store?.logo_url || data.tenantLogoUrl || data.tenant_logo_url || data.store?.logo,
      
      // Analytics
      view_count: data.view_count,
      unique_viewers: data.unique_viewers,
      engagement_count: data.engagement_count,
      conversion_count: data.conversion_count,
      revenue_cents: data.revenue_cents,
      units_sold: data.units_sold,
      trending_score: data.trending_score,
      
      // Ratings
      product_average_rating: data.product_average_rating,
      product_review_count: data.product_review_count,
      store_average_rating: data.store_average_rating,
      store_review_count: data.store_review_count,
      average_rating: data.average_rating,
      review_count: data.review_count,
      
      // Featured status - prioritize featured_type_array over single featured_type
      featured_type: data.featuredTypes || data.featured_type_array || data.featured_type,
      featured_type_array: data.featuredTypes || data.featured_type_array || (data.featured_type ? [data.featured_type] : []),
      featured_priority: data.featured_priority,
      featured_at: data.featured_at,
      featured_until: data.featured_until,
      featured_is_active: data.featured_is_active,
      is_actively_featured: data.is_actively_featured,
      
      // Variants (to be populated separately)
      variants: data.variants || [],
      
      // Timestamps
      created_at: data.created_at,
      updated_at: data.updated_at,
      published_at: data.published_at,
      archived_at: data.archived_at,
      mv_refreshed_at: data.mv_refreshed_at
    };
  }

  /**
   * Get featured type badges for a product
   */
  getFeaturedTypeBadges(product: EnhancedProduct): FeaturedType[] {
    const badges: FeaturedType[] = [];
    
    // Show featured types if the array has values
    if (product.featured_type_array && product.featured_type_array.length > 0) {
      product.featured_type_array.forEach((type, index) => {
        badges.push({
          type: this.mapFeaturedType(type),
          label: this.formatFeaturedTypeLabel(this.mapFeaturedType(type)),
          priority: product.featured_priority || index,
          active: product.featured_is_active || true
        });
      });
    }
    
    // Add automatic badges based on data
    if (product.trending_score && parseFloat(product.trending_score) > 0.5) {
      badges.push({
        type: 'trending',
        label: 'Trending',
        priority: 10,
        active: true
      });
    }
    
    if (product.view_count > 100) {
      badges.push({
        type: 'popular',
        label: 'Popular',
        priority: 8,
        active: true
      });
    }
    
    // Sort by priority
    return badges.sort((a, b) => a.priority - b.priority);
  }

  /**
   * Map database featured types to component types
   */
  private mapFeaturedType(dbType: string): FeaturedType['type'] {
    const typeMap: Record<string, FeaturedType['type']> = {
      'new_arrival': 'new',
      'sale': 'featured',
      'seasonal': 'premium',
      'staff_pick': 'staff_pick',
      'bestseller': 'bestseller',
      'gift_idea': 'gift_idea',
      'featured': 'featured',
      'trending': 'trending',
      'new': 'new',
      'premium': 'premium',
      'popular': 'popular'
    };
    
    return typeMap[dbType] || 'featured';
  }

  /**
   * Format featured type label
   */
  private formatFeaturedTypeLabel(type: FeaturedType['type']): string {
    const labels = {
      featured: 'Featured',
      trending: 'Trending',
      new: 'New',
      premium: 'Premium',
      staff_pick: 'Staff Pick',
      bestseller: 'Bestseller',
      gift_idea: 'Gift Idea',
      popular: 'Popular'
    };
    
    return labels[type] || 'Featured';
  }
}

// Export singleton instance
export const enhancedProductService = EnhancedProductService.getInstance();
export default EnhancedProductService;
