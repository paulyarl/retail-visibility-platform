/**
 * Directory Stores Hook
 * 
 * Provides access to directory store data through the StoreSingleton
 * with intelligent caching and search functionality.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { recommendationsService } from '@/services/RecommendationsSingletonService';

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
      // Log the request parameters (no manual cache key needed since service handles caching)
      console.log('[useDirectoryStores] Fetching with params:', {
        search,
        category,
        lat,
        lng,
        sort,
        page,
        limit
      });
      
      // Use the directory API endpoint through singleton service
      // Service handles caching automatically through makePublicRequest
      const result = await recommendationsService.searchDirectoryStores({
        search,
        category,
        lat,
        lng,
        sort,
        page,
        limit
      });

      if (!result) {
        throw new Error('Failed to fetch directory stores: No response from service');
      }

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

      // Store the fetched stores (service handles caching automatically)
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
    fromCache,
    metrics: localMetrics,
  };
};
