/**
 * React Hook for Tenant Featured Products Singleton
 * 
 * Provides a clean React interface for the TenantFeaturedProductsSingleton.
 * Handles subscription management and provides memoized state values.
 * Integrates with existing ProductSingleton for universal product data.
 */

import { useEffect, useMemo, useCallback } from 'react';
import { 
  getTenantFeaturedProductsSingleton,
  destroyTenantFeaturedProductsSingleton,
  type FeaturedProductsState,
  type FeaturedProduct,
  type FeaturedType
} from '@/lib/singletons/TenantFeaturedProductsSingleton';

// Import existing ProductSingleton
import { PublicProduct } from '@/providers/data/ProductSingleton';

interface UseTenantFeaturedProductsOptions {
  autoInitialize?: boolean;
  autoDestroy?: boolean;
}

interface UseTenantFeaturedProductsReturn extends FeaturedProductsState {
  // Actions
  featureProduct: (productId: string) => Promise<void>;
  unfeatureProduct: (productId: string) => Promise<void>;
  toggleProductActive: (productId: string, isActive: boolean) => Promise<void>;
  updateProductExpiration: (productId: string, expirationDate: string) => Promise<void>;
  setSelectedType: (typeId: string) => void;
  setSearchQuery: (query: string) => void;
  setAvailablePage: (page: number) => void;
  setEditingExpiration: (productId: string | null, date?: string) => void;
  forceRefresh: () => Promise<void>;
  
  // Computed values
  currentFeatured: FeaturedProduct[];
  activeFeatured: FeaturedProduct[];
  expiredFeatured: FeaturedProduct[];
  filteredAvailable: FeaturedProduct[];
  isOutOfStock: (product: FeaturedProduct) => boolean;
  
  // Pagination helpers
  paginatedInStock: FeaturedProduct[];
  paginatedOutOfStock: FeaturedProduct[];
  totalPages: number;
  startIndex: number;
  endIndex: number;
}

export function useTenantFeaturedProducts(
  tenantId: string,
  productSingleton?: any, // ProductSingleton integration
  options: UseTenantFeaturedProductsOptions = {}
): UseTenantFeaturedProductsReturn {
  const { autoInitialize = true, autoDestroy = false } = options;

  // Get singleton instance
  const singleton = useMemo(() => {
    const instance = getTenantFeaturedProductsSingleton(tenantId);
    
    // Integrate with ProductSingleton if provided
    if (productSingleton && instance.setProductProvider) {
      instance.setProductProvider(productSingleton);
    }
    
    return instance;
  }, [tenantId, productSingleton]);

  // Subscribe to state changes
  const state = singleton.getState();

  // Memoized computed values
  const currentFeatured = useMemo(() => singleton.currentFeatured, [state.featuredProducts, state.selectedType]);
  const activeFeatured = useMemo(() => singleton.activeFeatured, [currentFeatured]);
  const expiredFeatured = useMemo(() => singleton.expiredFeatured, [currentFeatured]);
  const filteredAvailable = useMemo(() => singleton.filteredAvailable, [state.availableProducts, state.searchQuery]);

  // Pagination logic (same as in original component)
  const itemsPerPage = 12;
  const inStockPageSize = Math.ceil(itemsPerPage * 0.7);
  const outOfStockPageSize = Math.ceil(itemsPerPage * 0.3);

  const inStockProducts = useMemo(() => 
    filteredAvailable.filter(product => !singleton.isOutOfStock(product)), 
    [filteredAvailable]
  );
  const outOfStockProducts = useMemo(() => 
    filteredAvailable.filter(product => singleton.isOutOfStock(product)), 
    [filteredAvailable]
  );

  const startIndex = useMemo(() => (state.availablePage - 1) * itemsPerPage, [state.availablePage]);
  const endIndex = useMemo(() => startIndex + itemsPerPage, [startIndex]);

  const paginatedInStock = useMemo(() => {
    const inStockStartIndex = (state.availablePage - 1) * inStockPageSize;
    const inStockEndIndex = inStockStartIndex + inStockPageSize;
    return inStockProducts.slice(inStockStartIndex, inStockEndIndex);
  }, [inStockProducts, state.availablePage, inStockPageSize]);

  const paginatedOutOfStock = useMemo(() => {
    const outOfStockStartIndex = (state.availablePage - 1) * outOfStockPageSize;
    const outOfStockEndIndex = outOfStockStartIndex + outOfStockPageSize;
    return outOfStockProducts.slice(outOfStockStartIndex, outOfStockEndIndex);
  }, [outOfStockProducts, state.availablePage, outOfStockPageSize]);

  const totalPages = useMemo(() => 
    Math.ceil(Math.max(inStockProducts.length, outOfStockProducts.length) / Math.max(inStockPageSize, outOfStockPageSize)),
    [inStockProducts.length, outOfStockProducts.length, inStockPageSize, outOfStockPageSize]
  );

  // Action callbacks
  const featureProduct = useCallback((productId: string) => {
    return singleton.featureProduct(productId);
  }, [singleton]);

  const unfeatureProduct = useCallback((productId: string) => {
    return singleton.unfeatureProduct(productId);
  }, [singleton]);

  const toggleProductActive = useCallback((productId: string, isActive: boolean) => {
    return singleton.toggleProductActive(productId, isActive);
  }, [singleton]);

  const updateProductExpiration = useCallback((productId: string, expirationDate: string) => {
    return singleton.updateProductExpiration(productId, expirationDate);
  }, [singleton]);

  const setSelectedType = useCallback((typeId: string) => {
    singleton.setSelectedType(typeId);
  }, [singleton]);

  const setSearchQuery = useCallback((query: string) => {
    singleton.setSearchQuery(query);
  }, [singleton]);

  const setAvailablePage = useCallback((page: number) => {
    singleton.setAvailablePage(page);
  }, [singleton]);

  const setEditingExpiration = useCallback((productId: string | null, date?: string) => {
    singleton.setEditingExpiration(productId, date);
  }, [singleton]);

  const forceRefresh = useCallback(() => {
    return singleton.forceRefresh();
  }, [singleton]);

  const isOutOfStock = useCallback((product: FeaturedProduct) => {
    return singleton.isOutOfStock(product);
  }, [singleton]);

  // Auto-initialize
  useEffect(() => {
    if (autoInitialize) {
      // Singleton auto-initializes on first subscriber
    }
  }, [autoInitialize, singleton]);

  // Auto-cleanup
  useEffect(() => {
    return () => {
      if (autoDestroy) {
        destroyTenantFeaturedProductsSingleton(tenantId);
      }
    };
  }, [autoDestroy, tenantId]);

  return {
    // State
    ...state,
    
    // Computed values
    currentFeatured,
    activeFeatured,
    expiredFeatured,
    filteredAvailable,
    paginatedInStock,
    paginatedOutOfStock,
    totalPages,
    startIndex,
    endIndex,
    
    // Actions
    featureProduct,
    unfeatureProduct,
    toggleProductActive,
    updateProductExpiration,
    setSelectedType,
    setSearchQuery,
    setAvailablePage,
    setEditingExpiration,
    forceRefresh,
    
    // Helpers
    isOutOfStock
  };
}

// Export a hook for manual singleton management
export function useTenantFeaturedProductsManager() {
  return {
    getSingleton: getTenantFeaturedProductsSingleton,
    destroySingleton: destroyTenantFeaturedProductsSingleton
  };
}
