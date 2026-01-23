/**
 * Directory Stores Hook
 * 
 * Provides access to directory store data through the StoreSingleton
 * with intelligent caching and search functionality.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import cacheManager from '@/utils/cacheManager';

export interface DirectoryStore {
  id: string;
  tenantId: string;
  businessName: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  logoUrl?: string;
  primaryCategory?: string;
  ratingAvg: number;
  ratingCount: number;
  productCount: number;
  isFeatured: boolean;
  subscriptionTier: string;
  useCustomWebsite: boolean;
  website?: string;
  distance?: number;
  isOpen?: boolean;
  businessHours?: any;
}

export interface DirectoryStoresResponse {
  listings: DirectoryStore[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

export interface UseDirectoryStoresOptions {
  search?: string;
  category?: string;
  lat?: number;
  lng?: number;
  sort?: string;
  page?: number;
  limit?: number;
  cacheTTL?: number;
}

export interface UseDirectoryStoresReturn {
  stores: DirectoryStore[];
  loading: boolean;
  error: string | null;
  pagination: DirectoryStoresResponse['pagination'] | null;
  refetch: () => Promise<void>;
  clearCache: () => void;
  fromCache: boolean;
  metrics: {
    cacheHits: number;
    cacheMisses: number;
    totalRequests: number;
    averageResponseTime: number;
  };
}

export const useDirectoryStores = (
  options: UseDirectoryStoresOptions = {}
): UseDirectoryStoresReturn => {
  const {
    search,
    category,
    lat,
    lng,
    sort = 'activity',
    page = 1,
    limit = 24,
    cacheTTL = 15 * 60 * 1000, // 15 minutes
  } = options;

  const [stores, setStores] = useState<DirectoryStore[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<DirectoryStoresResponse['pagination'] | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [localMetrics, setLocalMetrics] = useState({
    cacheHits: 0,
    cacheMisses: 0,
    totalRequests: 0,
    averageResponseTime: 0,
  });

  const fetchDirectoryStores = useCallback(async () => {
    setLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      // Create cache key for directory stores
      const cacheKey = `directory-stores-${search || 'none'}-${category || 'none'}-${lat || 'none'}-${lng || 'none'}-${sort}-${page}-${limit}`;
      
      console.log('[useDirectoryStores] Fetching with params:', {
        search,
        category,
        lat,
        lng,
        sort,
        page,
        limit,
        cacheKey,
        pageType: typeof page,
        pageValue: page
      });
      
      // Check cache using universal cache manager
      const cached = await cacheManager.get<DirectoryStoresResponse>(cacheKey);
      console.log('[useDirectoryStores] Cache check:', {
        cacheKey,
        cached: !!cached,
        cacheStats: cacheManager.getStats()
      });
      
      if (cached) {
        console.log('[useDirectoryStores] Cache HIT - serving from cache');
        setStores(cached.listings);
        setPagination(cached.pagination);
        setFromCache(true);
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Update metrics for cache hit
        console.log('[useDirectoryStores] Updating metrics for cache hit:', {
          before: { cacheHits: localMetrics.cacheHits, totalRequests: localMetrics.totalRequests },
          responseTime
        });
        
        setLocalMetrics(prev => {
          const newMetrics = {
            ...prev,
            totalRequests: prev.totalRequests + 1,
            cacheHits: prev.cacheHits + 1,
            averageResponseTime: (prev.averageResponseTime * prev.totalRequests + responseTime) / (prev.totalRequests + 1),
          };
          console.log('[useDirectoryStores] Updated metrics for cache hit:', newMetrics);
          return newMetrics;
        });
        return;
      }
      
      console.log('[useDirectoryStores] Cache MISS - fetching from API', {
        reason: !cached ? 'No cached data' : 'Cache expired',
        cached: !!cached,
        cacheTTL
      });
      
      // Use the directory API endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const params = new URLSearchParams();
      
      if (search) params.append('search', search);
      if (category) params.append('category', category);
      if (lat && lng) {
        params.append('lat', lat.toString());
        params.append('lng', lng.toString());
      }
      if (sort) params.append('sort', sort);
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      const response = await fetch(`${apiUrl}/api/directory/mv/search?${params}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch directory stores: ${response.status} ${errorText}`);
      }

      const result = await response.json();

      // Deduplicate listings by tenant_id (MV returns one row per category)
      // Keep the first occurrence of each store
      if (result.listings) {
        const seenIds = new Set();
        result.listings = result.listings.filter((listing: any) => {
          const id = listing.tenantId || listing.tenant_id || listing.id;
          if (seenIds.has(id)) {
            return false;
          }
          seenIds.add(id);
          return true;
        });
        // Update pagination count to reflect deduplicated results
        if (result.pagination) {
          result.pagination.totalItems = result.listings.length;
          result.pagination.returnedCount = result.listings.length;
        }
      }

      // Store in cache using universal cache manager
      await cacheManager.set(cacheKey, result);
      
      console.log('[useDirectoryStores] Stored in cache:', {
        cacheKey,
        cacheStats: cacheManager.getStats(),
        listingsCount: result.listings?.length || 0
      });

      // Store the fetched stores
      setStores(result.listings || []);
      setPagination(result.pagination);
      setFromCache(false);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Update metrics for cache miss
      console.log('[useDirectoryStores] Updating metrics for cache miss:', {
        before: { cacheMisses: localMetrics.cacheMisses, totalRequests: localMetrics.totalRequests },
        responseTime
      });
      
      setLocalMetrics(prev => {
        const newMetrics = {
          ...prev,
          totalRequests: prev.totalRequests + 1,
          cacheMisses: prev.cacheMisses + 1,
          averageResponseTime: (prev.averageResponseTime * prev.totalRequests + responseTime) / (prev.totalRequests + 1),
        };
        console.log('[useDirectoryStores] Updated metrics for cache miss:', newMetrics);
        console.log('[useDirectoryStores] Metrics comparison:', {
          before: prev,
          after: newMetrics,
          diff: {
            cacheMisses: newMetrics.cacheMisses - prev.cacheMisses,
            totalRequests: newMetrics.totalRequests - prev.totalRequests,
            averageResponseTime: newMetrics.averageResponseTime - prev.averageResponseTime,
          },
        });
        return newMetrics;
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch directory stores');
      console.error('[useDirectoryStores] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [search, category, lat, lng, sort, page, limit, cacheTTL]);

  const refetch = useCallback(() => {
    return fetchDirectoryStores();
  }, [fetchDirectoryStores]);

  const clearCache = useCallback(async () => {
    setFromCache(false);
    
    try {
      await cacheManager.clear();
      console.log('[useDirectoryStores] Cache cleared successfully');
    } catch (error) {
      console.warn('[useDirectoryStores] Failed to clear cache:', error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchDirectoryStores();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    stores,
    loading,
    error,
    pagination,
    refetch,
    clearCache,
    fromCache,
    metrics: localMetrics,
  };
};
