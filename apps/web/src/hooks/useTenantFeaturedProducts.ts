/**
 * React Hook for Tenant Featured Products Singleton
 * 
 * Provides a clean React interface for the TenantFeaturedProductsSingleton.
 * Handles subscription management and provides memoized state values.
 * Integrates with existing ProductSingleton for universal product data.
 */

import { useEffect, useMemo, useCallback, useState } from 'react';
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
  
  // Pre-calculated data for each type
  featuredProductsByType: Record<string, FeaturedProduct[]>;
  activeFeaturedByType: Record<string, FeaturedProduct[]>;
  
  // Pagination helpers
  paginatedInStock: FeaturedProduct[];
  paginatedOutOfStock: FeaturedProduct[];
  totalPages: number;
  totalAvailableProducts: number;
}

export function useTenantFeaturedProducts(
  tenantId: string,
  productSingleton?: any, // ProductSingleton integration
  options: UseTenantFeaturedProductsOptions = {}
): UseTenantFeaturedProductsReturn {
  const { autoInitialize = true, autoDestroy = false } = options;

  // Helper function for checking expiration status
  const getExpirationStatus = (product: FeaturedProduct) => {
    if (!product.featured_expires_at) {
      return { isExpired: false, daysRemaining: null, status: 'permanent' };
    }

    const now = new Date();
    const expirationDate = new Date(product.featured_expires_at);
    const diffTime = expirationDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      isExpired: diffDays < 0,
      daysRemaining: diffDays,
      status: diffDays < 0 ? 'expired' : diffDays <= 7 ? 'expiring' : 'active'
    };
  };

  // Get singleton instance
  const singleton = useMemo(() => {
    const instance = getTenantFeaturedProductsSingleton(tenantId);
    
    // Integrate with ProductSingleton if provided
    if (productSingleton && instance.setProductProvider) {
      instance.setProductProvider(productSingleton);
    }
    
    return instance;
  }, [tenantId, productSingleton]);

  // Subscribe to state changes with proper reactivity
  const [state, setState] = useState(() => singleton.getState());
  
  // Subscribe to singleton state changes
  useEffect(() => {
    const unsubscribe = singleton.subscribe(() => {
      const newState = singleton.getState();
      setState(newState);
    });

    return unsubscribe;
  }, [singleton]);

  // Memoized computed values
  const currentFeatured = useMemo(() => {
    // Access through state to ensure reactivity
    const featuredProducts = state.featuredProducts[state.selectedType] || [];
    return featuredProducts;
  }, [state.featuredProducts, state.selectedType]);
  
  const activeFeatured = useMemo(() => {
    // Return the current featured products (already filtered by type in currentFeatured)
    return currentFeatured;
  }, [currentFeatured]);
  
  const expiredFeatured = useMemo(() => {
    return currentFeatured.filter(product => {
      const status = getExpirationStatus(product);
      return status.isExpired;
    });
  }, [currentFeatured]);
  
  const filteredAvailable = useMemo(() => {
    // Access through state to ensure reactivity
    return state.availableProducts.filter(p =>
      p.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(state.searchQuery.toLowerCase())
    );
  }, [state.availableProducts, state.searchQuery]);

  // Pagination logic - simplified for better separation
  const itemsPerPage = 12;

  const inStockProducts = useMemo(() => {
    const inStock = filteredAvailable.filter(product => !singleton.isOutOfStock(product));
    console.log('useTenantFeaturedProducts: In-stock filtering', {
      totalAvailable: filteredAvailable.length,
      inStockCount: inStock.length,
      outOfStockCount: filteredAvailable.length - inStock.length,
      sampleOutOfStock: filteredAvailable.filter(product => singleton.isOutOfStock(product)).slice(0, 2).map(p => ({ id: p.id, name: p.name, stock: p.stock, availability: p.availability }))
    });
    return inStock;
  }, [filteredAvailable]);
  
  const outOfStockProducts = useMemo(() => {
    const outOfStock = filteredAvailable.filter(product => singleton.isOutOfStock(product));
    console.log('useTenantFeaturedProducts: Out-of-stock filtering', {
      totalAvailable: filteredAvailable.length,
      outOfStockCount: outOfStock.length,
      sampleOutOfStock: outOfStock.slice(0, 2).map(p => ({ id: p.id, name: p.name, stock: p.stock, availability: p.availability }))
    });
    return outOfStock;
  }, [filteredAvailable]);

  const paginatedInStock = useMemo(() => {
    // Show all in-stock products (no pagination for now to ensure visibility)
    return inStockProducts;
  }, [inStockProducts]);

  const paginatedOutOfStock = useMemo(() => {
    // Show all out-of-stock products (no pagination for now to ensure visibility)
    return outOfStockProducts;
  }, [outOfStockProducts]);

  const totalPages = useMemo(() => {
    const totalProducts = inStockProducts.length + outOfStockProducts.length;
    return Math.ceil(totalProducts / itemsPerPage);
  }, [inStockProducts, outOfStockProducts]);

  const totalAvailableProducts = useMemo(() => {
    return inStockProducts.length + outOfStockProducts.length;
  }, [inStockProducts, outOfStockProducts]);

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
    return Promise.all([
      singleton.fetchFeaturedProducts(),
      singleton.fetchAvailableProducts()
    ]).then(() => {
      // Return void
    });
  }, [singleton]);

  const isOutOfStock = useCallback((product: FeaturedProduct) => {
    return singleton.isOutOfStock(product);
  }, [singleton]);

  // Auto-initialize
  useEffect(() => {
    if (autoInitialize && singleton) {
      try {
        singleton.forceRefresh().catch(error => {
          console.error('Failed to initialize singleton:', error);
        });
      } catch (error) {
        console.error('Error during manual initialization:', error);
      }
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

  // Pre-calculated data for each type
  const featuredProductsByType = useMemo(() => {
    const byType: Record<string, FeaturedProduct[]> = {};
    state.featuredTypes.forEach(type => {
      byType[type.id] = state.featuredProducts[type.id] || [];
    });
    return byType;
  }, [state.featuredProducts, state.featuredTypes]);

  const activeFeaturedByType = useMemo(() => {
    const byType: Record<string, FeaturedProduct[]> = {};
    Object.entries(featuredProductsByType).forEach(([typeId, products]) => {
      byType[typeId] = products.filter(product => product.is_active !== false);
    });
    return byType;
  }, [featuredProductsByType]);

  return {
    // State
    ...state,
    
    // Computed values
    currentFeatured,
    activeFeatured,
    expiredFeatured,
    filteredAvailable,
    featuredProductsByType,
    activeFeaturedByType,
    paginatedInStock,
    paginatedOutOfStock,
    totalPages,
    totalAvailableProducts,
    
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
