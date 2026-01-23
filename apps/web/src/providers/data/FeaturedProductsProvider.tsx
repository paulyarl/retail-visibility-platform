"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { featuredProductsSingleton, FeaturedProduct, FeaturedType } from './FeaturedProductsSingleton';

// ====================
// CONTEXT TYPES
// ====================

interface FeaturedProductsContextType {
  // Data
  buckets: any | null;
  products: FeaturedProduct[];
  loading: boolean;
  error: string | null;
  
  // Actions
  refresh: () => Promise<void>;
  refetch: () => Promise<void>;
  clearCache: () => void;
  
  // Methods
  getProductsByType: (type: FeaturedType) => Promise<FeaturedProduct[]>;
  getStats: () => Promise<Record<string, number>>;
}

// ====================
// CONTEXT
// ====================

const FeaturedProductsContext = createContext<FeaturedProductsContextType | null>(null);

// ====================
// PROVIDER
// ====================

interface FeaturedProductsProviderProps {
  children: ReactNode;
  tenantId: string;
  limit?: number;
  autoLoad?: boolean;
}

export function FeaturedProductsProvider({ 
  children, 
  tenantId, 
  limit = 20,
  autoLoad = true 
}: FeaturedProductsProviderProps) {
  const [buckets, setBuckets] = useState<any | null>(null);
  const [products, setProducts] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load featured products data
  const loadFeaturedProducts = async () => {
    if (!tenantId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const featuredData = await featuredProductsSingleton.getAllFeaturedProducts(tenantId, limit);
      setBuckets(featuredData);
      
      // Flatten all products from all buckets (with null check)
      const allProducts: FeaturedProduct[] = featuredData?.buckets?.flatMap(bucket => bucket.products || []) || [];
      setProducts(allProducts);
      
    } catch (err) {
      console.error('[FeaturedProductsProvider] Failed to load featured products:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setBuckets(null);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  // Refresh data
  const refresh = async () => {
    if (!tenantId) return;
    
    try {
      setLoading(true);
      await featuredProductsSingleton.refreshFeaturedProducts(tenantId, limit);
      await loadFeaturedProducts();
    } catch (err) {
      console.error('[FeaturedProductsProvider] Failed to refresh featured products:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Refetch (alias for loadFeaturedProducts)
  const refetch = loadFeaturedProducts;

  // Clear cache
  const clearCache = () => {
    if (tenantId) {
      featuredProductsSingleton.clearTenantFeaturedProducts();
      setBuckets(null);
      setProducts([]);
    }
  };

  // Get products by type
  const getProductsByType = async (type: FeaturedType): Promise<FeaturedProduct[]> => {
    if (!tenantId) return [];
    return await featuredProductsSingleton.getFeaturedProductsByType(tenantId, type, 20);
  };

  // Get bucket statistics
  const getStats = async (): Promise<Record<string, number>> => {
    if (!tenantId) return {};
    return featuredProductsSingleton.getBucketStats();
  };

  // Auto-load on mount
  useEffect(() => {
    if (autoLoad && tenantId) {
      loadFeaturedProducts();
    }
  }, [tenantId, limit, autoLoad]);

  const value: FeaturedProductsContextType = {
    // Data
    buckets,
    products,
    loading,
    error,
    
    // Actions
    refresh,
    refetch,
    clearCache,
    
    // Methods
    getProductsByType,
    getStats,
  };

  return (
    <FeaturedProductsContext.Provider value={value}>
      {children}
    </FeaturedProductsContext.Provider>
  );
}

// ====================
// HOOK
// ====================

export function useFeaturedProducts() {
  const context = useContext(FeaturedProductsContext);
  if (!context) {
    throw new Error('useFeaturedProducts must be used within FeaturedProductsProvider');
  }
  return context;
}

// ====================
// CONVENIENCE HOOKS
// ====================

/**
 * Hook for getting featured products by type
 */
export function useFeaturedProductsByType(type: FeaturedType) {
  const { getProductsByType, loading, error } = useFeaturedProducts();
  const [products, setProducts] = useState<FeaturedProduct[]>([]);

  useEffect(() => {
    const loadProductsByType = async () => {
      const productsByType = await getProductsByType(type);
      setProducts(productsByType);
    };
    
    loadProductsByType();
  }, [type, getProductsByType]);

  return {
    products,
    loading,
    error
  };
}

/**
 * Hook for getting bucket statistics
 */
export function useFeaturedProductsStats() {
  const { getStats, loading, error } = useFeaturedProducts();
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadStats = async () => {
      try {
        const bucketStats = await getStats();
        setStats(bucketStats);
      } catch (err) {
        console.error('Failed to load featured products stats:', err);
      }
    };
    
    loadStats();
  }, [getStats]);

  return {
    stats,
    loading,
    error
  };
}

export default FeaturedProductsProvider;
