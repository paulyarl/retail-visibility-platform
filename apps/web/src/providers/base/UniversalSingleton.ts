/**
 * Universal Singleton Base Class
 * 
 * Provides common functionality for all platform singletons:
 * - Singleton pattern implementation
 * - Cache manager integration with encryption support
 * - Performance tracking (cache hits, misses, API calls)
 * - Common cache operations with error handling
 * - Metrics collection and reset
 * - API request utilities
 */

import { CacheManager } from '@/utils/cacheManager';
import { AutoUserCacheOptions } from '@/utils/userIdentification';

export interface SingletonCacheOptions {
  encrypt?: boolean;
  userId?: string;
}

export interface SingletonMetrics {
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  apiCalls: number;
  cacheSize: number;
  inMemoryCacheSize: number;
  persistentCacheSize: number;
}

/**
 * Abstract base class for all singletons
 * Provides universal singleton functionality with caching and metrics
 */
export abstract class UniversalSingleton {
  // Singleton instance management (from ApiSingletonBase)
  protected static instances: Map<string, UniversalSingleton> = new Map();

  // Cache management (from ApiSingletonBase)
  protected cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes default

  // Cache manager integration
  protected cacheManager: CacheManager;

  // Performance tracking
  protected cacheHits: number = 0;
  protected cacheMisses: number = 0;
  protected apiCalls: number = 0;

  // Emergency cache busting mode
  private static emergencyBustMode: boolean = false;
  private static emergencyBustReason: string = '';
  private static readonly STORAGE_KEY = 'emergency_bust_mode';

  /**
   * Enable/disable emergency cache busting mode
   * When enabled, all cache operations are bypassed and fresh data is always fetched
   */
  static setEmergencyBustMode(enabled: boolean, reason: string = ''): void {
    this.emergencyBustMode = enabled;
    this.emergencyBustReason = reason;
    
    // Persist to localStorage so it survives page refreshes
    if (typeof window !== 'undefined') {
      if (enabled) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ enabled, reason }));
        console.warn(`🚨 [UniversalSingleton] EMERGENCY CACHE BUST MODE ENABLED: ${reason}`);
        console.warn('🚨 All cache operations will be bypassed until disabled');
      } else {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log(`✅ [UniversalSingleton] Emergency cache bust mode disabled: ${reason}`);
      }
    }
  }

  /**
   * Check if emergency bust mode is enabled
   */
  static isEmergencyBustMode(): boolean {
    // Check localStorage on first access to persist across refreshes
    if (typeof window !== 'undefined' && !this.emergencyBustMode) {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          this.emergencyBustMode = parsed.enabled;
          this.emergencyBustReason = parsed.reason || '';
          if (this.emergencyBustMode) {
            console.log(`🚨 [UniversalSingleton] Emergency bust mode restored from storage: ${this.emergencyBustReason}`);
          }
        } catch (error) {
          console.warn('[UniversalSingleton] Failed to parse emergency bust mode from storage:', error);
          localStorage.removeItem(this.STORAGE_KEY);
        }
      }
    }
    
    return this.emergencyBustMode;
  }

  /**
   * Get emergency bust mode status
   */
  static getEmergencyBustStatus(): { enabled: boolean; reason: string } {
    return {
      enabled: this.emergencyBustMode,
      reason: this.emergencyBustReason
    };
  }

  /**
   * Emergency bust mode controls for global access
   * These can be called from browser console for quick debugging
   */
  static emergencyBust(reason: string = 'Manual emergency bust'): void {
    this.setEmergencyBustMode(true, reason);
  }

  static emergencyBustDisable(reason: string = 'Emergency resolved'): void {
    this.setEmergencyBustMode(false, reason);
  }

  static emergencyBustStatus(): void {
    const status = this.getEmergencyBustStatus();
    console.log(`🚨 Emergency Bust Mode Status: ${status.enabled ? 'ENABLED' : 'DISABLED'}`);
    if (status.enabled) {
      console.log(`🚨 Reason: ${status.reason}`);
    }
  }

  // Attach to window for global access (only in browser)
  static attachToWindow(): void {
    if (typeof window !== 'undefined') {
      // Only attach if not already present to avoid overwriting
      if (!(window as any).emergencyBust) {
        (window as any).emergencyBust = (reason: string) => {
          console.log(`🚨 Enabling emergency bust mode: ${reason}`);
          this.setEmergencyBustMode(true, reason);
        };
        
        (window as any).emergencyBustDisable = (reason: string) => {
          console.log(`✅ Disabling emergency bust mode: ${reason}`);
          this.setEmergencyBustMode(false, reason);
        };
        
        (window as any).emergencyBustStatus = () => {
          const status = this.getEmergencyBustStatus();
          console.log(`🚨 Emergency Bust Mode Status: ${status.enabled ? 'ENABLED' : 'DISABLED'}`);
          if (status.enabled) {
            console.log(`🚨 Reason: ${status.reason}`);
          }
          return status;
        };
        
        console.log('🔧 Emergency bust controls attached to window:');
        console.log('  - window.emergencyBust("reason") - Enable emergency mode');
        console.log('  - window.emergencyBustDisable("reason") - Disable emergency mode');
        console.log('  - window.emergencyBustStatus() - Check status');
      }
    }
  }

  // Singleton identifier
  protected readonly singletonKey: string;

  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    this.singletonKey = singletonKey;
    this.cacheManager = new CacheManager(cacheOptions);
    
    // Initialize emergency bust mode from storage
    UniversalSingleton.isEmergencyBustMode();
  }

  /**
   * Get data from cache with automatic hit/miss tracking
   */
  protected async getFromCache<T>(key: string, options?: AutoUserCacheOptions): Promise<T | null> {
    // Emergency bust mode bypasses all cache operations
    if (UniversalSingleton.emergencyBustMode) {
      console.log(`🚨 [${this.constructor.name}] Emergency bust mode: bypassing cache for ${key}`);
      this.cacheMisses++;
      this.logCacheMiss(key);
      return null;
    }

    try {
      const cached = await this.cacheManager.get(key, options);
      if (cached) {
        this.cacheHits++;
        this.logCacheHit(key);
        return cached as T;
      }
    } catch (error) {
      this.logCacheError('get', key, error);
    }
    
    this.cacheMisses++;
    this.logCacheMiss(key);
    return null;
  }

  /**
   * Set data in cache with error handling
   */
  protected async setCache<T>(key: string, data: T, options?: AutoUserCacheOptions): Promise<void> {
    // Emergency bust mode bypasses all cache operations
    if (UniversalSingleton.emergencyBustMode) {
      console.log(`🚨 [${this.constructor.name}] Emergency bust mode: skipping cache set for ${key}`);
      return;
    }

    try {
      await this.cacheManager.set(key, data, options);
      this.logCacheSet(key);
    } catch (error) {
      this.logCacheError('set', key, error);
    }
  }

  /**
   * Clear cache with error handling (enhanced from ApiSingletonBase)
   */
  protected async clearCache(key?: string): Promise<void> {
    try {
      // Clear in-memory cache
      if (key) {
        this.cache.delete(key);
        this.logCacheClear(key);
      } else {
        this.cache.clear();
        this.logCacheClearAll();
      }
      
      // Clear persistent cache
      if (key) {
        await this.cacheManager.remove(key);
        this.logCacheClear(`persistent:${key}`);
      } else {
        await this.cacheManager.clear();
        this.logCacheClearAll();
      }
    } catch (error) {
      this.logCacheError('clear', key || 'all', error);
    }
  }

  /**
   * Check if data is cached and valid (from ApiSingletonBase)
   */
  protected isCached(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < cached.ttl;
  }

  /**
   * Get cached data (from ApiSingletonBase)
   */
  protected getCachedData(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;
    
    const now = Date.now();
    if ((now - cached.timestamp) >= cached.ttl) {
      this.cache.delete(key);
      this.cacheMisses++;
      return null;
    }
    
    this.cacheHits++;
    return cached.data;
  }

  /**
   * Set cached data (from ApiSingletonBase)
   */
  protected setCachedData(key: string, data: any, customTTL?: number): void {
    const ttl = customTTL || this.cacheTTL;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  /**
   * Enhanced makeApiRequest method with caching and authentication
   */
  protected async makeApiRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    apiUrl: string = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000'
  ): Promise<T> {
    // Check cache first if cacheKey provided
    if (cacheKey && this.isCached(cacheKey)) {
      return this.getCachedData(cacheKey);
    }
    
    this.apiCalls++;
    this.logApiCall(url);
    
    try {
      // Import apiRequest dynamically to avoid circular dependencies
      const { apiRequest } = await import('@/lib/api');
      
      const response = await apiRequest(`${apiUrl}${url}`, {
        ...options,
        skipCache: true, // We handle caching ourselves
        skipAuthRedirect: false, // Allow auth redirects
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache the result if cacheKey provided
      if (cacheKey) {
        this.setCachedData(cacheKey, data, customTTL);
      }
      
      this.logApiSuccess(url);
      return data;
    } catch (error) {
      this.logApiError(url, error);
      throw error;
    }
  }

  /**
   * Get comprehensive metrics (enhanced from ApiSingletonBase)
   */
  public getMetrics(): SingletonMetrics & Record<string, any> {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const cacheStats = this.cacheManager.getStats?.() || { memorySize: 0 };
    
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: totalRequests > 0 ? this.cacheHits / totalRequests : 0,
      apiCalls: this.apiCalls,
      cacheSize: cacheStats.memorySize + this.cache.size, // Combined cache size
      inMemoryCacheSize: this.cache.size, // Separate in-memory cache size
      persistentCacheSize: cacheStats.memorySize || 0, // Persistent cache size
      // Allow subclasses to add their own metrics
      ...this.getCustomMetrics(),
    };
  }

  /**
   * Reset all metrics
   */
  public resetMetrics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.apiCalls = 0;
    this.logMetricsReset();
  }

  /**
   * Override this method in subclasses to add custom metrics
   */
  protected getCustomMetrics(): Record<string, any> {
    return {};
  }

  /**
   * Invalidate cache (alias for clearCache)
   */
  public invalidateCache(key?: string): Promise<void> {
    return this.clearCache(key);
  }

  // Logging methods - can be overridden for custom logging
  protected logCacheHit(key: string): void {
    console.log(`[${this.constructor.name}] Cache HIT: ${key}`);
  }

  protected logCacheMiss(key: string): void {
    console.log(`[${this.constructor.name}] Cache MISS: ${key}`);
  }

  protected logCacheSet(key: string): void {
    console.log(`[${this.constructor.name}] Cache SET: ${key}`);
  }

  protected logCacheClear(key: string): void {
    console.log(`[${this.constructor.name}] Cache CLEARED: ${key}`);
  }

  protected logCacheClearAll(): void {
    console.log(`[${this.constructor.name}] Cache CLEARED ALL`);
  }

  protected logCacheError(operation: string, key: string, error: any): void {
    console.warn(`[${this.constructor.name}] Cache ${operation} failed for ${key}:`, error);
  }

  protected logApiCall(url: string): void {
    console.log(`[${this.constructor.name}] API Call: ${url}`);
  }

  protected logApiSuccess(url: string): void {
    console.log(`[${this.constructor.name}] API Success: ${url}`);
  }

  protected logApiError(url: string, error: any): void {
    console.error(`[${this.constructor.name}] API Error: ${url}`, error);
  }

  protected logMetricsReset(): void {
    console.log(`[${this.constructor.name}] Metrics reset`);
  }

  /**
   * Get singleton key for identification
   */
  public getSingletonKey(): string {
    return this.singletonKey;
  }

  /**
   * Get cache manager instance for advanced operations
   */
  public getCacheManager(): CacheManager {
    return this.cacheManager;
  }

  /**
   * Validate cached data and clear if stale or invalid
   * This is useful when API endpoints change or data structures evolve
   */
  protected async validateAndClearCache<T>(
    cacheKey: string,
    validator: (data: any) => boolean,
    options?: AutoUserCacheOptions
  ): Promise<T | null> {
    // Emergency bust mode bypasses all cache operations
    if (UniversalSingleton.emergencyBustMode) {
      console.log(`🚨 [${this.constructor.name}] Emergency bust mode: bypassing cache validation for ${cacheKey}`);
      return null;
    }

    try {
      // Try to get from persistent cache first
      const cached = await this.cacheManager.get(cacheKey, options);
      if (cached) {
        // Validate the cached data structure
        if (validator(cached)) {
          this.logCacheHit(cacheKey);
          return cached as T;
        } else {
          // Clear invalid/stale cache data
          console.warn(`[${this.constructor.name}] Invalid cache data detected, clearing: ${cacheKey}`);
          await this.cacheManager.remove(cacheKey);
          this.logCacheClear(cacheKey);
        }
      }
    } catch (error) {
      console.warn(`[${this.constructor.name}] Cache validation failed for ${cacheKey}:`, error);
      // Clear potentially corrupted cache
      try {
        await this.cacheManager.remove(cacheKey);
      } catch (clearError) {
        console.warn(`[${this.constructor.name}] Failed to clear cache ${cacheKey}:`, clearError);
      }
    }
    
    return null;
  }

  /**
   * Check if cached data is from an old version and needs refresh
   * Useful for detecting when API responses have changed structure
   */
  protected async isCacheVersionStale(
    cacheKey: string,
    expectedStructure: string[],
    options?: AutoUserCacheOptions
  ): Promise<boolean> {
    try {
      const cached = await this.cacheManager.get(cacheKey, options);
      if (!cached) return true; // No cache means stale
      
      // Check if cached data has expected structure
      const hasExpectedStructure = expectedStructure.every(prop => {
        return cached && typeof cached === 'object' && prop in cached && (cached as any)[prop] !== undefined;
      });
      
      if (!hasExpectedStructure) {
        console.log(`[${this.constructor.name}] Cache structure mismatch detected for ${cacheKey}`);
        await this.cacheManager.remove(cacheKey);
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn(`[${this.constructor.name}] Cache version check failed for ${cacheKey}:`, error);
      return true; // Assume stale on error
    }
  }
}

/**
 * Base class for Public API singletons
 * Extends UniversalSingleton with public API specific functionality
 */
export abstract class PublicApiSingleton extends UniversalSingleton {
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes for public data
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
  }
  
  /**
   * Make public API request
   */
  protected async makePublicRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number
  ): Promise<T> {
    // Add public API headers
    const publicOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      }
    };
    
    return this.makeApiRequest<T>(url, publicOptions, cacheKey, customTTL);
  }
  
  /**
   * Handle public API errors
   */
  protected handlePublicError(error: any): void {
    console.error('Public API error:', error);
    // Public APIs might have different error handling needs
  }
}

/**
 * Base class for Authenticated API singletons
 * Extends UniversalSingleton with authentication-specific functionality
 */
export abstract class AuthenticatedApiSingleton extends UniversalSingleton {
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes for authenticated data
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
  }
  
  /**
   * Make authenticated API request
   */
  protected async makeAuthenticatedRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number
  ): Promise<T> {
    // Add authentication headers
    const authOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.getAuthToken()}`,
        'Content-Type': 'application/json',
      }
    };
    
    return this.makeApiRequest<T>(url, authOptions, cacheKey, customTTL);
  }
  
  /**
   * Get authentication token
   */
  protected getAuthToken(): string {
    // This would get the JWT token from localStorage, cookies, or auth context
    if (typeof window !== 'undefined') {
      return localStorage.getItem('authToken') || '';
    }
    return '';
  }
  
  /**
   * Handle authentication errors
   */
  protected handleAuthError(error: any): void {
    if (error.status === 401) {
      // Token expired, trigger refresh or logout
      console.warn('Authentication token expired');
      // This would trigger token refresh or logout
    }
  }
}
