/**
 * System Singleton Base Class
 * Base class for system-level services that need caching and API capabilities
 * Extends FlexibleApiSingleton for system-level operations (no authentication required)
 * Provides unified caching, error handling, and platform integration
 * Default: SYSTEM type + WEB target (port 3000)
 */

import { FlexibleApiSingleton, RequestType, RequestTarget, SingletonCacheOptions, SystemApiResponse, PublicRequestOptions, PublicApiResponse } from './FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '../../utils/contextCacheManager';

export interface SystemSingletonCacheOptions {
  encrypt?: boolean;
  userId?: string;
  ttl?: number;
}

/**
 * Base class for system-level singletons
 * Extends FlexibleApiSingleton with system-specific functionality
 */
export abstract class SystemSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.SYSTEM;
  protected defaultRequestTarget: RequestTarget = RequestTarget.WEB;
  protected defaultContext: AppContext = AppContext.SYSTEM;
  protected defaultIsolation: CacheIsolation = CacheIsolation.SYSTEM;
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes for system data
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      ttl: 15 * 60 * 1000, // 15 minutes for system data
      ...cacheOptions
    });
  }

  /**
   * Make web server request (port 3000)
   * Now uses the new target system automatically
   */
  protected async makeWebRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404: boolean = true
  ): Promise<SystemApiResponse<T>> {
    // Add web-specific headers
    const webOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'X-Web-Request': 'true', // Mark as web request for backend validation
      }
    };

    // Use the new target-aware request system (defaults to WEB)
    return this.makeDefaultRequest(url, webOptions, cacheKey, customTTL);
  }

  /**
   * Make request to API server when needed
   * Demonstrates cross-target capability from WEB default
   */
  protected async makeApiRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404: boolean = true
  ): Promise<SystemApiResponse<T>> {
    // Use the inherited API target override from FlexibleApiSingleton
    return super.makeApiRequest(url, options, cacheKey, customTTL);
  }
 

  /**
   * Get custom metrics for system operations
   */
  protected getCustomMetrics(): Record<string, any> {
    return {
      requestType: RequestType.SYSTEM,
      requestTarget: RequestTarget.WEB,
      defaultTTL: this.cacheTTL,
      systemWebRequests: this.apiCalls
    };
  }
}

export default SystemSingleton;
