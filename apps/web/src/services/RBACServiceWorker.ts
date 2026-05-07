/**
 * RBAC Service Worker for Platform Caching
 * Provides advanced caching coordination across browser tabs and platform
 */

const RBAC_CACHE_VERSION = '1.0.0';
const RBAC_CACHE_PREFIX = 'rbac-cache-';

// Cache storage keys
const CACHE_KEYS = {
  ROLE_GROUPS: `${RBAC_CACHE_PREFIX}role-groups`,
  USER_PERMISSIONS: `${RBAC_CACHE_PREFIX}user-permissions`,
  USER_ACCESS: `${RBAC_CACHE_PREFIX}user-access`
};

// Cache TTL in milliseconds
const CACHE_TTL = {
  ROLE_GROUPS: 10 * 60 * 1000, // 10 minutes
  USER_PERMISSIONS: 10 * 60 * 1000, // 10 minutes
  USER_ACCESS: 10 * 60 * 1000 // 10 minutes
};

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  etag?: string;
  version: string;
}

/**
 * RBAC Service Worker
 * Provides advanced caching and coordination for RBAC data
 * Handles cross-tab cache synchronization and background updates
 */

// Service Worker types
declare global {
  interface WorkerGlobalScope {
    addEventListener: (type: string, listener: (event: any) => void) => void;
    clients: any;
    skipWaiting: () => Promise<void>;
  }
  
  var workerSelf: WorkerGlobalScope;
}

interface ExtendableEvent extends Event {
  waitUntil(promise: Promise<any>): void;
}

interface Clients {
  matchAll(options?: any): Promise<any[]>;
}

/**
 * RBAC Service Worker
 * Provides advanced caching and coordination for RBAC data
 * Handles cross-tab cache synchronization and background updates
 */
class RBACServiceWorker {
  private cache: Map<string, CacheEntry> = new Map();
  private isInitialized = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load cache from localStorage if available
      this.loadCacheFromStorage();
      
      // Set up message listener for cache coordination
      this.setupMessageListener();
      
      // Set up periodic cache cleanup
      this.setupCacheCleanup();
      
      this.isInitialized = true;
      console.log('[RBACServiceWorker] Initialized successfully');
    } catch (error) {
      console.error('[RBACServiceWorker] Failed to initialize:', error);
    }
  }

  /**
   * Get cached data with platform coordination
   */
  async get(key: string): Promise<any | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if cache is expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.saveCacheToStorage();
      return null;
    }

    console.log(`[RBACServiceWorker] Cache hit for key: ${key}`);
    return entry.data;
  }

  /**
   * Set cached data with platform coordination
   */
  async set(key: string, data: any, ttl?: number, etag?: string): Promise<void> {
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.getDefaultTTL(key),
      etag,
      version: RBAC_CACHE_VERSION
    };

    this.cache.set(key, entry);
    this.saveCacheToStorage();
    
    // Notify other tabs of cache update
    this.broadcastCacheUpdate(key, data);
    
    console.log(`[RBACServiceWorker] Cache set for key: ${key}`);
  }

  /**
   * Delete specific cache entry
   */
  async delete(key: string): Promise<void> {
    this.cache.delete(key);
    this.saveCacheToStorage();
    
    // Notify other tabs of cache deletion
    this.broadcastCacheDeletion(key);
    
    console.log(`[RBACServiceWorker] Cache deleted for key: ${key}`);
  }

  /**
   * Clear all RBAC cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.saveCacheToStorage();
    
    // Notify other tabs of cache clear
    this.broadcastCacheClear();
    
    console.log('[RBACServiceWorker] All cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    totalEntries: number;
    expiredEntries: number;
    cacheSize: number;
    lastUpdate: number;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    const expiredEntries = entries.filter(([_, entry]) => this.isExpired(entry));
    
    return {
      totalEntries: entries.length,
      expiredEntries: expiredEntries.length,
      cacheSize: this.calculateCacheSize(),
      lastUpdate: Math.max(...entries.map(([_, entry]) => entry.timestamp), 0)
    };
  }

  /**
   * Preload all RBAC data
   */
  async preloadAll(): Promise<void> {
    console.log('[RBACServiceWorker] Preloading all RBAC data');
    
    try {
      // This would be called from the main thread
      // The service worker can't make fetch requests directly in all environments
      // So we notify the main thread to preload
      this.broadcastPreloadRequest();
    } catch (error) {
      console.error('[RBACServiceWorker] Failed to preload data:', error);
    }
  }

  // Private methods

  private isExpired(entry: CacheEntry): boolean {
    return (Date.now() - entry.timestamp) > entry.ttl;
  }

  private getDefaultTTL(key: string): number {
    switch (key) {
      case CACHE_KEYS.ROLE_GROUPS:
        return CACHE_TTL.ROLE_GROUPS;
      case CACHE_KEYS.USER_PERMISSIONS:
        return CACHE_TTL.USER_PERMISSIONS;
      case CACHE_KEYS.USER_ACCESS:
        return CACHE_TTL.USER_ACCESS;
      default:
        return CACHE_TTL.ROLE_GROUPS; // Default to 10 minutes
    }
  }

  private loadCacheFromStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }

      const stored = window.localStorage.getItem('rbac-service-worker-cache');
      if (!stored) return;

      const parsed = JSON.parse(stored);
      const cacheData = parsed.cache || {};
      
      // Validate and load cache entries
      Object.entries(cacheData).forEach(([key, entry]: [string, any]) => {
        if (entry.version === RBAC_CACHE_VERSION && !this.isExpired(entry)) {
          this.cache.set(key, entry);
        }
      });

      console.log(`[RBACServiceWorker] Loaded ${this.cache.size} entries from storage`);
    } catch (error) {
      console.error('[RBACServiceWorker] Failed to load cache from storage:', error);
    }
  }

  private saveCacheToStorage(): void {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return;
      }

      const cacheData: Record<string, CacheEntry> = {};
      this.cache.forEach((entry, key) => {
        cacheData[key] = entry;
      });

      const data = {
        version: RBAC_CACHE_VERSION,
        timestamp: Date.now(),
        cache: cacheData
      };

      window.localStorage.setItem('rbac-service-worker-cache', JSON.stringify(data));
    } catch (error) {
      console.error('[RBACServiceWorker] Failed to save cache to storage:', error);
    }
  }

  private setupMessageListener(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('message', (event) => {
      if (event.data?.type !== 'RBAC_CACHE_UPDATE') return;

      const { event: cacheEvent, data } = event.data;

      switch (cacheEvent) {
        case 'role-groups-updated':
        case 'user-permissions-updated':
        case 'user-access-updated':
          // Update local cache from other tabs
          this.handleCacheUpdate(cacheEvent, data);
          break;
        
        case 'rbac-cache-invalidated':
          this.handleCacheInvalidation();
          break;
        
        case 'rbac-cache-key-invalidated':
          this.handleCacheKeyInvalidation(data.key);
          break;
        
        case 'preload-request':
          this.handlePreloadRequest();
          break;
      }
    });
  }

  private setupCacheCleanup(): void {
    // Clean up expired cache entries every 5 minutes
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);
  }

  private cleanupExpiredEntries(): void {
    const before = this.cache.size;
    
    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
      }
    }
    
    if (this.cache.size !== before) {
      this.saveCacheToStorage();
      console.log(`[RBACServiceWorker] Cleaned up ${before - this.cache.size} expired entries`);
    }
  }

  private calculateCacheSize(): number {
    let size = 0;
    this.cache.forEach(entry => {
      size += JSON.stringify(entry).length;
    });
    return size;
  }

  private broadcastCacheUpdate(key: string, data: any): void {
    if (typeof window === 'undefined') return;

    window.postMessage({
      type: 'RBAC_CACHE_UPDATE',
      event: 'cache-updated',
      data: { key, data, timestamp: Date.now() }
    }, '*');
  }

  private broadcastCacheDeletion(key: string): void {
    if (typeof window === 'undefined') return;

    window.postMessage({
      type: 'RBAC_CACHE_UPDATE',
      event: 'cache-deleted',
      data: { key, timestamp: Date.now() }
    }, '*');
  }

  private broadcastCacheClear(): void {
    if (typeof window === 'undefined') return;

    window.postMessage({
      type: 'RBAC_CACHE_UPDATE',
      event: 'cache-cleared',
      data: { timestamp: Date.now() }
    }, '*');
  }

  private broadcastPreloadRequest(): void {
    if (typeof window === 'undefined') return;

    window.postMessage({
      type: 'RBAC_CACHE_UPDATE',
      event: 'preload-request',
      data: { timestamp: Date.now() }
    }, '*');
  }

  private handleCacheUpdate(event: string, data: any): void {
    // Update local cache from other tabs
    console.log(`[RBACServiceWorker] Received cache update: ${event}`);
    // Implementation would depend on specific event type
  }

  private handleCacheInvalidation(): void {
    this.cache.clear();
    this.saveCacheToStorage();
    console.log('[RBACServiceWorker] Cache invalidated from other tab');
  }

  private handleCacheKeyInvalidation(key: string): void {
    this.cache.delete(key);
    this.saveCacheToStorage();
    console.log(`[RBACServiceWorker] Cache key invalidated from other tab: ${key}`);
  }

  private handlePreloadRequest(): void {
    console.log('[RBACServiceWorker] Received preload request');
    // Implementation would trigger preload in main thread
  }

  public async cleanupExpired(): Promise<void> {
    console.log('[RBACServiceWorker] Cleaning up expired cache entries');
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= entry.ttl) {
        this.cache.delete(key);
        console.log(`[RBACServiceWorker] Removed expired cache entry: ${key}`);
      }
    }
    
    this.saveCacheToStorage();
  }
}

// Export singleton instance
export const rbacServiceWorker = new RBACServiceWorker();

// Auto-initialize if running in service worker context
const serviceWorkerSelf = (typeof self !== 'undefined' && 'addEventListener' in self) ? self : null;

if (serviceWorkerSelf) {
  serviceWorkerSelf.addEventListener('install', (event: any) => {
    console.log('[RBACServiceWorker] Service worker installed');
    (event as ExtendableEvent).waitUntil((async () => {
      await rbacServiceWorker.preloadAll();
    })());
  });

  serviceWorkerSelf.addEventListener('activate', (event: any) => {
    console.log('[RBACServiceWorker] Service worker activated');
    (event as ExtendableEvent).waitUntil((async () => {
      await rbacServiceWorker.cleanupExpired();
    })());
  });
}
