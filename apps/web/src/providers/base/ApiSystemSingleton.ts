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

import { FlexibleApiSingleton, RequestType, RequestTarget, SingletonCacheOptions, SystemRequestOptions, SystemApiResponse, ApiResult, PublicRequestOptions, PublicApiResponse } from './FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '../../utils/contextCacheManager';

// ====================
// UNIFIED SYSTEM API SINGLETON
// ====================

export abstract class ApiSystemSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.SYSTEM;
  protected defaultRequestTarget: RequestTarget = RequestTarget.API;
  protected defaultContext: AppContext = AppContext.SYSTEM;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SYSTEM;
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
    // Use the inherited makeDefaultRequest from FlexibleApiSingleton
    return super.makeDefaultRequest(url, options, cacheKey, customTTL);
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
      validateSystemAccess: true,
      bypassCache: false // Configurable (was true in SystemApiSingleton)
    };

    return await this.makeSystemRequest<T>(
      url,
      options,
      {
        cacheKey,
        ttl,
        ...{ ...defaults, ...systemOptions }
      }
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
      {
        cacheKey,
        ttl,
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
      {
        cacheKey,
        ttl,
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
      {
        cacheKey,
        ttl,
        requireAdminContext: false, // System bypasses admin validation
        bypassCache: false // Configurable
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
    return await this.makePublicRequest<T>(url, options, cacheKey, ttl, {
      cacheKey,
      ttl
    });
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
