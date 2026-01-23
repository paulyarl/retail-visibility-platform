/**
 * Universal Cache Manager
 * 
 * Provides IndexedDB with localStorage fallback for singleton caching.
 * Handles TTL, size limits, encryption, and graceful degradation.
 */

import { CacheEncryption } from '@/lib/cache/cache-encryption';
import { resolveCacheOptions, AutoUserCacheOptions } from './userIdentification';

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

    if (this.indexedDBSupported) {
      this.initIndexedDB();
    }
  }

  private async initIndexedDB(): Promise<void> {
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
      });

      console.log('[CacheManager] IndexedDB initialized successfully');
    } catch (error) {
      console.warn('[CacheManager] IndexedDB initialization failed, falling back to memory only:', error);
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

  private async cleanupIndexedDB(): Promise<void> {
    if (!this.db || !this.indexedDBSupported) return;

    try {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const entry = cursor.value as CacheEntry<any>;
          if (Date.now() - entry.timestamp >= entry.ttl) {
            cursor.delete();
          }
          cursor.continue();
        }
      };
    } catch (error) {
      console.warn('[CacheManager] IndexedDB cleanup failed:', error);
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
      console.warn('[CacheManager] localStorage set failed:', error);
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
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.memoryCache.delete(key);
      }
    }

    // Remove oldest entries if over size limit
    if (this.memoryCache.size > this.maxSize) {
      const entries = Array.from(this.memoryCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.memoryCache.size - this.maxSize);
      toRemove.forEach(([key]) => this.memoryCache.delete(key));
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
      console.log('[CacheManager] Memory cache HIT:', key);
      // Decrypt if needed
      return await this.decryptData(memoryEntry.data, memoryEntry.encrypted, userId);
    }

    // Try IndexedDB
    if (this.indexedDBSupported) {
      const indexedDBEntry = await this.getFromIndexedDB<T>(key);
      if (indexedDBEntry) {
        console.log('[CacheManager] IndexedDB cache HIT:', key);
        // Cache in memory for faster access
        this.memoryCache.set(key, indexedDBEntry);
        // Decrypt if needed
        return await this.decryptData(indexedDBEntry.data, indexedDBEntry.encrypted, userId);
      }
    }

    // Try localStorage fallback
    const localStorageEntry = this.getFromLocalStorage<T>(key);
    if (localStorageEntry) {
      console.log('[CacheManager] localStorage cache HIT:', key);
      // Cache in memory for faster access
      this.memoryCache.set(key, localStorageEntry);
      // Decrypt if needed
      return await this.decryptData(localStorageEntry.data, localStorageEntry.encrypted, userId);
    }

    console.log('[CacheManager] Cache MISS:', key);
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

    // Store in IndexedDB if available
    if (this.indexedDBSupported) {
      await this.setToIndexedDB(key, entry);
      console.log('[CacheManager] Stored in IndexedDB:', key, { encrypted: encrypt, userId: userId ? '***' : 'none' });
    }
    
    // Fallback to localStorage
    if (this.localStorageSupported) {
      this.setToLocalStorage(key, entry);
      console.log('[CacheManager] Stored in localStorage:', key, { encrypted: encrypt, userId: userId ? '***' : 'none' });
    }
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
        console.log('[CacheManager] Removed from IndexedDB:', key);
      } catch (error) {
        console.warn('[CacheManager] IndexedDB remove failed:', error);
      }
    }

    this.removeFromLocalStorage(key);
    console.log('[CacheManager] Removed from all storage:', key);
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
        console.log('[CacheManager] Cleared IndexedDB');
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
        console.log('[CacheManager] Cleared localStorage');
      } catch (error) {
        console.warn('[CacheManager] localStorage clear failed:', error);
      }
    }

    console.log('[CacheManager] Cleared all storage');
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
export { CacheManager, type CacheOptions, type CacheEntry };
