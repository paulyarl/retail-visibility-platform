import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for category-based product discovery
 * 
 * Uses the new scope-aware API to discover products by category
 * Supports both product categories and shop categories (GBP-based)
 */
export interface CategoryDiscoveryOptions {
  // Product category filters
  productName?: string;
  productId?: string;
  googleProductId?: string;
  
  // Shop category filters (GBP-based)
  shopCategoryName?: string;
  shopCategoryId?: string;
  shopGoogleCategoryId?: string;
  
  // Category type - specifies which category to use for filtering
  categoryType?: 'product' | 'shop' | 'both';
  
  bucketType?: 'random' | 'trending' | 'new' | 'sale' | 'seasonal' | 'staff' | 'selection';
  limit?: number;
  enabled?: boolean;
}

export interface CategoryDiscoveryResponse {
  products: any[];
  shops: any[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
  metrics?: {
    responseTime: number;
    productCount: number;
    shopCount: number;
  };
}

export function useCategoryDiscovery(options: CategoryDiscoveryOptions): CategoryDiscoveryResponse {
  const {
    productName,
    productId,
    googleProductId,
    shopCategoryName,
    shopCategoryId,
    shopGoogleCategoryId,
    categoryType = 'product',
    bucketType = 'trending',
    limit = 12,
    enabled = true
  } = options;

  const [products, setProducts] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{
    responseTime: number;
    productCount: number;
    shopCount: number;
  }>();

  const fetchCategoryDiscovery = useCallback(async () => {
    if (!enabled) return;
    
    // Validate that at least one category identifier is provided
    const hasProductCategory = productName || productId || googleProductId;
    const hasShopCategory = shopCategoryName || shopCategoryId || shopGoogleCategoryId;
    
    if (!hasProductCategory && !hasShopCategory) {
      setError('At least one category identifier (product or shop category) is required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const startTime = Date.now();
      
      // Build category query parameters
      const categoryParams = new URLSearchParams();
      
      // Product category parameters
      if (productName) categoryParams.append('category[productName]', productName);
      if (productId) categoryParams.append('category[productId]', productId);
      if (googleProductId) categoryParams.append('category[googleProductId]', googleProductId);
      
      // Shop category parameters (GBP-based)
      if (shopCategoryName) categoryParams.append('category[shopCategoryName]', shopCategoryName);
      if (shopCategoryId) categoryParams.append('category[shopCategoryId]', shopCategoryId);
      if (shopGoogleCategoryId) categoryParams.append('category[shopGoogleCategoryId]', shopGoogleCategoryId);
      
      // Category type
      categoryParams.append('category[categoryType]', categoryType);
      
      // Fetch products by category
      const productsResponse = await fetch(
        `/api/public/shops/discover/${bucketType}?scope=category&${categoryParams.toString()}&limit=${limit}`
      );
      
      if (!productsResponse.ok) {
        throw new Error(`Failed to fetch category products: ${productsResponse.statusText}`);
      }
      
      const productsData = await productsResponse.json();
      
      // Fetch trending shops by category
      const shopsResponse = await fetch(
        `/api/public/shops/trending?scope=category&${categoryParams.toString()}&limit=12`
      );
      
      if (!shopsResponse.ok) {
        throw new Error(`Failed to fetch category shops: ${shopsResponse.statusText}`);
      }
      
      const shopsData = await shopsResponse.json();
      
      setProducts(productsData.data || []);
      setShops(shopsData.data || []);
      
      setMetrics({
        responseTime: Date.now() - startTime,
        productCount: Array.isArray(productsData.data) ? productsData.data.length : 0,
        shopCount: Array.isArray(shopsData.data) ? shopsData.data.length : 0
      });
      
      console.log('[CATEGORY DISCOVERY] Successfully fetched category data', {
        categoryType,
        productName,
        shopCategoryName,
        bucketType,
        productCount: Array.isArray(productsData.data) ? productsData.data.length : 0,
        shopCount: Array.isArray(shopsData.data) ? shopsData.data.length : 0,
        responseTime: Date.now() - startTime
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch category discovery';
      setError(errorMessage);
      console.error('[CATEGORY DISCOVERY] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [productName, productId, googleProductId, shopCategoryName, shopCategoryId, shopGoogleCategoryId, categoryType, bucketType, limit, enabled]);

  const refetch = useCallback(() => {
    fetchCategoryDiscovery();
  }, [fetchCategoryDiscovery]);

  useEffect(() => {
    fetchCategoryDiscovery();
  }, [fetchCategoryDiscovery]);

  return {
    products,
    shops,
    loading,
    error,
    refetch,
    metrics
  };
}
