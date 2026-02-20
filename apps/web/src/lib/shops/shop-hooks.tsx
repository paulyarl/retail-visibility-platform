'use client';

/**
 * React Hooks for Shop Services
 * 
 * Client-side hooks that use the shop services
 * Separated from universal-singleton-client.ts to avoid "use client" directive in server components
 */

import { useState, useEffect, useCallback } from 'react';
import { shopsService } from '@/services/ShopsService';

export function useShopService() {
  return shopsService;
}

export function useShopDirectory(params: {
  limit?: number;
  offset?: number;
  search?: string;
  category?: string;
  location?: string;
  sortBy?: 'name' | 'rating' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}) {
  const shopService = useShopService();
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const fetchShops = useCallback(async () => {
    try {
      // Only show loading if we don't have data yet
      if (shops.length === 0) {
        setLoading(true);
      }
      setError(null);
      
      const result = await shopService.getShopDirectory(params);
      if (result && Array.isArray(result)) {
        setShops(result);
        setHasMore(result.length >= (params.limit || 10));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch shops');
    } finally {
      setLoading(false);
    }
  }, [shopService, params, shops.length]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loading) return;

    try {
      setLoading(true);
      const newParams = { ...params, offset: shops.length };
      const result = await shopService.getShopDirectory(newParams);
      if (result && Array.isArray(result)) {
        setShops(prev => [...prev, ...result]);
        setHasMore(result.length >= (params.limit || 10));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more shops');
    } finally {
      setLoading(false);
    }
  }, [shopService, params, shops.length, hasMore, loading]);

  const refresh = useCallback(() => {
    setShops([]);
    setHasMore(true);
    fetchShops();
  }, [fetchShops]);

  return {
    shops,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  };
}

export function useShopSearch() {
  const shopService = useShopService();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (query: string, filters?: {
    category?: string;
    location?: string;
    rating?: number;
  }) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const searchParams = {
        search: query,
        category: filters?.category,
        location: filters?.location
      };
      
      const searchResult = await shopService.getShopDirectory(searchParams);
      if (searchResult && Array.isArray(searchResult)) {
        setResults(searchResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, [shopService]);

  const clearResults = useCallback(() => {
    setResults([]);
    setError(null);
  }, []);

  return {
    results,
    loading,
    error,
    search,
    clearResults
  };
}

export function useShopCategories() {
  const shopService = useShopService();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    if (data.length > 0) return; // Avoid loading state when using cached data
    setLoading(true);
    setError(null);

    try {
      const response = await shopService.getShopCategories();
      if (response && Array.isArray(response)) {
        setData(response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }, [shopService, data.length]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { data, loading, error, refetch: fetchCategories };
}

export function useTrendingShops(params: {
  limit?: number;
  region?: string;
} = {}) {
  const shopService = useShopService();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Destructure params to get stable values
  const { limit, region } = params;

  const fetchTrendingShops = useCallback(async () => {
    // Only show loading if we don't have data yet
    if (data.length === 0) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await shopService.getTrendingShops({ limit, region });
      if (response && Array.isArray(response)) {
        setData(response);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trending shops');
    } finally {
      setLoading(false);
    }
  }, [shopService, limit, region, data.length]);

  useEffect(() => {
    fetchTrendingShops();
  }, [fetchTrendingShops]);

  return { data, loading, error, refetch: fetchTrendingShops };
}
