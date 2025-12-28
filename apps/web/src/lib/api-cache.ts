/**
 * Simple client-side API response cache
 * Prevents multiple simultaneous requests to the same endpoint
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class ApiCache {
  private cache = new Map<string, CacheEntry>();

  /**
   * Get cached data if still valid
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cache entry with TTL
   */
  set(key: string, data: any, ttl: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Check if key exists and is still valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear specific key or all cache
   */
  clear(key?: string): void {
    if (key) {
      this.cache.delete(key);
    } else {
      this.cache.clear();
    }
  }
}

// Global cache instance
export const apiCache = new ApiCache();

/**
 * Cached fetch function
 * Returns cached data if available and valid, otherwise makes request and caches result
 */
export async function cachedFetch(
  url: string,
  options?: RequestInit,
  ttl: number = 60000 // 60 seconds default (1 min)
): Promise<Response> {
  const cacheKey = `${url}:${JSON.stringify(options || {})}`;

  // Check cache first
  const cachedData = apiCache.get(cacheKey);
  if (cachedData) {
    // Return cached response as a Response-like object
    return new Response(JSON.stringify(cachedData), {
      status: 200,
      statusText: 'OK',
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Make actual request
  const response = await fetch(url, options);

  if (response.ok) {
    try {
      const data = await response.clone().json();
      // Cache successful JSON responses
      apiCache.set(cacheKey, data, ttl);
    } catch (e) {
      // Not JSON, don't cache
    }
  }

  return response;
}
