/**
 * Context-Aware Cache Service
 * 
 * Provides intelligent caching delegation by selecting the appropriate
 * enhanced context-aware cache manager based on context detection.
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

import { ContextAwareCacheManager, EnhancedCacheOptions } from '../utils/contextAwareCacheManager';
import { AppContext, CacheIsolation } from '../utils/contextCacheManager';

export interface ContextAwareCacheOptions extends CacheOptions {
  context?: CacheContext | AppContext; // Allow both types for compatibility
  isolation?: CacheContext;
  tenantId?: string;
  userId?: string;
}

/**
 * Enhanced context-aware caching service that delegates to appropriate
 * context-aware cache managers with intelligent storage strategies
 */
export class ContextAwareCacheService {
  // Enhanced singleton instances with context-aware strategies
  private adminCache = new ContextAwareCacheManager({ context: AppContext.ADMIN } as EnhancedCacheOptions);
  private publicCache = new ContextAwareCacheManager({ context: AppContext.PUBLIC } as EnhancedCacheOptions);
  private productCache = new ContextAwareCacheManager({ context: AppContext.PRODUCT } as EnhancedCacheOptions);
  private shopCache = new ContextAwareCacheManager({ context: AppContext.SHOP } as EnhancedCacheOptions);
  private storeCache = new ContextAwareCacheManager({ context: AppContext.STORE } as EnhancedCacheOptions);
  private systemCache = new ContextAwareCacheManager({ context: AppContext.SYSTEM } as EnhancedCacheOptions);
  private directoryCache = new ContextAwareCacheManager({ context: AppContext.DIRECTORY } as EnhancedCacheOptions);
  private globalCache = new ContextAwareCacheManager({ context: AppContext.GLOBAL } as EnhancedCacheOptions);

  // Cached instances for tenant and user contexts (with ID-specific databases)
  private tenantCacheManagers = new Map<string, ContextAwareCacheManager>();
  private userCacheManagers = new Map<string, ContextAwareCacheManager>();

  /**
   * Get cached data using enhanced context-aware cache manager selection
   */
  async get<T>(key: string, options?: ContextAwareCacheOptions): Promise<T | null> {
    if (!options?.context) {
      // Fall back to generic enhanced cache manager if no context provided
      const cacheManager = new ContextAwareCacheManager();
      return cacheManager.get<T>(key, options as EnhancedCacheOptions);
    }

    const cacheManager = this.getCacheManager(options.context, options);
    
    // Convert options to EnhancedCacheOptions
    const enhancedOptions: EnhancedCacheOptions = {
      ...options,
      context: this.convertToAppContext(options.context),
      isolation: this.convertIsolation(options.isolation)
    };
    
    return cacheManager.get<T>(key, enhancedOptions);
  }

  /**
   * Set cached data using enhanced context-aware cache manager selection
   */
  async set<T>(key: string, data: T, options?: ContextAwareCacheOptions): Promise<void> {
    if (!options?.context) {
      // Fall back to generic enhanced cache manager if no context provided
      const cacheManager = new ContextAwareCacheManager();
      return cacheManager.set<T>(key, data, options as EnhancedCacheOptions);
    }

    const cacheManager = this.getCacheManager(options.context, options);
    
    // Convert options to EnhancedCacheOptions
    const enhancedOptions: EnhancedCacheOptions = {
      ...options,
      context: this.convertToAppContext(options.context),
      isolation: this.convertIsolation(options.isolation)
    };
    
    return cacheManager.set<T>(key, data, enhancedOptions);
  }

  /**
   * Remove cached data using enhanced context-aware cache manager selection
   */
  async remove(key: string, options?: ContextAwareCacheOptions): Promise<void> {
    if (!options?.context) {
      // Fall back to generic enhanced cache manager if no context provided
      const cacheManager = new ContextAwareCacheManager();
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
   * Convert between CacheContext and AppContext enums
   */
  private convertToAppContext(context: CacheContext | AppContext): AppContext {
    // If it's already AppContext, return as-is
    if (Object.values(AppContext).includes(context as AppContext)) {
      return context as AppContext;
    }
    
    // Convert CacheContext to AppContext
    const contextMap: Record<CacheContext, AppContext> = {
      'admin': AppContext.ADMIN,
      'tenant': AppContext.TENANT,
      'product': AppContext.PRODUCT,
      'store': AppContext.STORE,
      'shop': AppContext.SHOP,
      'directory': AppContext.DIRECTORY,
      'user': AppContext.USER,
      'global': AppContext.GLOBAL,
      'public': AppContext.PUBLIC,
      'system': AppContext.SYSTEM
    };
    
    return contextMap[context as CacheContext] || AppContext.GLOBAL;
  }

  /**
   * Convert CacheContext to CacheIsolation for EnhancedCacheOptions
   */
  private convertIsolation(isolation?: CacheContext): CacheIsolation | undefined {
    if (!isolation) return undefined;
    
    const isolationMap: Record<CacheContext, CacheIsolation> = {
      'admin': CacheIsolation.ADMIN,
      'tenant': CacheIsolation.TENANT,
      'product': CacheIsolation.PRODUCT,
      'store': CacheIsolation.STORE,
      'shop': CacheIsolation.SHOP,
      'directory': CacheIsolation.DIRECTORY,
      'user': CacheIsolation.USER,
      'global': CacheIsolation.GLOBAL,
      'public': CacheIsolation.PUBLIC,
      'system': CacheIsolation.SYSTEM
    };
    
    return isolationMap[isolation];
  }

  /**
   * Select the appropriate enhanced cache manager based on context
   */
  private getCacheManager(context: CacheContext | AppContext, options?: ContextAwareCacheOptions): ContextAwareCacheManager {
    const appContext = this.convertToAppContext(context);
    
    switch (appContext) {
      case AppContext.TENANT:
        return this.getTenantCacheManager(options?.tenantId);
      
      case AppContext.USER:
        return this.getUserCacheManager(options?.userId);
      
      case AppContext.ADMIN:
        return this.adminCache;
      
      case AppContext.PUBLIC:
        return this.publicCache;
      
      case AppContext.PRODUCT:
        return this.productCache;
      
      case AppContext.SHOP:
        return this.shopCache;
      
      case AppContext.STORE:
        return this.storeCache;
      
      case AppContext.SYSTEM:
        return this.systemCache;
      
      case AppContext.DIRECTORY:
        return this.directoryCache;
      
      case AppContext.GLOBAL:
        return this.globalCache;
      
      default:
        // Fallback to generic enhanced cache manager
        return new ContextAwareCacheManager();
    }
  }

  /**
   * Get or create a tenant-specific enhanced cache manager
   */
  private getTenantCacheManager(tenantId?: string): ContextAwareCacheManager {
    const key = tenantId || 'default';
    
    if (!this.tenantCacheManagers.has(key)) {
      const manager = new ContextAwareCacheManager({ context: AppContext.TENANT, tenantId } as EnhancedCacheOptions);
      this.tenantCacheManagers.set(key, manager);
    }
    
    return this.tenantCacheManagers.get(key)!;
  }

  /**
   * Get or create a user-specific enhanced cache manager
   */
  private getUserCacheManager(userId?: string): ContextAwareCacheManager {
    const key = userId || 'default';
    
    if (!this.userCacheManagers.has(key)) {
      const manager = new ContextAwareCacheManager({ context: AppContext.USER, userId } as EnhancedCacheOptions);
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
