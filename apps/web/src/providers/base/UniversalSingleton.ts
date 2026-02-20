/**
 * Universal Singleton - Core Platform Foundation
 * 
 * Base singleton class providing core platform functionality:
 * - Emergency cache busting
 * - Metrics tracking
 * - Multi-layer caching (Memory → IndexedDB → localStorage)
 * - Smart cache validation
 * - Performance monitoring
 * - Error handling and logging
 */

import { CacheManager } from '@/utils/cacheManager';
import { AutoUserCacheOptions } from '@/utils/userIdentification';

// ====================
// INTERFACES
// ====================

export interface SingletonCacheOptions {
  enableCache?: boolean;
  enableEncryption?: boolean;
  enablePrivateCache?: boolean;
  authenticationLevel?: 'public' | 'authenticated' | 'admin';
  defaultTTL?: number;
  maxCacheSize?: number;
  enableMetrics?: boolean;
  enableLogging?: boolean;
  ttl?: number;
  encrypt?: boolean;
  userId?: string;
}

export interface SingletonMetrics {
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  apiCalls: number;
  errors: number;
  lastUpdated: string;
}

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: {
    status: number;
    message: string;
    code: string;
  };
  status?: number;
}

// ====================
// UNIVERSAL SINGLETON
// ====================

export abstract class UniversalSingleton {
  // Emergency bust mode state (global across all singletons)
  private static emergencyBustMode: boolean = false;
  private static emergencyBustReason: string = '';
  private static readonly STORAGE_KEY = 'emergency_bust_mode';

  // Singleton identifier
  protected readonly singletonKey: string;

  // Cache management
  protected cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  protected cacheManager: CacheManager;
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes default

  // Performance tracking
  protected cacheHits: number = 0;
  protected cacheMisses: number = 0;
  protected apiCalls: number = 0;
  protected errors: number = 0;

  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    this.singletonKey = singletonKey;
    this.cacheManager = new CacheManager(cacheOptions);
    
    // Initialize emergency bust mode from storage
    UniversalSingleton.isEmergencyBustMode();
  }

  // ====================
  // EMERGENCY BUST MODE
  // ====================

  /**
   * Set emergency bust mode state
   */
  private static setEmergencyBustMode(enabled: boolean, reason: string): void {
    UniversalSingleton.emergencyBustMode = enabled;
    UniversalSingleton.emergencyBustReason = reason;
    
    // Persist to localStorage for cross-session consistency
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const data = { enabled, reason };
        localStorage.setItem(UniversalSingleton.STORAGE_KEY, JSON.stringify(data));
      } catch (error) {
        console.warn('[UniversalSingleton] Failed to persist emergency bust mode:', error);
      }
    }
    
    console.log(`🚨 [UniversalSingleton] Emergency bust mode ${enabled ? 'ENABLED' : 'DISABLED'}: ${reason}`);
  }

  /**
   * Check if emergency bust mode is active
   */
  private static isEmergencyBustMode(): boolean {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem(UniversalSingleton.STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          UniversalSingleton.emergencyBustMode = parsed.enabled;
          UniversalSingleton.emergencyBustReason = parsed.reason || '';
          if (UniversalSingleton.emergencyBustMode) {
            console.log(`🚨 [UniversalSingleton] Emergency bust mode restored from storage: ${UniversalSingleton.emergencyBustReason}`);
          }
        }
      } catch (error) {
        console.warn('[UniversalSingleton] Failed to parse emergency bust mode from storage:', error);
        localStorage.removeItem(UniversalSingleton.STORAGE_KEY);
      }
    }
    
    return UniversalSingleton.emergencyBustMode;
  }

  /**
   * Get emergency bust mode status
   */
  static getEmergencyBustStatus(): { enabled: boolean; reason: string } {
    return {
      enabled: UniversalSingleton.emergencyBustMode,
      reason: UniversalSingleton.emergencyBustReason
    };
  }

  /**
   * Emergency bust mode controls for global access
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

  // Attach to window for global access
  static attachToWindow(): void {
    if (typeof window !== 'undefined') {
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
      }
    }
  }

  // ====================
  // CACHE MANAGEMENT
  // ====================

  /**
   * Get data from cache with automatic hit/miss tracking
   */
  protected async getFromCache<T>(key: string, options?: AutoUserCacheOptions): Promise<T | null> {
    // Emergency bust mode bypasses all cache operations
    if (UniversalSingleton.emergencyBustMode) {
      console.log(`🚨 [${this.constructor.name}] Emergency bust mode: bypassing cache for ${key}`);
      this.cacheMisses++;
      return null;
    }

    try {
      const cached = await this.cacheManager.get(key, options);
      if (cached) {
        this.cacheHits++;
        return cached as T;
      }
    } catch (error) {
      console.warn(`[${this.constructor.name}] Cache get failed for ${key}:`, error);
    }

    this.cacheMisses++;
    return null;
  }

  /**
   * Set data in cache with automatic tracking
   */
  protected async setCache<T>(key: string, data: T, options?: AutoUserCacheOptions): Promise<void> {
    // Emergency bust mode bypasses all cache operations
    if (UniversalSingleton.emergencyBustMode) {
      console.log(`🚨 [${this.constructor.name}] Emergency bust mode: bypassing cache set for ${key}`);
      return;
    }

    try {
      await this.cacheManager.set(key, data, options);
    } catch (error) {
      console.warn(`[${this.constructor.name}] Cache set failed for ${key}:`, error);
    }
  }

  /**
   * Clear cache (specific key or all)
   */
  protected async clearCache(key?: string): Promise<void> {
    try {
      // Clear memory cache
      if (key) {
        this.cache.delete(key);
      } else {
        this.cache.clear();
      }
      
      // Clear persistent cache
      if (key) {
        await this.cacheManager.remove(key);
      } else {
        await this.cacheManager.clear();
      }
    } catch (error) {
      console.warn(`[${this.constructor.name}] Cache clear failed:`, error);
    }
  }

  // ====================
  // SMART CACHE VALIDATION
  // ====================

  /**
   * Validate cached data and clear if stale or invalid
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
      const cached = await this.cacheManager.get(cacheKey, options);
      if (cached) {
        if (validator(cached)) {
          return cached as T;
        } else {
          console.warn(`[${this.constructor.name}] Invalid cache data detected, clearing: ${cacheKey}`);
          await this.cacheManager.remove(cacheKey);
        }
      }
    } catch (error) {
      console.warn(`[${this.constructor.name}] Cache validation failed for ${cacheKey}:`, error);
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
   */
  protected async isCacheVersionStale(
    cacheKey: string,
    expectedStructure: string[],
    options?: AutoUserCacheOptions
  ): Promise<boolean> {
    try {
      const cached = await this.cacheManager.get(cacheKey, options);
      if (!cached) return true;
      
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
      return true;
    }
  }

  // ====================
  // METRICS & PERFORMANCE
  // ====================

  /**
   * Get comprehensive metrics
   */
  public getMetrics(): SingletonMetrics & Record<string, any> {
    const totalRequests = this.cacheHits + this.cacheMisses;
    const cacheStats = this.cacheManager.getStats?.() || { memorySize: 0 };
    
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: totalRequests > 0 ? this.cacheHits / totalRequests : 0,
      apiCalls: this.apiCalls,
      errors: this.errors,
      cacheSize: cacheStats.memorySize + this.cache.size,
      inMemoryCacheSize: this.cache.size,
      persistentCacheSize: cacheStats.memorySize || 0,
      lastUpdated: new Date().toISOString(),
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
    this.errors = 0;
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

  // ====================
  // UTILITY METHODS
  // ====================

  /**
   * Get cache manager instance for advanced operations
   */
  public getCacheManager(): CacheManager {
    return this.cacheManager;
  }

  /**
   * Log cache hit (can be overridden for custom logging)
   */
  protected logCacheHit(key: string): void {
    console.log(`[${this.constructor.name}] Cache HIT: ${key}`);
  }

  /**
   * Log cache miss (can be overridden for custom logging)
   */
  protected logCacheMiss(key: string): void {
    console.log(`[${this.constructor.name}] Cache MISS: ${key}`);
  }

  /**
   * Log API call (can be overridden for custom logging)
   */
  protected logApiCall(url: string): void {
    console.log(`[${this.constructor.name}] API Call: ${url}`);
  }

  /**
   * Log cache clear (can be overridden for custom logging)
   */
  protected logCacheClear(key: string): void {
    console.log(`[${this.constructor.name}] Cache CLEARED: ${key}`);
  }

  /**
   * Log cache clear all (can be overridden for custom logging)
   */
  protected logCacheClearAll(): void {
    console.log(`[${this.constructor.name}] All cache CLEARED`);
  }

  /**
   * Log cache error (can be overridden for custom logging)
   */
  protected logCacheError(operation: string, key: string, error: any): void {
    console.error(`[${this.constructor.name}] Cache ${operation} error for ${key}:`, error);
  }

  /**
   * Log metrics reset (can be overridden for custom logging)
   */
  protected logMetricsReset(): void {
    console.log(`[${this.constructor.name}] Metrics RESET`);
  }
}

export default UniversalSingleton;
