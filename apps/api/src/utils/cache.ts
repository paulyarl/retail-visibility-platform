/**
 * Simple in-memory cache with TTL support
 * Used for caching business hours status and other frequently accessed data
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

export class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>()
  private metrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    expirations: 0
  }

  /**
   * Get a value from cache if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) {
      this.metrics.misses++
      return null
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.metrics.expirations++
      this.metrics.misses++
      return null
    }

    this.metrics.hits++
    return entry.data
  }

  /**
   * Set a value in cache with TTL in seconds
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    const expiresAt = Date.now() + (ttlSeconds * 1000)
    this.cache.set(key, { data: value, expiresAt })
    this.metrics.sets++
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): void {
    if (this.cache.delete(key)) {
      this.metrics.deletes++
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  deletePattern(pattern: string): void {
    let deletedCount = 0
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
        deletedCount++
      }
    }
    this.metrics.deletes += deletedCount
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size
    this.cache.clear()
    this.metrics.deletes += size
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let total = 0
    let expired = 0
    const now = Date.now()

    for (const [key, entry] of this.cache.entries()) {
      total++
      if (now > entry.expiresAt) {
        expired++
      }
    }

    return {
      totalEntries: total,
      expiredEntries: expired,
      activeEntries: total - expired,
      metrics: { ...this.metrics }
    }
  }

  /**
   * Reset metrics counters
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      expirations: 0
    }
  }

  /**
   * Get cache hit rate (percentage)
   */
  getHitRate(): number {
    const total = this.metrics.hits + this.metrics.misses
    return total > 0 ? (this.metrics.hits / total) * 100 : 0
  }

  /**
   * Clean up expired entries (optional maintenance)
   */
  cleanup(): void {
    const now = Date.now()
    let expiredCount = 0
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        expiredCount++
      }
    }
    this.metrics.expirations += expiredCount
  }
}

// Singleton instance
export const memoryCache = new MemoryCache()

// Cache key generators
export const cacheKeys = {
  businessHoursStatus: (tenantId: string) => `business_hours_status:${tenantId}`,
  businessHoursData: (tenantId: string) => `business_hours_data:${tenantId}`
}

// Cache TTL constants (in seconds)
export const CACHE_TTL = {
  BUSINESS_HOURS_STATUS: 900, // 5 minutes - status can change based on time
  BUSINESS_HOURS_DATA: 1800   // 30 minutes - raw data changes less frequently
}
