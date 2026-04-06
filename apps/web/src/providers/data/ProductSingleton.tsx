'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import EnhancedProductService, { EnhancedProduct } from '@/services/EnhancedProductService';
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
  categoryName?: string;
  categorySlug?: string;
  productCategory?: string;
  productCategorySlug?: string;
  featuredType?: string;
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

  protected defaultContext: AppContext = AppContext.PRODUCT;
  protected defaultIsolation: CacheIsolation = CacheIsolation.PRODUCT;
  private static instance: ProductSingleton;
  private enhancedProductService: EnhancedProductService;
  
  // Product state
  private products: Map<string, PublicProduct> = new Map();
  private categories: Map<string, ProductCategory> = new Map();
  private featuredProducts: PublicProduct[] = [];

  // Loading states
  private loadingStates: Map<string, boolean> = new Map();
  private errorStates: Map<string, string> = new Map();

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
    this.enhancedProductService = EnhancedProductService.getInstance();
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
      // HYBRID APPROACH: Try featured products API first (rich data), fallback to existing API
      // console.log('[ProductSingleton] Using hybrid approach for featured products');
      
      // Primary: Try Featured Products API for rich data (store-specific approach)
      try {
        // console.log('[ProductSingleton] Using featured products API for store_selection random data');
        
        // Get random featured products from multiple stores
        const randomFeaturedProducts = await this.fetchRandomFeaturedFromMultipleStores(location, limit);
        
        if (randomFeaturedProducts && randomFeaturedProducts.length > 0) {
          // console.log('[ProductSingleton] Using featured products API data, found', randomFeaturedProducts.length, 'products');
          
          // Transform to PublicProduct interface (data is already rich)
          const enrichedProducts: PublicProduct[] = randomFeaturedProducts.map((product: any): PublicProduct => ({
            // Core fields - already in correct format
            id: product.id,
            sku: product.sku,
            name: product.name,
            title: product.title,
            description: product.description,
            brand: product.brand || '',
            
            // Pricing - already rich
            priceCents: product.priceCents,
            salePriceCents: product.salePriceCents,
            
            // Stock and availability - already complete
            stock: product.stock || 0,
            availability: product.availability || 'in_stock',
            
            // Media - already complete
            imageUrl: product.imageUrl,
            
            // Tenant info - already complete
            tenantId: product.tenantId,
            
            // Category - map to proper PublicProduct interface
            category: product.categoryName ? {
              id: product.googleCategoryId || '',
              name: product.categoryName,
              slug: product.categorySlug || '',
              googleCategoryId: product.googleCategoryId,
            } : undefined,
            
            // Featured info - Only store_selection for directory display
            featuredType: 'store_selection',
            featuredPriority: 1,
            featuredAt: new Date().toISOString(),
            
            // Store info mapping - already complete
            storeInfo: {
              storeId: product.tenantId,
              storeName: product.tenantName,
              storeSlug: product.tenantSlug,
              storeLogo: product.tenantLogoUrl,
              storeCity: '', // Not available in this API
              storeState: '', // Not available in this API
              storeWebsite: '',
              storePhone: '',
            },
            
            // Additional fields
            hasVariants: false,
            hasActivePaymentGateway: product.hasActivePaymentGateway || false,
            defaultGatewayType: product.defaultGatewayType || null,
            distanceKm: null,
            
            // Metadata with rich data
            metadata: {
              source: 'featured_products_api',
              marketingDescription: product.marketingDescription,
              condition: product.condition,
              gtin: product.gtin,
              mpn: product.mpn,
              currency: product.currency,
              features: product.metadata?.features || [],
              specifications: product.metadata?.specifications || {},
              enhancedDescription: product.metadata?.enhancedDescription || '',
              originalData: product
            }
          }));
          
          this.featuredProducts = enrichedProducts;
          
          // Store individual products
          enrichedProducts.forEach((product: PublicProduct) => {
            this.products.set(`${product.id}-${product.tenantId}`, product);
          });
          
          return enrichedProducts;
        }
      } catch (featuredError) {
        console.warn('[ProductSingleton] Featured products API failed, falling back to existing API:', featuredError);
      }
      
      // Fallback: Use existing API
      // console.log('[ProductSingleton] Using fallback API: /api/directory/random-featured');
      
      let url = `/api/directory/random-featured?limit=${limit}`;
      
      if (location?.lat && location?.lng) {
        url += `&lat=${location.lat}&lng=${location.lng}`;
      }
      
      const cacheKey = `random-featured-${location?.lat || 'global'}-${location?.lng || 'global'}-${limit}`;
      const result = await this.makeDefaultRequest<{ products: any[] }>(url, {}, cacheKey);
      
      if (!result.success) {
        console.error('[ProductSingleton] Error fetching featured products:', result.error);
        return [];
      }
      
      // API returns: { products: [...] }
      const rawProducts = result.data?.products || [];
      
      // Transform API response to match PublicProduct interface
      const products: PublicProduct[] = rawProducts.map((product: any) => ({
        ...product,
        // Map category fields from API
        productCategory: product.categoryName,
        productCategorySlug: product.categorySlug,
        googleCategoryId: product.googleCategoryId,
        // Map store fields from API to storeInfo object
        storeInfo: product.storeName ? {
          storeId: product.tenantId,
          storeName: product.storeName,
          storeSlug: product.storeSlug,
          storeLogo: product.storeLogo,
          storeCity: product.storeCity,
          storeState: product.storeState,
          storeWebsite: product.storeWebsite,
          storePhone: product.storePhone,
        } : undefined,
        // Add default featured information since these are "featured products"
        isFeatured: true,
        featuredType: 'store_selection' as const,
        featuredTypes: this.generateRandomFeaturedTypes(),
        featuredPriority: product.featuredPriority || 1,
        featuredAt: product.featuredAt || new Date().toISOString(),
        // Map sale price if available (will be enriched later)
        salePriceCents: product.salePriceCents,
        listPriceCents: product.listPriceCents,
      }));
      
      // Enrich products with complete data from individual product API
      const enrichedProducts = await Promise.all(
        products.map(async (product) => {
          try {
            const fullProduct = await this.fetchProductById(product.id, product.tenantId);
            if (fullProduct) {
              // Merge the full product data with our mapped data
              return {
                ...product,
                // Use complete data from individual product API
                salePriceCents: fullProduct.salePriceCents,
                listPriceCents: (fullProduct as any).listPriceCents,
                featuredType: fullProduct.featuredType || product.featuredType,
                featuredTypes: (fullProduct as any).featuredTypes || (product as any).featuredTypes,
                featuredPriority: fullProduct.featuredPriority || product.featuredPriority,
                featuredAt: fullProduct.featuredAt || product.featuredAt,
                featuredExpiresAt: fullProduct.featuredExpiresAt,
                // Keep our mapped category and store info
                productCategory: (product as any).productCategory,
                productCategorySlug: (product as any).productCategorySlug,
                googleCategoryId: (product as any).googleCategoryId,
                storeInfo: product.storeInfo,
              };
            }
            return product;
          } catch (error) {
            console.warn(`Failed to enrich product ${product.id}:`, error);
            return product;
          }
        })
      );
      
      this.featuredProducts = enrichedProducts;
      
      // Store individual products
      enrichedProducts.forEach((product: PublicProduct) => {
        this.products.set(`${product.id}-${product.tenantId}`, product);
      });
      
      return enrichedProducts;
    } catch (error) {
      console.error('[ProductSingleton] Error in fetchRandomFeaturedProducts:', error);
      return [];
    }
  }
  
  // Helper method to fetch random featured products from multiple stores
  private async fetchRandomFeaturedFromMultipleStores(location?: { lat: number; lng: number }, limit: number = 20): Promise<any[]> {
    try {
      // First, get a list of available stores
      const storesUrl = '/api/shops/directory?limit=50'; // Get up to 50 stores
      const storesResult = await this.makeDefaultRequest<{ data: any[] }>(storesUrl, {}, 'directory-shops-list');
      
      if (!storesResult.success || !storesResult.data?.data || storesResult.data.data.length === 0) {
        console.warn('[ProductSingleton] No stores available for random selection');
        return [];
      }
      
      const stores = storesResult.data.data;
      // console.log('[ProductSingleton] Found', stores.length, 'stores for slot pool collection');
      
      // Collect ALL store_selection products from ALL stores into one pool
      const productPromises = stores.map(async (store: any) => {
        try {
          const url = `/api/directory/featured-products?tenantId=${store.tenantId}&limit=10`; // Get up to 10 slots per store
          const result = await this.makeDefaultRequest<any>(url, {}, `featured-products-${store.tenantId}`);
          
          if (result.success && result.data?.buckets?.store_selection) {
            // Collect all store_selection products - these are the merchant's directory slots
            const storeSelectionProducts = result.data.buckets.store_selection;
            // console.log(`[ProductSingleton] Store ${store.name} has ${storeSelectionProducts.length} directory slots`);
            return storeSelectionProducts;
          }
          return [];
        } catch (error) {
          console.warn(`[ProductSingleton] Failed to fetch store_selection products from store ${store.tenantId}:`, error);
          return [];
        }
      });
      
      const allStoreProducts = await Promise.all(productPromises);
      
      // Flatten all products into one big pool
      const slotPool = allStoreProducts.flat();
      // console.log('[ProductSingleton] Total slot pool size:', slotPool.length, 'products from all stores');
      
      if (slotPool.length === 0) {
        // console.warn('[ProductSingleton] No products found in slot pool');
        return [];
      }
      
      // Random selection from the entire pool (equal opportunity, weighted by tier slots)
      const randomProducts = this.selectRandomItems(slotPool, limit);
      // console.log('[ProductSingleton] Selected', randomProducts.length, 'random products from slot pool');
      
      return randomProducts;
    } catch (error) {
      console.error('[ProductSingleton] Error in fetchRandomFeaturedFromMultipleStores:', error);
      return [];
    }
  }
  
  // Helper method to select random items from an array
  private selectRandomItems<T>(array: T[], count: number): T[] {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  }
  
  // Helper method to map featured types from mv_global_discovery to our interface
  private mapFeaturedType(type: string): string {
    const typeMap: Record<string, string> = {
      'featured': 'store_selection',
      'trending': 'trending',
      'new': 'new_arrival',
      'premium': 'seasonal',
      'staff_pick': 'staff_pick',
      'bestseller': 'bestseller',
      'gift_idea': 'seasonal',
      'popular': 'store_selection',
      'clearance': 'clearance',
      'recommended': 'recommended'
    };
    
    return typeMap[type] || type; // Return original type if not in map
  }
  
  // Helper method to generate random featured types for variety
  private generateRandomFeaturedTypes(): string[] {
    const allTypes: string[] = [
      'store_selection',
      'new_arrival', 
      'seasonal',
      'sale',
      'staff_pick',
      'bestseller',
      'clearance',
      'trending',
      'featured',
      'recommended'
    ];
    
    // Always include store_selection as primary
    const types: string[] = ['store_selection'];
    
    // Randomly add 1-2 additional types for variety
    const additionalCount = Math.floor(Math.random() * 2) + 1; // 1-2 additional types
    const availableTypes = allTypes.filter(t => t !== 'store_selection');
    
    for (let i = 0; i < additionalCount && i < availableTypes.length; i++) {
      const randomIndex = Math.floor(Math.random() * availableTypes.length);
      const randomType = availableTypes[randomIndex];
      if (!types.includes(randomType)) {
        types.push(randomType);
        availableTypes.splice(randomIndex, 1);
      }
    }
    
    return types;
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
      
      // Use the correct Public API endpoint with proper persistent caching
      const url = `/api/public/products${params.toString() ? `?${params.toString()}` : ''}`;
      const result = await this.makeDefaultRequest<{ products: any[] }>(url, {}, cacheKey, undefined, {
        context: this.defaultContext,
        isolation: this.defaultIsolation
      });
      
      if (!result.success) {
        console.error('[ProductSingleton] Error fetching products:', result.error);
        return [];
      }
      // console.log(`[ProductSingleton] Fetched products:`, result.data);
      
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
        // Create category object from direct fields (API returns categoryName, categorySlug directly)
        category: product.categoryName ? {
          id: product.googleCategoryId || '',
          name: product.categoryName,
          slug: product.categorySlug || '',
          googleCategoryId: product.googleCategoryId,
          description: undefined,
          productCount: undefined
        } : undefined,
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
      // console.log(`[ProductSingleton] Stored products:`, transformedProducts);
      
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
      
      // Use the correct Public API endpoint with proper persistent caching
      const url = `/api/public/products/${productId}`;
      const result = await this.makeDefaultRequest(url, {}, cacheKey, undefined, {
        context: this.defaultContext,
        isolation: this.defaultIsolation
      });
      const product = (result as any)?.product || (result as any) || null;
      // console.log(`[ProductSingleton] Fetched product:`, product);
      
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
      // console.log(`[ProductSingleton] Stored product:`, transformedProduct);
      
      return transformedProduct;
    } catch (error) {
      console.error('[ProductSingleton] Error in fetchProductById:', error);
      return null;
    }
  }
  
  async fetchProductCategories(): Promise<ProductCategory[]> {
    try {
      const cacheKey = 'categories';
      const result = await this.makeDefaultRequest('/api/products/categories', {}, cacheKey);
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
