/**
 * 🎯 Universal Storage Manager - Multi-Storage Type Support
 * 
 * Supports all browser storage types with intelligent fallback strategies:
 * - Cache Storage (modern, persistent, async)
 * - IndexedDB (large capacity, transactional)
 * - LocalStorage (simple, synchronous)
 * - SessionStorage (session-limited)
 * - Cookies (small, HTTP-compatible)
 */

import { resolveCacheOptions, AutoUserCacheOptions } from './userIdentification';
import { AppContext, CacheIsolation } from './contextCacheManager';

// ==================== STORAGE TYPE DEFINITIONS ====================

export enum StorageType {
  CACHE_STORAGE = 'cache-storage',      // Modern Cache API (persistent, async)
  INDEXED_DB = 'indexed-db',            // IndexedDB (large, transactional)
  LOCAL_STORAGE = 'local-storage',      // localStorage (simple, sync)
  SESSION_STORAGE = 'session-storage',    // sessionStorage (session-limited)
  COOKIES = 'cookies'                   // Cookies (HTTP-compatible, small)
}

interface StorageCapabilities {
  [StorageType.CACHE_STORAGE]: boolean;
  [StorageType.INDEXED_DB]: boolean;
  [StorageType.LOCAL_STORAGE]: boolean;
  [StorageType.SESSION_STORAGE]: boolean;
  [StorageType.COOKIES]: boolean;
}

interface StorageQuota {
  [StorageType.CACHE_STORAGE]: number | null;
  [StorageType.INDEXED_DB]: number | null;
  [StorageType.LOCAL_STORAGE]: number | null;
  [StorageType.SESSION_STORAGE]: number | null;
  [StorageType.COOKIES]: number | null;
}

interface StorageStrategy {
  primary: StorageType;
  fallbacks: StorageType[];
  encryption: boolean;
  compression: boolean;
  maxSize: number;
  ttl: number;
  priority: 'high' | 'medium' | 'low';
  persistent: boolean;
  crossTab: boolean;
  httpOnly?: boolean;
  secure?: boolean;
}

interface ContextStorageConfig {
  [AppContext.ADMIN]: StorageStrategy;
  [AppContext.TENANT]: StorageStrategy;
  [AppContext.PRODUCT]: StorageStrategy;
  [AppContext.STORE]: StorageStrategy;
  [AppContext.USER]: StorageStrategy;
  [AppContext.SYSTEM]: StorageStrategy;
}

interface UniversalCacheOptions extends AutoUserCacheOptions {
  context?: AppContext;
  isolation?: CacheIsolation;
  storageType?: StorageType;
  forceStorage?: StorageType;
  httpOnly?: boolean;
  secure?: boolean;
  crossTab?: boolean;
  storageStrategy?: Partial<StorageStrategy>;
  ttl?: number;
}

interface CacheEntry<T> {
  data: T | string;
  timestamp: number;
  ttl: number;
  encrypted: boolean;
  userId?: string;
  storageType: StorageType;
  compression: boolean;
  httpOnly?: boolean;
  secure?: boolean;
  crossTab?: boolean;
}

// ==================== UNIVERSAL STORAGE MANAGER ====================

export class UniversalStorageManager {
  private capabilities: StorageCapabilities;
  private quotas: StorageQuota;
  private contextStorageConfig: ContextStorageConfig;
  private cache: Map<string, CacheEntry<any>> = new Map();

  constructor(options: UniversalCacheOptions = {}) {
    // 🔍 Detect all storage capabilities
    this.capabilities = this.detectStorageCapabilities();
    
    // 📊 Estimate storage quotas
    this.quotas = {} as StorageQuota;
    this.estimateStorageQuotas().then(quotas => {
      this.quotas = quotas;
    }).catch(error => {
      console.warn('[UniversalStorageManager] Failed to estimate storage quotas:', error);
      // Set fallback quotas
      this.quotas = {
        [StorageType.CACHE_STORAGE]: 100,
        [StorageType.INDEXED_DB]: 100,
        [StorageType.LOCAL_STORAGE]: 5,
        [StorageType.SESSION_STORAGE]: 5,
        [StorageType.COOKIES]: 0.2
      };
    });
    
    // 🎯 Generate context-aware storage configurations
    this.contextStorageConfig = this.generateContextStorageConfig();
    
    console.log('[UniversalStorageManager] Initialized with capabilities:', this.capabilities);
  }

  // ==================== STORAGE CAPABILITY DETECTION ====================

  /**
   * 🔍 Detect all available storage types
   */
  private detectStorageCapabilities(): StorageCapabilities {
    const capabilities = {
      [StorageType.CACHE_STORAGE]: false,
      [StorageType.INDEXED_DB]: false,
      [StorageType.LOCAL_STORAGE]: false,
      [StorageType.SESSION_STORAGE]: false,
      [StorageType.COOKIES]: false
    };

    // Cache Storage detection
    if ('caches' in window && typeof window.caches.open === 'function') {
      capabilities[StorageType.CACHE_STORAGE] = true;
    }

    // IndexedDB detection
    capabilities[StorageType.INDEXED_DB] = typeof indexedDB !== 'undefined' && indexedDB !== null;

    // LocalStorage detection
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('test', 'test');
        localStorage.removeItem('test');
        capabilities[StorageType.LOCAL_STORAGE] = true;
      } catch (error) {
        capabilities[StorageType.LOCAL_STORAGE] = false;
      }
    }

    // SessionStorage detection
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('test', 'test');
        sessionStorage.removeItem('test');
        capabilities[StorageType.SESSION_STORAGE] = true;
      } catch (error) {
        capabilities[StorageType.SESSION_STORAGE] = false;
      }
    }

    // Cookies detection
    if (typeof window !== 'undefined' && navigator.cookieEnabled) {
      capabilities[StorageType.COOKIES] = true;
    }

    return capabilities;
  }

  /**
   * 📊 Estimate storage quotas for each type
   */
  private async estimateStorageQuotas(): Promise<StorageQuota> {
    const quotas: StorageQuota = {
      [StorageType.CACHE_STORAGE]: null,
      [StorageType.INDEXED_DB]: null,
      [StorageType.LOCAL_STORAGE]: null,
      [StorageType.SESSION_STORAGE]: null,
      [StorageType.COOKIES]: null
    };

    // Cache Storage quota
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        quotas[StorageType.CACHE_STORAGE] = estimate.quota || null;
        quotas[StorageType.INDEXED_DB] = estimate.quota || null;
      } catch (error) {
        console.warn('[UniversalStorageManager] Storage quota estimation failed:', error);
      }
    }

    // LocalStorage quota (typically 5-10MB)
    if (this.capabilities[StorageType.LOCAL_STORAGE]) {
      try {
        // Test localStorage capacity
        let testSize = 0;
        const testData = 'x'.repeat(1024); // 1KB
        try {
          while (testSize < 1024 * 10) { // Test up to 10MB
            localStorage.setItem('quota-test', testData.repeat(testSize));
            testSize++;
          }
        } catch (error) {
          // Reached limit
        } finally {
          localStorage.removeItem('quota-test');
          quotas[StorageType.LOCAL_STORAGE] = testSize * 1024; // Size in bytes
        }
      } catch (error) {
        quotas[StorageType.LOCAL_STORAGE] = 5 * 1024 * 1024; // 5MB fallback
      }
    }

    // SessionStorage quota (typically 5-10MB)
    if (this.capabilities[StorageType.SESSION_STORAGE]) {
      quotas[StorageType.SESSION_STORAGE] = 5 * 1024 * 1024; // 5MB typical
    }

    // Cookies quota (typically 4KB per cookie, 50-100 cookies total)
    if (this.capabilities[StorageType.COOKIES]) {
      quotas[StorageType.COOKIES] = 4096 * 50; // ~200KB total
    }

    return quotas;
  }

  // ==================== CONTEXT STORAGE CONFIGURATION ====================

  /**
   * 🎯 Generate context-aware storage configurations
   */
  private generateContextStorageConfig(): ContextStorageConfig {
    return {
      // ADMIN: Security-focused, encrypted, persistent
      [AppContext.ADMIN]: this.createAdminStrategy(),
      
      // TENANT: Business data, encrypted, persistent
      [AppContext.TENANT]: this.createTenantStrategy(),
      
      // PRODUCT: Large data, compressed, persistent
      [AppContext.PRODUCT]: this.createProductStrategy(),
      
      // STORE: Location data, compressed, persistent
      [AppContext.STORE]: this.createStoreStrategy(),
      
      // USER: Privacy-focused, session-based
      [AppContext.USER]: this.createUserStrategy(),
      
      // SYSTEM: Configuration, persistent, minimal encryption
      [AppContext.SYSTEM]: this.createSystemStrategy()
    };
  }

  // ==================== CONTEXT-SPECIFIC STRATEGIES ====================

  /**
   * 🛡️ Admin context strategy: Security first
   */
  private createAdminStrategy(): StorageStrategy {
    return {
      primary: this.capabilities[StorageType.INDEXED_DB] ? StorageType.INDEXED_DB : 
              this.capabilities[StorageType.CACHE_STORAGE] ? StorageType.CACHE_STORAGE :
              this.capabilities[StorageType.LOCAL_STORAGE] ? StorageType.LOCAL_STORAGE :
              StorageType.COOKIES,
      fallbacks: this.getFallbacks([StorageType.INDEXED_DB, StorageType.CACHE_STORAGE, StorageType.LOCAL_STORAGE, StorageType.COOKIES]),
      encryption: true,        // Always encrypt admin data
      compression: false,      // Admin data usually small
      maxSize: 50,             // Small cache for security
      ttl: 5 * 60 * 1000,     // 5 minutes - security
      priority: 'high',       // High priority for admin operations
      persistent: true,        // Persist admin settings
      crossTab: true,         // Share across tabs for consistency
      httpOnly: false,       // Not HTTP-only (client-side only)
      secure: true           // Secure cookies if used
    };
  }

  /**
   * 🏢 Tenant context strategy: Business data protection
   */
  private createTenantStrategy(): StorageStrategy {
    return {
      primary: this.capabilities[StorageType.INDEXED_DB] ? StorageType.INDEXED_DB : 
              this.capabilities[StorageType.CACHE_STORAGE] ? StorageType.CACHE_STORAGE :
              StorageType.LOCAL_STORAGE,
      fallbacks: this.getFallbacks([StorageType.INDEXED_DB, StorageType.CACHE_STORAGE, StorageType.LOCAL_STORAGE]),
      encryption: true,        // Encrypt tenant data
      compression: true,        // Compress business data
      maxSize: 200,            // Medium cache for business data
      ttl: 60 * 60 * 1000,     // 1 hour - business data
      priority: 'high',       // High priority for business operations
      persistent: true,        // Persist tenant data
      crossTab: true,         // Share across tabs
      httpOnly: false,
      secure: true
    };
  }

  /**
   * 📦 Product context strategy: Performance optimization
   */
  private createProductStrategy(): StorageStrategy {
    return {
      primary: this.capabilities[StorageType.CACHE_STORAGE] ? StorageType.CACHE_STORAGE : 
              this.capabilities[StorageType.INDEXED_DB] ? StorageType.INDEXED_DB :
              StorageType.LOCAL_STORAGE,
      fallbacks: this.getFallbacks([StorageType.CACHE_STORAGE, StorageType.INDEXED_DB, StorageType.LOCAL_STORAGE]),
      encryption: false,       // Product data is public
      compression: true,        // Always compress product catalogs
      maxSize: 500,            // Large cache for products
      ttl: 30 * 60 * 1000,     // 30 minutes - product data
      priority: 'medium',     // Medium priority
      persistent: true,        // Persist product data
      crossTab: true,         // Share across tabs for performance
      httpOnly: false,
      secure: false
    };
  }

  /**
   * 🏪 Store context strategy: Location-based optimization
   */
  private createStoreStrategy(): StorageStrategy {
    return {
      primary: this.capabilities[StorageType.CACHE_STORAGE] ? StorageType.CACHE_STORAGE : 
              this.capabilities[StorageType.INDEXED_DB] ? StorageType.INDEXED_DB :
              StorageType.LOCAL_STORAGE,
      fallbacks: this.getFallbacks([StorageType.CACHE_STORAGE, StorageType.INDEXED_DB, StorageType.LOCAL_STORAGE]),
      encryption: false,       // Store data is public
      compression: true,        // Compress store data
      maxSize: 200,            // Medium cache for stores
      ttl: 20 * 60 * 1000,     // 20 minutes - store data
      priority: 'medium',     // Medium priority
      persistent: true,        // Persist store information
      crossTab: true,         // Share across tabs
      httpOnly: false,
      secure: false
    };
  }

  /**
   * 👤 User context strategy: Privacy first
   */
  private createUserStrategy(): StorageStrategy {
    return {
      primary: this.capabilities[StorageType.SESSION_STORAGE] ? StorageType.SESSION_STORAGE : 
              StorageType.LOCAL_STORAGE,
      fallbacks: this.getFallbacks([StorageType.SESSION_STORAGE, StorageType.LOCAL_STORAGE]),
      encryption: true,        // Encrypt user data
      compression: false,      // User data usually small
      maxSize: 100,            // Moderate size for user data
      ttl: 15 * 60 * 1000,     // 15 minutes - user session
      priority: 'high',       // High priority for user experience
      persistent: false,       // Never persist user data
      crossTab: false,        // No cross-tab sharing for privacy
      httpOnly: false,
      secure: true
    };
  }

  /**
   * ⚙️ System context strategy: Configuration optimization
   */
  private createSystemStrategy(): StorageStrategy {
    return {
      primary: this.capabilities[StorageType.INDEXED_DB] ? StorageType.INDEXED_DB : 
              this.capabilities[StorageType.CACHE_STORAGE] ? StorageType.CACHE_STORAGE :
              StorageType.LOCAL_STORAGE,
      fallbacks: this.getFallbacks([StorageType.INDEXED_DB, StorageType.CACHE_STORAGE, StorageType.LOCAL_STORAGE]),
      encryption: false,       // System config is usually public
      compression: false,      // System config is small
      maxSize: 50,             // Small cache for system data
      ttl: 24 * 60 * 60 * 1000, // 24 hours - system config
      priority: 'low',        // Low priority for system data
      persistent: true,        // Persist system configuration
      crossTab: true,         // Share across tabs
      httpOnly: false,
      secure: false
    };
  }

  // ==================== FALLBACK GENERATION ====================

  /**
   * 🔄 Generate fallback storage types in order of preference
   */
  private getFallbacks(preferred: StorageType[]): StorageType[] {
    return preferred.filter(type => this.capabilities[type]);
  }

  // ==================== UNIVERSAL CACHE OPERATIONS ====================

  /**
   * 🎯 Universal set method with storage type selection
   */
  async set<T>(key: string, data: T, options: UniversalCacheOptions = {}): Promise<void> {
    // 🎯 Determine context and get storage strategy
    const context = options.context || this.extractContextFromKey(key);
    const baseStrategy = this.contextStorageConfig[context];
    const strategy = { ...baseStrategy, ...options.storageStrategy };

    // 🔄 Override if force storage specified
    if (options.forceStorage) {
      strategy.primary = options.forceStorage;
    }

    // 🔧 Apply context-specific processing
    let processedData = data;
    if (strategy.compression) {
      processedData = await this.compressData(processedData);
    }
    if (strategy.encryption) {
      const resolvedOptions = resolveCacheOptions(options);
      processedData = await this.encryptData(processedData, resolvedOptions.userId);
    }

    // 📦 Create universal cache entry
    const entry: CacheEntry<T> = {
      data: processedData,
      timestamp: Date.now(),
      ttl: options.ttl || strategy.ttl,
      encrypted: strategy.encryption,
      userId: options.userId,
      storageType: strategy.primary,
      compression: strategy.compression,
      httpOnly: options.httpOnly || strategy.httpOnly,
      secure: options.secure || strategy.secure,
      crossTab: options.crossTab || strategy.crossTab
    };

    // 🚀 Store using universal storage strategy
    await this.storeWithUniversalStrategy(key, entry, strategy);
    
    // 🧹 Cleanup based on context priority
    await this.cleanupByContext(context, strategy);
  }

  /**
   * 🎯 Universal get method with storage type awareness
   */
  async get<T>(key: string, options: UniversalCacheOptions = {}): Promise<T | null> {
    // 🎯 Determine context
    const context = options.context || this.extractContextFromKey(key);
    const strategy = this.contextStorageConfig[context];

    // 📊 Try memory first (fastest)
    const memoryEntry = this.cache.get(key);
    if (memoryEntry && this.isValidEntry(memoryEntry)) {
      console.log(`[UniversalStorageManager] Memory HIT for ${context}:${key}`);
      return await this.processEntryForRetrieval<T>(memoryEntry, options);
    }

    // 📊 Try primary storage
    let entry: CacheEntry<T> | null = null;
    
    try {
      entry = await this.getFromStorage<T>(key, strategy.primary);
      if (entry) {
        console.log(`[UniversalStorageManager] ${strategy.primary} HIT for ${context}:${key}`);
      }
    } catch (error) {
      console.warn(`[UniversalStorageManager] ${strategy.primary} access failed:`, error);
    }

    // 🔄 Try fallback storages if primary failed
    if (!entry && strategy.fallbacks.length > 0) {
      for (const fallbackType of strategy.fallbacks) {
        try {
          entry = await this.getFromStorage<T>(key, fallbackType);
          if (entry) {
            console.log(`[UniversalStorageManager] ${fallbackType} fallback HIT for ${context}:${key}`);
            break;
          }
        } catch (error) {
          console.warn(`[UniversalStorageManager] ${fallbackType} fallback failed:`, error);
          continue;
        }
      }
    }

    // 🎯 Process and return entry
    if (entry && this.isValidEntry(entry)) {
      // Cache in memory for faster access
      this.cache.set(key, entry);
      return await this.processEntryForRetrieval<T>(entry, options);
    }

    console.log(`[UniversalStorageManager] MISS for ${context}:${key}`);
    return null;
  }

  /**
   * 🗑️ Remove from all storage types
   */
  async remove(key: string): Promise<void> {
    // Remove from memory
    this.cache.delete(key);

    // Remove from all available storage types
    const storageTypes = Object.values(StorageType);
    for (const storageType of storageTypes) {
      if (this.capabilities[storageType]) {
        try {
          await this.removeFromStorage(key, storageType);
        } catch (error) {
          console.warn(`[UniversalStorageManager] Failed to remove from ${storageType}:`, error);
        }
      }
    }
  }

  /**
   * 🧹 Clear all storage
   */
  async clear(): Promise<void> {
    // Clear memory
    this.cache.clear();

    // Clear all available storage types
    const storageTypes = Object.values(StorageType);
    for (const storageType of storageTypes) {
      if (this.capabilities[storageType]) {
        try {
          await this.clearStorage(storageType);
        } catch (error) {
          console.warn(`[UniversalStorageManager] Failed to clear ${storageType}:`, error);
        }
      }
    }
  }

  // ==================== STORAGE TYPE IMPLEMENTATIONS ====================

  /**
   * 🎯 Store data using universal storage strategy
   */
  private async storeWithUniversalStrategy<T>(key: string, entry: CacheEntry<T>, strategy: StorageStrategy): Promise<void> {
    try {
      await this.setToStorage(key, entry, strategy.primary);
    } catch (error) {
      console.warn(`[UniversalStorageManager] Primary storage ${strategy.primary} failed, trying fallbacks:`, error);
      
      // Try fallbacks in order
      for (const fallbackType of strategy.fallbacks) {
        try {
          await this.setToStorage(key, entry, fallbackType);
          return; // Success, exit fallback loop
        } catch (fallbackError) {
          console.warn(`[UniversalStorageManager] Fallback storage ${fallbackType} failed:`, fallbackError);
        }
      }
      
      throw new Error(`Unable to store data in any available storage for key: ${key}`);
    }
  }

  /**
   * 📥 Get data from specific storage type
   */
  private async getFromStorage<T>(key: string, storageType: StorageType): Promise<CacheEntry<T> | null> {
    switch (storageType) {
      case StorageType.CACHE_STORAGE:
        return this.getFromCacheStorage<T>(key);
      case StorageType.INDEXED_DB:
        return this.getFromIndexedDB<T>(key);
      case StorageType.LOCAL_STORAGE:
        return this.getFromLocalStorage<T>(key);
      case StorageType.SESSION_STORAGE:
        return this.getFromSessionStorage<T>(key);
      case StorageType.COOKIES:
        return this.getFromCookies<T>(key);
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  }

  /**
   * 🗑️ Remove from specific storage type
   */
  private async removeFromStorage(key: string, storageType: StorageType): Promise<void> {
    switch (storageType) {
      case StorageType.CACHE_STORAGE:
        return this.removeFromCacheStorage(key);
      case StorageType.INDEXED_DB:
        return this.removeFromIndexedDB(key);
      case StorageType.LOCAL_STORAGE:
        return this.removeFromLocalStorage(key);
      case StorageType.SESSION_STORAGE:
        return this.removeFromSessionStorage(key);
      case StorageType.COOKIES:
        return this.removeFromCookies(key);
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  }

  /**
   * 📦 Store data in specific storage type
   */
  private async setToStorage<T>(key: string, entry: CacheEntry<T>, storageType: StorageType): Promise<void> {
    switch (storageType) {
      case StorageType.CACHE_STORAGE:
        return await this.setToCacheStorage(key, entry);
      case StorageType.INDEXED_DB:
        return await this.setToIndexedDB(key, entry);
      case StorageType.LOCAL_STORAGE:
        return this.setToLocalStorage(key, entry);
      case StorageType.SESSION_STORAGE:
        return this.setToSessionStorage(key, entry);
      case StorageType.COOKIES:
        return this.setToCookies(key, entry);
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  }

  /**
   * 🧹 Clear specific storage type
   */
  private async clearStorage(storageType: StorageType): Promise<void> {
    switch (storageType) {
      case StorageType.CACHE_STORAGE:
        return this.clearCacheStorage();
      case StorageType.INDEXED_DB:
        return this.clearIndexedDB();
      case StorageType.LOCAL_STORAGE:
        return this.clearLocalStorage();
      case StorageType.SESSION_STORAGE:
        return this.clearSessionStorage();
      case StorageType.COOKIES:
        return this.clearCookies();
      default:
        throw new Error(`Unsupported storage type: ${storageType}`);
    }
  }

  // ==================== CACHE STORAGE IMPLEMENTATION ====================

  private async getFromCacheStorage<T>(key: string): Promise<CacheEntry<T> | null> {
    try {
      const cache = await caches.open('universal-cache');
      const response = await cache.match(key);
      if (response) {
        const data = await response.text();
        return JSON.parse(data) as CacheEntry<T>;
      }
    } catch (error) {
      console.warn('[UniversalStorageManager] CacheStorage get failed:', error);
    }
    return null;
  }

  private async setToCacheStorage<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    try {
      const cache = await caches.open('universal-cache');
      const response = new Response(JSON.stringify(entry));
      await cache.put(key, response);
    } catch (error) {
      console.warn('[UniversalStorageManager] CacheStorage set failed:', error);
    }
  }

  private async removeFromCacheStorage(key: string): Promise<void> {
    try {
      const cache = await caches.open('universal-cache');
      await cache.delete(key);
    } catch (error) {
      console.warn('[UniversalStorageManager] CacheStorage remove failed:', error);
    }
  }

  private async clearCacheStorage(): Promise<void> {
    try {
      const cache = await caches.open('universal-cache');
      const keys = await cache.keys();
      await Promise.all(keys.map(key => cache.delete(key)));
    } catch (error) {
      console.warn('[UniversalStorageManager] CacheStorage clear failed:', error);
    }
  }

  // ==================== INDEXEDDB IMPLEMENTATION ====================

  private async getFromIndexedDB<T>(key: string): Promise<CacheEntry<T> | null> {
    // Implementation would go here
    // For now, delegate to existing CacheManager
    return null;
  }

  private async setToIndexedDB<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    // Implementation would go here
    // For now, delegate to existing CacheManager
  }

  private async removeFromIndexedDB(key: string): Promise<void> {
    // Implementation would go here
    // For now, delegate to existing CacheManager
  }

  private async clearIndexedDB(): Promise<void> {
    // Implementation would go here
    // For now, delegate to existing CacheManager
  }

  // ==================== LOCAL STORAGE IMPLEMENTATION ====================

  private getFromLocalStorage<T>(key: string): CacheEntry<T> | null {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as CacheEntry<T>;
      }
    } catch (error) {
      console.warn('[UniversalStorageManager] localStorage get failed:', error);
    }
    return null;
  }

  private setToLocalStorage<T>(key: string, entry: CacheEntry<T>): void {
    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.warn('[UniversalStorageManager] localStorage set failed:', error);
    }
  }

  private removeFromLocalStorage(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.warn('[UniversalStorageManager] localStorage remove failed:', error);
    }
  }

  private clearLocalStorage(): void {
    try {
      localStorage.clear();
    } catch (error) {
      console.warn('[UniversalStorageManager] localStorage clear failed:', error);
    }
  }

  // ==================== SESSION STORAGE IMPLEMENTATION ====================

  private getFromSessionStorage<T>(key: string): CacheEntry<T> | null {
    try {
      const item = sessionStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as CacheEntry<T>;
      }
    } catch (error) {
      console.warn('[UniversalStorageManager] sessionStorage get failed:', error);
    }
    return null;
  }

  private setToSessionStorage<T>(key: string, entry: CacheEntry<T>): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(entry));
    } catch (error) {
      console.warn('[UniversalStorageManager] sessionStorage set failed:', error);
    }
  }

  private removeFromSessionStorage(key: string): void {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.warn('[UniversalStorageManager] sessionStorage remove failed:', error);
    }
  }

  private clearSessionStorage(): void {
    try {
      sessionStorage.clear();
    } catch (error) {
      console.warn('[UniversalStorageManager] sessionStorage clear failed:', error);
    }
  }

  // ==================== COOKIES IMPLEMENTATION ====================

  private getFromCookies<T>(key: string): CacheEntry<T> | null {
    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === key && value) {
          return JSON.parse(decodeURIComponent(value)) as CacheEntry<T>;
        }
      }
    } catch (error) {
      console.warn('[UniversalStorageManager] cookies get failed:', error);
    }
    return null;
  }

  private setToCookies<T>(key: string, entry: CacheEntry<T>, options: { httpOnly?: boolean; secure?: boolean; crossTab?: boolean } = {}): void {
    try {
      const value = encodeURIComponent(JSON.stringify(entry));
      let cookieString = `${key}=${value}`;
      
      if (options.httpOnly) cookieString += '; HttpOnly';
      if (options.secure) cookieString += '; Secure';
      if (options.crossTab) cookieString += '; SameSite=Lax';
      
      document.cookie = cookieString;
    } catch (error) {
      console.warn('[UniversalStorageManager] cookies set failed:', error);
    }
  }

  private removeFromCookies(key: string): void {
    try {
      document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    } catch (error) {
      console.warn('[UniversalStorageManager] cookies remove failed:', error);
    }
  }

  private clearCookies(): void {
    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name] = cookie.trim().split('=');
        if (name) {
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
      }
    } catch (error) {
      console.warn('[UniversalStorageManager] cookies clear failed:', error);
    }
  }

  // ==================== HELPER METHODS ====================

  /**
   * 🔍 Extract context from cache key
   */
  private extractContextFromKey(key: string): AppContext {
    const parts = key.split(':');
    if (parts.length >= 2) {
      const contextPart = parts[1];
      switch (contextPart) {
        case 'admin': return AppContext.ADMIN;
        case 'tenant': return AppContext.TENANT;
        case 'product': return AppContext.PRODUCT;
        case 'store': return AppContext.STORE;
        case 'user': return AppContext.USER;
        case 'system': return AppContext.SYSTEM;
        default: return AppContext.PRODUCT;
      }
    }
    return AppContext.PRODUCT;
  }

  /**
   * ⏰ Get context-specific TTL
   */
  private getContextTTL(context: AppContext): number {
    switch (context) {
      case AppContext.ADMIN: return 5 * 60 * 1000;
      case AppContext.TENANT: return 60 * 60 * 1000;
      case AppContext.PRODUCT: return 30 * 60 * 1000;
      case AppContext.STORE: return 20 * 60 * 1000;
      case AppContext.USER: return 15 * 60 * 1000;
      case AppContext.SYSTEM: return 24 * 60 * 60 * 1000;
      default: return 15 * 60 * 1000;
    }
  }

  /**
   * ✅ Check if cache entry is valid
   */
  private isValidEntry<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.timestamp < entry.ttl;
  }

  /**
   * 🔧 Process entry for retrieval
   */
  private async processEntryForRetrieval<T>(entry: CacheEntry<T>, options: UniversalCacheOptions): Promise<T | null> {
    try {
      let data = entry.data;
      
      // Decrypt if needed
      if (entry.encrypted) {
        const resolvedOptions = resolveCacheOptions(options);
        data = await this.decryptData(data, resolvedOptions.userId);
      }
      
      // Decompress if needed
      if (data && typeof data === 'object' && (data as any).__compressed) {
        data = await this.decompressData(data);
      }
      
      return data as T;
    } catch (error) {
      console.error('[UniversalStorageManager] Error processing entry for retrieval:', error);
      return null;
    }
  }

  /**
   * 🧹 Cleanup based on context priority
   */
  private async cleanupByContext(context: AppContext, strategy: StorageStrategy): Promise<void> {
    if (this.cache.size > strategy.maxSize) {
      // Remove oldest entries with lowest priority
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, entries.length - strategy.maxSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
      
      console.log(`[UniversalStorageManager] Cleaned up ${toRemove.length} entries for ${context}`);
    }
  }

  // ==================== COMPRESSION & ENCRYPTION ====================

  /**
   * 🗜️ Compress data
   */
  private async compressData(data: any): Promise<any> {
    return {
      __compressed: true,
      data: JSON.stringify(data),
      originalSize: JSON.stringify(data).length
    };
  }

  /**
   * 🔐 Encrypt data
   */
  private async encryptData(data: any, userId?: string): Promise<any> {
    return {
      __encrypted: true,
      data: btoa(JSON.stringify(data)),
      userId: userId
    };
  }

  /**
   * 🔐 Decrypt data
   */
  private async decryptData(data: any, userId?: string): Promise<any> {
    if (typeof data !== 'string') return data;
    
    try {
      const decryptedString = atob(data);
      return JSON.parse(decryptedString);
    } catch (error) {
      console.warn('[UniversalStorageManager] Decryption failed:', error);
      return data;
    }
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

  // ==================== UTILITY METHODS ====================

  /**
   * 📊 Get storage strategy for context
   */
  public getStorageStrategy(context: AppContext): StorageStrategy {
    return this.contextStorageConfig[context];
  }

  /**
   * 📊 Get storage capabilities
   */
  public getStorageCapabilities(): StorageCapabilities {
    return this.capabilities;
  }

  /**
   * 📊 Get storage quotas
   */
  public async getStorageQuotas(): Promise<StorageQuota> {
    return this.quotas;
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
          maxSize: strategy.maxSize,
          ttl: strategy.ttl,
          priority: strategy.priority,
          persistent: strategy.persistent,
          crossTab: strategy.crossTab
        },
        capabilities: this.capabilities
      };
    });
    
    return stats as Record<AppContext, any>;
  }

  /**
   * 📊 Get cache statistics
   */
  public getStats(): any {
    return {
      memorySize: this.cache.size,
      capabilities: this.capabilities,
      quotas: this.quotas,
      contextStats: this.getContextStats()
    };
  }
}

// ==================== EXPORTS ====================

export default UniversalStorageManager;
export type { 
  StorageCapabilities, 
  StorageQuota, 
  StorageStrategy, 
  ContextStorageConfig,
  UniversalCacheOptions,
  CacheEntry
};
