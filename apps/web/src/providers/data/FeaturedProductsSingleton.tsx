/**
 * Featured Products Singleton with Universal Product Integration
 * 
 * Manages featured products state and operations with integration to ProductSingleton
 * for universal product data access and caching.
 */

import { CacheManager } from '@/utils/cacheManager';
import { AutoUserCacheOptions } from '@/utils/userIdentification';
import { useAuthAwareCache } from '@/utils/authAwareCacheManager';
import { PublicApiSingleton } from '../base/PublicApiSingleton';
import {SingletonCacheOptions} from '../base/FlexibleApiSingleton';

// Import existing ProductSingleton for universal product integration
import { PublicProduct } from '@/providers/data/ProductSingleton';

// Import StorefrontService for API calls
import { storefrontService } from '@/services/StorefrontService';

// FeaturedType union - now dynamic to support all types
export type FeaturedType = string;

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
  featuredTypes?: string[];
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
  // Additional fields from API response
  categoryName?: string;
  condition?: string;
  ratingAvg?: number;
  ratingCount?: number;
  // Payment gateway fields for Add to Cart
  hasActivePaymentGateway?: boolean;
  defaultGatewayType?: string;
}

export class FeaturedProductsSingleton extends PublicApiSingleton {
  private static instance: FeaturedProductsSingleton;
  private productSingleton: any;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
    this.productSingleton = null;
    
    // Attach emergency bust controls to window for debugging
    FeaturedProductsSingleton.attachToWindow();
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

  // Force clear stale cache for specific cases
  private async forceClearStaleCache(cacheKey: string, options?: AutoUserCacheOptions): Promise<void> {
    try {
      // Check if we have stale cache data
      const cached = await this.cacheManager.get(cacheKey, options);
      if (cached && typeof cached === 'object' && 'lastUpdated' in cached) {
        const cacheTime = new Date((cached as any).lastUpdated).getTime();
        const apiFixTime = new Date('2026-01-24T11:45:00.000Z').getTime(); // When we fixed the API
        
        // If cache is from before the API fix, clear it aggressively
        if (cacheTime < apiFixTime) {
          console.log(`[FeaturedProductsSingleton] Force clearing stale cache from ${(cached as any).lastUpdated}`);
          
          // Clear from all cache layers
          await this.cacheManager.remove(cacheKey);
          this.cache.delete(cacheKey); // Clear memory cache too
          
          // Also clear from IndexedDB directly if possible
          try {
            await this.cacheManager.clear();
          } catch (clearError) {
            console.warn('[FeaturedProductsSingleton] Failed to clear all cache:', clearError);
          }
        }
      }
    } catch (error) {
      console.warn('[FeaturedProductsSingleton] Error in forceClearStaleCache:', error);
    }
  }

  // Get featured products with universal product data integration
  async getAllFeaturedProducts(tenantId: string, limit: number = 20, options?: AutoUserCacheOptions): Promise<FeaturedProductsData> {
    const cacheKey = `featured-products-${tenantId}-${limit}`;
    
    // Force clear stale cache for this specific case
    await this.forceClearStaleCache(cacheKey, options);
    
    // Try to get from cache with validation
    const cached = await this.validateAndClearCache<FeaturedProductsData>(cacheKey, (data) => {
      // Validator function to check if data has the expected structure
      if (!data || typeof data !== 'object') return false;
      
      // Check basic structure
      if (!('totalCount' in data && 'buckets' in data && 'lastUpdated' in data)) return false;
      
      // Check if this is old cached data (before API fix)
      // Old data: empty buckets from failed API calls
      // New data: should have products if totalCount > 0
      if (data.totalCount === 0 && data.buckets.length === 0) {
        // This might be old stale data, check the timestamp
        const cacheTime = new Date(data.lastUpdated).getTime();
        const apiFixTime = new Date('2026-01-24T11:45:00.000Z').getTime(); // When we fixed the API
        
        if (cacheTime < apiFixTime) {
          console.log(`[FeaturedProductsSingleton] Detected stale cache from ${data.lastUpdated}, clearing...`);
          return false; // Clear old cache
        }
      }
      
      // Check if buckets have the new structure with products and bucketName
      if (data.buckets.length > 0) {
        const firstBucket = data.buckets[0];
        if (!('products' in firstBucket && 'bucketName' in firstBucket)) {
          console.log(`[FeaturedProductsSingleton] Detected old bucket structure, clearing cache...`);
          return false; // Clear old format cache
        }
        
        // Check if products have the new fields (featuredTypes, hasActivePaymentGateway)
        if (firstBucket.products && firstBucket.products.length > 0) {
          const firstProduct = firstBucket.products[0];
          if (!('featuredTypes' in firstProduct) || !('hasActivePaymentGateway' in firstProduct)) {
            console.log(`[FeaturedProductsSingleton] Detected old product structure (missing featuredTypes/payment fields), clearing cache...`);
            return false; // Clear old format cache
          }
        }
      }
      
      return true;
    }, options);
    
    if (cached) {
      return cached;
    }

    // Default empty result
    const defaultResult: FeaturedProductsData = {
      totalCount: 0,
      buckets: [],
      lastUpdated: new Date().toISOString()
    };

    try {
      // Fetch featured products using StorefrontService
      const featuredResponse = await storefrontService.getFeaturedProducts(tenantId, { limit });
      
      // Transform the StorefrontService response to the expected format
      if (featuredResponse && featuredResponse.items) {
        const products = featuredResponse.items || [];
        
        // Group products by featuredType
        const productsByType = products.reduce((acc: Record<string, any[]>, product: any) => {
          const type = product.featuredType || 'store_selection';
          if (!acc[type]) acc[type] = [];
          
          // Transform API response to FeaturedProduct format
          const transformedProduct = {
            id: product.id,
            tenantId: product.tenantId,
            sku: product.sku,
            name: product.name,
            title: product.title,
            description: product.description ? product.description.substring(0, 30) + (product.description.length > 30 ? '...' : '') : '',
            marketingDescription: product.marketingDescription,
            priceCents: product.priceCents,
            salePriceCents: product.salePriceCents,
            stock: product.stock,
            imageUrl: product.imageUrl,
            imageGallery: product.imageGallery,
            brand: product.brand,
            manufacturer: product.manufacturer || null,
            condition: product.condition,
            gtin: product.gtin || null,
            mpn: product.mpn || null,
            availability: product.availability,
            itemStatus: product.itemStatus,
            visibility: product.visibility,
            hasVariants: product.hasVariants || product.hasVariants || false,
            variantId: product.variantId || null,
            variantName: product.variantName || null,
            variantAttributes: product.variantAttributes || null,
            featuredType: product.featuredType,
            featuredTypes: product.featuredTypes || (product.featuredType ? [product.featuredType] : []),
            featuredPriority: product.featuredPriority,
            featuredAt: product.featuredAt,
            featuredUntil: product.featuredUntil,
            isFeatured: product.isFeatured,
            isActivelyFeatured: product.isActivelyFeatured,
            categoryId: product.categoryId,
            categorySlug: product.categorySlug,
            categoryName: product.categoryName,
            googleCategoryId: product.googleCategoryId,
            metadata: product.metadata || {},
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
            tenant: product.tenant,
            // Payment gateway fields for Add to Cart
            hasActivePaymentGateway: product.hasActivePaymentGateway,
            defaultGatewayType: product.defaultGatewayType
          };
          
          acc[type].push(transformedProduct);
          return acc;
        }, {} as Record<string, any[]>);
        
        // Create buckets for each featured type with proper categorization
        const result: FeaturedProductsData = {
          totalCount: products.length,
          buckets: [
            { 
              bucketType: 'staff_pick', 
              bucketName: 'Staff Picks', 
              products: productsByType.staff_pick || [],
              count: productsByType.staff_pick?.length || 0,
              totalCount: productsByType.staff_pick?.length || 0
            },
            { 
              bucketType: 'seasonal', 
              bucketName: 'Seasonal Specials', 
              products: productsByType.seasonal || [],
              count: productsByType.seasonal?.length || 0,
              totalCount: productsByType.seasonal?.length || 0
            },
            { 
              bucketType: 'sale', 
              bucketName: 'Sale Items', 
              products: productsByType.sale || [],
              count: productsByType.sale?.length || 0,
              totalCount: productsByType.sale?.length || 0
            },
            { 
              bucketType: 'new_arrival', 
              bucketName: 'New Arrivals', 
              products: productsByType.new_arrival || [],
              count: productsByType.new_arrival?.length || 0,
              totalCount: productsByType.new_arrival?.length || 0
            },
            { 
              bucketType: 'store_selection', 
              bucketName: 'Store Selection', 
              products: productsByType.store_selection || [],
              count: productsByType.store_selection?.length || 0,
              totalCount: productsByType.store_selection?.length || 0
            }
          ],
          lastUpdated: new Date().toISOString()
        };
        
        // Cache the result
        await this.setCache(cacheKey, result, options); // 5 minutes
        return result;
      }
      
      // Return empty result if no data
      await this.setCache(cacheKey, defaultResult, options); // 1 minute for empty data
      return defaultResult;
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
      // Fetch featured products using StorefrontService
      const featuredResponse = await storefrontService.getFeaturedProducts(tenantId, { limit });
      
      // Transform the StorefrontService response to the expected format
      if (featuredResponse && featuredResponse.items) {
        // New API format: { success: true, products: [...] }
        const products = featuredResponse.items || [];
        
        // Group products by featuredType
        const productsByType = products.reduce((acc: Record<string, any[]>, product: any) => {
          const type = product.featuredType || 'store_selection';
          if (!acc[type]) acc[type] = [];
          
          // Transform API response to FeaturedProduct format
          const transformedProduct = {
            id: product.id,
            tenantId: product.tenant?.id || product.tenant_id,
            sku: product.sku,
            name: product.name,
            title: product.title,
            description: product.description ? product.description.substring(0, 30) + (product.description.length > 30 ? '...' : '') : '',
            marketingDescription: product.marketingDescription,
            priceCents: product.price ? Math.round(product.price * 100) : null,
            salePriceCents: product.salePriceCents || product.salePriceCents || null,
            stock: product.stock,
            imageUrl: product.imageUrl,
            imageGallery: product.imageGallery,
            brand: product.brand,
            manufacturer: product.manufacturer || null,
            condition: product.condition,
            gtin: product.gtin || null,
            mpn: product.mpn || null,
            availability: product.availability,
            itemStatus: product.itemStatus,
            visibility: product.visibility,
            hasVariants: product.hasVariants || product.hasVariants || false,
            variantId: product.variantId || null,
            variantName: product.variantName || null,
            variantAttributes: product.variantAttributes || null,
            featuredType: product.featuredType,
            featuredPriority: product.featuredPriority,
            featuredAt: product.featuredAt,
            featuredUntil: product.featuredUntil,
            isFeatured: product.isFeatured,
            isActivelyFeatured: product.isActivelyFeatured,
            categoryId: product.categoryId,
            categorySlug: product.categorySlug,
            categoryName: product.categoryName,
            googleCategoryId: product.googleCategoryId,
            metadata: product.metadata || {},
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
            tenant: product.tenant
          };
          
          acc[type].push(transformedProduct);
          return acc;
        }, {} as Record<string, any[]>);
        
        // Create buckets for each featured type with proper categorization
        const result: FeaturedProductsData = {
          totalCount: products.length,
          buckets: [
            { 
              bucketType: 'staff_pick', 
              bucketName: 'Staff Picks', 
              products: productsByType.staff_pick || [],
              count: productsByType.staff_pick?.length || 0,
              totalCount: productsByType.staff_pick?.length || 0
            },
            { 
              bucketType: 'seasonal', 
              bucketName: 'Seasonal Specials', 
              products: productsByType.seasonal || [],
              count: productsByType.seasonal?.length || 0,
              totalCount: productsByType.seasonal?.length || 0
            },
            { 
              bucketType: 'sale', 
              bucketName: 'Sale Items', 
              products: productsByType.sale || [],
              count: productsByType.sale?.length || 0,
              totalCount: productsByType.sale?.length || 0
            },
            { 
              bucketType: 'new_arrival', 
              bucketName: 'New Arrivals', 
              products: productsByType.new_arrival || [],
              count: productsByType.new_arrival?.length || 0,
              totalCount: productsByType.new_arrival?.length || 0
            },
            { 
              bucketType: 'store_selection', 
              bucketName: 'Store Selection', 
              products: productsByType.store_selection || [],
              count: productsByType.store_selection?.length || 0,
              totalCount: productsByType.store_selection?.length || 0
            }
          ],
          lastUpdated: new Date().toISOString()
        };
        
        // Cache with auth-aware encryption
        await set(cacheKey, result, { ttl: 5 * 60 * 1000, ...options });
        return result;
      }
      
      // Return empty result if no data
      await set(cacheKey, defaultResult, { ttl: 60 * 1000, ...options });
      return defaultResult;
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

// Initialize emergency bust controls immediately when module loads
if (typeof window !== 'undefined') {
  FeaturedProductsSingleton.attachToWindow();
}

// Export singleton instance
export const featuredProductsSingleton = FeaturedProductsSingleton.getInstance();
