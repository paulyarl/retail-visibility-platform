/**
 * React Hooks for Auth-Aware Singleton Usage
 * 
 * Provides hooks that automatically use current user for encryption
 * Follows behavior tracking pattern for user identification
 */

import { useCallback, useMemo } from 'react';
import { FeaturedProductsSingleton, FeaturedProductsData } from '@/providers/data/FeaturedProductsSingleton';
import StorePublishSingleton, { StorePublishData, StorePublishOptions } from '@/providers/data/StorePublishSingleton';
import { AutoUserCacheOptions } from '@/utils/userIdentification';

/**
 * Hook for Featured Products with automatic user-based encryption
 */
export function useFeaturedProductsSingleton() {
  const singleton = useMemo(() => {
    return FeaturedProductsSingleton.getInstance();
  }, []);

  const getAllFeaturedProducts = useCallback(async (
    tenantId: string, 
    limit: number = 20, 
    options?: AutoUserCacheOptions
  ): Promise<FeaturedProductsData> => {
    return singleton.getAllFeaturedProducts(tenantId, limit, options);
  }, [singleton]);

  return {
    singleton,
    getAllFeaturedProducts,
    // Other methods can be added here as needed
    getFeaturedProductsByType: singleton.getFeaturedProductsByType.bind(singleton),
    getFeaturedProductsAsUniversal: singleton.getFeaturedProductsAsUniversal.bind(singleton),
    invalidateCache: singleton.invalidateCache.bind(singleton),
    clearCache: singleton.clearCache.bind(singleton)
  };
}

/**
 * Hook for Store Publish with automatic user-based encryption
 */
export function useStorePublishSingleton() {
  const singleton = useMemo(() => {
    return StorePublishSingleton.getInstance();
  }, []);

  const getPublishedStores = useCallback(async (
    options: StorePublishOptions = {},
    cacheOptions?: AutoUserCacheOptions
  ): Promise<StorePublishData> => {
    return singleton.getPublishedStores(options, cacheOptions);
  }, [singleton]);

  return {
    singleton,
    getPublishedStores,
    // Other methods can be added here as needed
    getPublishedStore: singleton.getPublishedStore.bind(singleton),
    getDirectoryCategories: singleton.getDirectoryCategories.bind(singleton),
    publishStore: singleton.publishStore.bind(singleton),
    unpublishStore: singleton.unpublishStore.bind(singleton),
    updateStore: singleton.updatePublishedStore.bind(singleton),
    validatePublishingRequirements: singleton.validatePublishingRequirements.bind(singleton),
    invalidateCache: singleton.invalidateCache.bind(singleton),
    clearCache: singleton.invalidateCache.bind(singleton)
  };
}

/**
 * Generic hook for any singleton with auth-aware encryption
 */
export function useAuthAwareSingleton<T extends any>(
  singletonFactory: () => T,
  methods: (instance: T) => Record<string, any>
) {
  const singleton = useMemo(() => {
    return singletonFactory();
  }, [singletonFactory]);

  const authAwareMethods = useMemo(() => {
    return methods(singleton);
  }, [singleton, methods]);

  return {
    singleton,
    ...authAwareMethods
  };
}
