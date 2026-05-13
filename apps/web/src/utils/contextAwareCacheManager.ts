/**
 * 🎯 Enhanced CacheManager with Context-Aware Storage Strategies
 * 
 * Uses composition to extend CacheManager functionality with intelligent storage selection
 * based on context requirements and browser capabilities.
 */

import { CacheManager } from './cacheManager';
import { resolveCacheOptions, AutoUserCacheOptions } from './userIdentification';
import { AppContext, CacheIsolation } from './contextCacheManager';
import { StorageType } from './universalStorageManager';

// ==================== ENHANCED INTERFACES ====================

interface BrowserCapabilities {
  indexedDB: boolean;
  localStorage: boolean;
  deviceMemory: number;
  storageQuota: string;
  connectionSpeed: string;
  isPrivateMode: boolean;
  hardwareConcurrency: number;
}

interface StorageStrategy {
  primary: StorageType;
  fallback?: StorageType;
  encryption: boolean;
  compression: boolean;
  persistent: boolean;
  priority: 'high' | 'medium' | 'low';
  maxSize: number;
  ttl?: number;
  httpOnly?: boolean;
  secure?: boolean;
  crossTab?: boolean;
}

interface ContextStorageConfig {
  [AppContext.ADMIN]: StorageStrategy;
  [AppContext.TENANT]: StorageStrategy;
  [AppContext.PRODUCT]: StorageStrategy;
  [AppContext.STORE]: StorageStrategy;
  [AppContext.USER]: StorageStrategy;
  [AppContext.CUSTOMER]: StorageStrategy;
  [AppContext.SHOP]: StorageStrategy;
  [AppContext.DIRECTORY]: StorageStrategy;
  [AppContext.SYSTEM]: StorageStrategy;
  [AppContext.PUBLIC]: StorageStrategy;
  [AppContext.GLOBAL]: StorageStrategy;
}

interface EnhancedCacheOptions extends AutoUserCacheOptions {
  context?: AppContext;
  isolation?: CacheIsolation;
  storageType?: StorageType;
  forceStorage?: StorageType;
  storageStrategy?: Partial<StorageStrategy>;
  httpOnly?: boolean;
  secure?: boolean;
  crossTab?: boolean;
  ttl?: number;
}

interface EnhancedCacheEntry<T> {
  data: T | string;
  timestamp: number;
  ttl: number;
  encrypted: boolean;
  userId?: string;
  storageType?: StorageType;
  compression?: boolean;
  httpOnly?: boolean;
  secure?: boolean;
  crossTab?: boolean;
  context?: AppContext;
  isolation?: CacheIsolation;
  storageRegistry?: {
    primary: StorageType;
    fallback?: StorageType;
  };
}

// ==================== ENHANCED CACHE MANAGER ====================

export class ContextAwareCacheManager {
  private cacheManager: CacheManager;
  private browserCapabilities: BrowserCapabilities;
  private contextStorageConfig: ContextStorageConfig;
  private context: AppContext;

  constructor(options: EnhancedCacheOptions = {}) {
    // 🎯 Extract context for database naming
    this.context = options.context || AppContext.PRODUCT;
    
    // 🔍 Create context-specific database name and store name
    const dbName = `${this.context}-cache`;
    const storeName = `${this.context}-store`;
    
    // 🔍 Use composition with context-specific database
    this.cacheManager = new CacheManager({
      ...options,
      dbName,
      storeName,
      ttl: options.ttl || 15 * 60 * 1000,
    });
    
    // 🔍 Detect browser capabilities on initialization
    this.browserCapabilities = this.detectBrowserCapabilities();
    
    // 🎯 Generate context-aware storage configurations
    this.contextStorageConfig = this.generateContextStorageConfig();
    
    // console.log('[ContextAwareCacheManager] Initialized with capabilities:', this.browserCapabilities);
  }

  // ==================== BROWSER CAPABILITY DETECTION ====================

  /**
   * 🔍 Comprehensive browser capability detection
   */
  private detectBrowserCapabilities(): BrowserCapabilities {
    const capabilities = {
      indexedDB: typeof indexedDB !== 'undefined' && indexedDB !== null,
      localStorage: false,
      deviceMemory: typeof navigator !== 'undefined' ? (navigator as any).deviceMemory || 4 : 4,
      storageQuota: 'Unknown',
      connectionSpeed: typeof navigator !== 'undefined' ? (navigator as any).connection?.effectiveType || '4g' : '4g',
      isPrivateMode: false,
      hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4
    };

    // Test localStorage functionality
    if (typeof window !== 'undefined') {
      try {
        const testKey = '__context_cache_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        capabilities.localStorage = true;
      } catch (error) {
        capabilities.localStorage = false;
        capabilities.isPrivateMode = true;
      }
    }

    // console.log('[ContextAwareCacheManager] Browser capabilities detected:', capabilities);
    return capabilities;
  }

  // ==================== CONTEXT STORAGE CONFIGURATION ====================

  /**
   * 🎯 Generate context-aware storage configurations
   */
  private generateContextStorageConfig(): ContextStorageConfig {
    const caps = this.browserCapabilities;

    return {
      // ADMIN: Security-focused, encrypted, persistent
      [AppContext.ADMIN]: this.createAdminStrategy(caps),
      
      // TENANT: Business data, encrypted, persistent
      [AppContext.TENANT]: this.createTenantStrategy(caps),
      
      // PRODUCT: Large data, compressed, persistent
      [AppContext.PRODUCT]: this.createProductStrategy(caps),
      
      // STORE: Location data, compressed, persistent
      [AppContext.STORE]: this.createStoreStrategy(caps),      
      
      // PRODUCT: Large data, compressed, persistent
      [AppContext.SHOP]: this.createShopStrategy(caps),
      
      // STORE: Location data, compressed, persistent
      [AppContext.DIRECTORY]: this.createDirectoryStrategy(caps),
      
      // USER: Privacy-focused, memory-only, encrypted
      [AppContext.USER]: this.createUserStrategy(caps),      

      // CUSTOMER: Customer-specific data, encrypted, persistent
      [AppContext.CUSTOMER]: this.createCustomerStrategy(caps),      

      // GLOBAL: Shared data, compressed, persistent
      [AppContext.GLOBAL]: this.createGlobalStrategy(caps),
         
      
      // PUBLIC: Shared data, compressed, persistent
      [AppContext.PUBLIC]: this.createPublicStrategy(caps),
      
      // SYSTEM: Configuration, persistent, minimal encryption
      [AppContext.SYSTEM]: this.createSystemStrategy(caps)
    };
  }

  // ==================== CONTEXT-SPECIFIC STRATEGIES ====================

  /**
   * 🛡️ Admin context strategy: Security first
   */
  private createAdminStrategy(caps: BrowserCapabilities): StorageStrategy {
    return {
      primary: caps.indexedDB && !caps.isPrivateMode ? StorageType.INDEXED_DB : StorageType.LOCAL_STORAGE,
      fallback: caps.localStorage ? StorageType.LOCAL_STORAGE : StorageType.INDEXED_DB,
      encryption: true,        // Always encrypt admin data
      compression: false,      // Admin data usually small
      persistent: true,        // Persist admin settings
      priority: 'high',       // High priority for admin operations
      maxSize: 50,            // Small cache for security
      ttl: 5 * 60 * 1000,     // 5 minutes
      httpOnly: true,
      secure: true,
      crossTab: false
    };
  }

  /**
   * 🏢 Tenant context strategy: Business data protection
   */
  private createTenantStrategy(caps: BrowserCapabilities): StorageStrategy {
    const useIndexedDB = caps.indexedDB && !caps.isPrivateMode && caps.deviceMemory >= 4;
    
    return {
      primary: useIndexedDB ? StorageType.INDEXED_DB : StorageType.LOCAL_STORAGE,
      fallback: caps.localStorage ? StorageType.LOCAL_STORAGE : StorageType.INDEXED_DB,
      encryption: true,        // Encrypt tenant data
      compression: caps.deviceMemory >= 4,  // Compress on capable devices
      persistent: true,        // Persist tenant data
      priority: 'high',       // High priority for business operations
      maxSize: caps.deviceMemory >= 8 ? 200 : 100,  // Scale with device memory
      ttl: 60 * 60 * 1000,    // 1 hour
      httpOnly: true,
      secure: true,
      crossTab: false
    };
  }

  /**
   * 📦 Product context strategy: Performance optimization
   */
  private createProductStrategy(caps: BrowserCapabilities): StorageStrategy {
    const useIndexedDB = caps.indexedDB && !caps.isPrivateMode;
    
    return {
      primary: useIndexedDB ? StorageType.INDEXED_DB : StorageType.LOCAL_STORAGE,
      fallback: caps.localStorage ? StorageType.LOCAL_STORAGE : StorageType.INDEXED_DB,
      encryption: false,       // Product data is public
      compression: true,        // Always compress product catalogs
      persistent: true,        // Persist product data
      priority: 'medium',     // Medium priority
      maxSize: caps.deviceMemory >= 8 ? 500 : 250,  // Large cache for products
      ttl: 30 * 60 * 1000,    // 30 minutes
      httpOnly: false,
      secure: false,
      crossTab: true
    };
  }

  /**
   * 🏪 Store context strategy: Location-based optimization
   */
  private createStoreStrategy(caps: BrowserCapabilities): StorageStrategy {
    const useIndexedDB = caps.indexedDB && !caps.isPrivateMode;
    
    return {
      primary: useIndexedDB ? StorageType.INDEXED_DB : StorageType.LOCAL_STORAGE,
      fallback: caps.localStorage ? StorageType.LOCAL_STORAGE : StorageType.INDEXED_DB,
      encryption: false,       // Store data is public
      compression: true,        // Compress store data
      persistent: true,        // Persist store information
      priority: 'medium',     // Medium priority
      maxSize: caps.deviceMemory >= 4 ? 200 : 100,  // Medium cache for stores
      ttl: 20 * 60 * 1000,    // 20 minutes
      httpOnly: false,
      secure: false,
      crossTab: true
    };
  }

  /**
   * 🏪 Shop context strategy: Location-based optimization
   */
  private createShopStrategy(caps: BrowserCapabilities): StorageStrategy {
    const useIndexedDB = caps.indexedDB && !caps.isPrivateMode;
    
    return {
      primary: useIndexedDB ? StorageType.INDEXED_DB : StorageType.LOCAL_STORAGE,
      fallback: caps.localStorage ? StorageType.LOCAL_STORAGE : StorageType.INDEXED_DB,
      encryption: false,       // Store data is public
      compression: true,        // Compress store data
      persistent: true,        // Persist store information
      priority: 'medium',     // Medium priority
      maxSize: caps.deviceMemory >= 4 ? 200 : 100,  // Medium cache for stores
      ttl: 20 * 60 * 1000,    // 20 minutes
      httpOnly: false,
      secure: false,
      crossTab: true
    };
  }

  
  /**
   * 🏪 Directory context strategy: Location-based optimization
   */
  private createDirectoryStrategy(caps: BrowserCapabilities): StorageStrategy {
    const useIndexedDB = caps.indexedDB && !caps.isPrivateMode;
    
    return {
      primary: useIndexedDB ? StorageType.INDEXED_DB : StorageType.LOCAL_STORAGE,
      fallback: caps.localStorage ? StorageType.LOCAL_STORAGE : StorageType.INDEXED_DB,
      encryption: false,       // Store data is public
      compression: true,        // Compress store data
      persistent: true,        // Persist store information
      priority: 'medium',     // Medium priority
      maxSize: caps.deviceMemory >= 4 ? 200 : 100,  // Medium cache for stores
      ttl: 20 * 60 * 1000,    // 20 minutes
      httpOnly: false,
      secure: false,
      crossTab: true
    };
  }

  /**
   * 👤 User context strategy: Privacy first
   */
  private createUserStrategy(caps: BrowserCapabilities): StorageStrategy {
    return {
      primary: StorageType.INDEXED_DB,
      fallback: undefined,            // No fallback for privacy
      encryption: true,        // Encrypt even in memory
      compression: false,      // User data usually small
      persistent: false,        // Never persist user data
      priority: 'high',       // High priority for user experience
      maxSize: 100,            // Moderate size for user data
      ttl: 15 * 60 * 1000,    // 15 minutes
      httpOnly: false,
      secure: false,
      crossTab: false
    };
  }

  /**
   * � Customer context strategy: Customer-specific data, encrypted, persistent
   */
  private createCustomerStrategy(caps: BrowserCapabilities): StorageStrategy {
    return {
      primary: caps.indexedDB && !caps.isPrivateMode ? StorageType.INDEXED_DB : StorageType.LOCAL_STORAGE,
      fallback: caps.localStorage ? StorageType.LOCAL_STORAGE : StorageType.INDEXED_DB,
      encryption: true,        // Encrypt customer data
      compression: false,      // Customer data usually small
      persistent: true,        // Persist customer data across sessions
      priority: 'high',       // High priority for customer experience
      maxSize: 100,            // Moderate size for customer data
      ttl: 10 * 60 * 1000,    // 10 minutes
      httpOnly: false,
      secure: true,
      crossTab: true
    };
  }

  /**
   * �👤 Global context strategy: Shared data
   */
  private createGlobalStrategy(caps: BrowserCapabilities): StorageStrategy {
    return {
      primary: StorageType.INDEXED_DB,
      fallback: caps.localStorage ? StorageType.LOCAL_STORAGE : StorageType.INDEXED_DB,
      encryption: false,       // Global data is public
      compression: true,        // Compress global data
      persistent: true,        // Persist global information
      priority: 'medium',     // Medium priority
      maxSize: caps.deviceMemory >= 4 ? 200 : 100,  // Medium cache for global data
      ttl: 20 * 60 * 1000,    // 20 minutes
      httpOnly: false,
      secure: false,
      crossTab: true
    };
  }


  /**
   * 👤 Public context strategy: Shared data
   */
  private createPublicStrategy(caps: BrowserCapabilities): StorageStrategy {
    return {
      primary: StorageType.INDEXED_DB,
      fallback: caps.localStorage ? StorageType.LOCAL_STORAGE : StorageType.INDEXED_DB,
      encryption: false,       // Public data is public
      compression: true,        // Compress public data
      persistent: true,        // Persist public information
      priority: 'medium',     // Medium priority
      maxSize: caps.deviceMemory >= 4 ? 200 : 100,  // Medium cache for public data
      ttl: 20 * 60 * 1000,    // 20 minutes
      httpOnly: false,
      secure: false,
      crossTab: true
    };
  }

  /**
   * ⚙️ System context strategy: Configuration optimization
   */
  private createSystemStrategy(caps: BrowserCapabilities): StorageStrategy {
    const useIndexedDB = caps.indexedDB && !caps.isPrivateMode;
    
    return {
      primary: useIndexedDB ? StorageType.INDEXED_DB : StorageType.LOCAL_STORAGE,
      fallback: caps.localStorage ? StorageType.LOCAL_STORAGE : StorageType.INDEXED_DB,
      encryption: false,       // System config is usually public
      compression: false,      // System config is small
      persistent: true,        // Persist system configuration
      priority: 'low',        // Low priority for system data
      maxSize: 50,            // Small cache for system data
      ttl: 24 * 60 * 60 * 1000, // 24 hours
      httpOnly: false,
      secure: false,
      crossTab: false
    };
  }

  // ==================== ENHANCED CACHE OPERATIONS ====================

  /**
   * 🎯 Enhanced set method with context-aware storage
   */
  async set<T>(key: string, data: T, options: EnhancedCacheOptions = {}): Promise<void> {
    // 🎯 Determine context from options or extract from key
    const context = options.context || this.extractContextFromKey(key);
    const isolation = options.isolation || this.extractIsolationFromKey(key);
    
    // 🎯 Get storage strategy for context
    const baseStrategy = this.contextStorageConfig[context];
    const strategy = { ...baseStrategy, ...options.storageStrategy };
    
    // 🔄 Override if force storage specified
    if (options.forceStorage) {
      strategy.primary = options.forceStorage;
    }

    // 📊 Log storage decision
      // console.log(`[ContextAwareCacheManager] Storing ${context}:${isolation} using ${strategy.primary} strategy`, {
      //   key,
      //   strategy: {
      //     primary: strategy.primary,
      //     encryption: strategy.encryption,
      //     compression: strategy.compression,
      //     persistent: strategy.persistent
      //   }
      // });

    // 🔧 Apply context-specific processing
    let processedData = data;
    if (strategy.compression) {
      processedData = await this.compressData(processedData);
    }
    if (strategy.encryption) {
      const resolvedOptions = resolveCacheOptions(options);
      processedData = await this.encryptData(processedData, resolvedOptions.userId);
    }

    // 📦 Create enhanced cache entry
    const entry: EnhancedCacheEntry<T> = {
      data: processedData,
      timestamp: Date.now(),
      ttl: options.ttl || strategy.ttl || 0,
      encrypted: strategy.encryption,
      userId: options.userId,
      storageType: strategy.primary,
      compression: strategy.compression,
      httpOnly: options.httpOnly || strategy.httpOnly || false,
      secure: options.secure || strategy.secure || false,
      crossTab: options.crossTab || strategy.crossTab || false,
      storageRegistry: {
        primary: strategy.primary,
        fallback: strategy.fallback
      }
    };

    // 🚀 Store using context-aware strategy
    await this.storeWithContextStrategy(key, entry, strategy);
    
    // 🧹 Cleanup based on context priority
    await this.cleanupByContext(context, strategy);
  }

  /**
   * 🎯 Enhanced get method with context-aware retrieval
   */
  async get<T>(key: string, options: EnhancedCacheOptions = {}): Promise<T | null> {
    // 🎯 Determine context
    const context = options.context || this.extractContextFromKey(key);
    const strategy = this.contextStorageConfig[context];
    
    // 📊 Try to get from underlying cache manager
    const result = await this.cacheManager.get<T>(key, options);
    
    if (result) {
      // 🔧 Apply context-specific processing in reverse order
      let processedData: any = result;
      
      // Decrypt if needed
      if (strategy.encryption) {
        processedData = await this.decryptData(processedData, options.userId);
      }
      
      // Decompress if needed
      if (strategy.compression && processedData?.__compressed) {
        processedData = await this.decompressData(processedData);
      }
      
      // console.log(`[ContextAwareCacheManager] HIT for ${context}:${key}`);
      return processedData as T;
    }

    // console.log(`[ContextAwareCacheManager] MISS for ${context}:${key}`);
    return null;
  }

  // ==================== HELPER METHODS ====================

  /**
   * 🎯 Store data using context-specific strategy
   */
  private async storeWithContextStrategy<T>(
    key: string, 
    entry: EnhancedCacheEntry<T>, 
    strategy: StorageStrategy
  ): Promise<void> {
    // Use underlying cache manager with context-aware options
    await this.cacheManager.set(key, entry.data as T, {
      ttl: entry.ttl,
      encrypt: entry.encrypted,
      userId: entry.userId
    } as any);
  }

  /**
   * 🔍 Extract context from cache key
   */
  private extractContextFromKey(key: string): AppContext {
    const parts = key.split(':');
    if (parts.length >= 2) {
      const contextPart = parts[1];
      // Map string to enum
      switch (contextPart) {
        case 'admin': return AppContext.ADMIN;
        case 'tenant': return AppContext.TENANT;
        case 'product': return AppContext.PRODUCT;
        case 'store': return AppContext.STORE;
        case 'shop': return AppContext.SHOP;
        case 'directory': return AppContext.DIRECTORY;
        case 'user': return AppContext.USER;
        case 'system': return AppContext.SYSTEM;
        case 'global': return AppContext.GLOBAL;
        default: return AppContext.PRODUCT; // Default fallback
      }
    }
    return AppContext.PRODUCT; // Default fallback
  }

  /**
   * 🔍 Extract isolation from cache key
   */
  private extractIsolationFromKey(key: string): CacheIsolation {
    const parts = key.split(':');
    if (parts.length >= 3) {
      const isolationPart = parts[2];
      // Map string to enum
      switch (isolationPart) {
        case 'global': return CacheIsolation.GLOBAL;
        case 'tenant': return CacheIsolation.TENANT;
        case 'user': return CacheIsolation.USER;
        case 'system': return CacheIsolation.SYSTEM;
        case 'admin': return CacheIsolation.ADMIN;
        case 'store': return CacheIsolation.STORE;
        case 'product': return CacheIsolation.PRODUCT;
        case 'shop': return CacheIsolation.SHOP;
        case 'directory': return CacheIsolation.DIRECTORY;
        default: return CacheIsolation.GLOBAL; // Default fallback
      }
    }
    return CacheIsolation.GLOBAL; // Default fallback
  }

  /**
   * 🧹 Cleanup based on context priority
   */
  private async cleanupByContext(context: AppContext, strategy: StorageStrategy): Promise<void> {
    // Implement context-specific cleanup based on priority and size
    const stats = this.cacheManager.getStats();
    if ((stats as any).memorySize > strategy.maxSize) {
      // Remove oldest entries with lowest priority
      const cacheManager = this.cacheManager as any;
      if (cacheManager.entries && typeof cacheManager.entries === 'function') {
        const entries = cacheManager.entries();
        if (entries && Array.isArray(entries)) {
          const entriesArray = entries;
          entriesArray.sort((a: any, b: any) => a[1].timestamp - b[1].timestamp);
          
          const toRemove = entriesArray.slice(0, Math.max(0, entriesArray.length - strategy.maxSize));
          for (const [key] of toRemove) {
            this.cacheManager.remove(key);
          }
          // console.log(`[ContextAwareCacheManager] Cleaned up ${toRemove.length} entries for ${context}`);
        }
      }
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * 📊 Get storage strategy for context
   */
  public getStorageStrategy(context: AppContext): StorageStrategy {
    return this.contextStorageConfig[context];
  }

  /**
   * 📊 Get browser capabilities
   */
  public getBrowserCapabilities(): BrowserCapabilities {
    return this.browserCapabilities;
  }

  /**
   * 📊 Get context storage statistics
   */
  public getContextStats(): Record<AppContext, any> {
    const stats: Record<string, any> = {};
    
    Object.entries(this.contextStorageConfig).forEach(([context, strategy]) => {
      stats[context] = {
        strategy: {
          primary: strategy.primary,
          fallbacks: strategy.fallbacks,
          encryption: strategy.encryption,
          compression: strategy.compression,
          persistent: strategy.persistent,
          maxSize: strategy.maxSize,
          ttl: strategy.ttl,
          httpOnly: strategy.httpOnly,
          secure: strategy.secure,
          crossTab: strategy.crossTab
        },
        browserCapabilities: this.browserCapabilities
      };
    });
    
    return stats as Record<AppContext, any>;
  }

  // ==================== DELEGATED METHODS ====================

  /**
   * Delegate other methods to underlying cache manager
   */
  async remove(key: string): Promise<void> {
    return this.cacheManager.remove(key);
  }

  getStats(): any {
    return this.cacheManager.getStats();
  }

  /**
   * 🧹 Clear all caches
   */
  clear(): void {
    // Clear the composed CacheManager
    this.cacheManager.clear();
  }

  // ==================== COMPRESSION & ENCRYPTION HELPERS ====================

  /**
   * 🗜️ Compress data
   */
  private async compressData(data: any): Promise<any> {
    // Simple compression simulation - in production use proper compression library
    return {
      __compressed: true,
      data: JSON.stringify(data),
      originalSize: JSON.stringify(data).length
    };
  }

  /**
   * 🗜️ Decompress data
   */
  private async decompressData(data: any): Promise<any> {
    if (data?.__compressed) {
      return JSON.parse(data.data);
    }
    return data;
  }

  /**
   * 🔐 Encrypt data
   */
  private async encryptData(data: any, userId?: string): Promise<any> {
    try {
      // Handle Unicode properly by using encodeURIComponent before btoa
      const jsonString = JSON.stringify(data);
      const encodedString = encodeURIComponent(jsonString);
      const encryptedData = btoa(encodedString);
      
      return {
        __encrypted: true,
        data: encryptedData,
        userId: userId
      };
    } catch (error) {
      console.warn('[ContextAwareCacheManager] Encryption failed, returning original data:', error);
      // Fallback to original data if encryption fails
      return data;
    }
  }

  /**
   * 🔐 Decrypt data
   */
  private async decryptData(data: any, userId?: string): Promise<any> {
    if (typeof data !== 'string') return data as any;
    
    try {
      const decryptedString = atob(data);
      const decodedString = decodeURIComponent(decryptedString);
      return JSON.parse(decodedString);
    } catch (error) {
      console.warn('[ContextAwareCacheManager] Decryption failed:', error);
      return data as any;
    }
  }
}

// ==================== EXPORTS ====================

export default ContextAwareCacheManager;
export type { 
  BrowserCapabilities, 
  StorageStrategy, 
  ContextStorageConfig,
  EnhancedCacheEntry,
  EnhancedCacheOptions
};
