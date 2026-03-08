/**
 * Context-Aware Cache Service
 * 
 * Provides intelligent caching delegation by selecting the appropriate
 * composite cache manager based on context detection.
 */

import {
  CacheManager,
  TenantCacheManager,
  UserCacheManager,
  AdminCacheManager,
  PublicCacheManager,
  ProductCacheManager,
  ShopCacheManager,
  StoreCacheManager,
  SystemCacheManager,
  DirectoryCacheManager,
  GlobalCacheManager,
  type CacheContext,
  type CacheOptions
} from '../utils/cacheManager';

export interface ContextAwareCacheOptions extends CacheOptions {
  context?: CacheContext;
  isolation?: CacheContext;
  tenantId?: string;
  userId?: string;
}

/**
 * Context-aware caching service that delegates to appropriate composite cache managers
 */
export class ContextAwareCacheService {
  // Singleton instances for each context type
  private adminCache = new AdminCacheManager();
  private publicCache = new PublicCacheManager();
  private productCache = new ProductCacheManager();
  private shopCache = new ShopCacheManager();
  private storeCache = new StoreCacheManager();
  private systemCache = new SystemCacheManager();
  private directoryCache = new DirectoryCacheManager();
  private globalCache = new GlobalCacheManager();

  // Cached instances for tenant and user contexts (with ID-specific databases)
  private tenantCacheManagers = new Map<string, TenantCacheManager>();
  private userCacheManagers = new Map<string, UserCacheManager>();

  /**
   * Get cached data using context-aware cache manager selection
   */
  async get<T>(key: string, options?: ContextAwareCacheOptions): Promise<T | null> {
    if (!options?.context) {
      // Fall back to generic cache manager if no context provided
      const cacheManager = new CacheManager();
      return cacheManager.get<T>(key, options);
    }

    const cacheManager = this.getCacheManager(options.context, options);
    
    return cacheManager.get<T>(key, options);
  }

  /**
   * Set cached data using context-aware cache manager selection
   */
  async set<T>(key: string, data: T, options?: ContextAwareCacheOptions): Promise<void> {
    if (!options?.context) {
      // Fall back to generic cache manager if no context provided
      const cacheManager = new CacheManager();
      return cacheManager.set<T>(key, data, options);
    }

    const cacheManager = this.getCacheManager(options.context, options);
    
    return cacheManager.set<T>(key, data, options);
  }

  /**
   * Remove cached data using context-aware cache manager selection
   */
  async remove(key: string, options?: ContextAwareCacheOptions): Promise<void> {
    if (!options?.context) {
      // Fall back to generic cache manager if no context provided
      const cacheManager = new CacheManager();
      return cacheManager.remove(key);
    }

    const cacheManager = this.getCacheManager(options.context, options);
    return cacheManager.remove(key);
  }

  /**
   * Clear all cached data for a specific context
   */
  async clearContext(context: CacheContext, options?: Omit<ContextAwareCacheOptions, 'context'>): Promise<void> {
    const cacheManager = this.getCacheManager(context, options);
    return cacheManager.clear();
  }

  /**
   * Get cache statistics for a specific context
   */
  getContextStats(context: CacheContext, options?: Omit<ContextAwareCacheOptions, 'context'>) {
    const cacheManager = this.getCacheManager(context, options);
    return cacheManager.getStats();
  }

  /**
   * Select the appropriate cache manager based on context
   */
  private getCacheManager(context: CacheContext, options?: ContextAwareCacheOptions): CacheManager {
    switch (context) {
      case 'tenant':
        return this.getTenantCacheManager(options?.tenantId);
      
      case 'user':
        return this.getUserCacheManager(options?.userId);
      
      case 'admin':
        return this.adminCache;
      
      case 'public':
        return this.publicCache;
      
      case 'product':
        return this.productCache;
      
      case 'shop':
        return this.shopCache;
      
      case 'store':
        return this.storeCache;
      
      case 'system':
        return this.systemCache;
      
      case 'directory':
        return this.directoryCache;
      
      case 'global':
        return this.globalCache;
      
      default:
        // Fallback to generic cache manager
        return new CacheManager();
    }
  }

  /**
   * Get or create a tenant-specific cache manager
   */
  private getTenantCacheManager(tenantId?: string): TenantCacheManager {
    const key = tenantId || 'default';
    
    if (!this.tenantCacheManagers.has(key)) {
      const manager = new TenantCacheManager(tenantId);
      this.tenantCacheManagers.set(key, manager);
    }
    
    return this.tenantCacheManagers.get(key)!;
  }

  /**
   * Get or create a user-specific cache manager
   */
  private getUserCacheManager(userId?: string): UserCacheManager {
    const key = userId || 'default';
    
    if (!this.userCacheManagers.has(key)) {
      const manager = new UserCacheManager(userId);
      this.userCacheManagers.set(key, manager);
    }
    
    return this.userCacheManagers.get(key)!;
  }

  /**
   * Detect context from URL (utility method for API singletons)
   */
  detectContextFromUrl(url: string): CacheContext {
    // Tenant context
    if (url.includes('/tenants/') || url.includes('/tenant-') || url.includes('/platform/tenants')) {
      return 'tenant';
    }
    
    // Admin context
    if (url.includes('/admin/') || url.includes('/platform/admin') || url.includes('/system/')) {
      return 'admin';
    }
    
    // Public context
    if (url.includes('/public/') || url.includes('/platform/public')) {
      return 'public';
    }
    
    // Product context
    if (url.includes('/products/') || url.includes('/products') || url.includes('/product/') || url.includes('/product') || url.includes('/recommendations/') || url.includes('/featured-products')) {
      return 'product';
    }
    
    // Store context
    if (url.includes('/store/') || url.includes('/stores/') || url.includes('/tenant/') || url.includes('/storefront')) {
      return 'store';
    }
    
    // Shop context
    if (url.includes('/shops/') || url.includes('/shop/') || url.includes('/shops/directory') || url.includes('/shops')) {
      return 'shop';
    }
    
    // Directory context
    if (url.includes('/directory/') || url.includes('/directory')) {
      return 'directory';
    }
    
    // System context
    if (url.includes('/external/') || url.includes('/integrations/')) {
      return 'system';
    }
    
    // Default to user context for authenticated endpoints
    return 'user';
  }
}

// Export singleton instance for easy usage
export const contextAwareCacheService = new ContextAwareCacheService();
export default contextAwareCacheService;
