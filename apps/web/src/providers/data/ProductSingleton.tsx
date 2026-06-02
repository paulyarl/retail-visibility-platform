'use client';

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';
import { PublicApiSingleton } from '../base/PublicApiSingleton';

// ====================
// PUBLIC PRODUCT INTERFACES
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
  availability: 'in_stock' | 'out_of_stock' | 'preorder' | 'discontinued';
  imageUrl?: string;
  hasGallery?: boolean;
  tenantCategoryId?: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  };
  isFeatured?: boolean;
  featuredType?: 'store_selection' | 'new_arrival' | 'seasonal' | 'sale' | 'staff_pick';
  featuredTypes?: string[];
  featuredPriority?: number;
  featuredAt?: string;
  featuredExpiresAt?: string;
  metadata?: Record<string, any>;
  hasDescription?: boolean;
  hasBrand?: boolean;
  hasPrice?: boolean;
  createdAt?: string;
  updatedAt?: string;
  hasVariants?: boolean;
  variantOptions?: Record<string, string[]>;
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
  // Computed fields
  formattedPrice?: string;
  formattedSalePrice?: string;
  isOnSale?: boolean;
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock';
  // Location-aware fields
  distanceKm?: number;
  // Payment gateway fields
  hasActivePaymentGateway?: boolean;
  defaultGatewayType?: string;
  // Flat store fields (from random-featured-global endpoint)
  storeName?: string;
  storeLogo?: string;
  storeSlug?: string;
  storeCity?: string;
  storeState?: string;
  storeCategory?: string;
}

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: string;
  featured?: boolean;
  storeId?: string;
  search?: string;
  location?: {
    lat: number;
    lng: number;
    radius: number; // in km
  };
  limit?: number;
  offset?: number;
}

export interface ProductCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  productCount?: number;
}

// ====================
// PRODUCT SINGLETON CLASS
// ====================

class ProductSingleton extends PublicApiSingleton {
  private static instance: ProductSingleton;
  
  // Product state
  private products: Map<string, PublicProduct> = new Map();
  private categories: Map<string, ProductCategory> = new Map();
  private featuredProducts: PublicProduct[] = [];
  
  // Loading states
  private loadingStates: Map<string, boolean> = new Map();
  private errorStates: Map<string, string> = new Map();
  
  private constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, cacheOptions);
  }
  
  static getInstance(): ProductSingleton {
    if (!ProductSingleton.instance) {
      ProductSingleton.instance = new ProductSingleton('product-singleton');
    }
    return ProductSingleton.instance;
  }
  
  // ====================
  // API METHODS
  // ====================
  
  /**
   * Fetch products with optional filters
   */
  async fetchProducts(filters?: ProductFilters): Promise<PublicProduct[]> {
    const cacheKey = `products:${JSON.stringify(filters)}`;
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      let url = `${apiUrl}/api/products`;
      
      // Build query string from filters
      if (filters) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            if (key === 'location' && typeof value === 'object') {
              params.append('lat', value.lat.toString());
              params.append('lng', value.lng.toString());
              params.append('radius', value.radius.toString());
            } else {
              params.append(key, value.toString());
            }
          }
        });
        url += `?${params.toString()}`;
      }
      
      const response = await this.makeDefaultRequest<any>(
        url,
        {},
        cacheKey
      );
      
      const products: PublicProduct[] = response?.data?.products || [];
      
      // Update internal state
      products.forEach((product: PublicProduct) => {
        this.products.set(`${product.id}-${product.tenantId}`, product);
      });
      
      return products;
    } catch (error) {
      console.error('Failed to fetch products:', error);
      throw error;
    }
  }
  
  /**
   * Fetch a single product by ID
   */
  async fetchProductById(productId: string, tenantId?: string): Promise<PublicProduct | null> {
    const cacheKey = `product:${productId}:${tenantId || 'default'}`;
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      let url = `${apiUrl}/api/products/${productId}`;
      
      if (tenantId) {
        url += `?tenantId=${tenantId}`;
      }
      
      const response = await this.makeDefaultRequest<any>(
        url,
        {},
        cacheKey
      );
      
      const product: PublicProduct | null = response?.data?.data || response?.data || null;
      if (!product) return null;
      
      // Update internal state
      this.products.set(`${product.id}-${product.tenantId}`, product);
      
      return product;
    } catch (error) {
      console.error(`Failed to fetch product ${productId}:`, error);
      return null;
    }
  }
  
  /**
   * Fetch random featured products (location-aware) - OPTIMIZED
   * Uses single global MV query instead of multiple store calls + enrichment
   */
  async fetchRandomFeaturedProducts(location?: { lat: number; lng: number }, limit: number = 20): Promise<PublicProduct[]> {
    const cacheKey = `featured-global:${location ? `${location.lat},${location.lng}` : 'global'}:${limit}`;
    
    try {
      // OPTIMIZED: Single global MV query instead of multiple store calls + enrichment
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      let url = `${apiUrl}/api/directory/random-featured-global?limit=${limit}`;
      
      if (location) {
        url += `&lat=${location.lat}&lng=${location.lng}`;
      }
      
      const response = await this.makeDefaultRequest<any>(url, {}, cacheKey);
      
      const products: PublicProduct[] = response?.data?.products || [];
      if (!products.length) {
        console.warn('[ProductSingleton] Global featured products API failed, falling back to legacy method');
        return this.fetchRandomFeaturedLegacy(location, limit);
      }
      
      console.log(`[ProductSingleton] Using global featured products API, found ${products.length} products`);
      
      // Update internal state
      products.forEach((product: PublicProduct) => {
        this.products.set(`${product.id}-${product.tenantId}`, product);
      });
      
      // Update featured products cache
      this.featuredProducts = products;
      
      return products;
      
    } catch (error) {
      console.error('[ProductSingleton] Error in fetchRandomFeaturedProducts:', error);
      // Fallback to legacy method
      return this.fetchRandomFeaturedLegacy(location, limit);
    }
  }
  
  /**
   * Legacy fallback method (kept for reliability)
   */
  private async fetchRandomFeaturedLegacy(location?: { lat: number; lng: number }, limit: number = 20): Promise<PublicProduct[]> {
    const cacheKey = `featured-legacy:${location ? `${location.lat},${location.lng}` : 'global'}:${limit}`;
    
    try {
      console.log('[ProductSingleton] Using legacy fallback method');
      
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      let url = `${apiUrl}/api/directory/random-featured`;
      
      if (location) {
        const params = new URLSearchParams({
          lat: location.lat.toString(),
          lng: location.lng.toString(),
          maxDistance: '500', // 500km radius
          limit: limit.toString()
        });
        url += `?${params.toString()}`;
      }
      
      const response = await this.makeDefaultRequest<any>(
        url,
        {},
        cacheKey
      );
      
      const products: PublicProduct[] = response?.data?.products || [];
      
      // Update internal state
      products.forEach((product: PublicProduct) => {
        this.products.set(`${product.id}-${product.tenantId}`, product);
      });
      
      // Update featured products cache
      this.featuredProducts = products;
      
      return products;
    } catch (error) {
      console.error('[ProductSingleton] Legacy fallback failed:', error);
      throw error;
    }
  }
  
  /**
   * Fetch product categories
   */
  async fetchProductCategories(): Promise<ProductCategory[]> {
    const cacheKey = 'product-categories';
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await this.makeDefaultRequest<any>(
        `${apiUrl}/api/products/categories`,
        {},
        cacheKey
      );
      
      const categories: ProductCategory[] = response?.data?.categories || [];
      
      // Update internal state
      categories.forEach((category: ProductCategory) => {
        this.categories.set(category.id, category);
      });
      
      return categories;
    } catch (error) {
      console.error('Failed to fetch product categories:', error);
      throw error;
    }
  }
  
  /**
   * Search products
   */
  async searchProducts(query: string, filters?: ProductFilters): Promise<PublicProduct[]> {
    const searchFilters = { ...filters, search: query };
    return this.fetchProducts(searchFilters);
  }
  
  /**
   * Get products by category
   */
  async getProductsByCategory(categoryId: string, limit?: number): Promise<PublicProduct[]> {
    return this.fetchProducts({ category: categoryId, limit });
  }
  
  /**
   * Get products by store
   */
  async getProductsByStore(storeId: string, limit?: number): Promise<PublicProduct[]> {
    return this.fetchProducts({ storeId, limit });
  }
  
  /**
   * Get trending products
   */
  async getTrendingProducts(limit: number = 10): Promise<PublicProduct[]> {
    const cacheKey = `trending:${limit}`;
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await this.makeDefaultRequest<any>(
        `${apiUrl}/api/products/trending?limit=${limit}`,
        {},
        cacheKey
      );
      
      return response?.data?.products || [];
    } catch (error) {
      console.error('Failed to fetch trending products:', error);
      return [];
    }
  }
  
  /**
   * Get new arrivals
   */
  async getNewArrivals(limit: number = 10): Promise<PublicProduct[]> {
    const cacheKey = `new-arrivals:${limit}`;
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await this.makeDefaultRequest<any>(
        `${apiUrl}/api/products/new-arrivals?limit=${limit}`,
        {},
        cacheKey
      );
      
      return response?.data?.products || [];
    } catch (error) {
      console.error('Failed to fetch new arrivals:', error);
      return [];
    }
  }
  
  /**
   * Get products on sale
   */
  async getOnSaleProducts(limit: number = 10): Promise<PublicProduct[]> {
    const cacheKey = `on-sale:${limit}`;
    
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await this.makeDefaultRequest<any>(
        `${apiUrl}/api/products/on-sale?limit=${limit}`,
        {},
        cacheKey
      );
      
      return response?.data?.products || [];
    } catch (error) {
      console.error('Failed to fetch on-sale products:', error);
      return [];
    }
  }
  
  // ====================
  // HELPER METHODS
  // ====================
  
  /**
   * Get product from cache
   */
  getProduct(productId: string, tenantId?: string): PublicProduct | undefined {
    const key = tenantId ? `${productId}-${tenantId}` : productId;
    return this.products.get(key);
  }
  
  /**
   * Get multiple products from cache
   */
  getProducts(productIds: string[]): PublicProduct[] {
    return productIds.map(id => this.products.get(id)).filter(Boolean) as PublicProduct[];
  }
  
  /**
   * Get featured products from cache
   */
  getFeaturedProducts(): PublicProduct[] {
    return this.featuredProducts;
  }
  
  /**
   * Get category from cache
   */
  getCategory(categoryId: string): ProductCategory | undefined {
    return this.categories.get(categoryId);
  }
  
  /**
   * Get all categories from cache
   */
  getCategories(): ProductCategory[] {
    return Array.from(this.categories.values());
  }
  
  /**
   * Check if product is loading
   */
  isLoading(key: string): boolean {
    return this.loadingStates.get(key) || false;
  }
  
  /**
   * Get error for a key
   */
  getError(key: string): string | undefined {
    return this.errorStates.get(key);
  }
  
  /**
   * Clear product cache
   */
  clearProductCache(productId?: string): void {
    if (productId) {
      this.products.delete(productId);
    } else {
      this.products.clear();
    }
  }
  
  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.products.clear();
    this.categories.clear();
    this.featuredProducts = [];
    this.loadingStates.clear();
    this.errorStates.clear();
    // Clear base class cache (fire-and-forget since it's async)
    this.clearCache().catch(() => {});
  }
}

// ====================
// REACT CONTEXT AND PROVIDER
// ====================

interface ProductContextType {
  singleton: ProductSingleton;
  actions: {
    fetchProducts: (filters?: ProductFilters) => Promise<PublicProduct[]>;
    fetchProductById: (productId: string, tenantId?: string) => Promise<PublicProduct | null>;
    fetchRandomFeaturedProducts: (location?: { lat: number; lng: number }, limit?: number) => Promise<PublicProduct[]>;
    fetchProductCategories: () => Promise<ProductCategory[]>;
    searchProducts: (query: string, filters?: ProductFilters) => Promise<PublicProduct[]>;
    getProductsByCategory: (categoryId: string, limit?: number) => Promise<PublicProduct[]>;
    getProductsByStore: (storeId: string, limit?: number) => Promise<PublicProduct[]>;
    getTrendingProducts: (limit?: number) => Promise<PublicProduct[]>;
    getNewArrivals: (limit?: number) => Promise<PublicProduct[]>;
    getOnSaleProducts: (limit?: number) => Promise<PublicProduct[]>;
    getProduct: (productId: string, tenantId?: string) => PublicProduct | undefined;
    getProducts: (productIds: string[]) => PublicProduct[];
    getFeaturedProducts: () => PublicProduct[];
    getCategory: (categoryId: string) => ProductCategory | undefined;
    getCategories: () => ProductCategory[];
    isLoading: (key: string) => boolean;
    getError: (key: string) => string | undefined;
    clearProductCache: (productId?: string) => void;
    clearAllCaches: () => void;
  };
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export function ProductProvider({ children }: { children: ReactNode }) {
  const [singleton] = useState(() => ProductSingleton.getInstance());
  
  const actions = {
    fetchProducts: (filters?: ProductFilters) => singleton.fetchProducts(filters),
    fetchProductById: (productId: string, tenantId?: string) => singleton.fetchProductById(productId, tenantId),
    fetchRandomFeaturedProducts: (location?: { lat: number; lng: number }, limit?: number) => 
      singleton.fetchRandomFeaturedProducts(location, limit),
    fetchProductCategories: () => singleton.fetchProductCategories(),
    searchProducts: (query: string, filters?: ProductFilters) => singleton.searchProducts(query, filters),
    getProductsByCategory: (categoryId: string, limit?: number) => singleton.getProductsByCategory(categoryId, limit),
    getProductsByStore: (storeId: string, limit?: number) => singleton.getProductsByStore(storeId, limit),
    getTrendingProducts: (limit?: number) => singleton.getTrendingProducts(limit),
    getNewArrivals: (limit?: number) => singleton.getNewArrivals(limit),
    getOnSaleProducts: (limit?: number) => singleton.getOnSaleProducts(limit),
    getProduct: (productId: string, tenantId?: string) => singleton.getProduct(productId, tenantId),
    getProducts: (productIds: string[]) => singleton.getProducts(productIds),
    getFeaturedProducts: () => singleton.getFeaturedProducts(),
    getCategory: (categoryId: string) => singleton.getCategory(categoryId),
    getCategories: () => singleton.getCategories(),
    isLoading: (key: string) => singleton.isLoading(key),
    getError: (key: string) => singleton.getError(key),
    clearProductCache: (productId?: string) => singleton.clearProductCache(productId),
    clearAllCaches: () => singleton.clearAllCaches(),
  };
  
  const value: ProductContextType = {
    singleton,
    actions
  };
  
  return (
    <ProductContext.Provider value={value}>
      {children}
    </ProductContext.Provider>
  );
}

// ====================
// REACT HOOKS
// ====================

export function useProductSingleton() {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProductSingleton must be used within ProductProvider');
  }
  return context;
}

export function useRandomFeaturedProducts(location?: { lat: number; lng: number }, limit: number = 20) {
  const { actions } = useProductSingleton();
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const loadProducts = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const fetchedProducts = await actions.fetchRandomFeaturedProducts(location, limit);
      setProducts(fetchedProducts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch featured products');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadProducts();
  }, [location?.lat, location?.lng, limit]);
  
  return { products, loading, error, refetch: loadProducts };
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

// Export the provider for use in other components
export { ProductProvider as ProductSingletonProvider };

