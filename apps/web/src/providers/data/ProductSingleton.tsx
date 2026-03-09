'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { SingletonCacheOptions } from '@/providers/base/FlexibleApiSingleton';
import { CacheManager } from '@/utils/cacheManager';
import { AutoUserCacheOptions } from '@/utils/userIdentification';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';

// ====================
// PRODUCT INTERFACES
// ====================

export interface PublicProduct {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  title?: string;
  description?: string;
  brand?: string;
  priceCents: number;
  salePriceCents?: number;
  stock: number;
  imageUrl?: string;
  availability: 'in_stock' | 'out_of_stock' | 'preorder' | 'discontinued';
  hasVariants?: boolean;
  category?: ProductCategory;
  featuredType?: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
  featuredPriority?: number;
  featuredAt?: string;
  featuredExpiresAt?: string;
  metadata?: Record<string, any>;
  hasGallery?: boolean;
  hasDescription?: boolean;
  hasBrand?: boolean;
  hasPrice?: boolean;
  storeInfo?: {
    storeId: string;
    storeName: string;
    storeSlug: string;
    storeLogo?: string;
    storeCity?: string;
    storeState?: string;
    storeWebsite?: string;
    storePhone?: string;
  };
  distanceKm?: number | null;
  hasActivePaymentGateway?: boolean;
  defaultGatewayType?: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  googleCategoryId?: string;
  productCount?: number;
}

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: string;
  featured?: boolean;
  search?: string;
  tenantId?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  location?: {
    lat: number;
    lng: number;
    radius?: number;
  };
}

// ====================
// PRODUCT SINGLETON CLASS
// ====================

export class ProductSingleton extends PublicApiSingleton {

  protected defaultContext: AppContext = AppContext.DIRECTORY;
  protected defaultIsolation: CacheIsolation = CacheIsolation.DIRECTORY;
  private static instance: ProductSingleton;
  
  // Product state
  private products: Map<string, PublicProduct> = new Map();
  private categories: Map<string, ProductCategory> = new Map();
  private featuredProducts: PublicProduct[] = [];

  // Loading states
  private loadingStates: Map<string, boolean> = new Map();
  private errorStates: Map<string, string> = new Map();

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
  }

  // Override getInstance with ProductSingleton-specific signature
  static getInstance(options?: { encrypt?: boolean; userId?: string }): ProductSingleton {
    if (!ProductSingleton.instance) {
      ProductSingleton.instance = new ProductSingleton('product-singleton', options);
    }
    return ProductSingleton.instance;
  }

  // ====================
  // PRODUCT-SPECIFIC METHODS
  // ====================

  protected getCustomMetrics(): Record<string, any> {
    return {
      productsCount: this.products.size,
      categoriesCount: this.categories.size,
      featuredProductsCount: this.featuredProducts.length,
      loadingStatesCount: this.loadingStates.size,
      errorStatesCount: this.errorStates.size,
    };
  }

  // ====================
  // API METHODS
  // ====================

  
  async fetchRandomFeaturedProducts(location?: { lat: number; lng: number }, limit: number = 20): Promise<PublicProduct[]> {
    try {
      let url = `/api/directory/random-featured?limit=${limit}`;
      
      if (location) {
        url += `&lat=${location.lat}&lng=${location.lng}&maxDistance=500`;
      }
      
      // Add cache-busting timestamp to ensure fresh data
      url += `&_t=${Date.now()}`;
      
      // Generate cache key based on location and parameters
      const cacheKey = location 
        ? `featured-products-${location.lat}-${location.lng}-${limit}`
        : `featured-products-global-${limit}`;
      
      // Use makePublicRequest with proper cache key
      const result = await this.makePublicRequest<{ products: any[] }>(url, {}, cacheKey);
      
      if (!result.success) {
        console.error('[ProductSingleton] Error fetching featured products:', result.error);
        return [];
      }
      
      // API returns: { products: [...] }
      const products: PublicProduct[] = result.data?.products || [];
      this.featuredProducts = products;
      
      // Store individual products
      products.forEach((product: PublicProduct) => {
        this.products.set(`${product.id}-${product.tenantId}`, product);
      });
      
      return products;
    } catch (error) {
      console.error('[ProductSingleton] Error in fetchRandomFeaturedProducts:', error);
      return [];
    }
  }
  
  async fetchProducts(filters?: ProductFilters): Promise<PublicProduct[]> {
    try {
      const params = new URLSearchParams();
      
      // Add filters to query params
      if (filters?.category) params.append('category', filters.category);
      if (filters?.search) params.append('search', filters.search);
      if (filters?.minPrice) params.append('minPrice', filters.minPrice.toString());
      if (filters?.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
      if (filters?.availability) params.append('availability', filters.availability);
      if (filters?.tenantId) params.append('tenantId', filters.tenantId);
      if (filters?.featured) params.append('featured', 'true');
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.page) params.append('page', (filters.page || 1).toString());
      
      // Generate cache key based on filters
      const cacheKey = `products-${JSON.stringify(filters || {})}`;
      
      // Use the correct Public API endpoint
      const url = `/api/public/products${params.toString() ? `?${params.toString()}` : ''}`;
      const result = await this.makePublicRequest<{ products: any[] }>(url, {}, cacheKey);
      
      if (!result.success) {
        console.error('[ProductSingleton] Error fetching products:', result.error);
        return [];
      }
      
      const products: PublicProduct[] = result.data?.products || [];
      
      // Transform products to PublicProduct interface
      const transformedProducts: PublicProduct[] = products.map((product: any) => ({
        id: product.id,
        tenantId: product.tenantId,
        sku: product.sku || product.id,
        name: product.name,
        title: product.title || product.name,
        description: product.description,
        brand: product.brand || '',
        priceCents: product.priceCents || 0,
        salePriceCents: product.salePriceCents,
        stock: product.stock || 0,
        imageUrl: product.imageUrl,
        availability: product.availability || 'in_stock',
        hasVariants: product.has_variants || false,
        category: product.category,
        featuredType: product.featuredType,
        featuredPriority: product.featuredPriority,
        featuredAt: product.featuredAt,
        featuredExpiresAt: product.featuredExpiresAt,
        metadata: product.metadata,
        hasGallery: product.hasGallery,
        hasDescription: product.hasDescription,
        hasBrand: product.hasBrand,
        hasPrice: product.hasPrice,
        hasActivePaymentGateway: product.hasActivePaymentGateway,
        defaultGatewayType: product.defaultGatewayType,
        storeInfo: product.storeInfo,
        distanceKm: product.distanceKm,
      }));
      
      // Store individual products
      transformedProducts.forEach((product: PublicProduct) => {
        this.products.set(`${product.id}-${product.tenantId}`, product);
      });
      
      return transformedProducts;
    } catch (error) {
      console.error('[ProductSingleton] Error in fetchProducts:', error);
      return [];
    }
  }
  
  async fetchProductById(productId: string, tenantId?: string): Promise<PublicProduct | null> {
    try {
      // Generate cache key based on product ID and tenant
      const cacheKey = `product-${productId}-${tenantId || 'default'}`;
      
      // Use the correct Public API endpoint
      const url = `/api/public/products/${productId}`;
      const result = await this.makePublicRequest(url, {}, cacheKey);
      const product = (result as any)?.product || (result as any) || null;
      
      // Handle null product case
      if (!product) {
        return null;
      }
      
      // Transform to PublicProduct interface
      const transformedProduct: PublicProduct = {
        id: product.id,
        tenantId: product.tenantId,
        sku: product.sku || product.id,
        name: product.name,
        title: product.title || product.name,
        description: product.description,
        brand: product.brand || '',
        priceCents: product.priceCents || 0,
        salePriceCents: product.salePriceCents,
        stock: product.stock || 0,
        imageUrl: product.imageUrl,
        availability: product.availability || 'in_stock',
        hasVariants: product.has_variants || false,
        category: product.category,
        featuredType: product.featuredType,
        featuredPriority: product.featuredPriority,
        featuredAt: product.featuredAt,
        featuredExpiresAt: product.featuredExpiresAt,
        metadata: product.metadata,
        hasGallery: product.hasGallery,
        hasDescription: product.hasDescription,
        hasBrand: product.hasBrand,
        hasPrice: product.hasPrice,
        hasActivePaymentGateway: product.hasActivePaymentGateway,
        defaultGatewayType: product.defaultGatewayType,
        storeInfo: product.storeInfo,
        distanceKm: product.distanceKm,
      };
      
      // Store individual product
      this.products.set(`${transformedProduct.id}-${transformedProduct.tenantId}`, transformedProduct);
      
      return transformedProduct;
    } catch (error) {
      console.error('[ProductSingleton] Error in fetchProductById:', error);
      return null;
    }
  }
  
  async fetchProductCategories(): Promise<ProductCategory[]> {
    try {
      const cacheKey = 'categories';
      const result = await this.makePublicRequest('/api/products/categories', {}, cacheKey);
      const categories: ProductCategory[] = Array.isArray(result) ? result : (result as any)?.categories || [];
      
      // Store individual categories
      categories.forEach((category: ProductCategory) => {
        this.categories.set(category.id, category);
      });
      
      return categories;
    } catch (error) {
      console.error('[ProductSingleton] Error in fetchProductCategories:', error);
      return [];
    }
  }
  
  // ====================
  // HELPER METHODS
  // ====================
  
  getProduct(productId: string, tenantId?: string): PublicProduct | undefined {
    const key = tenantId ? `${productId}-${tenantId}` : productId;
    return this.products.get(key);
  }
  
  getFeaturedProducts(): PublicProduct[] {
    return this.featuredProducts;
  }
  
  getCategories(): ProductCategory[] {
    return Array.from(this.categories.values());
  }
  
  clearAllCache(): void {
    // Clear the universal cache
    this.clearCache();
    this.products.clear();
    this.categories.clear();
    this.featuredProducts = [];
  }

  // ====================
  // UTILITY METHODS
  // ====================
}

// ====================
// REACT CONTEXT
// ====================

interface ProductSingletonContextType {
  actions: ProductSingleton;
  isLoading: boolean;
}

const ProductSingletonContext = createContext<ProductSingletonContextType | null>(null);

export function ProductSingletonProvider({ children }: { children: ReactNode }) {
  const [instance] = useState(() => ProductSingleton.getInstance());
  
  // Store instance globally for non-React access
  useEffect(() => {
    (window as any).__productSingletonInstance = instance;
  }, [instance]);
  
  const value = {
    actions: instance,
    isLoading: false
  };
  
  return (
    <ProductSingletonContext.Provider value={value}>
      {children}
    </ProductSingletonContext.Provider>
  );
}

export function useProductSingleton() {
  const context = useContext(ProductSingletonContext);
  if (!context) {
    throw new Error('useProductSingleton must be used within ProductSingletonProvider');
  }
  return context;
}

// ====================
// CONVENIENCE HOOKS
// ====================

export function useRandomFeaturedProducts(location?: { lat: number; lng: number } | undefined, limit: number = 20) {
  const { actions } = useProductSingleton();
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchFromCache, setLastFetchFromCache] = useState(false);
  
  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Use the cached fetchRandomFeaturedProducts method which handles caching
      const fetchedProducts = await actions.fetchRandomFeaturedProducts(location, limit);
      
      // Log payment gateway values from API
      /* console.log('[SINGLETON-DEBUG] Payment Gateway API Values:', {
        total_products: fetchedProducts.length,
        products: fetchedProducts.map(p => ({
          product_id: p.id,
          tenant_id: p.tenantId,
          api_hasActivePaymentGateway: p.hasActivePaymentGateway,
          api_defaultGatewayType: p.defaultGatewayType,
          product_name: p.name
        })),
        source: 'ProductSingleton API'
      }); */
      
      // Ensure no duplicates by using product ID as unique key
      const uniqueProducts = Array.from(
        new Map(fetchedProducts.map((product: PublicProduct) => [product.id, product])).values()
      ) as PublicProduct[];
      
      setProducts(uniqueProducts);
      
      // Check if this came from cache by looking at the metrics before and after
      const metricsBefore = actions.getMetrics();
      setTimeout(() => {
        const metricsAfter = actions.getMetrics();
        // If cache hits increased, the last fetch was from cache
        setLastFetchFromCache(metricsAfter.cacheHits > metricsBefore.cacheHits);
      }, 100);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch featured products');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadProducts();
  }, [location?.lat, location?.lng, limit]);
  
  // Calculate metrics from singleton
  const singletonMetrics = actions.getMetrics();
  const metrics = {
    cacheHits: singletonMetrics.cacheHits,
    cacheMisses: singletonMetrics.cacheMisses,
    totalRequests: singletonMetrics.cacheHits + singletonMetrics.cacheMisses,
    averageResponseTime: 0, // Could be calculated if needed
  };
  
  const refetch = () => loadProducts();
  
  return {
    products,
    loading,
    error,
    refetch,
    metrics,
    fromCache: lastFetchFromCache
  };
}

export function useProductCategories() {
  const { actions } = useProductSingleton();
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loadCategories = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const fetchedCategories = await actions.fetchProductCategories();
      setCategories(fetchedCategories);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadCategories();
  }, []);
  
  return { categories, loading, error, refetch: loadCategories };
}

export default ProductSingleton;
