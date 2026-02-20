/**
 * useShopLocations Hook
 * Fetches available shop locations with caching support
 * Phase 5 UI Implementation
 */

'use client';

import { useState, useEffect } from 'react';
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

interface ShopLocation {
  city: string;
  state: string;
  zip: string;
}

interface UseShopLocationsResult {
  locations: ShopLocation[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Location Cache Singleton
 * Extends PublicApiSingleton for built-in cache management
 */
class LocationCache extends PublicApiSingleton {
  private static instance: LocationCache;
  private pendingRequest: Promise<ShopLocation[]> | null = null;

  private constructor() {
    super('shop-locations-singleton');
    
    // Set cache TTL to 1 hour for location data
    this.cacheTTL = 60 * 60 * 1000;
  }

  static getInstance(): LocationCache {
    if (!LocationCache.instance) {
      LocationCache.instance = new LocationCache();
    }
    return LocationCache.instance;
  }

  /**
   * Get locations with caching via UniversalSingleton
   */
  async getLocations(): Promise<ShopLocation[]> {
    const cacheKey = 'shop-locations';

    // Check cache first using UniversalSingleton's cache management
    const cached = await this.getFromCache<ShopLocation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    // Check if request is already pending (deduplication)
    if (this.pendingRequest) {
      console.log('[LocationCache] Request pending, waiting...');
      return this.pendingRequest;
    }

    console.log('[LocationCache] Fetching locations from API');

    // Create and store the pending request
    this.pendingRequest = this.fetchLocations()
      .then(async (locations) => {
        // Store in cache using PublicApiSingleton's cache management
        await this.setCache(cacheKey, locations);
        return locations;
      })
      .finally(() => {
        this.pendingRequest = null;
      });

    return this.pendingRequest;
  }

  /**
   * Fetch locations from API using PublicApiSingleton's makeDefaultRequest
   */
  private async fetchLocations(): Promise<ShopLocation[]> {
    try {
      const response = await this.makeDefaultRequest<ShopLocation[]>(
        `/api/public/shops/locations`,
        {}
      );

      return response.data || [];
    } catch (error) {
      console.error('[LocationCache] Error fetching locations:', error);
      throw error;
    }
  }

  /**
   * Clear cache using UniversalSingleton's cache management
   */
  async clearLocationCache(): Promise<void> {
    await this.clearCache('shop-locations');
  }

  /**
   * Get cache stats from UniversalSingleton
   */
  getLocationStats() {
    return this.getMetrics();
  }
}

/**
 * Hook for fetching shop locations
 */
export function useShopLocations(): UseShopLocationsResult {
  const [locations, setLocations] = useState<ShopLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const locationCache = LocationCache.getInstance();

  const fetchLocations = async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await locationCache.getLocations();
      setLocations(data);

      // Log cache stats using UniversalSingleton metrics
      const stats = locationCache.getLocationStats();
      console.log('[SHOP LOCATIONS] Loaded', data.length, 'locations', stats);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch locations';
      setError(errorMessage);
      console.error('[SHOP LOCATIONS] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const refetch = async () => {
    await locationCache.clearLocationCache();
    fetchLocations();
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  return {
    locations,
    loading,
    error,
    refetch
  };
}

export default useShopLocations;
