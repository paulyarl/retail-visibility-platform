/**
 * Featured Stores Singleton Hook
 * 
 * Provides access to featured store data through the StoreSingleton
 * with intelligent caching and error handling.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useStore } from '@/providers/StoreProviderSingleton';
import cacheManager from '@/utils/cacheManager';

export interface Store {
  id: string;
  name: string;
  slug: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  logoUrl?: string;
  ratingAvg?: number;
  ratingCount?: number;
  productCount?: number;
  isFeatured?: boolean;
  distance?: number; // in km
  createdAt: string;
  // Additional fields from MV for complete showcase
  tenantId?: string;
  phone?: string;
  email?: string;
  website?: string;
  primaryCategory?: string;
  subscriptionTier?: string;
  useCustomWebsite?: boolean;
  businessHours?: any;
  directoryPublished?: boolean;
  updatedAt?: string;
  
  // Rich data from MV joins
  actualProductCount?: number;
  featuredProductCount?: number;
  productsWithImages?: number;
  avgProductPrice?: number;
  productCategories?: string[];
  hasNewArrivals?: boolean;
  hasSaleItems?: boolean;
  lowestPrice?: number;
  highestPrice?: number;
  featuredProductsShowcase?: any[];
  activityLevel?: 'very_active' | 'active' | 'moderately_active' | 'less_active';
}

export interface UseFeaturedStoresOptions {
  limit?: number;
  location?: {
    lat: number;
    lng: number;
    radius?: number; // in km
  };
  city?: string;
  state?: string;
  cacheTTL?: number;
}

export interface UseFeaturedStoresReturn {
  stores: Store[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  getStoreBySlug: (slug: string) => Store | undefined;
  getStoresByLocation: (lat: number, lng: number, radius?: number) => Store[];
  clearCache: () => void;
  metrics: {
    cacheHits: number;
    cacheMisses: number;
    totalRequests: number;
    averageResponseTime: number;
  };
}

export const useFeaturedStores = (
  options: UseFeaturedStoresOptions = {}
): UseFeaturedStoresReturn => {
  const {
    limit = 10,
    location,
    city,
    state,
    cacheTTL = 15 * 60 * 1000, // 15 minutes
  } = options;

  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localMetrics, setLocalMetrics] = useState({
    cacheHits: 0,
    cacheMisses: 0,
    totalRequests: 0,
    averageResponseTime: 0,
  });

  const fetchFeaturedStores = useCallback(async () => {
    setLoading(true);
    setError(null);

    const startTime = Date.now();

    try {
      // Create cache key for featured stores
      const cacheKey = `featured-stores-${location?.lat || 'default'}-${location?.lng || 'default'}-${limit}`;
      
      // Check cache first using universal cache manager
      const cached = await cacheManager.get<Store[]>(cacheKey);
      console.log('[useFeaturedStores] Cache check:', {
        cacheKey,
        cached: !!cached,
        cacheStats: cacheManager.getStats()
      });
      
      if (cached && Array.isArray(cached)) {
        console.log('[useFeaturedStores] Cache HIT - serving from cache');
        setStores(cached);
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        // Update metrics for cache hit
        setLocalMetrics(prev => ({
          ...prev,
          totalRequests: prev.totalRequests + 1,
          cacheHits: prev.cacheHits + 1,
          averageResponseTime: (prev.averageResponseTime * prev.totalRequests + responseTime) / (prev.totalRequests + 1),
        }));
        return;
      }
      
      console.log('[useFeaturedStores] Cache MISS - fetching from API');
      
      // Use the featured stores endpoint
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const params = new URLSearchParams();
      params.append('limit', limit.toString());
      
      if (location) {
        params.append('lat', location.lat.toString());
        params.append('lng', location.lng.toString());
        params.append('maxDistance', '50'); // 50km radius
      }

      const response = await fetch(`${apiUrl}/api/directory/featured-stores?${params}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch featured stores: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('[useFeaturedStores] API Response:', {
        status: response.status,
        success: data.success,
        dataKeys: data.data ? Object.keys(data.data) : 'no data',
        stores: data.data?.stores,
        fullResponse: data
      });
      
      if (!data.success || !data.data || !data.data.stores) {
        console.error('[useFeaturedStores] Invalid response format:', data);
        throw new Error('Invalid response format');
      }

      // Store in cache using universal cache manager
      await cacheManager.set(cacheKey, data.data.stores);
      console.log('[useFeaturedStores] Stored in cache:', {
        cacheKey,
        storesCount: data.data.stores.length,
        sampleStore: data.data.stores[0] ? {
          id: data.data.stores[0].id,
          name: data.data.stores[0].businessName,
          city: data.data.stores[0].city,
          state: data.data.stores[0].state,
          productCount: data.data.stores[0].productCount,
          isFeatured: data.data.stores[0].isFeatured
        } : 'No stores'
      });

      // Store the fetched stores
      setStores(data.data.stores.map((store: any) => ({
        id: store.id,
        name: store.businessName,
        slug: store.slug || store.id, // Use id as fallback for slug
        description: store.description || null, // Could be generated from other fields
        address: store.address,
        city: store.city,
        state: store.state,
        zipCode: store.postalCode,
        country: 'US', // Default country
        logoUrl: store.logoUrl,
        ratingAvg: store.ratingAvg,
        ratingCount: store.ratingCount,
        productCount: parseInt(store.productCount) || 0,
        isFeatured: store.isFeatured,
        distance: null, // Could be calculated if needed
        createdAt: store.createdAt,
        // Additional fields from MV for complete showcase
        tenantId: store.tenantId,
        phone: store.phone,
        email: store.email,
        website: store.website,
        primaryCategory: store.primaryCategory,
        subscriptionTier: store.subscriptionTier,
        useCustomWebsite: store.useCustomWebsite,
        businessHours: store.businessHours,
        directoryPublished: store.directoryPublished,
        updatedAt: store.updatedAt
      })));

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Update metrics for cache miss
      setLocalMetrics(prev => ({
        ...prev,
        totalRequests: prev.totalRequests + 1,
        cacheMisses: prev.cacheMisses + 1,
        averageResponseTime: (prev.averageResponseTime * prev.totalRequests + responseTime) / (prev.totalRequests + 1),
      }));

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch featured stores');
      console.error('[useFeaturedStores] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [limit, location, cacheTTL]);

  const refetch = useCallback(() => {
    return fetchFeaturedStores();
  }, [fetchFeaturedStores]);

  const getStoreBySlug = useCallback((slug: string): Store | undefined => {
    return stores.find((store: Store) => store.slug === slug);
  }, [stores]);

  const getStoresByLocation = useCallback((
    lat: number,
    lng: number,
    radius: number = 50
  ): Store[] => {
    // Simplified location filtering - in real implementation would use geolocation
    return stores.filter((store: Store) => store.city && store.state);
  }, [stores]);

  // Clear cache method for testing
  const clearCache = useCallback(async () => {
    try {
      await cacheManager.clear();
      console.log('[useFeaturedStores] Cache cleared');
    } catch (error) {
      console.warn('[useFeaturedStores] Failed to clear cache:', error);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchFeaturedStores();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    stores,
    loading,
    error,
    refetch,
    getStoreBySlug,
    getStoresByLocation,
    clearCache,
    metrics: localMetrics,
  };
};
