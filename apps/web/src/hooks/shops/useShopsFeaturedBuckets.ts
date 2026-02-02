"use client";

import { useState, useEffect, useCallback } from 'react';
import { UniversalSingleton } from '@/providers/base/UniversalSingleton';

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
  private static isTroubleshootingMode(): boolean {
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
      console.log(`[ProductCache] Request pending for ${inventoryItemId}, waiting...`);
      return pending;
    }

    console.log(`[ProductCache] Fetching product ${inventoryItemId}`);

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
    
    const response = await fetch(url, {
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch product ${inventoryItemId}: ${response.status}`);
    }

    const product = await response.json();
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
      console.log('[SHOPS BUCKETS] Cache stats before fetch:', cacheStatsBefore);
      
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
        
        // Fallback to legacy shop-scoped URLs
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

      // Add shop-specific endpoints
      const shopEndpoints = [
        { name: 'trendingShops', url: `/api/public/shops/trending?scope=global&limit=12` }
      ];

      // Add user-specific endpoints if userId provided
      const userEndpoints = userId ? [
        { name: 'recentlyViewed', url: `/api/public/shops/recently-viewed?userId=${userId}` }
      ] : [];

      // Combine all endpoints
      const allEndpoints = [...bucketEndpoints, ...shopEndpoints, ...userEndpoints];
      
      // Fetch all buckets in parallel
      const fetchPromises = allEndpoints.map(async (endpoint) => {
        try {
          const response = await fetch(endpoint.url);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${endpoint.name}: ${response.statusText}`);
          }
          const data = await response.json();
          
          // Check if the API call was successful
          if (!data.success) {
            throw new Error(`API error for ${endpoint.name}: ${data.error || 'Unknown error'}`);
          }
          
          // Transform featured product records to actual product data using ProductCache
          const featuredProducts = data.data || [];
          
                    
          // Debug: Log invalid inventoryItemId values
          const invalidProducts = featuredProducts.filter(
            (product: any) => !product.inventoryItemId || product.inventoryItemId === 'undefined' || product.inventoryItemId === null
          );
          
          // Debug specifically for random endpoint
          if (endpoint.name === 'random' && invalidProducts.length > 0) {
            console.warn(`[SHOPS BUCKETS] ${endpoint.name} - Invalid inventoryItemId debug:`, {
              totalProducts: featuredProducts.length,
              invalidProducts: invalidProducts.length,
              validProducts: featuredProducts.length - invalidProducts.length,
              sampleInvalid: invalidProducts.slice(0, 2).map((p: any) => ({
                inventoryItemId: p.inventoryItemId,
                id: p.id,
                tenantLogoUrl: p.tenantLogoUrl || p.tenant_logo_url,
                productName: p.productName || p.product_name
              }))
            });
          }
          
          if (invalidProducts.length > 0) {
            console.warn(`[SHOPS BUCKETS] Found ${invalidProducts.length} products with invalid inventoryItemId:`, invalidProducts);
          }
          
          // Filter out products with invalid inventoryItemId
          const validFeaturedProducts = featuredProducts.filter(
            (product: any) => product.inventoryItemId && product.inventoryItemId !== 'undefined' && product.inventoryItemId !== null
          );
          
          // Create a map to avoid duplicate fetches for the same product
          const productMap = new Map<string, any>();
          validFeaturedProducts.forEach((product: any) => {
            productMap.set(product.inventoryItemId, product);
          });
          
          // Get ProductCache singleton instance
          const productCache = ProductCache.getInstance();
          
          const transformedProducts = await Promise.all(
            Array.from(productMap.entries()).map(async ([inventoryItemId, featuredProduct]: [string, any]) => {
              try {
                // Use ProductCache to get product data
                const productData = await productCache.getProduct(inventoryItemId);
                
                // Debug for ALL buckets to compare working vs non-working
                if (inventoryItemId && (inventoryItemId.includes('sid-xbjcqzwj') || inventoryItemId.includes('sid-071div8t'))) {
                  console.log(`[SHOPS BUCKETS] ${endpoint.name} - Merge Debug:`, {
                    inventoryItemId,
                    featuredProductLogo: featuredProduct.tenantLogoUrl || featuredProduct.tenant_logo_url,
                    cacheProductLogo: productData.tenantLogoUrl || productData.tenant_logo_url,
                    featuredProductName: featuredProduct.productName || featuredProduct.product_name,
                    cacheProductName: productData.productName || productData.product_name,
                    finalLogoUrl: featuredProduct.tenantLogoUrl || productData.tenantLogoUrl || featuredProduct.tenant_logo_url || productData.tenant_logo_url,
                    hasFeaturedProductLogo: !!(featuredProduct.tenantLogoUrl || featuredProduct.tenant_logo_url),
                    hasCacheProductLogo: !!(productData.tenantLogoUrl || productData.tenant_logo_url)
                  });
                }
                
                return {
                  ...productData,
                  // Preserve logo fields from bucket API response
                  tenantLogoUrl: featuredProduct.tenantLogoUrl || productData.tenantLogoUrl,
                  tenant_logo_url: featuredProduct.tenant_logo_url || productData.tenant_logo_url,
                  tenantName: featuredProduct.tenantName || productData.tenantName,
                  tenant_name: featuredProduct.tenant_name || productData.tenant_name,
                  featuredType: featuredProduct.featuredType,
                  priority: featuredProduct.priority,
                  featuredAt: featuredProduct.featuredAt
                };
              } catch (error) {
                console.error(`Failed to fetch product ${inventoryItemId}:`, error);
                return null;
              }
            })
          );
          
          return { name: endpoint.name, data: transformedProducts.filter(Boolean), metrics: data.metrics };
        } catch (err) {
          console.error(`[SHOPS BUCKETS] Error fetching ${endpoint.name}:`, err);
          return { name: endpoint.name, data: [], metrics: null };
        }
      });

      const results = await Promise.all(fetchPromises);
      
      // Process results
      const newBuckets: Partial<ShopsBucketData> = {};
      let totalResponseTime = 0;
      let cacheHits = 0;
      
      results.forEach(result => {
        newBuckets[result.name as keyof ShopsBucketData] = result.data;
        if (result.metrics) {
          totalResponseTime += result.metrics.responseTime || 0;
          if (result.metrics.cacheHit) cacheHits++;
        }
      });

      setBuckets(newBuckets as ShopsBucketData);
      
      // Set metrics
      setMetrics({
        totalResponseTime: Date.now() - startTime,
        cacheHitRate: results.length > 0 ? (cacheHits / results.length) * 100 : 0,
        bucketCount: results.length
      });
      
      console.log('[SHOPS BUCKETS] Successfully fetched buckets', {
        bucketCount: results.length,
        totalResponseTime: Date.now() - startTime,
        cacheHitRate: `${((cacheHits / results.length) * 100).toFixed(1)}%`
      });
      
      // Log cache stats after fetching
      const cacheStatsAfter = productCache.getCacheStats();
      console.log('[SHOPS BUCKETS] Cache stats after fetch:', cacheStatsAfter);
      
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
    console.log('[SHOPS BUCKETS] Cache cleared by user');
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
      
      switch (bucketType) {
        case 'random':
          url = `/api/public/shops/featured/random?${queryParams.toString()}`;
          break;
        case 'trending':
          url = `/api/public/shops/featured/trending?${queryParams.toString()}`;
          break;
        case 'new':
          url = `/api/public/shops/featured/new?${queryParams.toString()}`;
          break;
        case 'sale':
          url = `/api/public/shops/featured/sale?${queryParams.toString()}`;
          break;
        case 'seasonal':
          url = `/api/public/shops/featured/seasonal?${queryParams.toString()}`;
          break;
        case 'staff':
          url = `/api/public/shops/featured/staff?${queryParams.toString()}`;
          break;
        case 'selection':
          url = `/api/public/shops/featured/selection?${queryParams.toString()}`;
          break;
        case 'trendingShops':
          url = `/api/public/shops/trending?limit=${limit}`;
          break;
        case 'recentlyViewed':
          // This requires userId, so we'll handle it separately
          url = `/api/public/shops/recently-viewed?limit=${limit}`;
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
