/**
 * Featured Products Singleton with Universal Product Integration
 * 
 * Manages featured products state and operations with integration to ProductSingleton
 * for universal product data access and caching.
 */

import { CacheManager } from '@/utils/cacheManager';
import { AutoUserCacheOptions } from '@/utils/userIdentification';
import { useAuthAwareCache } from '@/utils/authAwareCacheManager';
import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';

// Import existing ProductSingleton for universal product integration
import { PublicProduct } from '@/providers/data/ProductSingleton';

// FeaturedType union
export type FeaturedType = 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';

// Import the existing UniversalProduct interface
interface UniversalProduct {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  title?: string;
  description?: string;
  brand: string;
  priceCents: number;
  imageUrl?: string;
  stock: number;
  availability: string;
  hasVariants: boolean;
  productType?: string;
  categoryPath?: string[];
  isFeatured?: boolean;
  featuredBucket?: string;
  featuredPriority?: number;
  featuredExpiresAt?: string;
  isActive?: boolean;
}

// Featured assignment interface
interface FeaturedAssignment {
  inventory_item_id: string;
  featured_type: string;
  featured_priority: number;
  featured_expires_at?: string;
  auto_unfeature?: boolean;
  is_active?: boolean;
}

// Featured products bucket interface
export interface FeaturedProductsBucket {
  bucketType: string;
  bucketName: string;
  products: FeaturedProduct[];
  count: number;
  totalCount: number;
}

// Featured products data interface
export interface FeaturedProductsData {
  totalCount: number;
  buckets: FeaturedProductsBucket[];
  lastUpdated: string;
}

// Featured product interface (backward compatibility)
export interface FeaturedProduct {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  title?: string;
  description?: string;
  brand: string;
  priceCents: number;
  salePriceCents?: number;
  imageUrl?: string;
  stock: number;
  availability: string;
  hasVariants: boolean;
  productType?: string;
  categoryPath?: string[];
  featuredType?: FeaturedType;
  featuredPriority?: number;
  featuredExpiresAt?: string;
  featuredAt?: string;
  isActive?: boolean;
  isExpired?: boolean;
  metadata?: Record<string, any>;
  hasGallery?: boolean;
  hasDescription?: boolean;
  hasBrand?: boolean;
  hasPrice?: boolean;
}

export class FeaturedProductsSingleton extends UniversalSingleton {
  private static instance: FeaturedProductsSingleton;
  private productSingleton: any;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
  }

  static getInstance(options?: { encrypt?: boolean; userId?: string }): FeaturedProductsSingleton {
    if (!FeaturedProductsSingleton.instance) {
      FeaturedProductsSingleton.instance = new FeaturedProductsSingleton('featured-products-singleton', options);
    }
    return FeaturedProductsSingleton.instance;
  }

  // Integration with existing ProductSingleton
  setProductSingleton(productSingleton: any) {
    this.productSingleton = productSingleton;
  }

  // Get featured products with universal product data integration
  async getAllFeaturedProducts(tenantId: string, limit: number = 20, options?: AutoUserCacheOptions): Promise<FeaturedProductsData> {
    const cacheKey = `featured-products-${tenantId}-${limit}`;
    
    // Try to get from cache first
    const cached = await this.getFromCache(cacheKey, options);
    if (cached) {
      try {
        // Validate cached data structure
        const cachedData = cached as any;
        if (cachedData && typeof cachedData === 'object' && 'totalCount' in cachedData && 'buckets' in cachedData) {
          return cachedData as FeaturedProductsData;
        }
      } catch (error) {
        console.warn('[FeaturedProductsSingleton] Invalid cache data, continuing with fresh fetch');
      }
    }

    // Default empty result
    const defaultResult: FeaturedProductsData = {
      totalCount: 0,
      buckets: [],
      lastUpdated: new Date().toISOString()
    };

    try {
      // Fetch featured assignments
      const response = await fetch(`/api/featured-products/public?tenantId=${tenantId}&limit=${limit}`);
      
      if (!response.ok) {
        console.warn('API response not ok, returning empty result');
        // Cache the empty result to avoid repeated failed requests
        await this.setCache(cacheKey, defaultResult, options); // 30 seconds for errors
        return defaultResult;
      }

      const featuredAssignments = await response.json();
      
      // Return empty result if no data
      if (!featuredAssignments || !featuredAssignments.buckets) {
        // Cache the empty result to avoid repeated requests
        await this.setCache(cacheKey, defaultResult, options); // 1 minute for empty data
        return defaultResult;
      }

      // For now, return the default result (can be enhanced later with real data processing)
      const result: FeaturedProductsData = {
        totalCount: featuredAssignments.totalCount || 0,
        buckets: featuredAssignments.buckets || [],
        lastUpdated: featuredAssignments.lastUpdated || new Date().toISOString()
      };

      // Cache the result
      await this.setCache(cacheKey, result, options); // 5 minutes

      return result;
    } catch (error) {
      console.error('Error fetching featured products:', error);
      
      // Cache the error result to avoid repeated failures
      await this.setCache(cacheKey, defaultResult, options); // 30 seconds for errors
      
      // Always return a valid structure, never null
      return defaultResult;
    }
  }

  /**
   * Auth-aware method for React components
   * Automatically uses current user for encryption when useAuthUser: true
   */
  async getAllFeaturedProductsAuth(tenantId: string, limit: number = 20, options?: { 
    encrypt?: boolean; 
    useAuthUser?: boolean; 
    userId?: string 
  }): Promise<FeaturedProductsData> {
    const { get, set } = useAuthAwareCache();
    const cacheKey = `featured-products-${tenantId}-${limit}`;
    
    // Try to get from cache first with auth-aware encryption
    const cached = await get(cacheKey, options);
    if (cached) {
      try {
        const cachedData = cached as any;
        if (cachedData && typeof cachedData === 'object' && 'totalCount' in cachedData && 'buckets' in cachedData) {
          return cachedData as FeaturedProductsData;
        }
      } catch (error) {
        console.warn('[FeaturedProductsSingleton] Invalid cache data, continuing with fresh fetch');
      }
    }

    // Default empty result
    const defaultResult: FeaturedProductsData = {
      totalCount: 0,
      buckets: [],
      lastUpdated: new Date().toISOString()
    };

    try {
      // Fetch featured assignments
      const response = await fetch(`/api/featured-products/public?tenantId=${tenantId}&limit=${limit}`);
      
      if (!response.ok) {
        console.warn('API response not ok, returning empty result');
        await set(cacheKey, defaultResult, { ttl: 30 * 1000, ...options });
        return defaultResult;
      }

      const featuredAssignments = await response.json();
      
      if (!featuredAssignments || !featuredAssignments.buckets) {
        await set(cacheKey, defaultResult, { ttl: 60 * 1000, ...options });
        return defaultResult;
      }

      const result: FeaturedProductsData = {
        totalCount: featuredAssignments.totalCount || 0,
        buckets: featuredAssignments.buckets || [],
        lastUpdated: featuredAssignments.lastUpdated || new Date().toISOString()
      };

      // Cache with auth-aware encryption
      await set(cacheKey, result, { ttl: 5 * 60 * 1000, ...options });

      return result;
    } catch (error) {
      console.error('Error fetching featured products:', error);
      await set(cacheKey, defaultResult, { ttl: 30 * 1000, ...options });
      return defaultResult;
    }
  }

  // Get featured products by specific type
  async getFeaturedProductsByType(tenantId: string, type: string, limit: number = 10): Promise<FeaturedProduct[]> {
    const allFeatured = await this.getAllFeaturedProducts(tenantId, 100);
    const bucket = allFeatured.buckets.find(b => b.bucketType === type);
    
    if (!bucket) {
      return [];
    }

    return bucket.products.slice(0, limit);
  }

  // Get featured products in PublicProduct format (for UniversalProductCard)
  async getFeaturedProductsAsUniversal(tenantId: string, type?: string, limit: number = 20): Promise<PublicProduct[]> {
    try {
      const featuredProducts = type 
        ? await this.getFeaturedProductsByType(tenantId, type, limit)
        : await this.getAllFeaturedProducts(tenantId, limit);

      // Handle both array and object return types
      let products: FeaturedProduct[] = [];
      if (Array.isArray(featuredProducts)) {
        products = featuredProducts;
      } else if (featuredProducts && featuredProducts.buckets) {
        products = featuredProducts.buckets.flatMap(bucket => bucket.products || []);
      }

      // Convert FeaturedProduct to PublicProduct format
      return products.map((product: FeaturedProduct): PublicProduct => ({
        id: product.id,
        tenantId: product.tenantId,
        sku: product.sku,
        name: product.name,
        description: product.description,
        brand: product.brand,
        priceCents: product.priceCents,
        salePriceCents: product.salePriceCents,
        stock: product.stock,
        imageUrl: product.imageUrl,
        availability: product.availability as 'in_stock' | 'out_of_stock' | 'preorder' | 'discontinued',
        hasVariants: product.hasVariants,
        featuredType: product.featuredType,
        featuredPriority: product.featuredPriority,
        metadata: product.metadata || {},
        hasGallery: false,
        hasDescription: !!product.description,
        hasBrand: !!product.brand,
        hasPrice: product.priceCents > 0
      }));
    } catch (error) {
      console.error('Error converting to universal products:', error);
      return [];
    }
  }

  // Invalidate cache when featured products change
  async invalidateCache(tenantId?: string): Promise<void> {
    // Invalidate all featured products cache
    await super.clearCache();
  }

  // Clear cache (for testing or manual refresh)
  async clearCache(): Promise<void> {
    await super.clearCache();
  }

  // Additional methods for compatibility
  refreshFeaturedProducts(tenantId?: string, limit?: number) {
    return this.clearCache();
  }

  getBucketStats() {
    return {
      staff_pick: 0,
      seasonal: 0,
      sale: 0,
      new_arrival: 0,
      store_selection: 0
    };
  }

  // Featured products specific metrics for UniversalSingleton
  protected getCustomMetrics(): Record<string, any> {
    return {
      totalProducts: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  preloadTenantFeaturedProducts() {
    return Promise.resolve();
  }

  clearTenantFeaturedProducts() {
    this.clearCache();
  }
}

// Export singleton instance
export const featuredProductsSingleton = FeaturedProductsSingleton.getInstance();
