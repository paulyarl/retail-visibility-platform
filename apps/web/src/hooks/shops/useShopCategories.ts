'use client';

import { useState, useEffect } from 'react';
import { UniversalSingleton } from '@/providers/base/UniversalSingleton';
import { shopsService } from '@/services/ShopsService';

interface ShopCategory {
  id: string;
  name: string;
  slug: string;
  count?: number;
}

/**
 * Shop Categories Cache Singleton
 * Extends UniversalSingleton for built-in cache management
 * Manages caching of shop categories data to avoid duplicate API calls
 */
class ShopCategoriesCache extends UniversalSingleton {
  private static instance: ShopCategoriesCache;

  private constructor() {
    super('shop-categories-cache-singleton', {
      encrypt: false // Category data is public
    });
    
    // Set cache TTL to 30 minutes for category data (changes infrequently)
    this.cacheTTL = 30 * 60 * 1000;
    
    // Attach emergency bust controls
    ShopCategoriesCache.attachToWindow();
  }

  public static getInstance(): ShopCategoriesCache {
    if (!ShopCategoriesCache.instance) {
      ShopCategoriesCache.instance = new ShopCategoriesCache();
    }
    return ShopCategoriesCache.instance;
  }

  /**
   * Get shop categories data with caching via UniversalSingleton and ShopsService
   */
  async getShopCategories(): Promise<ShopCategory[]> {
    const cacheKey = 'shop-categories:all';

    // Check cache first using UniversalSingleton's cache management
    /* const cached = await this.getFromCache<ShopCategory[]>(cacheKey);
    if (cached) {
      //console.log('[ShopCategoriesCache] Cache hit for shop categories');
      return cached;
    } */

    //console.log('[ShopCategoriesCache] Fetching shop categories from service');

    // Fetch from service (includes built-in caching)
    const response = await shopsService.getShopCategories();
    
    // Store in cache using UniversalSingleton's cache management
    /* await this.setCache(cacheKey, categories);
    // Also store in in-memory cache with TTL
    this.setCachedData(cacheKey, categories, this.cacheTTL); */
    
    return response.categories;
  }

  /**
   * Clear cache for shop categories using UniversalSingleton
   */
  async clearCache(): Promise<void> {
    await this.clearCache();
  }

  /**
   * Get cache statistics from UniversalSingleton
   */
  getCacheStats(): { size: number } & ReturnType<typeof this.getMetrics> {
    return {
      ...this.getMetrics(),
      size: this.getMetrics().cacheSize
    };
  }
}

/**
 * Hook to fetch shop categories from mv_global_discovery using cached singleton
 * 
 * Provides a list of unique shop categories with product counts
 * Used for category dropdowns and filters
 * 
 * Features:
 * - 30-minute cache TTL (categories change infrequently)
 * - Singleton pattern for consistent caching
 * - Error handling and loading states
 * - Cache busting capabilities
 */
export function useShopCategories() {
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get ShopCategoriesCache singleton instance
  const categoriesCache = ShopCategoriesCache.getInstance();

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      // Use cached singleton for data fetching
      const fetchedCategories = await categoriesCache.getShopCategories();
      setCategories(fetchedCategories);
      
    } catch (err) {
      console.error('[useShopCategories] Error fetching categories:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [categoriesCache]);

  const refetch = () => {
    // Clear cache and refetch
    categoriesCache.clearCache();
    setCategories([]);
    fetchCategories();
  };

  const getCacheStats = () => {
    return categoriesCache.getCacheStats();
  };

  return {
    categories,
    loading,
    error,
    refetch,
    getCacheStats
  };
}

// Export ShopCategoriesCache for use in troubleshooting components
export { ShopCategoriesCache };
