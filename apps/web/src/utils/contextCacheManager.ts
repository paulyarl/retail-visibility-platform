/**
 * Context-Aware Cache Manager
 * 
 * Provides optimized caching strategies for different application contexts:
 * - Admin: Security-focused, short TTL
 * - Tenants: Isolated per-tenant, long TTL
 * - Products: Shared data, medium TTL
 * - Stores: Location-based, medium TTL
 */

import { CacheManager } from './cacheManager';

import cacheManager from './cacheManager';

export type AppContext = 'admin' | 'tenant' | 'product' | 'store' | 'user' | 'system';

interface ContextCacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum entries
  isolation: 'global' | 'tenant' | 'user' | 'admin';
  encryption: boolean; // Whether to encrypt sensitive data
  compression: boolean; // Whether to compress large data
  persistent: boolean; // Whether to persist to IndexedDB
}

const CONTEXT_CONFIGS: Record<AppContext, ContextCacheConfig> = {
  // Admin context: Security-focused, short TTL, encrypted
  admin: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 50,
    isolation: 'admin',
    encryption: true,
    compression: false,
    persistent: true
  },

  // Tenant context: Long TTL, isolated per tenant
  tenant: {
    ttl: 60 * 60 * 1000, // 1 hour
    maxSize: 100,
    isolation: 'tenant',
    encryption: true,
    compression: true,
    persistent: true
  },

  // Product context: Shared data, medium TTL, compressed
  product: {
    ttl: 30 * 60 * 1000, // 30 minutes
    maxSize: 500,
    isolation: 'global',
    encryption: false,
    compression: true,
    persistent: true
  },

  // Store context: Location-based, medium TTL
  store: {
    ttl: 20 * 60 * 1000, // 20 minutes
    maxSize: 200,
    isolation: 'global',
    encryption: false,
    compression: true,
    persistent: true
  },

  // User context: Personal data, session-based
  user: {
    ttl: 15 * 60 * 1000, // 15 minutes
    maxSize: 100,
    isolation: 'user',
    encryption: true,
    compression: false,
    persistent: false // Memory only for privacy
  },

  // System context: Configuration, long TTL
  system: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 50,
    isolation: 'global',
    encryption: false,
    compression: false,
    persistent: true
  }
};

class ContextCacheManager {
  private contexts: Map<AppContext, CacheManager> = new Map();

  constructor() {
    // Initialize cache managers for each context
    Object.entries(CONTEXT_CONFIGS).forEach(([context, config]) => {
      const manager = new CacheManager({
        dbName: `${context}-cache`,
        storeName: `${context}-store`,
        ttl: config.ttl,
        maxSize: config.maxSize
      });
      this.contexts.set(context as AppContext, manager);
    });
  }

  private getCacheKey(context: AppContext, key: string, isolationId?: string): string {
    const config = CONTEXT_CONFIGS[context];
    let prefix = context;

    // Add isolation prefix based on context type
    switch (config.isolation) {
      case 'tenant':
        prefix += `-${isolationId || 'default-tenant'}`;
        break;
      case 'user':
        prefix += `-${isolationId || 'anonymous'}`;
        break;
      case 'admin':
        prefix += `-${isolationId || 'system'}`;
        break;
      case 'global':
        // No isolation prefix
        break;
    }

    return `${prefix}-${key}`;
  }

  private async processData<T>(
    context: AppContext, 
    data: T, 
    operation: 'store' | 'retrieve'
  ): Promise<T> {
    const config = CONTEXT_CONFIGS[context];
    let processedData: T = data;

    // Compression for large data
    if (config.compression && operation === 'store') {
      if (JSON.stringify(data).length > 1024) { // Only compress if > 1KB
        processedData = await this.compress(data) as T;
      }
    }

    // Encryption for sensitive data
    if (config.encryption) {
      if (operation === 'store') {
        processedData = await this.encrypt(processedData) as T;
      } else {
        processedData = await this.decrypt(processedData) as T;
      }
    }

    // Decompression
    if (config.compression && operation === 'retrieve') {
      processedData = await this.decompress(processedData) as T;
    }

    return processedData;
  }

  private async compress(data: any): Promise<any> {
    // Simple compression simulation - in production use proper compression library
    return {
      __compressed: true,
      data: JSON.stringify(data)
    };
  }

  private async decompress(data: any): Promise<any> {
    if (data?.__compressed) {
      return JSON.parse(data.data);
    }
    return data;
  }

  private async encrypt(data: any): Promise<any> {
    // Simple encryption simulation - in production use proper encryption
    return {
      __encrypted: true,
      data: btoa(JSON.stringify(data))
    };
  }

  private async decrypt(data: any): Promise<any> {
    if (data?.__encrypted) {
      return JSON.parse(atob(data.data));
    }
    return data;
  }

  async get<T>(
    context: AppContext, 
    key: string, 
    isolationId?: string
  ): Promise<T | null> {
    const cacheKey = this.getCacheKey(context, key, isolationId);
    const manager = this.contexts.get(context);
    
    if (!manager) {
      console.warn(`[ContextCacheManager] No cache manager for context: ${context}`);
      return null;
    }

    try {
      const cached = await manager.get(cacheKey);
      if (cached) {
        return await this.processData<T>(context, cached as T, 'retrieve');
      }
      return null;
    } catch (error) {
      console.error(`[ContextCacheManager] Get failed for ${context}:`, error);
      return null;
    }
  }

  async set<T>(
    context: AppContext, 
    key: string, 
    data: T, 
    options: { 
      isolationId?: string; 
      ttl?: number 
    } = {}
  ): Promise<void> {
    const cacheKey = this.getCacheKey(context, key, options.isolationId);
    const manager = this.contexts.get(context);
    const config = CONTEXT_CONFIGS[context];
    
    if (!manager) {
      console.warn(`[ContextCacheManager] No cache manager for context: ${context}`);
      return;
    }

    // Skip persistence for user context (privacy)
    if (!config.persistent && context === 'user') {
      console.log(`[ContextCacheManager] Skipping persistence for ${context} context`);
      return;
    }

    try {
      const processedData = await this.processData<T>(context, data, 'store');
      await manager.set(cacheKey, processedData);
      
      console.log(`[ContextCacheManager] Stored in ${context} cache:`, {
        key: cacheKey,
        size: JSON.stringify(data).length,
        encrypted: config.encryption,
        compressed: config.compression
      });
    } catch (error) {
      console.error(`[ContextCacheManager] Set failed for ${context}:`, error);
    }
  }

  async remove(context: AppContext, key: string, isolationId?: string): Promise<void> {
    const cacheKey = this.getCacheKey(context, key, isolationId);
    const manager = this.contexts.get(context);
    
    if (!manager) return;

    try {
      await manager.remove(cacheKey);
      console.log(`[ContextCacheManager] Removed from ${context} cache:`, { key: cacheKey });
    } catch (error) {
      console.error(`[ContextCacheManager] Remove failed for ${context}:`, error);
    }
  }

  async clear(context?: AppContext): Promise<void> {
    if (context) {
      // Clear specific context
      const manager = this.contexts.get(context);
      if (manager) {
        await manager.clear();
        console.log(`[ContextCacheManager] Cleared ${context} cache`);
      }
    } else {
      // Clear all contexts
      for (const [ctx, manager] of this.contexts.entries()) {
        await manager.clear();
      }
      console.log('[ContextCacheManager] Cleared all context caches');
    }
  }

  getStats(): Record<AppContext, any> {
    const stats: Record<string, any> = {};
    for (const [context, manager] of this.contexts.entries()) {
      stats[context] = {
        ...manager.getStats(),
        config: CONTEXT_CONFIGS[context]
      };
    }
    return stats as Record<AppContext, any>;
  }

  // Context-specific helper methods
  async getAdminData<T>(key: string): Promise<T | null> {
    return this.get<T>('admin', key, 'system');
  }

  async setAdminData<T>(key: string, data: T): Promise<void> {
    return this.set('admin', key, data, { isolationId: 'system' });
  }

  async getTenantData<T>(tenantId: string, key: string): Promise<T | null> {
    return this.get<T>('tenant', key, tenantId);
  }

  async setTenantData<T>(tenantId: string, key: string, data: T): Promise<void> {
    return this.set('tenant', key, data, { isolationId: tenantId });
  }

  async getProductData<T>(key: string): Promise<T | null> {
    return this.get<T>('product', key);
  }

  async setProductData<T>(key: string, data: T): Promise<void> {
    return this.set('product', key, data);
  }

  async getStoreData<T>(location: string, key: string): Promise<T | null> {
    return this.get<T>('store', key, location);
  }

  async setStoreData<T>(location: string, key: string, data: T): Promise<void> {
    return this.set('store', key, data, { isolationId: location });
  }

  async getUserData<T>(userId: string, key: string): Promise<T | null> {
    return this.get<T>('user', key, userId);
  }

  async setUserData<T>(userId: string, key: string, data: T): Promise<void> {
    return this.set('user', key, data, { isolationId: userId });
  }
}

// Singleton instance
const contextCacheManager = new ContextCacheManager();

export default contextCacheManager;
export { CONTEXT_CONFIGS, type ContextCacheConfig };
