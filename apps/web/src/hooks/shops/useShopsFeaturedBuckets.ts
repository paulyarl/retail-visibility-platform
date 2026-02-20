"use client";

import { useState, useEffect, useCallback } from 'react';
import { shopsService } from '@/services/ShopsService';

// Featured product interface
interface FeaturedProduct {
  id: string;
  inventory_item_id?: string; // Add this for compatibility
  name: string;
  price: number;
  imageUrl?: string;
  shopName: string;
  shopSlug: string;
  category?: string;
  featured: boolean;
  createdAt: string;
}

// Featured bucket interface
interface FeaturedBucket {
  id: string;
  name: string;
  description: string;
  products: FeaturedProduct[];
  totalCount: number;
  lastUpdated: string;
}

/**
 * Hook for fetching and managing featured shops buckets
 * Uses the modern shopsService with proper caching and error handling
 */
export function useShopsFeaturedBuckets() {
  const [buckets, setBuckets] = useState<FeaturedBucket[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch featured shops buckets
   */
  const fetchBuckets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Use shopsService to get trending shops (featured)
      const trendingShops = await shopsService.getTrendingShops({ limit: 20 });
      
      // Transform to bucket format
      const featuredBucket: FeaturedBucket = {
        id: 'featured-shops',
        name: 'Featured Shops',
        description: 'Trending and popular shops in your area',
        products: trendingShops.map(shop => ({
          id: shop.tenantId,
          name: shop.name,
          price: 0, // Shops don't have price
          imageUrl: shop.imageUrl || shop.bannerUrl, // Use imageUrl with bannerUrl fallback
          shopName: shop.name,
          shopSlug: shop.slug || shop.tenantId,
          category: shop.category || 'featured',
          featured: true,
          createdAt: shop.createdAt || new Date().toISOString()
        })),
        totalCount: trendingShops.length,
        lastUpdated: new Date().toISOString()
      };

      setBuckets([featuredBucket]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch featured shops');
      console.error('[useShopsFeaturedBuckets] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Refresh buckets
   */
  const refresh = useCallback(() => {
    setBuckets([]);
    fetchBuckets();
  }, [fetchBuckets]);

  // Auto-fetch on mount
  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  // Return buckets in the expected format for the page
  const bucketMap = buckets.reduce((acc, bucket) => {
    acc[bucket.id] = bucket.products;
    return acc;
  }, {} as Record<string, FeaturedProduct[]>);

  return {
    // Array format for new components
    buckets,
    loading,
    error,
    refresh,
    getBucketById: (bucketId: string) => buckets.find(b => b.id === bucketId) || null,
    getProductsFromBucket: (bucketId: string) => bucketMap[bucketId] || [],
    fetchBuckets,
    // Legacy format for existing page
    trending: bucketMap['featured-shops'] || [],
    new: [],
    sale: [],
    seasonal: [],
    staff: [],
    selection: [],
    random: []
  };
}

/**
 * Hook for managing a single featured bucket
 */
export function useFeaturedBucket(bucketId: string = 'featured-shops') {
  const { buckets, loading, error, getBucketById, getProductsFromBucket } = useShopsFeaturedBuckets();
  
  const bucket = getBucketById(bucketId);
  const products = getProductsFromBucket(bucketId);

  return {
    bucket,
    products,
    loading,
    error,
    hasData: !!bucket && bucket.products.length > 0,
    isEmpty: !!bucket && bucket.products.length === 0
  };
}

export type { FeaturedProduct, FeaturedBucket };

// Backward compatibility exports (deprecated)
export const ProductCache = {
  getInstance: () => ({
    clearCache: () => console.warn('ProductCache.clearCache is deprecated'),
    getCacheStats: () => ({ size: 0, hitRate: 0, pendingRequests: 0 })
  })
};

export const ProductAPISingleton = {
  getInstance: () => ({
    fetchProduct: () => console.warn('ProductAPISingleton.fetchProduct is deprecated'),
    makePublicApiRequest: () => console.warn('ProductAPISingleton.makePublicApiRequest is deprecated')
  })
};
