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

import cacheManager, { CacheManager } from '../../utils/cacheManager';
import { contextAwareCacheService, ContextAwareCacheOptions } from '../../services/contextAwareCacheService';
import { AutoUserCacheOptions } from '../../utils/userIdentification';
import { AppContext, CacheIsolation } from '../../utils/contextCacheManager';

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
  protected contextCacheService = contextAwareCacheService;

  // Performance tracking
  protected cacheHits: number = 0;
  protected cacheMisses: number = 0;
  protected apiCalls: number = 0;
  protected errors: number = 0;
  protected lastUpdated: string = '';
  protected enableMetrics: boolean = true;
  protected enableLogging: boolean = true;
  protected cacheOptions: SingletonCacheOptions;

  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    this.singletonKey = singletonKey;
    this.cacheOptions = cacheOptions || {};
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
      //console.log(`[${this.constructor.name}] Cache get for ${key}:`, cached);
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
   * Context-aware cache get method
   */
  protected async getContextAwareCache<T>(key: string, options?: ContextAwareCacheOptions): Promise<T | null> {
    // Emergency bust mode bypasses all cache operations
    if (UniversalSingleton.emergencyBustMode) {
      console.log(`🚨 [${this.constructor.name}] Emergency bust mode: bypassing context-aware cache for ${key}`);
      this.cacheMisses++;
      return null;
    }

    try {
      const cached = await this.contextCacheService.get<T>(key, options);
      if (cached) {
        this.cacheHits++;
        return cached;
      }
      this.cacheMisses++;
      return null;
    } catch (error) {
      console.warn(`[${this.constructor.name}] Context-aware cache get failed for ${key}:`, error);
      return null;
    }
  }

  /**
   * Context-aware cache set method
   */
  protected async setContextAwareCache<T>(key: string, data: T, options?: ContextAwareCacheOptions): Promise<void> {
    // Emergency bust mode bypasses all cache operations
    if (UniversalSingleton.emergencyBustMode) {
      console.log(`🚨 [${this.constructor.name}] Emergency bust mode: bypassing context-aware cache set for ${key}`);
      return;
    }

    try {
      await this.contextCacheService.set<T>(key, data, options);
    } catch (error) {
      console.warn(`[${this.constructor.name}] Context-aware cache set failed for ${key}:`, error);
    }
  }

  /**
   * Context-aware cache remove method
   */
  protected async removeContextAwareCache(key: string, options?: ContextAwareCacheOptions): Promise<void> {
    try {
      await this.contextCacheService.remove(key, options);
    } catch (error) {
      console.warn(`[${this.constructor.name}] Context-aware cache remove failed for ${key}:`, error);
    }
  }

  /**
   * Clear cache (specific key or all)
   */
  protected async clearCache(key?: string): Promise<void> {
    try {
      // Clear memory cache
      // console.log(`[${this.constructor.name}] ----------------------------------------`);
      // console.log(`[${this.constructor.name}] start         : clearCache`);
      // console.log(`[${this.constructor.name}] key           : ${key}`);
      // console.log(`[${this.constructor.name}] end           : clearCache  `);
      
      if (key) {
        this.cache.delete(key);
        console.log(`[${this.constructor.name}] Memory cache cleared for key: ${key}`);
      } else {
        this.cache.clear();
        console.log(`[${this.constructor.name}] Memory cache cleared for all keys`);
      }
     
      // Clear persistent cache
      if (key) {
        await this.cacheManager.remove(key);
        console.log(`[${this.constructor.name}] Persistent cache cleared for key: ${key}`);
      } else {
        await this.cacheManager.clear();
        console.log(`[${this.constructor.name}] Persistent cache cleared for all keys`);
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
   * Enhanced cache invalidation with pattern matching for dynamic keys
   * Supports patterns like 'ticker-config*' or 'variant-*' to match context-aware keys
   * Now properly clears from all storage layers (memory, IndexedDB, localStorage)
   */
  protected async invalidateCachePattern(pattern: string): Promise<void> {
    try {
        // console.log(`[${this.constructor.name}] ----------------------------------------`);
        // console.log(`[${this.constructor.name}] start         : invalidateCachePattern`);
        // console.log(`[${this.constructor.name}] pattern       : ${pattern}`);
        // console.log(`[${this.constructor.name}] end           : invalidateCachePattern  `);
      
      // Handle wildcard patterns
      if (pattern.includes('*')) {
        // Use the new removeByPattern method that scans all storage layers
        await this.cacheManager.removeByPattern(pattern);
      } else {
        // Exact match or context-aware key - use clearCache
        await this.clearCache(pattern);
      }
    } catch (error) {
      console.warn(`[${this.constructor.name}] Enhanced cache invalidation failed for pattern '${pattern}':`, error);
    }
  }

  /**
   * Context-aware cache invalidation with type safety
   * Invalidate cache for specific base key within specific context/isolation
   * 
   * Uses base class defaults when context/isolation not provided
   * 
   * Examples:
   * - invalidateCacheWithContext('tier-system-tiers', AppContext.ADMIN, CacheIsolation.ADMIN) -> clears 'tier-system-tiers:admin:admin'
   * - invalidateCacheWithContext('tier-system-tiers', AppContext.ADMIN, null) -> clears all admin context keys
   * - invalidateCacheWithContext('tier-system-tiers', null, CacheIsolation.ADMIN) -> clears all admin isolation keys
   * - invalidateCacheWithContext('tier-system-tiers', null, null) -> clears using base class defaults
   */
  protected async invalidateCacheWithContext(
    baseKey: string, 
    context?: AppContext | null, 
    isolation?: CacheIsolation | null
  ): Promise<void> {
    try {
      let pattern = baseKey;

      // console.log(`[${this.constructor.name}] ----------------------------------------`);
      // console.log(`[${this.constructor.name}] start         : invalidateCacheWithContext`);
      // console.log(`[${this.constructor.name}] baseKey       : ${baseKey}`);
      // console.log(`[${this.constructor.name}] context       : ${context}`);
      // console.log(`[${this.constructor.name}] isolation     : ${isolation}`);
      
      // Check if baseKey already contains context:isolation format
      const keyParts = baseKey.split(':');
      const hasContextIsolation = keyParts.length >= 3;
      
      if (hasContextIsolation) {
        // Key already has context:isolation, use as-is or add wildcards if context/isolation params are provided
        if (context && isolation) {
          // Replace existing context:isolation with new ones
          pattern = `${keyParts[0]}:${context}:${isolation}`;
        } else if (context) {
          // Replace context, keep isolation wildcard
          pattern = `${keyParts[0]}:${context}:*`;
        } else if (isolation) {
          // Replace isolation, keep context wildcard  
          pattern = `${keyParts[0]}:*:${isolation}`;
        } else {
          // Use the key as-is
          pattern = baseKey;
        }
      } else {
        // Key doesn't have context:isolation, append them
        if (context && isolation) {
          // Target specific context and isolation
          pattern = `${baseKey}:${context}:${isolation}`;
        } else if (context) {
          // Target specific context (any isolation)
          pattern = `${baseKey}:${context}:*`;
        } else if (isolation) {
          // Target specific isolation (any context)
          pattern = `${baseKey}:*:${isolation}`;
        } else {
          // Use base class defaults
          const defaultContext = (this as any).defaultContext;
          const defaultIsolation = (this as any).defaultIsolation;
          
          if (defaultContext && defaultIsolation) {
            pattern = `${baseKey}:${defaultContext}:${defaultIsolation}`;
          } else {
            // Fallback: target all contexts and isolations
            pattern = `${baseKey}*`;
          }
        }
      }
      
      // console.log(`[${this.constructor.name}] end           : invalidateCacheWithContext  `);
      // console.log(`[${this.constructor.name}] Pattern       : ${pattern}`);
      
      await this.invalidateCachePattern(pattern);
    } catch (error) {
      console.warn(`[${this.constructor.name}] Context-aware cache invalidation failed for baseKey '${baseKey}', context '${context}', isolation '${isolation}':`, error);
    }
  }

  /**
   * Invalidate cache for multiple contexts with type safety
   * Useful for admin operations that should clear both admin and system caches
   * 
   * Uses base class defaults when contexts array is empty
   */
  protected async invalidateCacheAcrossContexts(
    baseKey: string, 
    contexts?: AppContext[], 
    isolations?: CacheIsolation[]
  ): Promise<void> {
    try {
      // console.log(`[${this.constructor.name}] ----------------------------------------`);
      // console.log(`[${this.constructor.name}] start         : invalidateCacheAcrossContexts`);
      // console.log(`[${this.constructor.name}] baseKey       : ${baseKey}`);
      // console.log(`[${this.constructor.name}] contexts      : ${contexts}`);
      // console.log(`[${this.constructor.name}] isolations    : ${isolations}`);
      // console.log(`[${this.constructor.name}] end           : invalidateCacheAcrossContexts  `);
      
      // Use base class defaults for backward compatibility
      if (!contexts || contexts.length === 0) {
        const defaultContext = (this as any).defaultContext;
        const defaultIsolation = (this as any).defaultIsolation;
        
        if (defaultContext && defaultIsolation) {
          // Use default context and isolation
          await this.invalidateCacheWithContext(baseKey, defaultContext, defaultIsolation);
        } else {
          // Fallback: target all contexts and isolations
          await this.invalidateCachePattern(`${baseKey}*`);
        }
        return;
      }
      
      const promises: Promise<void>[] = [];
      
      for (const context of contexts) {
        if (isolations && isolations.length > 0) {
          for (const isolation of isolations) {
            promises.push(this.invalidateCacheWithContext(baseKey, context, isolation));
          }
        } else {
          promises.push(this.invalidateCacheWithContext(baseKey, context, null));
        }
      }
      
      await Promise.all(promises);
    } catch (error) {
      console.warn(`[${this.constructor.name}] Multi-context cache invalidation failed for baseKey '${baseKey}':`, error);
    }
  }

  /**
   * Invalidate cache (supports wildcards for pattern matching)
   */
  public async invalidateCache(key?: string): Promise<void> {
      // console.log(`[${this.constructor.name}] ----------------------------------------`);
      // console.log(`[${this.constructor.name}] start         : invalidateCache`);
      // console.log(`[${this.constructor.name}] key           : ${key}`);
      // console.log(`[${this.constructor.name}] end           : invalidateCache  `);
    
    if (key && key.includes('*')) {
      // Use pattern matching for wildcard keys
      return this.invalidateCachePattern(key);
    }else if (key && key.includes(':')) {
      // Use pattern matching for wildcard keys
      return this.invalidateCacheWithContext(key);
    }
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

  // ====================
  // USER/SESSION CACHING UTILITIES
  // ====================

  /**
   * Get cached user data from local storage (like behaviorTracking pattern)
   * Automatically handles encryption/decryption and validation
   */
  protected async getCachedUserData<T>(cacheKey: string): Promise<T | null> {
    if (typeof window === 'undefined') return null;

    try {
      const cachedData = await cacheManager.get<T>(cacheKey, {
        encrypt: this.cacheOptions.enableEncryption || false,
        userId: this.cacheOptions.userId
      });

      if (cachedData) {
        // Validate the structure of cached data
        if (this.validateCachedUserData(cachedData)) {
          return cachedData;
        } else {
          console.warn(`[${this.constructor.name}] Invalid cached user data structure, clearing cache`);
          await this.clearCachedUserData(cacheKey);
        }
      }

      return null;
    } catch (error) {
      console.warn(`[${this.constructor.name}] Failed to get cached user data:`, error);
      await this.clearCachedUserData(cacheKey);
      return null;
    }
  }

  /**
   * Set cached user data with encryption (like behaviorTracking pattern)
   */
  protected async setCachedUserData<T>(cacheKey: string, userData: T): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      await cacheManager.set(cacheKey, userData, {
        encrypt: this.cacheOptions.enableEncryption || false,
        userId: this.cacheOptions.userId,
        ttl: this.cacheOptions.defaultTTL || 60 * 60 * 1000 // 1 hour default
      });
    } catch (error) {
      console.warn(`[${this.constructor.name}] Failed to cache user data:`, error);
    }
  }

  /**
   * Clear cached user data
   */
  protected async clearCachedUserData(cacheKey: string): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      // Remove the specific key from all cache layers
      await cacheManager.remove(cacheKey);
    } catch (error) {
      console.warn(`[${this.constructor.name}] Failed to clear cached user data:`, error);
    }
  }

  /**
   * Get user ID from various context sources (like behaviorTracking)
   * This is a helper method for services to get current user context
   */
  protected getUserIdFromContext(): string | null {
    if (typeof window === 'undefined') return null;

    // Try localStorage first
    const userId = localStorage.getItem('userId');
    if (userId) return userId;

    // Try session storage
    const sessionUserId = sessionStorage.getItem('userId');
    if (sessionUserId) return sessionUserId;

    // Try cookie
    const cookies = document.cookie.split(';');
    const userIdCookie = cookies.find(cookie => cookie.trim().startsWith('userId='));
    if (userIdCookie) {
      return userIdCookie.split('=')[1]?.trim();
    }

    return null;
  }

  /**
   * Get session ID for anonymous users (like behaviorTracking)
   * This is a helper method for services to get/create session context
   */
  protected getSessionIdFromContext(): string | null {
    if (typeof window === 'undefined') return null;

    // Try session storage
    let sessionId = sessionStorage.getItem('sessionId');
    if (!sessionId) {
      // Generate new session ID
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('sessionId', sessionId);
    }
    return sessionId;
  }

  /**
   * Validate cached user data structure (override in subclasses for specific validation)
   * Default implementation checks for basic object structure
   */
  protected validateCachedUserData(data: any): boolean {
    return data !== null && typeof data === 'object';
  }
}

export default UniversalSingleton;
