'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';
import { CacheManager } from '@/utils/cacheManager';
import { AutoUserCacheOptions } from '@/utils/userIdentification';

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

export class ProductSingleton extends UniversalSingleton {
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
    const cacheKey = `featured-${location?.lat || 'default'}-${location?.lng || 'default'}-${limit}`;
    
    // Check cache first
    const cached = await this.getFromCache<PublicProduct[]>(cacheKey);
    if (cached) {
      this.featuredProducts = cached;
      return cached;
    }
    
    try {
      let url = `/api/directory/random-featured?limit=${limit}`;
      
      if (location) {
        url += `&lat=${location.lat}&lng=${location.lng}&maxDistance=500`;
      }
      
      const data = await this.makeApiRequest(url);
      const response = data as { products: any[] } || { products: [] };
      const products: PublicProduct[] = response.products || [];
      
      // Store in cache
      await this.setCache(cacheKey, products);
      this.featuredProducts = products;
      
      // Store individual products
      products.forEach((product: PublicProduct) => {
        this.products.set(`${product.id}-${product.tenantId}`, product);
      });
      
      return products;
    } catch (error) {
      throw error;
    }
  }
  
  async fetchProducts(filters?: ProductFilters): Promise<PublicProduct[]> {
    const cacheKey = `products-${JSON.stringify(filters || {})}`;
    
    // Check cache first
    const cached = await this.getFromCache<PublicProduct[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const params = new URLSearchParams();
      
      if (filters?.category) params.append('category', filters.category);
      if (filters?.minPrice) params.append('minPrice', filters.minPrice.toString());
      if (filters?.maxPrice) params.append('maxPrice', filters.maxPrice.toString());
      if (filters?.availability) params.append('availability', filters.availability);
      if (filters?.featured) params.append('featured', 'true');
      if (filters?.search) params.append('search', filters.search);
      if (filters?.page) params.append('offset', ((filters.page - 1) * (filters.limit || 12)).toString());
      if (filters?.limit) params.append('limit', filters.limit.toString());
      if (filters?.sort) params.append('sort', filters.sort);
      if (filters?.order) params.append('order', filters.order || 'asc');
      
      if (filters?.location) {
        params.append('lat', filters.location.lat.toString());
        params.append('lng', filters.location.lng.toString());
        params.append('radius', (filters.location.radius || 50).toString());
      }
      
      // Use the correct Public API endpoint
      const url = `/api/public/products${params.toString() ? `?${params.toString()}` : ''}`;
      const data = await this.makeApiRequest(url);
      
      // Handle Public API response format
      const response = data as { products: any[] } || { products: [] };
      const products: PublicProduct[] = response.products || [];
      
      // Transform to match PublicProduct interface
      const transformedProducts = products.map((product: any) => ({
        id: product.id,
        tenantId: product.tenant?.id || '',
        sku: product.sku || '',
        name: product.name,
        title: product.name,
        description: product.description,
        brand: product.brand,
        priceCents: Math.round((product.price || 0) * 100),
        stock: product.stock || 0,
        imageUrl: product.imageUrl,
        availability: product.availability || 'in_stock',
        hasVariants: product.hasVariants || false,
        category: product.category,
        featuredType: product.featuredType,
        featuredPriority: product.featuredPriority,
        featuredAt: product.featuredAt,
        featuredExpiresAt: product.featuredExpiresAt,
        metadata: product.metadata,
        hasGallery: product.hasGallery || false,
        hasDescription: !!product.description,
        hasBrand: !!product.brand,
        hasPrice: product.price !== null,
        storeInfo: product.tenant ? {
          storeId: product.tenant.id,
          storeName: product.tenant.name,
          storeSlug: product.tenant.slug,
        } : undefined,
        hasActivePaymentGateway: product.hasActivePaymentGateway || false,
        defaultGatewayType: product.defaultGatewayType,
      }));
      
      // Store in cache
      await this.setCache(cacheKey, transformedProducts);
      
      // Store individual products
      transformedProducts.forEach((product: PublicProduct) => {
        this.products.set(`${product.id}-${product.tenantId}`, product);
      });
      
      return transformedProducts;
    } catch (error) {
      throw error;
    }
  }
  
  async fetchProductById(productId: string, tenantId?: string): Promise<PublicProduct | null> {
    const cacheKey = `product-${productId}-${tenantId || 'default'}`;
    
    // Check cache first
    const cached = await this.getFromCache<PublicProduct | null>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      // Use the correct Public API endpoint
      const url = `/api/public/products/${productId}`;
      const data = await this.makeApiRequest(url);
      const product = (data as any)?.product || (data as any) || null;
      
      // Handle null product case
      if (!product) {
        return null;
      }
      
      // Transform to match PublicProduct interface
      const transformedProduct = {
        id: product.id,
        tenantId: product.tenant?.id || '',
        sku: product.sku || '',
        name: product.name,
        title: product.name,
        description: product.description,
        brand: product.brand,
        priceCents: Math.round((product.price || 0) * 100),
        stock: product.stock || 0,
        imageUrl: product.imageUrl,
        availability: product.availability || 'in_stock',
        hasVariants: product.hasVariants || false,
        category: product.category,
        featuredType: product.featuredType,
        featuredPriority: product.featuredPriority,
        featuredAt: product.featuredAt,
        featuredExpiresAt: product.featuredExpiresAt,
        metadata: product.metadata,
        hasGallery: product.hasGallery || false,
        hasDescription: !!product.description,
        hasBrand: !!product.brand,
        hasPrice: product.price !== null,
        storeInfo: product.tenant ? {
          storeId: product.tenant.id,
          storeName: product.tenant.name,
          storeSlug: product.tenant.slug,
        } : undefined,
        hasActivePaymentGateway: product.hasActivePaymentGateway || false,
        defaultGatewayType: product.defaultGatewayType,
      };
      
      // Store in cache
      await this.setCache(cacheKey, transformedProduct);
      this.products.set(`${transformedProduct.id}-${transformedProduct.tenantId}`, transformedProduct);
      
      return transformedProduct;
    } catch (error) {
      throw error;
    }
  }
  
  async fetchProductCategories(): Promise<ProductCategory[]> {
    const cacheKey = 'categories';
    
    // Check cache first
    const cached = await this.getFromCache<ProductCategory[]>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const data = await this.makeApiRequest('/api/products/categories');
      const categories: ProductCategory[] = Array.isArray(data) ? data : (data as any)?.categories || [];
      
      // Store in cache
      await this.setCache(cacheKey, categories);
      
      // Store individual categories
      categories.forEach((category: ProductCategory) => {
        this.categories.set(category.id, category);
      });
      
      return categories;
    } catch (error) {
      throw error;
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
