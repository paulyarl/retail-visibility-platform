import { useState, useEffect, useCallback } from 'react';
import { shopsService } from '@/services/ShopsService';
import { clientLogger } from '@/lib/client-logger';

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
      
      // Fetch products by category using shopsService
      const productsData = await shopsService.getShopCategories();
      
      // For now, return empty data since shopsService doesn't have category discovery yet
      // This can be extended when the API supports category-based discovery
      const products: any[] = [];
      
      // Fetch trending shops by category using shopsService
      const shopsData = await shopsService.getTrendingShops({ limit: 12 });
      const shops = shopsData || [];
      
      setProducts(products);
      setShops(shops);
      
      setMetrics({
        responseTime: Date.now() - startTime,
        productCount: products.length,
        shopCount: shops.length
      });
      
      console.log('[CATEGORY DISCOVERY] Successfully fetched category data', {
        categoryType,
        productName,
        shopCategoryName,
        bucketType,
        productCount: products.length,
        shopCount: shops.length,
        responseTime: Date.now() - startTime
      });
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch category discovery';
      setError(errorMessage);
      clientLogger.error('[CATEGORY DISCOVERY] Error:', { detail: err });
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
