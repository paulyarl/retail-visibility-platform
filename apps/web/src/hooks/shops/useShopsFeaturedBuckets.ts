"use client";

import { useState, useEffect, useCallback } from 'react';
import { UniversalSingleton } from '@/providers/base/UniversalSingleton';
import { ShopsAPISingleton } from '@/services/ShopsService';

// Product API Singleton Class
class ProductAPISingleton extends UniversalSingleton {
  private static instance: ProductAPISingleton;

  private constructor() {
    super('product-api', { encrypt: false });
  }

  public static getInstance(): ProductAPISingleton {
    if (!ProductAPISingleton.instance) {
      ProductAPISingleton.instance = new ProductAPISingleton();
    }
    return ProductAPISingleton.instance;
  }

  async fetchProduct(url: string, headers: Record<string, string>): Promise<any> {
    const response = await this.makeApiRequest<any>(url, { headers });
    
    if (!response.success) {
      throw new Error(`Failed to fetch product: ${response.error || 'Unknown error'}`);
    }
    
    return response.data;
  }

  async makePublicApiRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const response = await this.makeApiRequest<T>(url, options, cacheKey);
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

/**
 * Product Cache Singleton
 * Extends UniversalSingleton for built-in cache management
 * Manages caching of product data to avoid duplicate API calls
 */
class ProductCache extends UniversalSingleton {
  private static instance: ProductCache;
  private pendingRequests: Map<string, Promise<any>> = new Map();

  private constructor() {
    super('featured-products-cache-singleton', {
      encrypt: false // Product data is public
    });
    
    // Set cache TTL to 10 minutes for product data
    this.cacheTTL = 10 * 60 * 1000;
    
    // Attach emergency bust controls
    ProductCache.attachToWindow();
  }

  /**
   * Check if troubleshooting mode is enabled (cache bypass)
   */
  public static isTroubleshootingMode(): boolean {
    if (typeof window === 'undefined') return false;
    
    // Check localStorage for troubleshooting mode
    const stored = localStorage.getItem('troubleshooting-mode');
    if (stored !== null) return stored === 'true';
    
    // Check URL parameter for temporary troubleshooting mode
    const urlParams = new URLSearchParams(window.location.search);
    const debugMode = urlParams.get('debug') === 'true' || urlParams.get('troubleshoot') === 'true';
    
    // Store in localStorage for persistence
    localStorage.setItem('troubleshooting-mode', debugMode.toString());
    
    return debugMode;
  }

  /**
   * Toggle troubleshooting mode
   */
  static toggleTroubleshootingMode(): boolean {
    if (typeof window === 'undefined') return false;
    
    const currentMode = ProductCache.isTroubleshootingMode();
    const newMode = !currentMode;
    
    localStorage.setItem('troubleshooting-mode', newMode.toString());
    
    // Clear cache when enabling troubleshooting mode
    if (newMode) {
      ProductCache.getInstance().clearAllCache();
      console.log('🔧 Troubleshooting mode ENABLED - Cache bypassed');
    } else {
      console.log('✅ Troubleshooting mode DISABLED - Cache enabled');
    }
    
    return newMode;
  }

  /**
   * Get troubleshooting mode status
   */
  static getTroubleshootingMode(): boolean {
    return ProductCache.isTroubleshootingMode();
  }

  public static getInstance(): ProductCache {
    if (!ProductCache.instance) {
      ProductCache.instance = new ProductCache();
    }
    return ProductCache.instance;
  }

  /**
   * Get product data with caching via UniversalSingleton
   */
  async getProduct(inventoryItemId: string): Promise<any> {
    const cacheKey = `product:${inventoryItemId}`;

    // Check cache first using UniversalSingleton's cache management
    const cached = await this.getFromCache<any>(cacheKey);
    if (cached) {
      return cached;
    }

    // Check if request is already pending (deduplication)
    const pending = this.pendingRequests.get(inventoryItemId);
    if (pending) {
     // console.log(`[ProductCache] Request pending for ${inventoryItemId}, waiting...`);
      return pending;
    }

    // console.log(`[ProductCache] Fetching product ${inventoryItemId}`);

    // Create and store the pending request
    const requestPromise = this.fetchProduct(inventoryItemId)
      .then(async (product) => {
        // Store in cache using UniversalSingleton's cache management
        await this.setCache(cacheKey, product);
        // Also store in in-memory cache with TTL
        this.setCachedData(cacheKey, product, this.cacheTTL);
        return product;
      })
      .finally(() => {
        // Clean up pending request
        this.pendingRequests.delete(inventoryItemId);
      });

    this.pendingRequests.set(inventoryItemId, requestPromise);
    
    return requestPromise;
  }

  /**
   * Fetch product data from API
   */
  private async fetchProduct(inventoryItemId: string): Promise<any> {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const troubleshootingMode = ProductCache.isTroubleshootingMode();
    const url = troubleshootingMode 
      ? `/api/items/${inventoryItemId}?t=${Date.now()}` // Bypass cache with timestamp
      : `/api/items/${inventoryItemId}`; // Use cache
    
    const productApiSingleton = ProductAPISingleton.getInstance();
    const product = await productApiSingleton.fetchProduct(url, headers);
    return product;
  }

  /**
   * Clear cache for a specific product using UniversalSingleton
   */
  async clearProductCache(inventoryItemId: string): Promise<void> {
    const cacheKey = `product:${inventoryItemId}`;
    await this.clearCache(cacheKey);
  }

  /**
   * Clear all product cache using UniversalSingleton
   */
  async clearAllCache(): Promise<void> {
    await this.clearCache();
    this.pendingRequests.clear();
  }

  /**
   * Get cache statistics from UniversalSingleton
   */
  getCacheStats(): { size: number; pending: number } & ReturnType<typeof this.getMetrics> {
    return {
      ...this.getMetrics(),
      size: this.getMetrics().cacheSize,
      pending: this.pendingRequests.size
    };
  }
}

// Export ProductAPISingleton for use in other files
export { ProductAPISingleton };

/**
 * Hook for fetching shops multi-bucket discovery data
 * 
 * Provides all featured product buckets and shop data for the shops directory page.
 * Uses parallel fetching for optimal performance.
 */
export interface ShopsBucketData {
  random: any[];
  trending: any[];
  new: any[];
  sale: any[];
  seasonal: any[];
  staff: any[];
  selection: any[];
  trendingShops: any[];
  recentlyViewed: any[];
}

export interface ShopsBucketResponse {
  buckets: ShopsBucketData;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  clearCache: () => void;
  getCacheStats: () => { size: number; pending: number };
  metrics?: {
    totalResponseTime: number;
    cacheHitRate: number;
    bucketCount: number;
  };
}

import { ScopeParams } from '@/types/scope';
import { scopeRequestBuilder } from '@/services/scopeRequestBuilder';

export function useShopsFeaturedBuckets(options: {
  tenantId?: string;
  shopScope?: 'global' | 'shop';
  userId?: string;
  limit?: number;
  enabled?: boolean;
  scope?: ScopeParams; // NEW: Scope-aware filtering
} = {}): ShopsBucketResponse {
  const { tenantId, shopScope = 'global', userId, limit = 12, enabled = true, scope } = options;
  
  const [buckets, setBuckets] = useState<ShopsBucketData>({
    random: [],
    trending: [],
    new: [],
    sale: [],
    seasonal: [],
    staff: [],
    selection: [],
    trendingShops: [],
    recentlyViewed: []
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{
    totalResponseTime: number;
    cacheHitRate: number;
    bucketCount: number;
  } | undefined>();

  // Get ProductCache singleton instance
  const productCache = ProductCache.getInstance();

  const fetchBuckets = async () => {
    if (!enabled) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const startTime = Date.now();
      
      // Log cache stats before fetching
      const cacheStatsBefore = productCache.getCacheStats();
      //console.log('[SHOPS BUCKETS] Cache stats before fetch:', cacheStatsBefore);
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      if (tenantId) queryParams.append('tenantId', tenantId);
      if (shopScope !== 'global') queryParams.append('shopScope', shopScope);
      
      // Build bucket URLs - use scope-aware builder if scope provided with valid parameters
      const buildBucketUrl = (bucketType: string): string => {
        // Only use scope-aware builder if we have a non-global scope with valid parameters
        if (scope && scope.scope !== 'global') {
          // Validate scope has required parameters
          if (scope.scope === 'category' && scope.category) {
            // Check if category has at least one filter value
            const hasProductFilter = scope.category.productName || scope.category.productSlug || 
                                    scope.category.productId || scope.category.googleProductId;
            const hasShopFilter = scope.category.shopCategoryName || scope.category.shopCategoryId || 
                                 scope.category.shopGoogleCategoryId;
            
            if (hasProductFilter || hasShopFilter) {
              return scopeRequestBuilder.buildProductUrl(bucketType as any, scope, limit);
            }
          }
          if (scope.scope === 'location' && scope.location) {
            // Check if location has coordinates or address
            const hasCoordinates = scope.location.latitude !== undefined && scope.location.longitude !== undefined;
            const hasAddress = scope.location.city || scope.location.state || scope.location.zip;
            
            if (hasCoordinates || hasAddress) {
              return scopeRequestBuilder.buildProductUrl(bucketType as any, scope, limit);
            }
          }
          // If scope type is set but parameters are missing, fall through to default
        }
        
        // Fallback to legacy shop-scoped URLs (just path, UniversalSingleton will handle full URL)
        return `/api/public/shops/discover/${bucketType}?scope=${shopScope}${tenantId ? `&tenantId=${tenantId}` : ''}&limit=${limit || 12}`;
      };

      // Define bucket endpoints
      const bucketEndpoints = [
        { name: 'random', url: buildBucketUrl('random') },
        { name: 'trending', url: buildBucketUrl('trending') },
        { name: 'new', url: buildBucketUrl('new') },
        { name: 'sale', url: buildBucketUrl('sale') },
        { name: 'seasonal', url: buildBucketUrl('seasonal') },
        { name: 'staff', url: buildBucketUrl('staff') },
        { name: 'selection', url: buildBucketUrl('selection') }
      ];

      // Add shop-specific endpoints (just paths, UniversalSingleton will handle full URLs)
      const shopEndpoints = [
        { name: 'trendingShops', url: `/api/public/shops/shop/trending?scope=global&limit=12&_t=${Date.now()}` }
      ];

      // Add user-specific endpoints if userId provided (just paths, UniversalSingleton will handle full URLs)
      const userEndpoints = userId ? [
        { name: 'recentlyViewed', url: `/api/public/shops/recently-viewed?userId=${userId}` }
      ] : [];

      // Combine all endpoints
      const allEndpoints = [...bucketEndpoints, ...shopEndpoints, ...userEndpoints];
      
      // Create UniversalSingleton instance for API calls
      const apiSingleton = ProductAPISingleton.getInstance();
      
      // Fetch all buckets in parallel
      const fetchPromises = allEndpoints.map(async (endpoint) => {
        try {
          // Extract the path from the full URL for makeApiRequest
          const urlPath = endpoint.url.replace(/https?:\/\/[^\/]+/, '');
          
          let data;
          
          // Use ShopsAPISingleton for shop endpoints, UniversalSingleton will handle full URLs
          if (endpoint.name === 'trendingShops') {
            const timestamp = Date.now(); // Force fresh cache key
            const shopsApiSingleton = ShopsAPISingleton.getInstance();
            // Temporarily disable caching for trending shops
            data = await shopsApiSingleton.makeShopsApiRequest<any>(urlPath, {}, undefined);
          } else {
            const apiSingleton = ProductAPISingleton.getInstance();
            data = await apiSingleton.makePublicApiRequest<any>(urlPath, {}, `shops-bucket:${endpoint.name}`);
          }
          
          // Check if the API call was successful
          if (!data.success) {
            throw new Error(`API error for ${endpoint.name}: ${data.error || 'Unknown error'}`);
          }

          // Handle different response structures
          let responseData;
          if (endpoint.name === 'trendingShops') {
            // Shop endpoints return data directly
            responseData = data.data || [];
          } else {
            // Product endpoints return nested data
            responseData = Array.isArray(data.data?.data) ? data.data.data : [];
          }
          
          if (endpoint.name === 'trendingShops') {
            // Transform trending products into unique shop data
            const shopMap = new Map<string, any>();
            
            // Extract the actual data array from the response object
            const productsArray = Array.isArray(responseData) ? responseData : (responseData?.data || []);
            
            productsArray.forEach((product: any) => {
              // The API returns product objects with rich shop data
              const tenantId = product.tenant_id;
              
              if (!shopMap.has(tenantId)) {
                // Create shop entry from product data
                const shopData = {
                  tenantId: product.tenant_id,
                  name: product.tenant_name,
                  slug: product.tenant_slug, // Full slug: "baraka-international-market-inc"
                  autoId: product.tenant_id,
                  imageUrl: product.tenant_logo_url,
                  location: `${product.tenant_city || ''}${product.tenant_city && product.tenant_state ? ', ' : ''}${product.tenant_state || ''}`,
                  productCount: 1, // Will be accumulated
                  rating: product.store_average_rating?.s || product.average_rating?.s || 4.5,
                  reviewCount: product.store_review_count?.s || product.review_count?.s || 0,
                  primary_category: product.shop_category || 'General', // "Grocery Store"
                  trendingScore: product.trending_score?.s || 0,
                  urls: {
                    slugUrl: `/shops/${product.tenant_slug}`,
                    tenantIdUrl: `/shops/${product.tenant_id}`,
                    autoIdUrl: `/shops/${product.tenant_id}`,
                    canonicalUrl: `/shops/${product.tenant_slug}`
                  }
                };
                shopMap.set(tenantId, shopData);
              } else {
                // Accumulate product count for existing shop
                const existingShop = shopMap.get(tenantId);
                existingShop.productCount += 1;
              }
            });
            
            const finalShops = Array.from(shopMap.values());
            
            return {
              endpointName: endpoint.name,
              data: finalShops,
              success: true
            };
          }
          
          // Transform and deduplicate products, accumulating featured types
          const productMap = new Map<string, any>();
          
          responseData.forEach((product: any) => {
            const productId = product.inventory_item_id || product.id;
            
            if (productMap.has(productId)) {
              // Product already exists, accumulate featured types
              const existingProduct = productMap.get(productId);
              const existingTypes = Array.isArray(existingProduct.featuredTypes) 
                ? existingProduct.featuredTypes 
                : [existingProduct.featuredType].filter(Boolean);
              const newTypes = [product.featured_type || product.featuredType].filter(Boolean);
              
              existingProduct.featuredTypes = [...new Set([...existingTypes, ...newTypes])];
            } else {
              // New product, transform it
              const transformedProduct = {
                id: product.inventory_item_id || product.id,
                name: product.product_name || product.name,
                title: product.product_title || product.title,
                brand: product.brand,
                description: product.description,
                priceCents: product.price_cents || product.priceCents,
                salePriceCents: product.sale_price_cents || product.salePriceCents,
                stock: product.stock,
                imageUrl: product.image_url || product.imageUrl,
                categoryName: product.product_category || product.category_name || product.categoryName || 'General',
                categorySlug: product.product_category_slug || product.category_slug || product.categorySlug || 'general',
                condition: product.condition,
                availability: product.availability,
                ratingAvg: product.rating_avg || product.ratingAvg,
                ratingCount: product.rating_count || product.ratingCount,
                isFeatured: product.is_featured || product.isFeatured,
                hasVariants: product.has_variants || product.hasVariants,
                price: product.price,
                salePrice: product.sale_price || product.salePrice,
                currency: product.currency,
                sku: product.sku,
                tenantId: product.tenant_id || product.tenantId,
                tenantName: product.tenant_name || product.tenantName,
                tenantLogoUrl: product.tenant_logo_url || product.tenantLogoUrl,
                featuredType: product.featured_type || product.featuredType,
                featuredTypes: [product.featured_type || product.featuredType].filter(Boolean),
                priority: product.priority,
                featuredAt: product.featured_at || product.featuredAt
              };
              
              productMap.set(productId, transformedProduct);
            }
          });
          
          const transformedProducts = Array.from(productMap.values());
          
          return { name: endpoint.name, data: transformedProducts, metrics: apiSingleton.getMetrics() };
        } catch (err) {
          console.error(`[SHOPS BUCKETS] Error fetching ${endpoint.name}:`, err);
          return { name: endpoint.name, data: [], metrics: null };
        }
      });

      // Process all results
      const results = await Promise.allSettled(fetchPromises);
      
      // Debug: Log the results
      /* if (process.env.NODE_ENV === 'development') {
        console.log('[useShopsFeaturedBuckets] API Results:', results);
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            console.log(`[useShopsFeaturedBuckets] ${allEndpoints[index].name} result:`, result.value);
          } else {
            console.error(`[useShopsFeaturedBuckets] ${allEndpoints[index].name} error:`, result.reason);
          }
        });
      } */
      
      // Process results
      const newBuckets: Partial<ShopsBucketData> = {};
      let totalResponseTime = 0;
      let cacheHits = 0;
      
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const endpointName = result.value.endpointName || result.value.name;
          const bucketKey = endpointName as keyof ShopsBucketData;
          newBuckets[bucketKey] = result.value.data;
          
          if (result.value.metrics) {
            totalResponseTime += result.value.metrics.responseTime || 0;
            if (result.value.metrics.cacheHit) cacheHits++;
          }
        }
      });

      setBuckets(newBuckets as ShopsBucketData);
      
      // Set metrics
      setMetrics({
        totalResponseTime: Date.now() - startTime,
        cacheHitRate: results.length > 0 ? (cacheHits / results.length) * 100 : 0,
        bucketCount: results.length
      });
      
      /* console.log('[SHOPS BUCKETS] Successfully fetched buckets', {
        bucketCount: results.length,
        totalResponseTime: Date.now() - startTime,
        cacheHitRate: `${((cacheHits / results.length) * 100).toFixed(1)}%`
      }); */
      
      // Log cache stats after fetching
      const cacheStatsAfter = productCache.getCacheStats();
      // console.log('[SHOPS BUCKETS] Cache stats after fetch:', cacheStatsAfter);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch buckets';
      setError(errorMessage);
      console.error('[SHOPS BUCKETS] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refetch = useCallback(() => {
    // Clear product cache before refetching to ensure fresh data
    productCache.clearAllCache();
    fetchBuckets();
  }, [productCache, fetchBuckets]);

  const clearCache = useCallback(() => {
    productCache.clearAllCache();
    // console.log('[SHOPS BUCKETS] Cache cleared by user');
  }, [productCache]);

  const getCacheStats = useCallback(() => {
    return productCache.getCacheStats();
  }, [productCache]);

  useEffect(() => {
    fetchBuckets();
  }, [tenantId, shopScope, userId, enabled, scope]);

  return {
    buckets,
    loading,
    error,
    refetch,
    clearCache,
    getCacheStats,
    metrics
  };
}

/**
 * Hook for fetching a single bucket
 * Useful for individual bucket components or lazy loading
 */
export function useShopsBucket(bucketType: keyof ShopsBucketData, options: {
  tenantId?: string;
  shopScope?: 'global' | 'shop';
  limit?: number;
  enabled?: boolean;
} = {}) {
  const { tenantId, shopScope = 'global', limit = 12, enabled = true } = options;
  
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBucket = async () => {
    if (!enabled) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const queryParams = new URLSearchParams();
      if (tenantId) queryParams.append('tenantId', tenantId);
      if (shopScope !== 'global') queryParams.append('shopScope', shopScope);
      queryParams.append('limit', limit.toString());
      
      let url: string;
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      switch (bucketType) {
        case 'random':
          url = `${apiUrl}/api/public/shops/featured/random?${queryParams.toString()}`;
          break;
        case 'trending':
          url = `${apiUrl}/api/public/shops/featured/trending?${queryParams.toString()}`;
          break;
        case 'new':
          url = `${apiUrl}/api/public/shops/featured/new?${queryParams.toString()}`;
          break;
        case 'sale':
          url = `${apiUrl}/api/public/shops/featured/sale?${queryParams.toString()}`;
          break;
        case 'seasonal':
          url = `${apiUrl}/api/public/shops/featured/seasonal?${queryParams.toString()}`;
          break;
        case 'staff':
          url = `${apiUrl}/api/public/shops/featured/staff?${queryParams.toString()}`;
          break;
        case 'selection':
          url = `${apiUrl}/api/public/shops/featured/selection?${queryParams.toString()}`;
          break;
        case 'trendingShops':
          url = `${apiUrl}/api/public/shops/trending?limit=${limit}`;
          break;
        case 'recentlyViewed':
          // This requires userId, so we'll handle it separately
          url = `${apiUrl}/api/public/shops/recently-viewed?limit=${limit}`;
          break;
        default:
          throw new Error(`Unknown bucket type: ${bucketType}`);
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${bucketType}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Check if the API call was successful
      if (!result.success) {
        throw new Error(`API error for ${bucketType}: ${result.error || 'Unknown error'}`);
      }
      
      setData(result.data || []);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : `Failed to fetch ${bucketType}`;
      setError(errorMessage);
      console.error(`[SHOPS BUCKET] Error fetching ${bucketType}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBucket();
  }, [bucketType, tenantId, shopScope, limit, enabled]);

  return {
    data,
    loading,
    error,
    refetch: fetchBucket
  };
}

/**
 * Hook for recently viewed shops (requires userId)
 */
export function useRecentlyViewedShops(options: {
  userId: string;
  limit?: number;
  enabled?: boolean;
}) {
  const { userId, limit = 12, enabled = true } = options;
  
  return useShopsBucket('recentlyViewed', {
    limit,
    enabled: enabled && !!userId
  });
}

// Export ProductCache for use in troubleshooting components
export { ProductCache };
