'use client';

/**
 * React Hooks for Shop Services
 * 
 * Client-side hooks that use the shop services
 * Separated from universal-singleton-client.ts to avoid "use client" directive in server components
 */

import { useState, useEffect, useCallback } from 'react';
import { shopsService } from '@/services/ShopsService';
import { clientLogger } from '@/lib/client-logger';

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
      setLoading(true);
      setError(null);
      
      const result = await shopService.getShopDirectory(params);
     /*  console.log('[useShopDirectory] API response:', result);
      console.log('[useShopDirectory] Response type:', typeof result);
      console.log('[useShopDirectory] Has shops property:', result && 'shops' in result);
      console.log('[useShopDirectory] Has data property:', result && 'data' in result);
      console.log('[useShopDirectory] Is array:', Array.isArray(result)); */
      
      // Extract shops from the response structure
      if (result && result.shops && (result.shops as any).data && Array.isArray((result.shops as any).data)) {
        // Handle double-wrapped response: { shops: { data: [...] } }
        setShops((result.shops as any).data);
        setHasMore((result.shops as any).data.length >= (params.limit || 10));
 //       console.log('[useShopDirectory] Shops loaded from result.shops.data:', (result.shops as any).data.length);
      } else if (result && result.shops && Array.isArray(result.shops)) {
        // Handle direct shops array: { shops: [...] }
        setShops(result.shops);
        setHasMore(result.shops.length >= (params.limit || 10));
 //       console.log('[useShopDirectory] Shops loaded from result.shops:', result.shops.length);
      } else if (result && (result as any).data && Array.isArray((result as any).data)) {
        // Handle response structure with data property
        setShops((result as any).data);
        setHasMore((result as any).data.length >= (params.limit || 10));
 //       console.log('[useShopDirectory] Shops loaded from result.data:', (result as any).data.length);
      } else if (result && Array.isArray(result)) {
        // Fallback for different response structure
        setShops(result);
        setHasMore(result.length >= (params.limit || 10));
 //       console.log('[useShopDirectory] Shops loaded (fallback):', result.length);
      } else {
        clientLogger.warn('[useShopDirectory] Unexpected response structure:', { detail: result });
        setShops([]);
        setHasMore(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch shops');
      clientLogger.error('[useShopDirectory] Error:', { detail: err });
    } finally {
      setLoading(false);
    }
  }, [shopService, params]); // Remove shops.length to prevent infinite loop

  useEffect(() => {
    fetchShops();
  }, [shopService, JSON.stringify(params)]); // Use stable dependencies

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
    // Call fetchShops directly without depending on it
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const result = await shopService.getShopDirectory(params);
       // console.log('[useShopDirectory] API response:', result);
        
        // Extract shops from the response structure
        if (result && result.shops && Array.isArray(result.shops)) {
          setShops(result.shops);
          setHasMore(result.shops.length >= (params.limit || 10));
 //         console.log('[useShopDirectory] Shops loaded:', result.shops.length);
        } else if (result && Array.isArray(result)) {
          // Fallback for different response structure
          setShops(result);
          setHasMore(result.length >= (params.limit || 10));
 //         console.log('[useShopDirectory] Shops loaded (fallback):', result.length);
        } else {
          clientLogger.warn('[useShopDirectory] Unexpected response structure:', { detail: result });
          setShops([]);
          setHasMore(false);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch shops');
        clientLogger.error('[useShopDirectory] Error:', { detail: err });
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [shopService, JSON.stringify(params)]);

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
   /*    console.log('[useShopCategories] API response:', response);
      console.log('[useShopCategories] Response type:', typeof response);
      console.log('[useShopCategories] Has data property:', response && 'data' in response);
      console.log('[useShopCategories] Is array:', Array.isArray(response)); */
      
      // Handle response structure: { categories: { data: [...] } }
      if (response && (response as any).categories && (response as any).categories.data && Array.isArray((response as any).categories.data)) {
        setData((response as any).categories.data);
//        console.log('[useShopCategories] Categories loaded from response.categories.data:', (response as any).categories.data.length);
      } else if (response && (response as any).data && Array.isArray((response as any).data)) {
        // Handle double-wrapped response: { data: [...] }
        setData((response as any).data);
//        console.log('[useShopCategories] Categories loaded from response.data:', (response as any).data.length);
      } else if (response && Array.isArray(response)) {
        // Fallback for direct array response
        setData(response);
//        console.log('[useShopCategories] Categories loaded (fallback):', response.length);
      } else {
        clientLogger.warn('[useShopCategories] Unexpected response structure:', { detail: response });
        setData([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
      clientLogger.error('[useShopCategories] Error:', { detail: err });
    } finally {
      setLoading(false);
    }
  }, [shopService, data.length]);

  useEffect(() => {
    fetchCategories();
  }, [shopService]); // Remove fetchCategories dependency to prevent infinite loop

  return { data, loading, error, refetch: fetchCategories };
}

export function useStoreTypes() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStoreTypes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Import DirectoryService to get store types from dedicated endpoint
      const { directoryService } = await import('@/services/DirectorySingletonService');
      
      // Get all directory store types globally (no tenant required)
      const storeTypesData = await directoryService.getDirectoryStoreTypes();
      
     // console.log('[useStoreTypes] Directory store types data:', storeTypesData);
      
      if (storeTypesData && Array.isArray(storeTypesData)) {
        // Transform storeTypes to match the expected category format
        const transformedStoreTypes = storeTypesData.map((storeType: any) => ({
          id: storeType.id,
          name: storeType.displayName || storeType.name,
          slug: storeType.slug,
          count: storeType.storeCount || storeType.store_count || 0,
          icon: '🏪', // Default icon for store types
          avgRating: storeType.avgRating || storeType.avg_rating || 0,
          totalProducts: storeType.totalProducts || storeType.total_products || 0,
          uniqueLocations: storeType.uniqueLocations || storeType.unique_locations || 0
        }));
        
        setData(transformedStoreTypes);
       // console.log('[useStoreTypes] Transformed store types:', transformedStoreTypes);
      } else {
        clientLogger.warn('[useStoreTypes] No store types found');
        setData([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch store types');
      clientLogger.error('[useStoreTypes] Error:', { detail: err });
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStoreTypes();
  }, [fetchStoreTypes]);

  return { data, loading, error, refetch: fetchStoreTypes };
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
