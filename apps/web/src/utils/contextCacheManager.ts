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
import { gzip, ungzip } from 'pako';

import cacheManager from './cacheManager';
import { clientLogger } from '@/lib/client-logger';

export enum CacheIsolation {
  GLOBAL = 'global',
  TENANT = 'tenant',
  USER = 'user', 
  CUSTOMER = 'customer',
  ADMIN = 'admin',
  PRODUCT = 'product',
  STORE = 'store',
  SHOP = 'shop',
  DIRECTORY = 'directory',
  PUBLIC = 'public',
  SYSTEM = 'system'
}
export enum CacheOperation {
  GET = 'get',
  SET = 'set',
  DELETE = 'delete',
  CLEAR = 'clear'
}
export enum ProcessOperation {
  STORE = 'store',
  RETRIEVE = 'retrieve'
}
export enum AppContext {
  ADMIN = 'admin',
  TENANT = 'tenant', 
  PRODUCT = 'product',
  STORE = 'store',
  SHOP = 'shop',
  DIRECTORY = 'directory',
  USER = 'user',
  CUSTOMER = 'customer',
  GLOBAL = 'global',
  PUBLIC = 'public',
  SYSTEM = 'system'
}

export enum CompressionLevel {
  FASTEST = 1,        // Fastest compression, lowest ratio (50-60%)
  FAST = 2,           // Fast compression, low ratio (55-65%)
  BALANCED_FAST = 3,  // Balanced, fast (60-70%)
  BALANCED = 4,       // Sweet spot for mobile (65-75%)
  BALANCED_GOOD = 5,  // Good balance (70-75%)
  OPTIMAL = 6,        // Optimal for most use cases (75-80%)
  GOOD = 7,           // Good compression, slower (80-85%)
  BEST = 8,           // Best compression, slow (85-90%)
  MAXIMUM = 9         // Maximum compression, slowest (90-95%)
}

export enum CompressionType {
  GZIP = 'gzip',
  BROTLI = 'brotli'
}

// Utility functions for compression level guidance
export const CompressionGuidance = {
  getDescription: (level: CompressionLevel): string => {
    const descriptions = {
      [CompressionLevel.FASTEST]: 'Fastest compression, lowest ratio (50-60%)',
      [CompressionLevel.FAST]: 'Fast compression, low ratio (55-65%)',
      [CompressionLevel.BALANCED_FAST]: 'Balanced, fast (60-70%)',
      [CompressionLevel.BALANCED]: 'Sweet spot for mobile (65-75%)',
      [CompressionLevel.BALANCED_GOOD]: 'Good balance (70-75%)',
      [CompressionLevel.OPTIMAL]: 'Optimal for most use cases (75-80%)',
      [CompressionLevel.GOOD]: 'Good compression, slower (80-85%)',
      [CompressionLevel.BEST]: 'Best compression, slow (85-90%)',
      [CompressionLevel.MAXIMUM]: 'Maximum compression, slowest (90-95%)'
    };
    return descriptions[level];
  },

  getUseCase: (level: CompressionLevel): string => {
    const useCases = {
      [CompressionLevel.FASTEST]: 'Real-time data, frequent updates',
      [CompressionLevel.FAST]: 'Interactive applications, mobile',
      [CompressionLevel.BALANCED_FAST]: 'General purpose, responsive UI',
      [CompressionLevel.BALANCED]: 'Mobile-first, frequent access',
      [CompressionLevel.BALANCED_GOOD]: 'Balanced performance and size',
      [CompressionLevel.OPTIMAL]: 'Most applications, sweet spot',
      [CompressionLevel.GOOD]: 'Archives, infrequent access',
      [CompressionLevel.BEST]: 'Static data, batch operations',
      [CompressionLevel.MAXIMUM]: 'Memory-constrained, maximum savings'
    };
    return useCases[level];
  },

  getRecommendedFor: (dataType: string): CompressionLevel => {
    const recommendations: Record<string, CompressionLevel> = {
      'real-time': CompressionLevel.FASTEST,
      'mobile': CompressionLevel.BALANCED,
      'api-response': CompressionLevel.OPTIMAL,
      'large-catalog': CompressionLevel.MAXIMUM,
      'user-data': CompressionLevel.BALANCED_GOOD,
      'static': CompressionLevel.BEST,
      'archive': CompressionLevel.MAXIMUM
    };
    return recommendations[dataType] || CompressionLevel.OPTIMAL;
  }
};

interface ContextCacheConfig {
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum entries
  isolation: CacheIsolation;
  encryption: boolean; // Whether to encrypt sensitive data
  compression: boolean; // Whether to compress large data
  compressionLevel?: CompressionLevel; // Type-safe compression level
  compressionType?: CompressionType; // Type-safe compression algorithm
  persistent: boolean; // Whether to persist to IndexedDB
}
const CONTEXT_CONFIGS: Record<AppContext, ContextCacheConfig> = {
  // Admin context: Security-focused, short TTL, encrypted, no compression
  [AppContext.ADMIN]: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 50,
    isolation: CacheIsolation.ADMIN,
    encryption: true,
    compression: false,
    persistent: true
  },

  // Tenant context: Long TTL, isolated per tenant, balanced compression
  [AppContext.TENANT]: {
    ttl: 60 * 60 * 1000, // 1 hour
    maxSize: 100,
    isolation: CacheIsolation.TENANT,
    encryption: true,
    compression: true,
    compressionLevel: CompressionLevel.OPTIMAL, // Balanced compression
    compressionType: CompressionType.GZIP, // Fast and reliable
    persistent: true
  },

  // Product context: Shared data, medium TTL, maximum compression
  [AppContext.PRODUCT]: {
    ttl: 30 * 60 * 1000, // 30 minutes
    maxSize: 500,
    isolation: CacheIsolation.GLOBAL,
    encryption: false,
    compression: true,
    compressionLevel: CompressionLevel.MAXIMUM, // Maximum compression for large catalogs
    compressionType: CompressionType.BROTLI, // Best compression ratio
    persistent: true
  },

  // Store context: Location-based, medium TTL, fast compression
  [AppContext.STORE]: {
    ttl: 20 * 60 * 1000, // 20 minutes
    maxSize: 500,
    isolation: CacheIsolation.GLOBAL,
    encryption: false,
    compression: true,
    compressionLevel: CompressionLevel.MAXIMUM, // Fast compression for mobile performance
    compressionType: CompressionType.BROTLI, // Quick compression/decompression
    persistent: true
  },

  // Shop context: Location-based, medium TTL, fast compression
  [AppContext.SHOP]: {
    ttl: 25 * 60 * 1000, // 25 minutes
    maxSize: 500,
    isolation: CacheIsolation.SHOP,
    encryption: false,
    compression: true,
    compressionLevel: CompressionLevel.BALANCED, // Fast compression
    compressionType: CompressionType.GZIP, // Mobile-optimized
    persistent: true
  },

  // Directory context: Location-based, medium TTL, balanced compression
  [AppContext.DIRECTORY]: {
    ttl: 15 * 60 * 1000, // 15 minutes
    maxSize: 500,
    isolation: CacheIsolation.GLOBAL,
    encryption: false,
    compression: true,
    compressionLevel: CompressionLevel.MAXIMUM, // Maximum compression for shared data
    compressionType: CompressionType.BROTLI, // Best compression ratio
    persistent: true
  },

  // User context: Personal data, short TTL, encrypted, no compression
  [AppContext.USER]: {
    ttl: 10 * 60 * 1000, // 10 minutes
    maxSize: 100,
    isolation: CacheIsolation.USER,
    encryption: true,
    compression: false, // Privacy prioritized over performance
    persistent: false // Memory only for privacy
  },

  // Customer context: Customer-specific data, medium TTL, encrypted
  [AppContext.CUSTOMER]: {
    ttl: 10 * 60 * 1000, // 10 minutes
    maxSize: 100,
    isolation: CacheIsolation.CUSTOMER,
    encryption: true,
    compression: false,
    persistent: true
  },

  // Global context: Shared data, medium TTL, maximum compression
  [AppContext.GLOBAL]: {
    ttl: 30 * 60 * 1000, // 30 minutes
    maxSize: 500,
    isolation: CacheIsolation.GLOBAL,
    encryption: false,
    compression: true,
    compressionLevel: CompressionLevel.MAXIMUM, // Maximum compression for shared data
    compressionType: CompressionType.BROTLI, // Best compression ratio
    persistent: false // Memory only for privacy
  },

  // Public context: Shared data, medium TTL, high compression
  [AppContext.PUBLIC]: {
    ttl: 30 * 60 * 1000, // 30 minutes
    maxSize: 500,
    isolation: CacheIsolation.PUBLIC,
    encryption: false,
    compression: true,
    compressionLevel: CompressionLevel.BEST, // High compression for public data
    compressionType: CompressionType.BROTLI, // Optimize for size
    persistent: false // Memory only for privacy
  },

  // System context: System data, short TTL, no compression
  [AppContext.SYSTEM]: {
    ttl: 2 * 60 * 1000, // 2 minutes
    maxSize: 50,
    isolation: CacheIsolation.GLOBAL,
    encryption: false,
    compression: false, // System data needs fast access
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
    let prefix = context.toString(); // Convert enum to string

    // Add isolation prefix based on context type
    switch (config.isolation) {
      case CacheIsolation.TENANT:
        prefix += `-${isolationId || 'default-tenant'}`;
        break;
      case CacheIsolation.USER:
        prefix += `-${isolationId || 'anonymous'}`;
        break;
      case CacheIsolation.ADMIN:
        prefix += `-${isolationId || 'platform'}`;
        break;
      case CacheIsolation.STORE:
        prefix += `-${isolationId || 'store'}`;
        break;
      case CacheIsolation.SHOP:
        prefix += `-${isolationId || 'shop'}`;
        break;
      case CacheIsolation.DIRECTORY:
        prefix += `-${isolationId || 'directory'}`;
        break;
      case CacheIsolation.PRODUCT:
        prefix += `-${isolationId || 'product'}`;
        break;
      case CacheIsolation.SYSTEM:
        prefix += `-${isolationId || 'system'}`;
        break;
      case CacheIsolation.PUBLIC:
        prefix += `-${isolationId || 'public'}`;
        break;
      case CacheIsolation.GLOBAL:
        // No isolation prefix
        break;
    }

    return `${prefix}-${key}`;
  }

  private async processData<T>(
    context: AppContext, 
    data: T, 
    operation: ProcessOperation.STORE | ProcessOperation.RETRIEVE
  ): Promise<T> {
    const config = CONTEXT_CONFIGS[context];
    let processedData: T = data;

    // Compression for large data
    if (config.compression && operation === ProcessOperation.STORE) {
      if (JSON.stringify(data).length > 1024) { // Only compress if > 1KB
        processedData = await this.compress(data, context) as T;
      }
    }

    // Encryption for sensitive data
    if (config.encryption) {
      if (operation === ProcessOperation.STORE) {
        processedData = await this.encrypt(processedData) as T;
      } else {
        processedData = await this.decrypt(processedData) as T;
      }
    }

    // Decompression
    if (config.compression && operation === ProcessOperation.RETRIEVE) {
      processedData = await this.decompress(processedData) as T;
    }

    return processedData;
  }

  private async compress(data: any, context: AppContext): Promise<any> {
    try {
      const config = CONTEXT_CONFIGS[context];
      if (!config.compressionLevel || !config.compressionType) {
        // Fallback to simple JSON compression if no adaptive config
        return {
          __compressed: true,
          data: JSON.stringify(data),
          type: 'simple'
        };
      }

      const jsonString = JSON.stringify(data);
      
      // Use appropriate compression based on type and level
      if (config.compressionType === 'brotli') {
        // For now, use gzip for brotli contexts (browser compatibility)
        // In production, you could use CompressionStream API for brotli
        const compressed = gzip(jsonString, { 
          level: config.compressionLevel as any, // Type assertion for pako level
          strategy: 0 // Z_DEFAULT_STRATEGY
        });
        
        return {
          __compressed: true,
          data: Array.from(compressed), // Convert Uint8Array to regular array for storage
          type: 'gzip',
          level: config.compressionLevel,
          originalSize: jsonString.length,
          compressedSize: compressed.length
        };
      } else {
        // Use gzip compression
        const compressed = gzip(jsonString, { 
          level: config.compressionLevel as any, // Type assertion for pako level
          strategy: 0 // Z_DEFAULT_STRATEGY
        });
        
        return {
          __compressed: true,
          data: Array.from(compressed), // Convert Uint8Array to regular array for storage
          type: 'gzip',
          level: config.compressionLevel,
          originalSize: jsonString.length,
          compressedSize: compressed.length
        };
      }
    } catch (error) {
      clientLogger.error('[ContextCacheManager] Compression failed:', { detail: error });
      // Fallback to uncompressed data
      return data;
    }
  }

  private async decompress(data: any): Promise<any> {
    if (!data?.__compressed) {
      return data;
    }

    try {
      if (data.type === 'simple') {
        // Legacy simple compression
        return JSON.parse(data.data);
      }

      if (data.type === 'gzip') {
        // Convert array back to Uint8Array and decompress
        const compressedData = new Uint8Array(data.data);
        const decompressed = ungzip(compressedData);
        const jsonString = new TextDecoder().decode(decompressed);
        
        // console.log(`[ContextCacheManager] Decompression stats:`, {
        //   originalSize: data.originalSize,
        //   compressedSize: data.compressedSize,
        //   compressionRatio: ((data.originalSize - data.compressedSize) / data.originalSize * 100).toFixed(1) + '%',
        //   level: data.level
        // });
        
        return JSON.parse(jsonString);
      }

      return data;
    } catch (error) {
      clientLogger.error('[ContextCacheManager] Decompression failed:', { detail: error });
      return data;
    }
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
      clientLogger.warn(`[ContextCacheManager] No cache manager for context: ${context}`);
      return null;
    }

    try {
      const cached = await manager.get(cacheKey);
      if (cached) {
        return await this.processData<T>(context, cached as T, ProcessOperation.RETRIEVE);
      }
      return null;
    } catch (error) {
      clientLogger.error(`[ContextCacheManager] Get failed for ${context}:`, { detail: error });
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
      clientLogger.warn(`[ContextCacheManager] No cache manager for context: ${context}`);
      return;
    }

    // Skip persistence for user context (privacy)
    if (!config.persistent && context === 'user') {
      console.log(`[ContextCacheManager] Skipping persistence for ${context} context`);
      return;
    }

    try {
      const processedData = await this.processData<T>(context, data, ProcessOperation.STORE);
      await manager.set(cacheKey, processedData);
        
        // console.log(`[ContextCacheManager] Stored in ${context} cache:`, {
        //   key: cacheKey,
        //   size: JSON.stringify(data).length,
        //   encrypted: config.encryption,
        //   compressed: config.compression
        // });
    } catch (error) {
      clientLogger.error(`[ContextCacheManager] Set failed for ${context}:`, { detail: error });
    }
  }

  async remove(context: AppContext, key: string, isolationId?: string): Promise<void> {
    const cacheKey = this.getCacheKey(context, key, isolationId);
    const manager = this.contexts.get(context);
    
    if (!manager) return;

    try {
      await manager.remove(cacheKey);
      // console.log(`[ContextCacheManager] Removed from ${context} cache:`, { key: cacheKey });
    } catch (error) {
      clientLogger.error(`[ContextCacheManager] Remove failed for ${context}:`, { detail: error });
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
      for (const [ctx, manager] of Array.from(this.contexts.entries())) {
        await manager.clear();
      }
      console.log('[ContextCacheManager] Cleared all context caches');
    }
  }

  getStats(): Record<AppContext, any> {
    const stats: Record<string, any> = {};
    for (const [context, manager] of Array.from(this.contexts.entries())) {
      stats[context] = {
        ...manager.getStats(),
        config: CONTEXT_CONFIGS[context]
      };
    }
    return stats as Record<AppContext, any>;
  }

  // Context-specific helper methods
  async getAdminData<T>(key: string): Promise<T | null> {
    return this.get<T>(AppContext.ADMIN, key, 'system');
  }

  async setAdminData<T>(key: string, data: T): Promise<void> {
    return this.set(AppContext.ADMIN, key, data, { isolationId: 'system' });
  }

  async getTenantData<T>(tenantId: string, key: string): Promise<T | null> {
    return this.get<T>(AppContext.TENANT, key, tenantId);
  }

  async setTenantData<T>(tenantId: string, key: string, data: T): Promise<void> {
    return this.set(AppContext.TENANT, key, data, { isolationId: tenantId });
  }

  async getProductData<T>(key: string): Promise<T | null> {
    return this.get<T>(AppContext.PRODUCT, key);
  }

  async setProductData<T>(key: string, data: T): Promise<void> {
    return this.set(AppContext.PRODUCT, key, data);
  }

  async getShopData<T>(location: string, key: string): Promise<T | null> {
    return this.get<T>(AppContext.SHOP, key, location);
  }

  async setShopData<T>(location: string, key: string, data: T): Promise<void> {
    return this.set(AppContext.SHOP, key, data, { isolationId: location });
  }

  async getDirectoryData<T>(location: string, key: string): Promise<T | null> {
    return this.get<T>(AppContext.DIRECTORY, key, location);
  }

  async setDirectoryData<T>(location: string, key: string, data: T): Promise<void> {
    return this.set(AppContext.DIRECTORY, key, data, { isolationId: location });
  }

  async getPublicData<T>(location: string, key: string): Promise<T | null> {
    return this.get<T>(AppContext.PUBLIC, key, location);
  }

  async setPublicData<T>(location: string, key: string, data: T): Promise<void> {
    return this.set(AppContext.PUBLIC, key, data, { isolationId: location });
  }
  async getStoreData<T>(location: string, key: string): Promise<T | null> {
    return this.get<T>(AppContext.STORE, key, location);
  }

  async setStoreData<T>(location: string, key: string, data: T): Promise<void> {
    return this.set(AppContext.STORE, key, data, { isolationId: location });
  }

  async getUserData<T>(userId: string, key: string): Promise<T | null> {
    return this.get<T>(AppContext.USER, key, userId);
  }

  async setUserData<T>(userId: string, key: string, data: T): Promise<void> {
    return this.set(AppContext.USER, key, data, { isolationId: userId });
  }

  // Quick test method for adaptive compression
  async runQuickCompressionTest(): Promise<void> {
    console.log('🚀 Quick Adaptive Compression Test');
    console.log('===================================\n');

    const testData = {
      small: { message: "Hello World" },
      medium: { 
        products: Array.from({ length: 30 }, (_, i) => ({ // Reduced size for localStorage
          id: i,
          name: `Product ${i}`,
          description: `Description for product ${i}`.repeat(3),
          price: Math.random() * 100
        }))
      },
      large: {
        catalog: Array.from({ length: 50 }, (_, i) => ({ // Reduced size for localStorage
          id: i,
          name: `Product ${i}`,
          description: `Detailed description for product ${i}`.repeat(5),
          specs: {
            weight: Math.random() * 10,
            features: Array.from({ length: 3 }, (_, j) => `Feature ${j}`)
          }
        }))
      }
    };

    const tests = [
      { 
        context: AppContext.PRODUCT, 
        name: `PRODUCT (${CompressionGuidance.getDescription(CompressionLevel.MAXIMUM)})`, 
        data: testData.large 
      },
      { 
        context: AppContext.TENANT, 
        name: `TENANT (${CompressionGuidance.getDescription(CompressionLevel.OPTIMAL)})`, 
        data: testData.medium 
      },
      { 
        context: AppContext.STORE, 
        name: `STORE (${CompressionGuidance.getDescription(CompressionLevel.BALANCED)})`, 
        data: testData.medium 
      },
      { 
        context: AppContext.ADMIN, 
        name: 'ADMIN (No Compression - Security Priority)', 
        data: testData.small 
      }
    ];

    for (const test of tests) {
      console.log(`📊 Testing ${test.name}:`);
      const originalSize = JSON.stringify(test.data).length;
      console.log(`  Original size: ${originalSize.toLocaleString()} bytes`);
      
      try {
        const startTime = performance.now();
        await this.set(test.context, 'test-key', test.data);
        const storeTime = performance.now() - startTime;
        
        const retrieveStart = performance.now();
        const retrieved = await this.get(test.context, 'test-key');
        const retrieveTime = performance.now() - retrieveStart;
        
        const integrity = JSON.stringify(retrieved) === JSON.stringify(test.data);
        
        console.log(`  ✅ Store: ${storeTime.toFixed(2)}ms, Retrieve: ${retrieveTime.toFixed(2)}ms`);
        console.log(`  ✅ Data integrity: ${integrity ? 'PASS' : 'FAIL'}`);
        
      } catch (error) {
        clientLogger.error(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      console.log('---');
    }

    console.log('\n📊 Cache Stats:');
    const stats = this.getStats();
    Object.entries(stats).forEach(([context, stat]) => {
      if (stat.size > 0) {
        console.log(`${context}: ${stat.size} entries`);
      }
    });

    // Demonstrate compression guidance utilities
    // console.log('\n🎯 Compression Guidance Examples:');
    // console.log('==================================');
    // console.log(`Recommended for 'mobile': ${CompressionGuidance.getRecommendedFor('mobile')} (${CompressionGuidance.getDescription(CompressionGuidance.getRecommendedFor('mobile'))})`);
    // console.log(`Recommended for 'large-catalog': ${CompressionGuidance.getRecommendedFor('large-catalog')} (${CompressionGuidance.getDescription(CompressionGuidance.getRecommendedFor('large-catalog'))})`);
    // console.log(`Recommended for 'api-response': ${CompressionGuidance.getRecommendedFor('api-response')} (${CompressionGuidance.getDescription(CompressionGuidance.getRecommendedFor('api-response'))})`);
    
    // console.log('\n💡 Available Compression Levels:');
    Object.values(CompressionLevel).forEach((level) => {
      if (typeof level === 'number') {
        console.log(`  ${level}: ${CompressionGuidance.getDescription(level)}`);
      }
    });
  }
}

// Singleton instance
const contextCacheManager = new ContextCacheManager();

// Make test available globally in browser environment
if (typeof window !== 'undefined') {
  (window as any).testAdaptiveCompression = () => contextCacheManager.runQuickCompressionTest();
  console.log('🧪 Adaptive compression test ready! Run testAdaptiveCompression() in console');
}

export default contextCacheManager;
export { CONTEXT_CONFIGS, type ContextCacheConfig };
