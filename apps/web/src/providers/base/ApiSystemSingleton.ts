/**
 * Unified System API Singleton - System Operations
 * 
 * Extends FlexibleApiSingleton for system-level operations:
 * - Default request type: SYSTEM
 * - Default target: API (port 4000)
 * - Configurable caching (default 10 minutes, can bypass)
 * - System context enforcement and validation
 * - Background processing capabilities
 * - Cross-target support (can call web server when needed)
 */

import { FlexibleApiSingleton, RequestType, RequestTarget, SingletonCacheOptions, SystemRequestOptions, SystemApiResponse, ApiResult } from './FlexibleApiSingleton';

// ====================
// UNIFIED SYSTEM API SINGLETON
// ====================

export abstract class ApiSystemSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.SYSTEM;
  protected defaultRequestTarget: RequestTarget = RequestTarget.API;
  protected cacheTTL: number = 10 * 60 * 1000; // 10 minutes for API data (configurable)
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      ttl: 10 * 60 * 1000, // 10 minutes for API data (can be overridden)
      ...cacheOptions
    });
  }

  // ====================
  // CORE SYSTEM METHODS
  // ====================

  /**
   * Make API request to backend (port 4000)
   * Now uses the new target system - no manual URL construction needed
   */
  protected async makeApiRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404: boolean = true
  ): Promise<ApiResult<T>> {
    // Add API-specific headers
    const apiOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'X-API-Request': 'true', // Mark as API request for backend validation
      }
    };

    // Use the new target-aware request system
    return this.makeDefaultRequest(url, apiOptions, cacheKey, customTTL, handle404);
  }

  /**
   * Make authenticated API request
   * Now uses inherited makeApiRequest which handles API target automatically
   */
  protected async makeAuthenticatedApiRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404: boolean = true
  ): Promise<ApiResult<T>> {
    return this.makeApiRequest(url, options, cacheKey, customTTL, handle404);
  }

  /**
   * Make public API request
   * Uses convenience method for PUBLIC + API combination
   */
  protected async makePublicRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404: boolean = true
  ): Promise<ApiResult<T>> {
    // Use the new PUBLIC + API convenience method
    return this.makePublicApiRequest(url, options, cacheKey, customTTL);
  }

  /**
   * Make request to web server when needed
   * Demonstrates cross-target capability
   */
  protected async makeWebRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404: boolean = true
  ): Promise<ApiResult<T>> {
    // Use the inherited WEB target override from FlexibleApiSingleton
    return super.makeWebRequest(url, options, cacheKey, customTTL);
  }

  // ====================
  // SYSTEM-SPECIFIC CONVENIENCE METHODS (from SystemApiSingleton)
  // ====================

  /**
   * Make system request with sensible defaults for background processing
   */
  protected async makeSystemRequestWithDefaults<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number,
    systemOptions: Partial<SystemRequestOptions> = {}
  ) {
    const defaults: SystemRequestOptions = {
      requireSystemContext: true,
      validateSystemAccess: true,
      bypassCache: false // Configurable (was true in SystemApiSingleton)
    };

    return await this.makeSystemRequest<T>(
      url,
      options,
      cacheKey,
      ttl,
      { ...defaults, ...systemOptions }
    );
  }

  /**
   * Make system request with custom system key
   */
  protected async makeSystemRequestWithKey<T>(
    url: string,
    systemKey: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number
  ) {
    return await this.makeSystemRequest<T>(
      url,
      options,
      cacheKey,
      ttl,
      {
        requireSystemContext: true,
        validateSystemAccess: true,
        systemKey: systemKey,
        bypassCache: false // Configurable
      }
    );
  }

  /**
   * Make system request without validation (for trusted internal calls)
   * Can bypass cache for real-time operations
   */
  protected async makeTrustedSystemRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number,
    bypassCache: boolean = false
  ) {
    return await this.makeSystemRequest<T>(
      url,
      options,
      cacheKey,
      ttl,
      {
        requireSystemContext: false,
        validateSystemAccess: false,
        bypassCache: bypassCache // Configurable
      }
    );
  }

  /**
   * System service accessing admin endpoints
   * Example: System performing admin-level maintenance
   */
  protected async makeSystemToAdminRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number
  ) {
    // Use admin request method but with system privileges
    return await this.makeAdminRequest<T>(
      url,
      options,
      cacheKey,
      ttl,
      {
        requireAdminContext: false, // System bypasses admin validation
        validateAdminAccess: false
      }
    );
  }

  /**
   * System service accessing public endpoints
   * Example: System checking public configuration
   */
  protected async makeSystemToPublicRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number
  ) {
    return await this.makePublicRequest<T>(url, options, cacheKey, ttl);
  }

  /**
   * Get custom metrics for system operations
   */
  protected getCustomMetrics(): Record<string, any> {
    return {
      requestType: 'system',
      requestTarget: 'api',
      defaultTTL: this.cacheTTL,
      systemApiRequests: this.apiCalls
    };
  }
}

export default ApiSystemSingleton;
