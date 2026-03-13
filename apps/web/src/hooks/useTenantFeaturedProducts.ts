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
  context?: 'storefront' | 'directory' | 'admin'; // Context for type filtering
}

interface UseTenantFeaturedProductsReturn extends FeaturedProductsState {
  // Actions
  featureProduct: (productId: string) => Promise<void>;
  featureProductInDirectory: (productId: string) => Promise<void>;
  unfeatureProduct: (productId: string) => Promise<void>;
  toggleProductActive: (productId: string, isActive: boolean) => Promise<void>;
  updateProductExpiration: (productId: string, expirationDate: string) => Promise<void>;
  setSelectedType: (typeId: string) => void;
  setSearchQuery: (query: string) => void;
  setAvailablePage: (page: number) => void;
  setOutOfStockPage: (page: number) => void;
  setEditingExpiration: (productId: string | null, date?: string) => void;
  forceRefresh: () => Promise<void>;
  
  // Computed values
  currentFeatured: FeaturedProduct[];
  activeFeatured: FeaturedProduct[];
  expiredFeatured: FeaturedProduct[];
  filteredAvailable: FeaturedProduct[];
  isOutOfStock: (product: FeaturedProduct) => boolean;
  
  // Singleton access for advanced operations
  singleton: ReturnType<typeof getTenantFeaturedProductsSingleton>;
  
  // Pre-calculated data for each type
  featuredProductsByType: Record<string, FeaturedProduct[]>;
  activeFeaturedByType: Record<string, FeaturedProduct[]>;
  
  // Pagination helpers
  paginatedInStock: FeaturedProduct[];
  paginatedOutOfStock: FeaturedProduct[];
  totalPages: number;
  outOfStockTotalPages: number;
  totalAvailableProducts: number;
}

export function useTenantFeaturedProducts(
  tenantId: string,
  productSingleton?: any, // ProductSingleton integration
  options: UseTenantFeaturedProductsOptions = {}
): UseTenantFeaturedProductsReturn {
  const { autoInitialize = true, autoDestroy = false, context = 'storefront' } = options;

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
      // console.log(`[useTenantFeaturedProducts] State update received, featured products count:`, 
      //   Object.values(newState.featuredProducts || {}).reduce((sum, arr) => sum + arr.length, 0));
      setState(newState);
    });

    return unsubscribe;
  }, [singleton]);

  // Get featured types based on context
  const contextFeaturedTypes = useMemo(() => {
    const types = context === 'directory' 
      ? singleton.getDirectoryOnlyTypes()
      : context === 'admin'
      ? singleton.getAllTypes()
      : singleton.getStorefrontTypes();
    
      // console.log(`[useTenantFeaturedProducts] Context: ${context}`);
      // console.log(`[useTenantFeaturedProducts] Available types:`, types.map(t => t.id));
      // console.log(`[useTenantFeaturedProducts] Selected type: ${state.selectedType}`);
    
    return types;
  }, [context, singleton, state.selectedType, state.featuredLimits]);

  // Set context-appropriate default selected type
  useEffect(() => {
    if (context === 'directory' && contextFeaturedTypes.length > 0) {
      const storeSelectionType = contextFeaturedTypes.find(t => t.id === 'store_selection');
      // Set to store_selection if either no type is selected OR current type is not valid for directory context
      if (storeSelectionType && (!state.selectedType || !contextFeaturedTypes.find(t => t.id === state.selectedType))) {
        singleton.setSelectedType('store_selection');
      }
    } else if (context === 'admin' && contextFeaturedTypes.length > 0) {
      const firstType = contextFeaturedTypes[0];
      // Set to first available type if current type is not valid for admin context
      if (firstType && (!state.selectedType || !contextFeaturedTypes.find(t => t.id === state.selectedType))) {
        singleton.setSelectedType(firstType.id);
      }
    } else if (context === 'storefront' && contextFeaturedTypes.length > 0) {
      const newArrivalType = contextFeaturedTypes.find(t => t.id === 'new_arrival');
      // Set to new_arrival if current type is not valid for storefront context
      if (newArrivalType && (!state.selectedType || !contextFeaturedTypes.find(t => t.id === state.selectedType))) {
        singleton.setSelectedType('new_arrival');
      }
    }
  }, [context, contextFeaturedTypes, singleton, state.selectedType]);

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
  const outOfStockItemsPerPage = 3; // Smaller page size for out-of-stock to enable pagination

  const inStockProducts = useMemo(() => {
    const inStock = filteredAvailable.filter(product => !singleton.isOutOfStock(product));
    /* console.log('useTenantFeaturedProducts: In-stock filtering', {
      totalAvailable: filteredAvailable.length,
      inStockCount: inStock.length,
      outOfStockCount: filteredAvailable.length - inStock.length,
      sampleOutOfStock: filteredAvailable.filter(product => singleton.isOutOfStock(product)).slice(0, 2).map(p => ({ id: p.id, name: p.name, stock: p.stock, availability: p.availability }))
    }); */
    return inStock;
  }, [filteredAvailable]);
  
  const outOfStockProducts = useMemo(() => {
    // Access out-of-stock products through the state
    return state.outOfStockProducts || [];
  }, [state.outOfStockProducts]);

  /* console.log('useTenantFeaturedProducts: Out-of-stock products from singleton', {
    totalAvailable: filteredAvailable.length,
    outOfStockCount: outOfStockProducts.length,
    sampleOutOfStock: outOfStockProducts.slice(0, 2).map(p => ({ id: p.id, name: p.name, stock: p.stock, availability: p.availability }))
  }); */

  const paginatedInStock = useMemo(() => {
    // Apply pagination to in-stock products
    const startIndex = (state.availablePage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return inStockProducts.slice(startIndex, endIndex);
  }, [inStockProducts, state.availablePage]);

  const paginatedOutOfStock = useMemo(() => {
    // Apply pagination to out-of-stock products with smaller page size
    const startIndex = (state.outOfStockPage - 1) * outOfStockItemsPerPage;
    const endIndex = startIndex + outOfStockItemsPerPage;
    return outOfStockProducts.slice(startIndex, endIndex);
  }, [outOfStockProducts, state.outOfStockPage]);

  const totalPages = useMemo(() => {
    // Only paginate in-stock products
    return Math.ceil(inStockProducts.length / itemsPerPage);
  }, [inStockProducts]);

  const outOfStockTotalPages = useMemo(() => {
    // Calculate pages for out-of-stock products with smaller page size
    return Math.ceil(outOfStockProducts.length / outOfStockItemsPerPage);
  }, [outOfStockProducts]);

  const totalAvailableProducts = useMemo(() => {
    // Only count in-stock products for pagination
    return inStockProducts.length;
  }, [inStockProducts]);

  // Action callbacks
  const featureProduct = useCallback((productId: string) => {
    return singleton.featureProduct(productId);
  }, [singleton]);

  const featureProductInDirectory = useCallback((productId: string) => {
    return singleton.featureProductInDirectory(productId);
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
  }, []);

  const setOutOfStockPage = useCallback((page: number) => {
    singleton.setOutOfStockPage(page);
  }, []);

  const setEditingExpiration = useCallback((productId: string | null, date?: string) => {
    singleton.setEditingExpiration(productId, date);
  }, []);

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
    contextFeaturedTypes.forEach(type => {
      byType[type.id] = state.featuredProducts[type.id] || [];
    });
    return byType;
  }, [state.featuredProducts, contextFeaturedTypes]);

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
    
    // Override featuredTypes with context-specific types
    featuredTypes: contextFeaturedTypes,
    
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
    outOfStockTotalPages,
    totalAvailableProducts,
    
    // Actions
    featureProduct,
    featureProductInDirectory,
    unfeatureProduct,
    toggleProductActive,
    updateProductExpiration,
    setSelectedType,
    setSearchQuery,
    setAvailablePage,
    setOutOfStockPage,
    setEditingExpiration,
    forceRefresh,
    
    // Singleton access for advanced operations
    singleton,
    
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
