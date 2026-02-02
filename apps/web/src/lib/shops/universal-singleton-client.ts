/**
 * Universal Singleton Client Integration
 * Client-side implementation of the Universal Singleton pattern for shops system
 */

import { Shop, ShopIdentifiers, ShopResolution, ApiResponse } from '@/types/shop';

// ====================
// UNIVERSAL SINGLETON CLIENT
// ====================

export interface SingletonClientConfig {
  baseUrl: string;
  enableCache?: boolean;
  defaultTTL?: number;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  apiKey?: string;
}

export interface SingletonMetrics {
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  apiCalls: number;
  errors: number;
  lastUpdated: string;
}

export interface CacheEntry<T> {
  data: T;
  expires: number;
  timestamp: number;
}

/**
 * Universal Singleton Client
 * Provides consistent caching, metrics, and API communication
 */
export class UniversalSingletonClient {
  private static instance: UniversalSingletonClient;
  private config: SingletonClientConfig;
  private cache: Map<string, CacheEntry<any>>;
  private metrics: SingletonMetrics;
  private cacheKeyPrefix = 'shops_';

  private constructor(config: SingletonClientConfig) {
    this.config = {
      enableCache: true,
      defaultTTL: 300, // 5 minutes
      enableMetrics: true,
      enableLogging: true,
      ...config
    };

    this.cache = new Map();
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      apiCalls: 0,
      errors: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  static getInstance(config?: SingletonClientConfig): UniversalSingletonClient {
    if (!UniversalSingletonClient.instance) {
      const defaultConfig: SingletonClientConfig = {
        baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
        enableCache: true,
        defaultTTL: 300,
        enableMetrics: true,
        enableLogging: true
      };
      UniversalSingletonClient.instance = new UniversalSingletonClient(config || defaultConfig);
    }
    return UniversalSingletonClient.instance;
  }

  // ====================
  // CACHE MANAGEMENT
  // ====================

  private getCacheKey(key: string): string {
    return `${this.cacheKeyPrefix}${key}`;
  }

  private isCacheValid(entry: CacheEntry<any>): boolean {
    return Date.now() < entry.expires;
  }

  public setCache<T>(key: string, data: T, ttl?: number): void {
    if (!this.config.enableCache) return;

    const cacheKey = this.getCacheKey(key);
    const expires = Date.now() + ((ttl || this.config.defaultTTL || 300) * 1000);
    
    this.cache.set(cacheKey, {
      data,
      expires,
      timestamp: Date.now()
    });

    if (this.config.enableLogging) {
      console.log(`[SINGLETON] Cached: ${key}`);
    }
  }

  public getCache<T>(key: string): T | null {
    if (!this.config.enableCache) return null;

    const cacheKey = this.getCacheKey(key);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      this.metrics.cacheMisses++;
      return null;
    }

    if (!this.isCacheValid(entry)) {
      this.cache.delete(cacheKey);
      this.metrics.cacheMisses++;
      return null;
    }

    this.metrics.cacheHits++;
    this.updateCacheHitRate();

    if (this.config.enableLogging) {
      console.log(`[SINGLETON] Cache hit: ${key}`);
    }

    return entry.data;
  }

  private clearCache(key?: string): void {
    if (key) {
      this.cache.delete(this.getCacheKey(key));
    } else {
      this.cache.clear();
    }
  }

  private updateCacheHitRate(): void {
    const total = this.metrics.cacheHits + this.metrics.cacheMisses;
    this.metrics.cacheHitRate = total > 0 ? (this.metrics.cacheHits / total) * 100 : 0;
  }

  // ====================
  // API COMMUNICATION
  // ====================

  public async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    this.metrics.apiCalls++;

    // Get auth token dynamically for each request (matches platform api.ts implementation)
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };

    try {
      /* if (this.config.enableLogging) {
        console.log(`[SINGLETON] API Request: ${endpoint}`);
      } */

      const response = await fetch(url, {
        ...options,
        headers
      });

      const data = await response.json();

      if (!response.ok) {
        this.metrics.errors++;
        throw new Error(data.message || `HTTP ${response.status}`);
      }

     /*  if (this.config.enableLogging) {
        console.log(`[SINGLETON] API Success: ${endpoint}`);
      } */

      return data;
    } catch (error) {
      this.metrics.errors++;
      console.error(`[SINGLETON] API Error: ${endpoint}`, error);
      throw error;
    }
  }

  // ====================
  // SHOP-SPECIFIC METHODS
  // ====================

  /**
   * Get tenant auto ID for a given tenant ID
   */
  async getTenantAutoId(tenantId: string): Promise<string> {
    const cacheKey = `tenant_auto_id_${tenantId}`;
    const cached = this.getCache<string>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.makeRequest<{ data: { autoId: string } }>(
        `/api/tenant-auto-id/${tenantId}`
      );

      const autoId = (response.data as any)?.autoId || '';
      this.setCache(cacheKey, autoId, 3600); // Cache for 1 hour
      return autoId;
    } catch (error) {
      console.error('[SINGLETON] Failed to get tenant auto ID:', error);
      throw error;
    }
  }

  /**
   * Get all shop identifiers (tenantId, slug, autoId)
   */
  async getShopIdentifiers(tenantId: string, slug?: string): Promise<ShopIdentifiers> {
    const cacheKey = `shop_identifiers_${tenantId}`;
    const cached = this.getCache<ShopIdentifiers>(cacheKey);
    
    if (cached && !slug) {
      return cached;
    }

    try {
      const autoId = await this.getTenantAutoId(tenantId);
      const identifiers: ShopIdentifiers = {
        tenantId,
        slug,
        autoId
      };

      this.setCache(cacheKey, identifiers, 3600); // Cache for 1 hour
      return identifiers;
    } catch (error) {
      console.error('[SINGLETON] Failed to get shop identifiers:', error);
      throw error;
    }
  }

  /**
   * Resolve shop by any identifier (slug, tenantId, or autoId)
   */
  async resolveShop(identifier: string): Promise<ShopResolution> {
    const cacheKey = `resolve_shop_${identifier}`;
    const cached = this.getCache<ShopResolution>(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const response = await this.makeRequest<{ data: Shop; resolved: any }>(
        `/api/shops/${identifier}`
      );

      // Extract shop data from response, excluding the resolved field
      const { resolved, ...shopData } = response.data as any;
      
      const resolution: ShopResolution = {
        identifier,
        type: (resolved?.type as 'tenantId' | 'slug' | 'autoId') || ('tenantId' as const),
        found: response.success || false,
        shop: shopData
      };

      this.setCache(cacheKey, resolution, 1800); // Cache for 30 minutes
      return resolution;
    } catch (error) {
      const resolution: ShopResolution = {
        identifier,
        type: 'tenantId' as const,
        found: false
      };
      return resolution;
    }
  }

  /**
   * Generate shop URLs in multiple formats
   */
  async getShopUrls(tenantId: string, slug?: string): Promise<Shop['urls']> {
    const identifiers = await this.getShopIdentifiers(tenantId, slug);
    
    return {
      slugUrl: slug ? `/shops/${slug}` : null,
      tenantIdUrl: `/shops/${identifiers.tenantId}`,
      autoIdUrl: `/shops/${identifiers.autoId}`,
      canonicalUrl: slug ? `/shops/${slug}` : `/shops/${identifiers.tenantId}`
    };
  }

  // ====================
  // METRICS & UTILITIES
  // ====================

  getMetrics(): SingletonMetrics {
    this.updateCacheHitRate();
    this.metrics.lastUpdated = new Date().toISOString();
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      apiCalls: 0,
      errors: 0,
      lastUpdated: new Date().toISOString()
    };
  }

  clearAllCache(): void {
    this.cache.clear();
    if (this.config.enableLogging) {
      console.log('[SINGLETON] All cache cleared');
    }
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  // ====================
  // HEALTH CHECK
  // ====================

  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest('/api/health');
      return true;
    } catch (error) {
      console.error('[SINGLETON] Health check failed:', error);
      return false;
    }
  }
}

// ====================
// SHOP SERVICE
// ====================

export class ShopService {
  private client: UniversalSingletonClient;

  constructor(client?: UniversalSingletonClient) {
    this.client = client || UniversalSingletonClient.getInstance();
  }

  /**
   * Get shop directory with pagination and filtering
   */
  async getShopDirectory(params: {
    limit?: number;
    offset?: number;
    search?: string;
    category?: string;
    region?: string;
  } = {}): Promise<ApiResponse<Shop[]>> {
    const queryParams = new URLSearchParams();
    
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.offset) queryParams.append('offset', params.offset.toString());
    if (params.search) queryParams.append('search', params.search);
    if (params.category) queryParams.append('category', params.category);
    if (params.region) queryParams.append('region', params.region);

    const endpoint = `/api/shops/directory?${queryParams.toString()}`;
    const cacheKey = `shop_directory_${queryParams.toString()}`;
    
    const cached = this.client.getCache<ApiResponse<Shop[]>>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.client.makeRequest<Shop[]>(endpoint);
      this.client.setCache(cacheKey, response, 300); // Cache for 5 minutes
      return response;
    } catch (error) {
      console.error('[SHOP SERVICE] Failed to get shop directory:', error);
      throw error;
    }
  }

  /**
   * Get trending shops
   */
  async getTrendingShops(params: {
    limit?: number;
    region?: string;
  } = {}): Promise<ApiResponse<Shop[]>> {
    const queryParams = new URLSearchParams();
    
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.region) queryParams.append('region', params.region);

    const endpoint = `/api/shops/trending?${queryParams.toString()}`;
    const cacheKey = `trending_shops_${queryParams.toString()}`;
    
    const cached = this.client.getCache<ApiResponse<Shop[]>>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.client.makeRequest<Shop[]>(endpoint);
      this.client.setCache(cacheKey, response, 600); // Cache for 10 minutes
      return response;
    } catch (error) {
      console.error('[SHOP SERVICE] Failed to get trending shops:', error);
      throw error;
    }
  }

  /**
   * Get shop categories
   */
  async getShopCategories(): Promise<ApiResponse<any[]>> {
    const endpoint = '/api/shops/categories';
    const cacheKey = 'shop_categories';
    
    const cached = this.client.getCache<ApiResponse<any[]>>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await this.client.makeRequest<any[]>(endpoint);
      this.client.setCache(cacheKey, response, 3600); // Cache for 1 hour
      return response;
    } catch (error) {
      console.error('[SHOP SERVICE] Failed to get shop categories:', error);
      throw error;
    }
  }

  /**
   * Get shop details by identifier
   */
  async getShopByIdentifier(identifier: string): Promise<Shop | null> {
    const resolution = await this.client.resolveShop(identifier);
    return resolution.shop || null;
  }

  /**
   * Get shop products with auto ID information
   */
  async getShopProductsWithIdentifiers(tenantId: string, options: {
    limit?: number;
    featuredType?: string;
  } = {}): Promise<any[]> {
    // This would integrate with the shops service
    // For now, return empty array
    return [];
  }
}

export default UniversalSingletonClient;
