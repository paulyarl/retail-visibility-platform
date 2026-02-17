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

export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: {
    status: number;
    message: string;
    code: string;
  };
  status: number;
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
   * Parse error response from API to extract structured error information
   */
  protected async parseErrorResponse(response: Response): Promise<{
    status: number;
    message: string;
    code: string;
  }> {
    let message = `API request failed: ${response.status} ${response.statusText}`;
    let code = 'HTTP_ERROR';
    
    // Try to extract actual error message from API response
    try {
      const errorData = await response.clone().json();
      if (errorData.error) {
        message = errorData.error;
        code = errorData.error;
      } else if (errorData.message) {
        message = errorData.message;
        code = 'API_ERROR';
      }
      
      // Use specific error codes for common scenarios
      if (response.status === 400) code = 'BAD_REQUEST';
      if (response.status === 401) code = 'UNAUTHORIZED';
      if (response.status === 404) code = 'NOT_FOUND';
      if (response.status === 403) code = 'FORBIDDEN';
      if (response.status === 500) code = 'SERVER_ERROR';
    } catch (parseError) {
      // If we can't parse JSON, keep the generic message
      console.warn('[UniversalSingleton] Could not parse error response JSON:', parseError);
    }
    
    return {
      status: response.status,
      message,
      code
    };
  }

  /**
   * Unified HTTP error handling with intelligent routing
   * Routes errors to specific handlers and optionally throws for admin requests
   */
  protected handleHttpError(error: any, shouldThrow: boolean = false): void {
    const statusCode = error?.status || error?.statusCode;
    
    // Route to specific handlers
    switch (statusCode) {
      case 400:
        this.handleBadRequest(error);
        break;
      case 401:
        this.handleAuthError(error);
        break;
      case 404:
        this.handleNotFound(error);
        break;
      default:
        // For any other status codes, log and optionally throw
        console.warn(`Unhandled HTTP error (${statusCode}):`, error?.message || 'Unknown error');
        break;
    }
    
    // Throw if requested (useful for admin requests that should see the error)
    if (shouldThrow) {
      throw error;
    }
  }

  /**
   * Handle bad request errors (400)
   */
  protected handleBadRequest(error: any): void {
    if (error.status === 400) {
      // Client-side validation error or invalid request - use actual API message
      console.warn('Bad request error:', error.message || 'Invalid request');
      // Could trigger form validation updates or user notifications
    }
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

  /**
   * Handle not found errors (404)
   */
  protected handleNotFound(error: any): void {
    if (error.status === 404) {
      // Resource not found - API endpoint doesn't exist - use actual API message
      console.warn('Resource not found:', error.message || 'API endpoint not found');
      // Could trigger navigation updates or user notifications
    }
  }

  /**
   * Extract data from ApiResult for backward compatibility
   * Throws error if result is not successful (maintains old behavior)
   */
  protected extractData<T>(result: ApiResult<T>): T {
    if (!result.success) {
      throw new Error(result.error?.message || 'API request failed');
    }
    return result.data as T;
  }

  /**
   * Extract data from ApiResult with optional fallback
   * Returns fallback value if result is not successful
   */
  protected extractDataOrDefault<T>(result: ApiResult<T>, fallback: T): T {
    if (!result.success) {
      console.warn('[UniversalSingleton] API request failed, using fallback:', result.error);
      return fallback;
    }
    return result.data as T;
  }

  /**
   * Get authentication token from localStorage
   * Aligned with platform token storage using access_token
   */
  protected getAuthToken(): string {
    // This gets the JWT token from platform's localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token') || '';
    }
    return '';
  }

  /**
   * Enhanced makeApiRequest method with caching and authentication
   * Returns consistent ApiResult<T> for both success and error cases
   */
  protected async makeApiRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404?: boolean,
    apiUrl: string = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000',
    isAdminRequest: boolean = false // Flag to differentiate admin requests
  ): Promise<ApiResult<T>> {
    // Check cache first if cacheKey provided and it's a GET request
    if (cacheKey && (options.method === 'GET' || !options.method) && this.isCached(cacheKey)) {
      const cachedData = this.getCachedData(cacheKey);
      return {
        success: true,
        data: cachedData,
        status: 200
      };
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
        // Handle 404 errors gracefully if requested (default: true)
        if ((handle404 ?? true) && response.status === 404) {
          console.warn(`[UniversalSingleton] 404 Not Found for ${url} - handled gracefully`);
          return {
            success: false,
            error: {
              status: 404,
              message: 'Resource not found',
              code: 'NOT_FOUND'
            },
            status: 404
          };
        }
        
        // Parse error details consistently
        const errorDetails = await this.parseErrorResponse(response);
        
        // Create error object for handleHttpError
        const error = new Error(errorDetails.message);
        (error as any).status = errorDetails.status;
        (error as any).statusCode = errorDetails.status;
        (error as any).response = response;
        
        // Use unified error handling for logging/side effects
        this.handleHttpError(error, isAdminRequest);
        
        // Return structured error result instead of throwing
        return {
          success: false,
          error: errorDetails,
          status: errorDetails.status
        };
      }

      const data = await response.json();
      
      // For GET requests, cache the result if cacheKey provided
      if (cacheKey && (options.method === 'GET' || !options.method)) {
        this.setCachedData(cacheKey, data, customTTL);
      }
      
      // For non-GET requests, invalidate the cache if cacheKey provided
      if (cacheKey && options.method && options.method !== 'GET') {
        await this.invalidateCache(cacheKey);
        this.logCacheClear(cacheKey);
      }
      
      this.logApiSuccess(url);
      
      return {
        success: true,
        data,
        status: response.status
      };
      
    } catch (error: any) {
      // Handle network errors, parsing errors, etc.
      console.error(`[UniversalSingleton] Network or parsing error for ${url}:`, error);
      
      // Create error result for unexpected errors
      return {
        success: false,
        error: {
          status: 0,
          message: error.message || 'Network error',
          code: 'NETWORK_ERROR'
        },
        status: 0
      };
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
    customTTL?: number,
    handle404?: boolean
  ): Promise<ApiResult<T>> {
    // Add public API headers
    const publicOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      }
    };
    
    return this.makeApiRequest<T>(url, publicOptions, cacheKey, customTTL, handle404 ?? true);
  }

  /**
   * Parse error response from API to extract structured error information
   */
  protected async parseErrorResponse(response: Response): Promise<{
    status: number;
    message: string;
    code: string;
  }> {
    let message = `API request failed: ${response.status} ${response.statusText}`;
    let code = 'HTTP_ERROR';
    
    // Try to extract actual error message from API response
    try {
      const errorData = await response.clone().json();
      if (errorData.error) {
        message = errorData.error;
        code = errorData.error;
      } else if (errorData.message) {
        message = errorData.message;
        code = 'API_ERROR';
      }
      
      // Use specific error codes for common scenarios
      if (response.status === 400) code = 'BAD_REQUEST';
      if (response.status === 401) code = 'UNAUTHORIZED';
      if (response.status === 404) code = 'NOT_FOUND';
      if (response.status === 403) code = 'FORBIDDEN';
      if (response.status === 500) code = 'SERVER_ERROR';
    } catch (parseError) {
      // If we can't parse JSON, keep the generic message
      console.warn('[UniversalSingleton] Could not parse error response JSON:', parseError);
    }
    
    return {
      status: response.status,
      message,
      code
    };
  }

  /**
   * Handle public API errors
   */
  protected handlePublicError(error: any): void {
    console.error('Public API error:', error);
    // Public APIs might have different error handling needs
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

  /**
   * Handle bad request errors (400)
   */
  protected handleBadRequest(error: any): void {
    if (error.status === 400) {
      // Client-side validation error or invalid request - use actual API message
      console.warn('Bad request error:', error.message || 'Invalid request');
      // Could trigger form validation updates or user notifications
    }
  }

  /**
   * Handle not found errors (404)
   */
  protected handleNotFound(error: any): void {
    if (error.status === 404) {
      // Resource not found - API endpoint doesn't exist - use actual API message
      console.warn('Resource not found:', error.message || 'API endpoint not found');
      // Could trigger navigation updates or user notifications
    }
  }

  /**
   * Unified HTTP error handling with intelligent routing
   * Routes errors to specific handlers and optionally throws for admin requests
   */
  protected handleHttpError(error: any, shouldThrow: boolean = false): void {
    const statusCode = error?.status || error?.statusCode;
    
    // Route to specific handlers
    switch (statusCode) {
      case 400:
        this.handleBadRequest(error);
        break;
      case 401:
        this.handleAuthError(error);
        break;
      case 404:
        this.handleNotFound(error);
        break;
      default:
        // For any other status codes, log and optionally throw
        console.warn(`Unhandled HTTP error (${statusCode}):`, error?.message || 'Unknown error');
        break;
    }
    
    // Throw if requested (useful for admin requests that should see the error)
    if (shouldThrow) {
      throw error;
    }
  }

  /**
   * Backward compatibility wrapper for makeApiRequest
   * Maintains old API: returns data directly, throws on error
   * @deprecated Use makeApiRequest for new code (returns ApiResult<T>)
   */
  protected async makeApiRequestLegacy<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404?: boolean,
    apiUrl: string = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000',
    isAdminRequest: boolean = false
  ): Promise<T> {
    const result = await this.makeApiRequest<T>(url, options, cacheKey, customTTL, handle404, apiUrl, isAdminRequest);
    return this.extractData(result);
  }

  /**
   * Backward compatibility wrapper for makePublicRequest
   * Maintains old API: returns data directly, throws on error
   * @deprecated Use makePublicRequest for new code (returns ApiResult<T>)
   */
  protected async makePublicRequestLegacy<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404?: boolean
  ): Promise<T> {
    const result = await this.makePublicRequest<T>(url, options, cacheKey, customTTL, handle404);
    return this.extractData(result);
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
    customTTL?: number,
    handle404?: boolean,
    isAdminRequest: boolean = false
  ): Promise<ApiResult<T>> {
    // Add authentication headers
    const authOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${this.getAuthToken()}`,
        'Content-Type': 'application/json',
      }
    };
    
    return this.makeApiRequest<T>(url, authOptions, cacheKey, customTTL, handle404 ?? true, undefined, isAdminRequest);
  }

  /**
   * Make admin API request with additional admin validation
   * Reserved exclusively for admin operations
   * Layers on top of makeAuthenticatedRequest to follow DRY principle
   */
  protected async makeAdminRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404?: boolean
  ): Promise<ApiResult<T>> {
    // Add admin-specific validation before making request
    if (!this.isAdminUser()) {
      return {
        success: false,
        error: {
          status: 403,
          message: 'Admin access required for this operation',
          code: 'ADMIN_ACCESS_REQUIRED'
        },
        status: 403
      };
    }

    // Add admin-specific headers to the options
    const adminOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'X-Admin-Request': 'true', // Mark as admin request for backend validation
      }
    };
    
    console.log(`[UniversalSingleton] Making admin request to: ${url}`);
    // Delegate to makeAuthenticatedRequest which handles token and other auth logic
    return this.makeAuthenticatedRequest<T>(url, adminOptions, cacheKey, customTTL, handle404, true);
  }
  
  /**
   * Get authentication token
   * Aligned with platform token storage using access_token
   */
  protected getAuthToken(): string {
    // This gets the JWT token from platform's localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('access_token') || '';
    }
    return '';
  }

  /**
   * Get current tenant ID from platform localStorage
   */
  protected getCurrentTenantId(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('current_tenant_id');
    }
    return null;
  }

  /**
   * Get refresh token from platform localStorage
   */
  protected getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('refresh_token');
    }
    return null;
  }

  /**
   * Get last tenant route from platform localStorage
   */
  protected getLastTenantRoute(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('last_tenant_route');
    }
    return null;
  }

  /**
   * Check if current user has admin privileges
   * Parses JWT token to check user role/permissions
   */
  protected isAdminUser(): boolean {
    try {
      const token = this.getAuthToken();
      if (!token) return false;

      // Parse JWT payload (basic parsing without verification for client-side check)
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      // Check for admin roles - adjust based on your actual JWT structure
      const adminRoles = ['PLATFORM_ADMIN', 'ADMIN', 'OWNER'];
      const userRole = payload.role || payload.userRole || payload.permissions?.role;
      
      return adminRoles.includes(userRole) || 
             payload.permissions?.includes('admin') ||
             payload.isAdmin === true;
    } catch (error) {
      console.warn('[UniversalSingleton] Failed to parse admin status from token:', error);
      return false;
    }
  }

  /**
   * Get user role from JWT token
   */
  protected getUserRole(): string | null {
    try {
      const token = this.getAuthToken();
      if (!token) return null;

      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || payload.userRole || payload.permissions?.role || null;
    } catch (error) {
      console.warn('[UniversalSingleton] Failed to parse user role from token:', error);
      return null;
    }
  }

  /**
   * Get user ID from JWT token
   */
  protected getUserId(): string | null {
    try {
      const token = this.getAuthToken();
      if (!token) return null;

      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.userId || payload.sub || payload.user_id || null;
    } catch (error) {
      console.warn('[UniversalSingleton] Failed to parse user ID from token:', error);
      return null;
    }
  }

  /**
   * Backward compatibility wrapper for makeAuthenticatedRequest
   * Maintains old API: returns data directly, throws on error
   * @deprecated Use makeAuthenticatedRequest for new code (returns ApiResult<T>)
   */
  protected async makeAuthenticatedRequestLegacy<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404?: boolean,
    isAdminRequest: boolean = false
  ): Promise<T> {
    const result = await this.makeAuthenticatedRequest<T>(url, options, cacheKey, customTTL, handle404, isAdminRequest);
    return this.extractData(result);
  }

  /**
   * Backward compatibility wrapper for makeAdminRequest
   * Maintains old API: returns data directly, throws on error
   * @deprecated Use makeAdminRequest for new code (returns ApiResult<T>)
   */
  protected async makeAdminRequestLegacy<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404?: boolean
  ): Promise<T> {
    const result = await this.makeAdminRequest<T>(url, options, cacheKey, customTTL, handle404);
    return this.extractData(result);
  }
}