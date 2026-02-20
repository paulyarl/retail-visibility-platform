/**
 * System API Singleton - Background System Processing
 * 
 * Extends FlexibleApiSingleton with system-specific defaults:
 * - Default request type: SYSTEM
 * - System context enforcement
 * - Background processing capabilities
 * - Cache bypass for real-time operations
 */

import { FlexibleApiSingleton, RequestType, SingletonCacheOptions, SystemRequestOptions } from './FlexibleApiSingleton';

export abstract class SystemApiSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType.SYSTEM = RequestType.SYSTEM;
  protected cacheTTL: number = 0; // No caching for system operations
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      ttl: 0, // System operations typically bypass cache
      ...cacheOptions
    });
  }

  // ====================
  // SYSTEM-SPECIFIC CONVENIENCE METHODS
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
      bypassCache: true // System ops typically bypass cache
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
        bypassCache: true
      }
    );
  }

  /**
   * Make system request without validation (for trusted internal calls)
   */
  protected async makeTrustedSystemRequest<T>(
    url: string,
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
        requireSystemContext: false,
        validateSystemAccess: false,
        bypassCache: true
      }
    );
  }

  // ====================
  // EDGE CASE METHODS
  // ====================

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
}
