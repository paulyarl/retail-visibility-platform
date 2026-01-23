"use client";

import { useState, useEffect } from 'react';
import { useProductSingleton, PublicProduct } from '@/providers/data/ProductSingleton';
import { featuredProductsSingleton, FeaturedProduct } from '@/providers/data/FeaturedProductsSingleton';

// Universal Product interface that combines both singleton data
export interface UniversalProduct extends PublicProduct {
  // Additional computed fields for display compatibility
  price: number; // Computed from priceCents
  salePrice?: number; // Computed from salePriceCents
  currency: string;
  // Featured products specific fields
  featuredBucket?: 'staff_pick' | 'seasonal' | 'sale' | 'new_arrival' | 'store_selection';
  featuredBucketPriority?: number;
  // Enhanced display fields
  featuredBadgeInfo?: {
    label: string;
    color: string;
    icon: string;
  };
  // Computed fields
  isFeatured?: boolean;
  featuredContext?: string;
}

// Enhanced featured product with bucket information
interface EnhancedFeaturedProduct extends FeaturedProduct {
  featuredBucket?: 'staff_pick' | 'seasonal' | 'sale' | 'new_arrival' | 'store_selection';
  featuredBucketPriority?: number;
}

/**
 * Universal Product Hook
 * 
 * Demonstrates the power of the new singleton system by combining
 * product data and featured products data into a universal product prop.
 * 
 * @param tenantId - The tenant ID to fetch products for
 * @param options - Configuration options
 * @returns Universal products with combined singleton data
 */
export function useUniversalProducts(
  tenantId: string,
  options: {
    includeFeatured?: boolean;
    enhanceWithSingleton?: boolean;
    limit?: number;
  } = {}
) {
  const { actions: productSingleton } = useProductSingleton();
  const [products, setProducts] = useState<UniversalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<any>(null);

  const {
    includeFeatured = true,
    enhanceWithSingleton = true,
    limit = 50
  } = options;

  useEffect(() => {
    const loadUniversalProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        // Step 1: Get base products from ProductSingleton
        let baseProducts: PublicProduct[] = [];
        
        if (enhanceWithSingleton) {
          try {
            // Fetch products using the singleton
            baseProducts = await productSingleton.fetchProducts({ tenantId });
          } catch (productError) {
            console.warn('Failed to load products from singleton:', productError);
            // Continue without product data
          }
        }

        // Step 2: Get featured products data if requested
        let featuredData: any = null;
        if (includeFeatured) {
          try {
            featuredData = await featuredProductsSingleton.getAllFeaturedProducts(tenantId, 20);
          } catch (featuredError) {
            console.warn('Failed to load featured products:', featuredError);
            // Continue without featured data
          }
        }

        // Step 3: Create universal products by combining data
        const universalProducts = createUniversalProducts(baseProducts, featuredData);
        
        // Step 4: Apply limit if specified
        const limitedProducts = universalProducts.slice(0, limit);
        
        setProducts(limitedProducts);

        // Step 5: Get combined metrics
        const combinedMetrics = getCombinedMetrics(featuredData);
        setMetrics(combinedMetrics);

      } catch (err) {
        console.error('Error loading universal products:', err);
        setError(err instanceof Error ? err.message : 'Failed to load products');
      } finally {
        setLoading(false);
      }
    };

    if (tenantId) {
      loadUniversalProducts();
    }
  }, [tenantId, includeFeatured, enhanceWithSingleton, limit]);

  /**
   * Create universal products by combining product and featured data
   */
  const createUniversalProducts = (
    baseProducts: PublicProduct[],
    featuredData: any
  ): UniversalProduct[] => {
    if (!featuredData) {
      // Return base products with basic universal fields
      return baseProducts.map(product => ({
        ...product,
        price: product.priceCents / 100,
        salePrice: product.salePriceCents ? product.salePriceCents / 100 : undefined,
        currency: 'USD',
        isFeatured: !!product.featuredType,
        featuredBadgeInfo: product.featuredType ? getBadgeInfo(product.featuredType) : undefined,
        featuredContext: product.featuredType ? `Featured as ${product.featuredType.replace('_', ' ')}` : undefined
      }));
    }

    // Create a map of featured products for quick lookup
    const featuredMap = new Map<string, EnhancedFeaturedProduct>();
    
    // Add all featured products to the map
    Object.entries(featuredData).forEach(([bucketType, bucketProducts]: [string, any]) => {
      if (Array.isArray(bucketProducts)) {
        bucketProducts.forEach((product: FeaturedProduct) => {
          const enhancedProduct: EnhancedFeaturedProduct = {
            ...product,
            featuredBucket: bucketType as any,
            featuredBucketPriority: product.featuredPriority
          };
          featuredMap.set(product.id, enhancedProduct);
        });
      }
    });

    // Enhance base products with featured data
    return baseProducts.map(product => {
      const featuredProduct = featuredMap.get(product.id);
      
      const universalProduct: UniversalProduct = {
        ...product,
        price: product.priceCents / 100,
        salePrice: product.salePriceCents ? product.salePriceCents / 100 : undefined,
        currency: 'USD',
        // Featured information from featured products singleton
        featuredBucket: featuredProduct?.featuredType,
        featuredBucketPriority: featuredProduct?.featuredPriority,
        // Enhanced display information
        isFeatured: !!featuredProduct || !!product.featuredType,
        featuredBadgeInfo: getBadgeInfo(featuredProduct?.featuredType || product.featuredType),
        featuredContext: featuredProduct 
          ? `Featured in ${featuredProduct.featuredType?.replace('_', ' ')} bucket`
          : product.featuredType 
            ? `Featured as ${product.featuredType.replace('_', ' ')}`
            : undefined
      };

      return universalProduct;
    });
  };

  /**
   * Get combined metrics from both singletons
   */
  const getCombinedMetrics = (featuredData: any) => {
    const productMetrics = productSingleton.getMetrics();
    const featuredMetrics = featuredProductsSingleton.getMetrics();
    
    return {
      products: productMetrics,
      featured: featuredMetrics,
      combined: {
        totalCacheHits: productMetrics.cacheHits + featuredMetrics.cacheHits,
        totalCacheMisses: productMetrics.cacheMisses + featuredMetrics.cacheMisses,
        totalApiCalls: productMetrics.apiCalls + featuredMetrics.apiCalls,
        overallCacheHitRate: (productMetrics.cacheHits + featuredMetrics.cacheHits) / 
                           (productMetrics.cacheHits + featuredMetrics.cacheMisses + productMetrics.apiCalls + featuredMetrics.apiCalls) || 0,
        totalCachedProducts: featuredData ? featuredData.totalCount : 0
      }
    };
  };

  /**
   * Get badge information for featured types
   */
  const getBadgeInfo = (featuredType?: string) => {
    if (!featuredType) return undefined;
    
    switch (featuredType) {
      case 'staff_pick':
        return { label: 'Staff Pick', color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: '⭐' };
      case 'seasonal':
        return { label: 'Seasonal', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', icon: '🍂' };
      case 'sale':
        return { label: 'Sale', color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: '💰' };
      case 'new_arrival':
        return { label: 'New', color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200', icon: '✨' };
      case 'store_selection':
        return { label: 'Featured', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: '🏪' };
      default:
        return { label: 'Featured', color: 'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200', icon: '⭐' };
    }
  };

  /**
   * Refresh universal products
   */
  const refresh = async () => {
    // Clear featured products cache
    featuredProductsSingleton.clearTenantFeaturedProducts();
    
    // Reload data - this will trigger the useEffect to reload
    setProducts([]);
    setLoading(true);
    
    // Force reload of data by re-triggering the useEffect
    // This is handled by the useEffect dependency array
  };

  /**
   * Get products by featured bucket
   */
  const getProductsByBucket = (bucketType: string) => {
    return products.filter(product => product.featuredBucket === bucketType);
  };

  /**
   * Get featured products only
   */
  const getFeaturedProducts = () => {
    return products.filter(product => product.isFeatured);
  };

  /**
   * Get non-featured products only
   */
  const getNonFeaturedProducts = () => {
    return products.filter(product => !product.isFeatured);
  };

  return {
    products,
    loading,
    error,
    metrics,
    refresh,
    getProductsByBucket,
    getFeaturedProducts,
    getNonFeaturedProducts,
    // Demo utilities
    demo: {
      totalProducts: products.length,
      featuredCount: products.filter(p => p.isFeatured).length,
      bucketCounts: {
        staff_pick: getProductsByBucket('staff_pick').length,
        seasonal: getProductsByBucket('seasonal').length,
        sale: getProductsByBucket('sale').length,
        new_arrival: getProductsByBucket('new_arrival').length,
        store_selection: getProductsByBucket('store_selection').length,
      },
      cacheEfficiency: metrics?.combined?.overallCacheHitRate || 0,
      singletonIntegration: {
        productSingletonUsed: enhanceWithSingleton,
        featuredSingletonUsed: includeFeatured,
        dataCombined: enhanceWithSingleton && includeFeatured
      }
    }
  };
}

/**
 * Universal Product Card Component
 * 
 * Demonstrates the universal product prop in action with featured badges
 */
export function UniversalProductCard({ 
  product, 
  tenantId,
  showFeaturedBadge = true 
}: { 
  product: UniversalProduct;
  tenantId: string;
  showFeaturedBadge?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg overflow-hidden hover:shadow-lg transition-shadow">
      {/* Product Image */}
      <div className="aspect-square relative bg-neutral-100 dark:bg-neutral-700">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-neutral-400 dark:text-neutral-500">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        
        {/* Featured Badge */}
        {showFeaturedBadge && product.featuredBadgeInfo && (
          <div className="absolute top-2 right-2">
            <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${product.featuredBadgeInfo.color}`}>
              <span>{product.featuredBadgeInfo.icon}</span>
              {product.featuredBadgeInfo.label}
            </span>
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-4">
        {/* Product Name */}
        <h4 className="font-medium text-neutral-900 dark:text-white line-clamp-2 mb-2">
          {product.name}
        </h4>

        {/* Brand */}
        {product.brand && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">
            {product.brand}
          </p>
        )}

        {/* Price */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg font-semibold text-neutral-900 dark:text-white">
            ${product.price}
          </span>
          {product.salePrice && product.salePrice < product.price && (
            <>
              <span className="text-sm text-neutral-500 dark:text-neutral-400 line-through">
                ${product.price}
              </span>
              <span className="text-lg font-semibold text-red-600 dark:text-red-400">
                ${product.salePrice}
              </span>
            </>
          )}
        </div>

        {/* Stock Status */}
        <div className="flex items-center gap-2 text-sm mb-3">
          {product.stock > 0 ? (
            <span className="text-green-600 dark:text-green-400">
              ✓ In Stock ({product.stock})
            </span>
          ) : (
            <span className="text-red-600 dark:text-red-400">
              ✗ Out of Stock
            </span>
          )}
        </div>

        {/* Featured Context */}
        {product.featuredContext && (
          <p className="text-xs text-primary-600 dark:text-primary-400 mb-2">
            {product.featuredContext}
          </p>
        )}

        {/* Universal Product Properties (Demo) */}
        <div className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1">
          <div>Product ID: {product.id}</div>
          {product.featuredBucket && <div>Bucket: {product.featuredBucket}</div>}
          {product.featuredBucketPriority && <div>Priority: {product.featuredBucketPriority}</div>}
          {product.hasGallery && <div>• Gallery</div>}
          {product.hasDescription && <div>• Description</div>}
          {product.hasBrand && <div>• Brand</div>}
        </div>
      </div>
    </div>
  );
}
