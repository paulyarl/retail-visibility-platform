"use client";

import { useState, useEffect, useCallback } from 'react';
import { featuredProductsSingleton, FeaturedProduct, FeaturedType } from '@/providers/data/FeaturedProductsSingleton';

/**
 * Hook for getting all featured products buckets
 * Perfect for the main featured products display
 */
export function useFeaturedProductsBuckets(tenantId?: string, limit: number = 20) {
  const [buckets, setBuckets] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBuckets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!tenantId) {
        setBuckets(null);
        setLoading(false);
        return;
      }

      const bucketsData = await featuredProductsSingleton.getAllFeaturedProducts(tenantId, limit);
      setBuckets(bucketsData);
    } catch (err) {
      console.error('Failed to fetch featured products buckets:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setBuckets(null);
    } finally {
      setLoading(false);
    }
  }, [tenantId, limit]);

  useEffect(() => {
    fetchBuckets();
  }, [fetchBuckets]);

  const refresh = useCallback(async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      await featuredProductsSingleton.refreshFeaturedProducts(tenantId, limit);
      await fetchBuckets();
    } catch (err) {
      console.error('Failed to refresh featured products buckets:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, limit, fetchBuckets]);

  return {
    buckets,
    loading,
    error,
    refresh,
    refetch: fetchBuckets
  };
}

/**
 * Hook for getting featured products by type
 */
export function useFeaturedProductsByType(tenantId?: string, featuredType?: FeaturedType, limit: number = 20) {
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!tenantId || !featuredType) {
        setProducts([]);
        setLoading(false);
        return;
      }

      const featuredProducts = await featuredProductsSingleton.getFeaturedProductsByType(tenantId, featuredType, limit);
      setProducts(featuredProducts);
    } catch (err) {
      console.error('Failed to fetch featured products by type:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId, featuredType, limit]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    refetch: fetchProducts
  };
}

/**
 * Hook for getting bucket statistics
 */
export function useFeaturedProductsStats(tenantId?: string) {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (!tenantId) {
        setStats({});
        setLoading(false);
        return;
      }

      const bucketStats = featuredProductsSingleton.getBucketStats();
      setStats(bucketStats);
    } catch (err) {
      console.error('Failed to fetch featured products stats:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStats({});
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats
  };
}

/**
 * Hook for preloading featured products
 */
export function usePreloadFeaturedProducts(tenantId?: string, limit: number = 20) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preload = useCallback(async () => {
    if (!tenantId) return;

    try {
      setLoading(true);
      setError(null);
      await featuredProductsSingleton.preloadTenantFeaturedProducts();
    } catch (err) {
      console.error('Failed to preload featured products:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [tenantId, limit]);

  return {
    preload,
    loading,
    error
  };
}

/**
 * Hook for clearing featured products cache
 */
export function useFeaturedProductsCache() {
  const clearCache = useCallback((tenantId: string) => {
    featuredProductsSingleton.clearTenantFeaturedProducts();
  }, []);

  return {
    clearCache
  };
}
