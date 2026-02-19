/**
 * System Singleton Base Class
 * Base class for system-level services that need caching and API capabilities
 * Similar to AuthenticatedApiSingleton but for system-level operations (no authentication required)
 * Provides unified caching, error handling, and platform integration
 */

import { CacheManager } from '@/utils/cacheManager';
import { AutoUserCacheOptions } from '@/utils/userIdentification';
import { UniversalSingleton, SingletonCacheOptions, ApiResult } from './UniversalSingleton';

export interface SystemSingletonCacheOptions {
  encrypt?: boolean;
  userId?: string;
  ttl?: number;
}

/**
 * Base class for system-level singletons
 * Extends UniversalSingleton with system-specific functionality
 * All system services should extend this class
 * Uses port 3000 for frontend system requests
 */
export abstract class SystemSingleton extends UniversalSingleton {
  protected cacheTTL: number = 10 * 60 * 1000; // 10 minutes default for system data
  
  constructor(singletonKey: string, cacheOptions?: SystemSingletonCacheOptions) {
    super(singletonKey, cacheOptions);
    // Override the default TTL for system data
    this.cacheTTL = cacheOptions?.ttl || this.cacheTTL;
  }

  /**
   * Make system API request with automatic caching
   * Similar to AuthenticatedApiSingleton but without authentication
   * Uses platform's built-in caching system
   * Uses port 3000 environment variables for frontend system requests
   */
  protected async makeSystemRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404?: boolean,
    apiUrl?: string
  ): Promise<ApiResult<T>> {
    // Use port 3000 environment variables for system requests
    // Priority order: WEB_URL > NEXT_PUBLIC_APP_ORIGIN > FRONTEND_URL
    const systemApiUrl = apiUrl || 
      process.env.WEB_URL || 
      process.env.NEXT_PUBLIC_APP_ORIGIN || 
      process.env.FRONTEND_URL || 
      'http://localhost:3000';
  
    // Use UniversalSingleton's makeApiRequest for proper platform caching
    return this.makeApiRequest(url, {
      ...options,
      skipAuth: (options as any).skipAuth,
    }, cacheKey, customTTL, handle404, systemApiUrl);
  }


}
