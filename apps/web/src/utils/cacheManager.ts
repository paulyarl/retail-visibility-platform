/**
 * Universal Cache Manager
 * 
 * Provides IndexedDB with localStorage fallback for singleton caching.
 * Handles TTL, size limits, encryption, and graceful degradation.
 */

import { CacheEncryption } from '../lib/cache/cache-encryption';
import { resolveCacheOptions, AutoUserCacheOptions } from './userIdentification';

// Context types for cache organization
export type CacheContext = 'public' | 'user' | 'tenant' | 'admin' | 'system' | 'shop' | 'product' | 'store' | 'directory' | 'global';

interface CacheEntry<T> {
  data: T | string;      // Encrypted or plain data
  timestamp: number;
  ttl: number;
  encrypted: boolean;    // Flag for encryption status
  userId?: string;       // Optional user-specific encryption
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds (default: 15 minutes)
  maxSize?: number; // Maximum number of entries (default: 100)
  dbName?: string; // IndexedDB database name
  storeName?: string; // IndexedDB store name
  encrypt?: boolean; // Whether to encrypt cached data
  userId?: string; // User ID for encryption key derivation
}

interface ContextAwareCacheOptions extends CacheOptions {
  context?: CacheContext;
  isolation?: CacheContext;
  tenantId?: string;
  userId?: string;
}

class CacheManager {
  private dbName: string;
  private storeName: string;
  private defaultTTL: number;
  private maxSize: number;
  private defaultEncrypt: boolean;
  private defaultUserId?: string;
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private indexedDBSupported: boolean = false;
  private localStorageSupported: boolean = false;
  private db: IDBDatabase | null = null;

  constructor(options: CacheOptions = {}) {
    this.dbName = options.dbName || 'singleton-cache';
    this.storeName = options.storeName || 'cache-store';
    this.defaultTTL = options.ttl || 15 * 60 * 1000; // 15 minutes
    this.maxSize = options.maxSize || 100;
    this.defaultEncrypt = options.encrypt || false;
    this.defaultUserId = options.userId;

    // Detect support with actual functionality tests
    this.indexedDBSupported = typeof indexedDB !== 'undefined' && indexedDB !== null;
    
    // Check if we're in a browser environment (not SSR)
    const isBrowser = typeof window !== 'undefined';
    
    if (!isBrowser) {
      // SSR environment - storage not available
      this.localStorageSupported = false;
    } else {
      // Browser environment - test localStorage functionality
      try {
        const testKey = '__cache_manager_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.getItem(testKey);
        localStorage.removeItem(testKey);
        this.localStorageSupported = true;
      } catch (error) {
        this.localStorageSupported = false;
      }
    }

    // IndexedDB will be initialized lazily when needed
  }

  /**
   * Static factory method to create context-specific cache managers
   */
  static createContextAware(context: CacheContext, isolation?: CacheContext, tenantId?: string, userId?: string): CacheManager {
    // Build context-specific database name
    const parts = [`${context}-cache`];
    
    if (isolation && isolation !== context) {
      parts.push(isolation);
    }
    
    if (tenantId) {
      parts.push(`tenant-${tenantId}`);
    }
    
    if (userId) {
      parts.push(`user-${userId}`);
    }
    
    const dbName = parts.join('-');
    
    // Use context-aware store name (not always 'cache-store')
    const storeName = `${context}-store`;
    
    return new CacheManager({
      dbName,
      storeName,
      ttl: 15 * 60 * 1000, // 15 minutes
      maxSize: 100
    });
  }

  /**
   * 🎯 Get context-aware database/store configuration
   * Routes to appropriate database based on context and isolation
   */
  private getContextAwareStorage(context?: CacheContext, isolation?: CacheContext): { dbName: string; storeName: string } {
    // Priority: isolation > context > default
    const activeContext = isolation || context;
    
    switch (activeContext) {
      case 'tenant':
        return { dbName: 'tenant-cache', storeName: 'tenant-store' };
      case 'admin':
        return { dbName: 'admin-cache', storeName: 'admin-store' };
      case 'user':
        return { dbName: 'user-cache', storeName: 'user-store' };
      case 'shop':
        return { dbName: 'shop-cache', storeName: 'shop-store' };
      case 'product':
        return { dbName: 'product-cache', storeName: 'product-store' };
      case 'store':
        return { dbName: 'store-cache', storeName: 'store-store' };
      case 'directory':
        return { dbName: 'directory-cache', storeName: 'directory-store' };
      case 'system':
        return { dbName: 'system-cache', storeName: 'system-store' };
      case 'public':
        return { dbName: 'public-cache', storeName: 'public-store' };
      case 'global':
        return { dbName: 'global-cache', storeName: 'global-store' };
      default:
        return { dbName: this.dbName, storeName: this.storeName };
    }
  }

  /**
   * 🎯 Initialize database connection with context awareness
   */
  private async initializeDB(context?: CacheContext, isolation?: CacheContext): Promise<void> {
    if (!this.indexedDBSupported) return;

    try {
      // Always try to open with a higher version to trigger onupgradeneeded
      const version = 1; // Base version
      const { dbName, storeName } = this.getContextAwareStorage(context, isolation);
      const request = indexedDB.open(dbName, version);

      request.onerror = () => {
        console.warn('[CacheManager] IndexedDB open failed, falling back to memory only');
        this.indexedDBSupported = false;
      };

      request.onsuccess = () => {
        this.db = request.result;
        
        // Double-check that our store exists
        if (!this.db.objectStoreNames.contains(this.storeName)) {
          console.warn(`[CacheManager] Store '${this.storeName}' missing after initialization, attempting to recreate`);
          // Close current connection and reopen with higher version
          this.db.close();
          this.initIndexedDBWithVersion(version + 1);
        }
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          console.log(`[CacheManager] Creating store '${this.storeName}' in database '${this.dbName}'`);
          db.createObjectStore(this.storeName);
        }
      };
    } catch (error) {
      console.warn('[CacheManager] IndexedDB initialization failed, falling back to memory only:', error);
      this.indexedDBSupported = false;
    }
  }

  private async initIndexedDBWithVersion(version: number): Promise<void> {
    if (!this.indexedDBSupported) return;

    try {
      const request = indexedDB.open(this.dbName, version);

      request.onerror = () => {
        console.warn('[CacheManager] IndexedDB version upgrade failed');
        this.indexedDBSupported = false;
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log(`[CacheManager] Successfully upgraded database to version ${version}`);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          console.log(`[CacheManager] Creating store '${this.storeName}' in database version ${version}`);
          db.createObjectStore(this.storeName);
        }
      };
    } catch (error) {
      console.warn('[CacheManager] IndexedDB version upgrade failed:', error);
      this.indexedDBSupported = false;
    }
  }

  /**
   * Encrypt data if encryption is enabled
   */
  private async encryptData<T>(data: T, encrypt: boolean, userId?: string): Promise<T | string> {
    if (!encrypt) {
      return data;
    }

    try {
      const jsonString = JSON.stringify(data);
      return await CacheEncryption.encrypt(jsonString, userId || this.defaultUserId);
    } catch (error) {
      console.warn('[CacheManager] Encryption failed, storing plain data:', error);
      return data;
    }
  }

  /**
   * Decrypt data if it was encrypted
   */
  private async decryptData<T>(data: T | string, encrypted: boolean, userId?: string): Promise<T> {
    if (!encrypted || typeof data !== 'string') {
      return data as T;
    }

    try {
      const decryptedString = await CacheEncryption.decrypt(data, userId || this.defaultUserId);
      return JSON.parse(decryptedString);
    } catch (error) {
      console.warn('[CacheManager] Decryption failed, returning as-is:', error);
      return data as T;
    }
  }

  private getStorageKey(key: string): string {
    return `${this.dbName}-${this.storeName}-${key}`;
  }

  private async getFromIndexedDB<T>(key: string): Promise<CacheEntry<T> | null> {
    if (!this.db || !this.indexedDBSupported) return null;

    try {
      // Check if the store exists before trying to access it
      if (!this.db.objectStoreNames.contains(this.storeName)) {
        console.warn(`[CacheManager] Store '${this.storeName}' not found in database, falling back to memory`);
        return null;
      }

      return await new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const result = request.result;
          if (result && Date.now() - result.timestamp < result.ttl) {
            resolve(result);
          } else {
            resolve(null);
          }
        };
      });
    } catch (error) {
      console.warn('[CacheManager] IndexedDB get failed:', error);
      return null;
    }
  }

  private async setToIndexedDB<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    if (!this.db || !this.indexedDBSupported) return;

    try {
      // Check if the store exists before trying to access it
      if (!this.db.objectStoreNames.contains(this.storeName)) {
        console.warn(`[CacheManager] Store '${this.storeName}' not found in database, skipping IndexedDB write`);
        return;
      }

      await new Promise<void>((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(entry, key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });

      // Cleanup old entries
      await this.cleanupIndexedDB();
    } catch (error) {
      console.warn('[CacheManager] IndexedDB set failed:', error);
    }
  }

  private getFromLocalStorage<T>(key: string): CacheEntry<T> | null {
    if (!this.localStorageSupported) return null;

    try {
      const storageKey = this.getStorageKey(key);
      const cached = localStorage.getItem(storageKey);
      if (!cached) return null;

      const entry = JSON.parse(cached) as CacheEntry<T>;
      if (Date.now() - entry.timestamp < entry.ttl) {
        return entry;
      } else {
        // Remove expired entry
        localStorage.removeItem(storageKey);
        return null;
      }
    } catch (error) {
      console.warn('[CacheManager] localStorage get failed:', error);
      return null;
    }
  }

  private setToLocalStorage<T>(key: string, entry: CacheEntry<T>): void {
    if (!this.localStorageSupported) return;

    try {
      const storageKey = this.getStorageKey(key);
      localStorage.setItem(storageKey, JSON.stringify(entry));
    } catch (error) {
      // Handle quota exceeded specifically
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[CacheManager] localStorage quota exceeded, attempting cleanup...');
        this.cleanupLocalStorage();
        // Try again after cleanup
        try {
          const storageKey = this.getStorageKey(key);
          localStorage.setItem(storageKey, JSON.stringify(entry));
        } catch (retryError) {
          console.warn('[CacheManager] localStorage set failed even after cleanup:', retryError);
        }
      } else {
        console.warn('[CacheManager] localStorage set failed:', error);
      }
    }
  }

  private cleanupLocalStorage(): void {
    if (!this.localStorageSupported) return;

    try {
      // Get all cache-related keys
      const cacheKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('singleton-cache-') || key.includes('-cache-')
      );

      // Sort by timestamp (if available) and remove oldest entries
      const entriesWithTimestamp: Array<{key: string, timestamp: number}> = [];
      
      cacheKeys.forEach(key => {
        try {
          const value = localStorage.getItem(key);
          if (value) {
            const parsed = JSON.parse(value);
            if (parsed.timestamp) {
              entriesWithTimestamp.push({ key, timestamp: parsed.timestamp });
            }
          }
        } catch {
          // Remove malformed entries
          localStorage.removeItem(key);
        }
      });

      // Sort by oldest first and remove 25% of entries
      entriesWithTimestamp.sort((a, b) => a.timestamp - b.timestamp);
      const toRemove = Math.max(1, Math.floor(entriesWithTimestamp.length * 0.25));
      
      for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(entriesWithTimestamp[i].key);
      }

      console.log(`[CacheManager] Cleaned up ${toRemove} old localStorage cache entries`);
    } catch (error) {
      console.warn('[CacheManager] localStorage cleanup failed:', error);
    }
  }

  private removeFromLocalStorage(key: string): void {
    if (!this.localStorageSupported) return;

    try {
      const storageKey = this.getStorageKey(key);
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn('[CacheManager] localStorage remove failed:', error);
    }
  }

  private cleanupMemory(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.memoryCache.entries())) {
      if (now - entry.timestamp >= entry.ttl) {
        this.memoryCache.delete(key);
      }
    }
  }

  private async cleanupIndexedDB(): Promise<void> {
    if (!this.db || !this.indexedDBSupported) return;

    try {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();
      
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value;
          const now = Date.now();
          if (now - entry.timestamp >= entry.ttl) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    } catch (error) {
      console.warn('[CacheManager] IndexedDB cleanup failed:', error);
    }
  }

  async get<T>(key: string, options: AutoUserCacheOptions = {}): Promise<T | null> {
    // Resolve options with automatic user identification
    const resolvedOptions = resolveCacheOptions(options);
    const encrypt = resolvedOptions.encrypt !== undefined ? resolvedOptions.encrypt : this.defaultEncrypt;
    const userId = resolvedOptions.userId || this.defaultUserId;

    // Try memory cache first (fastest)
    const memoryEntry = this.memoryCache.get(key);
    if (memoryEntry && Date.now() - memoryEntry.timestamp < memoryEntry.ttl) {
      // console.log('[CacheManager] Memory cache HIT:', key);
      // Decrypt if needed
      return await this.decryptData(memoryEntry.data, memoryEntry.encrypted, userId);
    }

    // Try IndexedDB
    if (this.indexedDBSupported) {
      const indexedDBEntry = await this.getFromIndexedDB<T>(key);
      if (indexedDBEntry) {
        // console.log('[CacheManager] IndexedDB cache HIT:', key);
        // Cache in memory for faster access
        this.memoryCache.set(key, indexedDBEntry);
        // Decrypt if needed
        return await this.decryptData(indexedDBEntry.data, indexedDBEntry.encrypted, userId);
      }
    }

    // Try localStorage fallback
    const localStorageEntry = this.getFromLocalStorage<T>(key);
    if (localStorageEntry) {
      // console.log('[CacheManager] localStorage cache HIT:', key);
      // Cache in memory for faster access
      this.memoryCache.set(key, localStorageEntry);
      // Decrypt if needed
      return await this.decryptData(localStorageEntry.data, localStorageEntry.encrypted, userId);
    }

    // console.log('[CacheManager] Cache MISS:', key);
    return null;
  }

  async set<T>(key: string, data: T, options: AutoUserCacheOptions = {}): Promise<void> {
    // Resolve options with automatic user identification
    const resolvedOptions = resolveCacheOptions(options);
    const ttl = resolvedOptions.ttl || this.defaultTTL;
    const encrypt = resolvedOptions.encrypt !== undefined ? resolvedOptions.encrypt : this.defaultEncrypt;
    const userId = resolvedOptions.userId || this.defaultUserId;

    // Encrypt data if needed
    const processedData = await this.encryptData(data, encrypt, userId);

    const entry: CacheEntry<T> = {
      data: processedData,
      timestamp: Date.now(),
      ttl,
      encrypted: encrypt,
      userId: userId
    };

    // Always store in memory
    this.memoryCache.set(key, entry);
    this.cleanupMemory();

    // Priority 1: Try IndexedDB first
    if (this.indexedDBSupported) {
      try {
        await this.setToIndexedDB(key, entry);
        // console.log('[CacheManager] Stored in IndexedDB:', key, { encrypted: encrypt, userId: userId ? '***' : 'none' });
        return; // Success, don't fallback to localStorage
      } catch (error) {
        console.warn('[CacheManager] IndexedDB set failed, falling back to localStorage:', error);
      }
    }
    
    // Priority 2: Fallback to localStorage only if IndexedDB fails
    if (this.localStorageSupported) {
      this.setToLocalStorage(key, entry);
      // console.log('[CacheManager] Stored in localStorage:', key, { encrypted: encrypt, userId: userId ? '***' : 'none' });
    }
  }

  /**
   * Context-aware get method using factory-created cache manager instances
   */
  async getContextAware<T>(key: string, options?: ContextAwareCacheOptions): Promise<T | null> {
    if (!options?.context) {
      // Fall back to regular get if no context provided
      return this.get<T>(key);
    }

    // Create a context-specific cache manager instance
    const contextCacheManager = CacheManager.createContextAware(
      options.context,
      options.isolation,
      options.tenantId,
      options.userId
    );

    // Use the context-specific cache manager with proper options
    return contextCacheManager.get<T>(key, {
      encrypt: options?.encrypt,
      userId: options?.userId
    });
  }

  /**
   * Context-aware set method using factory-created cache manager instances
   */
  async setContextAware<T>(key: string, data: T, options?: ContextAwareCacheOptions): Promise<void> {
    if (!options?.context) {
      // Fall back to regular set if no context provided
      return this.set<T>(key, data, {
        encrypt: options?.encrypt,
        userId: options?.userId
      });
    }

    // Create a context-specific cache manager instance
    const contextCacheManager = CacheManager.createContextAware(
      options.context,
      options.isolation,
      options.tenantId,
      options.userId
    );

    // Use the context-specific cache manager with proper options
    return contextCacheManager.set<T>(key, data, {
      encrypt: options?.encrypt,
      userId: options?.userId
    });
  }

  async remove(key: string): Promise<void> {
    // Remove from all storage layers
    this.memoryCache.delete(key);

    if (this.indexedDBSupported && this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = this.db!.transaction([this.storeName], 'readwrite');
          const store = transaction.objectStore(this.storeName);
          const request = store.delete(key);

          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });
        // console.log('[CacheManager] Removed from IndexedDB:', key);
      } catch (error) {
        console.warn('[CacheManager] IndexedDB remove failed:', error);
      }
    }

    this.removeFromLocalStorage(key);
    // console.log('[CacheManager] Removed from all storage:', key);
  }

  /**
   * 🎯 Remove keys matching pattern from all storage layers
   * Uses context-aware factory pattern like save operations
   */
  async removeByPattern(pattern: string, context?: CacheContext, isolation?: CacheContext): Promise<number> {
    // console.log(`[CacheManager] 🚀 START removeByPattern with pattern: ${pattern} (context: ${context}, isolation: ${isolation})`);
    
    let totalRemoved = 0;

    // If context provided, use context-specific cache manager like save operations
    if (context) {
      // console.log(`[CacheManager] 🎯 Using context-specific cache manager for: ${context}/${isolation || context}`);
      const contextCacheManager = CacheManager.createContextAware(context, isolation);
      
      // Delegate to context-specific cache manager
      totalRemoved = await contextCacheManager.removeByPattern(pattern);
      // console.log(`[CacheManager] ✅ Context-specific invalidation completed, removed: ${totalRemoved}`);
      return totalRemoved;
    }

    // Fallback to default behavior for backward compatibility
    // console.log(`[CacheManager] 🗄️ Using default cache manager (no context provided)`);
    
    // Convert pattern to regex for matching
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    // console.log(`[CacheManager] 📝 Generated regex: ${regex}`);

    // Clear memory cache
    const memoryKeysToDelete: string[] = [];
    for (const [key] of this.memoryCache.entries()) {
      if (regex.test(key)) {
        memoryKeysToDelete.push(key);
      }
    }
    
    memoryKeysToDelete.forEach(key => this.memoryCache.delete(key));
    totalRemoved += memoryKeysToDelete.length;
    // console.log(`[CacheManager] 💾 Removed ${memoryKeysToDelete.length} keys from memory cache matching pattern: ${pattern}`);

    // Check if IndexedDB and localStorage are supported
    // console.log(`[CacheManager] 📊 IndexedDB supported: ${this.indexedDBSupported}, DB exists: ${!!this.db}`);
    // console.log(`[CacheManager] 📊 localStorage supported: ${this.localStorageSupported}`);

    // Run IndexedDB and localStorage invalidation in parallel for reliability
    const invalidationPromises: Promise<number>[] = [];
    
    if (this.indexedDBSupported && this.db) {
      // console.log(`[CacheManager] 🔥 Adding IndexedDB invalidation to parallel queue`);
      invalidationPromises.push(this.removeByPatternFromIndexedDB(pattern, regex));
    }
    
    if (this.localStorageSupported) {
      // console.log(`[CacheManager] 🔥 Adding localStorage invalidation to parallel queue`);
      invalidationPromises.push(this.removeByPatternFromLocalStorage(pattern, regex));
    }
    
    // console.log(`[CacheManager] ⚡ Running ${invalidationPromises.length} invalidation promises in parallel`);
    
    if (invalidationPromises.length > 0) {
      const results = await Promise.allSettled(invalidationPromises);
      // console.log(`[CacheManager] ✅ All invalidation promises completed, results:`, results);
      
      // Sum up successful removals
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          totalRemoved += result.value;
          // console.log(`[CacheManager] ✅ Promise ${index + 1} removed ${result.value} entries`);
        } else {
          // console.error(`[CacheManager] ❌ Promise ${index + 1} failed:`, result.reason);
        }
      });
    }
    
    console.log(`[CacheManager] 🏁 END removeByPattern, total removed: ${totalRemoved}`);
    return totalRemoved;
  }

  /**
   * Remove keys matching pattern from IndexedDB only
   */
  private async removeByPatternFromIndexedDB(pattern: string, regex: RegExp): Promise<number> {
    // console.log(`[CacheManager] 🗄️ START IndexedDB pattern removal for: ${pattern}`);
    let removedCount = 0;
    
    try {
      const keysToDelete: string[] = [];
      const allKeys: string[] = [];
      
      // Collect matching keys
      await new Promise<void>((resolve, reject) => {
        // console.log(`[CacheManager] 🔍 Scanning IndexedDB for matching keys...`);
        const transaction = this.db!.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.openCursor();
        
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            const key = cursor.key as string;
            allKeys.push(key);
            if (regex.test(key)) {
              keysToDelete.push(key);
              console.log(`[CacheManager] 🎯 Found matching IndexedDB key: ${key}`);
            }
            cursor.continue();
          } else {
            console.log(`[CacheManager] 📊 IndexedDB scan complete: ${allKeys.length} total keys, ${keysToDelete.length} matching`);
            console.log(`[CacheManager] 📋 All IndexedDB keys:`, allKeys.slice(0, 10)); // Show first 10 keys
            if (allKeys.length > 10) {
              console.log(`[CacheManager] 📋 ... and ${allKeys.length - 10} more keys`);
            }
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
      
      if (keysToDelete.length > 0) {
        console.log(`[CacheManager] 🗑️ Deleting ${keysToDelete.length} keys from IndexedDB in parallel...`);
        // Delete matching keys in parallel for better performance
        const deletePromises = keysToDelete.map(key => this.remove(key));
        await Promise.all(deletePromises);
        console.log(`[CacheManager] ✅ Successfully deleted ${keysToDelete.length} keys from IndexedDB`);
      } else {
        console.log(`[CacheManager] ℹ️ No keys to delete from IndexedDB`);
      }
      
      removedCount = keysToDelete.length;
      
    } catch (error) {
      console.error('[CacheManager] ❌ IndexedDB pattern remove failed:', error);
      throw error;
    }
    
    console.log(`[CacheManager] 🏁 END IndexedDB pattern removal, removed: ${removedCount}`);
    return removedCount;
  }

  /**
   * Remove keys matching pattern from localStorage only
   */
  private async removeByPatternFromLocalStorage(pattern: string, regex: RegExp): Promise<number> {
    // console.log(`[CacheManager] 💾 START localStorage pattern removal for: ${pattern}`);
    let removedCount = 0;
    
    try {
      const prefix = this.getStorageKey('');
      const keysToDelete: string[] = [];
      const allKeys: string[] = [];
      
      // console.log(`[CacheManager] 🔍 Scanning localStorage with prefix: ${prefix}`);
      
      // Collect matching keys
      for (let i = 0; i < localStorage.length; i++) {
        const storageKey = localStorage.key(i);
        if (storageKey && storageKey.startsWith(prefix)) {
          // Extract the actual cache key from the storage key
          const cacheKey = storageKey.substring(prefix.length);
          allKeys.push(cacheKey);
          if (regex.test(cacheKey)) {
            keysToDelete.push(storageKey);
            // console.log(`[CacheManager] 🎯 Found matching localStorage key: ${storageKey} (cache key: ${cacheKey})`);
          }
        }
      }
      
      // console.log(`[CacheManager] 📊 localStorage scan complete: ${allKeys.length} total keys, ${keysToDelete.length} matching`);
      // console.log(`[CacheManager] 📋 All localStorage cache keys:`, allKeys.slice(0, 10)); // Show first 10 keys
      if (allKeys.length > 10) {
        // console.log(`[CacheManager] 📋 ... and ${allKeys.length - 10} more keys`);
      }
      
      if (keysToDelete.length > 0) {
        // console.log(`[CacheManager] 🗑️ Deleting ${keysToDelete.length} keys from localStorage...`);
        // Delete matching keys
        keysToDelete.forEach(storageKey => {
          localStorage.removeItem(storageKey);
          removedCount++;
        });
        // console.log(`[CacheManager] ✅ Successfully deleted ${keysToDelete.length} keys from localStorage`);
      } else {
        // console.log(`[CacheManager] ℹ️ No keys to delete from localStorage`);
      }
      
    } catch (error) {
      console.error('[CacheManager] ❌ localStorage pattern remove failed:', error);
      throw error;
    }
    
    // console.log(`[CacheManager] 🏁 END localStorage pattern removal, removed: ${removedCount}`);
    return removedCount;
  }

  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();

    // Clear IndexedDB
    if (this.indexedDBSupported && this.db) {
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = this.db!.transaction([this.storeName], 'readwrite');
          const store = transaction.objectStore(this.storeName);
          const request = store.clear();

          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve();
        });
        // console.log('[CacheManager] Cleared IndexedDB');
      } catch (error) {
        console.warn('[CacheManager] IndexedDB clear failed:', error);
      }
    }

    // Clear localStorage
    if (this.localStorageSupported) {
      try {
        const keys = Object.keys(localStorage);
        const prefix = this.getStorageKey('');
        keys.forEach(key => {
          if (key.startsWith(prefix)) {
            localStorage.removeItem(key);
          }
        });
        // console.log('[CacheManager] Cleared localStorage');
      } catch (error) {
        console.warn('[CacheManager] localStorage clear failed:', error);
      }
    }

    // console.log('[CacheManager] Cleared all storage');
  }

  getStats(): {
    memorySize: number;
    indexedDBSupported: boolean;
    localStorageSupported: boolean;
  } {
    return {
      memorySize: this.memoryCache.size,
      indexedDBSupported: this.indexedDBSupported,
      localStorageSupported: this.localStorageSupported
    };
  }
}

// Singleton cache manager instance
const cacheManager = new CacheManager({
  dbName: 'singleton-cache',
  storeName: 'cache-store',
  ttl: 15 * 60 * 1000, // 15 minutes
  maxSize: 100
});

export default cacheManager;
export { CacheManager, type CacheOptions, type CacheEntry, type ContextAwareCacheOptions };

/**
 * Context-specific cache manager classes that extend the base CacheManager
 * Each context gets its own dedicated database instance with explicit configuration
 */

// Tenant cache manager - for tenant-specific data
export class TenantCacheManager extends CacheManager {
  constructor(tenantId?: string) {
    super({
      dbName: tenantId ? `tenant-cache-tenant-${tenantId}` : 'tenant-cache',
      storeName: 'tenant-store',
      ttl: 15 * 60 * 1000, // 15 minutes
      maxSize: 100
    });
  }
}

// User cache manager - for user-specific data
export class UserCacheManager extends CacheManager {
  constructor(userId?: string) {
    super({
      dbName: userId ? `user-cache-user-${userId}` : 'user-cache',
      storeName: 'user-store',
      ttl: 15 * 60 * 1000, // 15 minutes
      maxSize: 100
    });
  }
}

// Admin cache manager - for admin operations
export class AdminCacheManager extends CacheManager {
  constructor() {
    super({
      dbName: 'admin-cache',
      storeName: 'admin-store',
      ttl: 5 * 60 * 1000, // 5 minutes for admin data (security)
      maxSize: 50
    });
  }
}

// Public cache manager - for public-facing data
export class PublicCacheManager extends CacheManager {
  constructor() {
    super({
      dbName: 'public-cache',
      storeName: 'public-store',
      ttl: 30 * 60 * 1000, // 30 minutes for public data (performance)
      maxSize: 200
    });
  }
}

// Product cache manager - for product data
export class ProductCacheManager extends CacheManager {
  constructor() {
    super({
      dbName: 'product-cache',
      storeName: 'product-store',
      ttl: 20 * 60 * 1000, // 20 minutes for product data
      maxSize: 150
    });
  }
}

// Shop cache manager - for shop data
export class ShopCacheManager extends CacheManager {
  constructor() {
    super({
      dbName: 'shop-cache',
      storeName: 'shop-store',
      ttl: 25 * 60 * 1000, // 25 minutes for shop data
      maxSize: 120
    });
  }
}

// Store cache manager - for store data
export class StoreCacheManager extends CacheManager {
  constructor() {
    super({
      dbName: 'store-cache',
      storeName: 'store-store',
      ttl: 20 * 60 * 1000, // 20 minutes for store data
      maxSize: 100
    });
  }
}

// System cache manager - for system operations
export class SystemCacheManager extends CacheManager {
  constructor() {
    super({
      dbName: 'system-cache',
      storeName: 'system-store',
      ttl: 10 * 60 * 1000, // 10 minutes for system data
      maxSize: 80
    });
  }
}

// Directory cache manager - for directory data
export class DirectoryCacheManager extends CacheManager {
  constructor() {
    super({
      dbName: 'directory-cache',
      storeName: 'directory-store',
      ttl: 30 * 60 * 1000, // 30 minutes for directory data
      maxSize: 150
    });
  }
}

// Global cache manager - for global/shared data
export class GlobalCacheManager extends CacheManager {
  constructor() {
    super({
      dbName: 'global-cache',
      storeName: 'global-store',
      ttl: 60 * 60 * 1000, // 1 hour for global data (stability)
      maxSize: 300
    });
  }
}
