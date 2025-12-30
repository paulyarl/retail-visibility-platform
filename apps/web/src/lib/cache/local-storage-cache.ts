/**
 * Local Storage Cache Wrapper
 * Provides persistent caching with TTL for API responses
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  tenantId?: string; // Optional tenant scoping
}

export class LocalStorageCache {
  private static readonly PREFIX = 'cache:';
  private static readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate cache key with optional tenant scoping
   */
  private static getKey(key: string, tenantId?: string): string {
    const tenantPrefix = tenantId ? `${tenantId}:` : '';
    return `${this.PREFIX}${tenantPrefix}${key}`;
  }

  /**
   * Check if cached entry is still valid
   */
  private static isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Get cached data if valid, null otherwise
   */
  static get<T>(key: string, tenantId?: string): T | null {
    try {
      const cacheKey = this.getKey(key, tenantId);
      const stored = localStorage.getItem(cacheKey);

      if (!stored) return null;

      const entry: CacheEntry<T> = JSON.parse(stored);

      if (this.isExpired(entry)) {
        this.delete(key, tenantId);
        return null;
      }

      return entry.data;
    } catch (error) {
      console.warn('[LocalStorageCache] Error reading from cache:', error);
      return null;
    }
  }

  /**
   * Set cache entry with TTL
   */
  static set<T>(key: string, data: T, options: CacheOptions = {}): void {
    try {
      const { ttl = this.DEFAULT_TTL, tenantId } = options;
      const cacheKey = this.getKey(key, tenantId);

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl
      };

      localStorage.setItem(cacheKey, JSON.stringify(entry));
    } catch (error) {
      console.warn('[LocalStorageCache] Error writing to cache:', error);
    }
  }

  /**
   * Delete specific cache entry
   */
  static delete(key: string, tenantId?: string): void {
    try {
      const cacheKey = this.getKey(key, tenantId);
      localStorage.removeItem(cacheKey);
    } catch (error) {
      console.warn('[LocalStorageCache] Error deleting from cache:', error);
    }
  }

  /**
   * Clear all cache entries (optionally scoped to tenant)
   */
  static clear(tenantId?: string): void {
    try {
      const prefix = tenantId ? `${this.PREFIX}${tenantId}:` : this.PREFIX;

      const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));

      keys.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.warn('[LocalStorageCache] Error clearing cache:', error);
    }
  }

  /**
   * Get cache stats for debugging
   */
  static getStats(tenantId?: string): { entries: number; size: number } {
    try {
      const prefix = tenantId ? `${this.PREFIX}${tenantId}:` : this.PREFIX;

      const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));

      let totalSize = 0;
      keys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) totalSize += value.length;
      });

      return { entries: keys.length, size: totalSize };
    } catch (error) {
      return { entries: 0, size: 0 };
    }
  }
}
