'use client';

// ====================
// STOREFRONT SERVICE - PLATFORM-ALIGNED
// ====================

// Service interfaces
interface ProductFilters {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  sort?: 'featured' | 'newest' | 'price-low' | 'price-high' | 'rating';
}

interface ProductResponse {
  items: CatalogProduct[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  title?: string;
  brand?: string;
  description?: string;
  priceCents: number;
  salePriceCents?: number;
  stock: number;
  imageUrl?: string;
  tenantId: string;
  categoryName?: string;
  categorySlug?: string;
  condition?: string;
  availability?: 'in_stock' | 'out_of' | 'preorder';
  ratingAvg?: number;
  ratingCount?: number;
  isFeatured?: boolean;
  featuredTypes?: string[];
  hasVariants?: boolean;
  metadata?: Record<string, any>;
  price?: number;
  salePrice?: number;
  currency?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

interface ServiceMetrics {
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  apiCalls: number;
  errors: number;
  lastUpdated: string;
}

// Service implementation
class StorefrontService {
  private static instance: StorefrontService;
  private memoryCache: Map<string, { data: any; expires: number }> = new Map();
  private options = {
    enableCache: true,
    defaultTTL: 300, // 5 minutes
    maxCacheSize: 1000,
    enableLogging: true,
  };
  private metrics: ServiceMetrics;
  private currentAuthContext: { token?: string; tenantId?: string } | null = null;

  private constructor() {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      apiCalls: 0,
      errors: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  static getInstance(): StorefrontService {
    if (!(globalThis as any).__storefrontServiceInstance) {
      (globalThis as any).__storefrontServiceInstance = new StorefrontService();
    }
    return (globalThis as any).__storefrontServiceInstance;
  }

  // Logging methods
  private logInfo(message: string, metadata?: any): void {
    if (this.options.enableLogging) {
      console.log(`[StorefrontService] INFO: ${message}`, metadata || '');
    }
  }

  private logError(message: string, error?: any): void {
    if (this.options.enableLogging) {
      console.error(`[StorefrontService] ERROR: ${message}`, error || '');
    }
  }

  // Authentication context
  setAuthContext(authContext: { token?: string; tenantId?: string }): void {
    this.currentAuthContext = authContext;
    this.logInfo('Authentication context set', { tenantId: authContext.tenantId });
  }

  getAuthContext() {
    return this.currentAuthContext;
  }

  // Cache management
  private getFromCache<T>(key: string): T | null {
    if (!this.options.enableCache) return null;

    const cached = this.memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      this.metrics.cacheHits++;
      return cached.data as T;
    }

    this.metrics.cacheMisses++;
    if (cached) this.memoryCache.delete(key); // Remove expired
    return null;
  }

  private setCache<T>(key: string, data: T, ttl?: number): void {
    if (!this.options.enableCache) return;

    const expires = Date.now() + ((ttl || this.options.defaultTTL) * 1000);
    this.memoryCache.set(key, { data, expires });
    this.metrics.cacheHitRate = this.memoryCache.size > 0 ?
      this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) : 0;
  }

  private updateMetrics(): void {
    this.metrics.lastUpdated = new Date().toISOString();
  }

  // API request method
  private async makeAPIRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const url = `${apiBaseUrl}${endpoint}`;

    // Add authentication headers
    const headers = new Headers(options.headers || {});
    if (this.currentAuthContext?.token) {
      headers.set('Authorization', `Bearer ${this.currentAuthContext.token}`);
    }
    if (this.currentAuthContext?.tenantId) {
      headers.set('X-Tenant-ID', this.currentAuthContext.tenantId);
    }

    const requestOptions: RequestInit = {
      ...options,
      headers
    };

    this.metrics.apiCalls++;
    this.updateMetrics();

    try {
      const response = await fetch(url, requestOptions);

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json() as T;
    } catch (error) {
      this.metrics.errors++;
      this.updateMetrics();
      this.logError('API request error:', error);
      throw error;
    }
  }

  // Public API methods with caching
  async getProducts(tenantId: string, filters: ProductFilters = {}): Promise<ProductResponse> {
    const cacheKey = `products:${tenantId}:${JSON.stringify(filters)}`;

    // Check cache first
    const cached = this.getFromCache<ProductResponse>(cacheKey);
    if (cached) {
      this.logInfo('Returning cached products', { tenantId, filters });
      return cached;
    }

    // Make API request
    this.logInfo('Fetching products from API', { tenantId, filters });

    const params = new URLSearchParams();
    if (filters.page) params.set('page', filters.page.toString());
    if (filters.limit) params.set('limit', filters.limit.toString());
    if (filters.category) params.set('category', filters.category);
    if (filters.search) params.set('search', filters.search);
    if (filters.sort) params.set('sort', filters.sort);

    const queryString = params.toString();
    const endpoint = `/api/storefront/${tenantId}/products${queryString ? `?${queryString}` : ''}`;

    const data = await this.makeAPIRequest<ProductResponse>(endpoint);

    // Cache the result
    this.setCache(cacheKey, data);

    return data;
  }

  async getCategories(tenantId: string): Promise<Category[]> {
    const cacheKey = `categories:${tenantId}`;

    // Check cache first
    const cached = this.getFromCache<Category[]>(cacheKey);
    if (cached) {
      this.logInfo('Returning cached categories', { tenantId });
      return cached;
    }

    // Make API request
    this.logInfo('Fetching categories from API', { tenantId });

    const data = await this.makeAPIRequest<{ categories: Category[] }>(`/api/storefront/${tenantId}/categories`);

    const categories = data.categories || [];

    // Cache the result
    this.setCache(cacheKey, categories);

    return categories;
  }

  async getFeaturedProducts(tenantId: string, filters: { limit?: number; search?: string } = {}): Promise<{ items: CatalogProduct[]; count: number; buckets: Record<string, CatalogProduct[]> }> {
    const cacheKey = `featured-products:${tenantId}:${JSON.stringify(filters)}`;

    // Check cache first
    const cached = this.getFromCache<any>(cacheKey);
    if (cached) {
      this.logInfo('Returning cached featured products', { tenantId, filters });
      return cached;
    }

    // Make API request
    this.logInfo('Fetching featured products from API', { tenantId, filters });

    const params = new URLSearchParams();
    if (filters.limit) params.set('limit', filters.limit.toString());
    if (filters.search) params.set('search', filters.search);

    const queryString = params.toString();
    const endpoint = `/api/storefront/${tenantId}/featured-products${queryString ? `?${queryString}` : ''}`;

    const data = await this.makeAPIRequest<{
      success: boolean;
      items: CatalogProduct[];
      totalCount: number;
      bucketCounts: Record<string, number>;
    }>(endpoint);

    // Transform response to match expected format
    const result = {
      items: data.items || [],
      count: data.totalCount || 0,
      buckets: {} as Record<string, CatalogProduct[]>
    };

    // Cache the result
    this.setCache(cacheKey, result);

    return result;
  }

  // Cache management methods
  clearCache(pattern?: string): void {
    if (!pattern) {
      this.memoryCache.clear();
      this.logInfo('Cleared all cache');
    } else {
      const keysToDelete: string[] = [];
      for (const key of this.memoryCache.keys()) {
        if (key.includes(pattern)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.memoryCache.delete(key));
      this.logInfo(`Cleared cache for pattern: ${pattern}`, { keysCleared: keysToDelete.length });
    }
    this.updateMetrics();
  }

  clearTenantCache(tenantId: string): void {
    this.clearCache(tenantId);
  }

  // Metrics
  getMetrics(): ServiceMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics.cacheHits = 0;
    this.metrics.cacheMisses = 0;
    this.metrics.cacheHitRate = 0;
    this.metrics.apiCalls = 0;
    this.metrics.errors = 0;
    this.metrics.lastUpdated = new Date().toISOString();
  }
}

// Export singleton instance
export const storefrontService = StorefrontService.getInstance();

// Export types
export type { CatalogProduct, Category, ProductFilters, ProductResponse, ServiceMetrics };
