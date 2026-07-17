/**
 * Authenticated API Singleton - Protected Data Operations
 * 
 * Extends FlexibleApiSingleton with authenticated-specific defaults:
 * - Default request type: AUTHENTICATED
 * - Auth0 session via HTTP-only cookies (credentials: 'include')
 * - Auth-specific TTL (5 minutes)
 * - Optimized for user-specific data
 */

import { FlexibleApiSingleton, RequestType, RequestTarget, SingletonCacheOptions, AuthenticatedApiResponse, ApiResult } from './FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '../../utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

// ====================
// AUTHENTICATED API SINGLETON
// ====================

export abstract class AuthenticatedApiSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.AUTHENTICATED;
  protected defaultRequestTarget: RequestTarget = RequestTarget.API;
  protected defaultContext: AppContext = AppContext.USER;
  protected defaultIsolation: CacheIsolation = CacheIsolation.USER;
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes for authenticated data
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
  }
  
  /**
   * Custom hook for authenticated request behavior
   * Auth0 handles authentication via HTTP-only cookies (credentials: 'include' in fetchWithCache)
   * Also adds x-auth0-id and x-auth0-email headers for API to identify user
   */
  protected async onAuthenticatedRequest<T>(
    url: string,
    options: RequestInit,
    cacheKey?: string,
    ttl?: number,
    isAdminRequest: boolean = false
  ): Promise<RequestInit> {
    // Call parent to add x-auth0-id and x-auth0-email headers
    let modifiedOptions = await super.onAuthenticatedRequest(url, options, cacheKey, ttl, isAdminRequest);
    
    // Add admin-specific headers if needed
    if (isAdminRequest) {
      modifiedOptions = {
        ...modifiedOptions,
        headers: {
          ...modifiedOptions.headers,
          'X-Admin-Request': 'true',
        },
      };
    }

    return modifiedOptions;
  }

  /**
   * Clear authentication-related cache
   */
  protected async clearAuthCache(): Promise<void> {
    // Clear all cache entries that might contain user-specific data
    const keysToDelete: string[] = [];
    
    for (const [key] of Array.from(this.cache.entries())) {
      // Clear keys that might be user-specific
      if (key.includes('user') || key.includes('auth') || key.includes('profile')) {
        keysToDelete.push(key);
      }
    }
    
    // Clear from memory cache
    keysToDelete.forEach(key => this.cache.delete(key));
    
    // Clear from persistent cache
    for (const key of keysToDelete) {
      try {
        await this.cacheManager.remove(key);
      } catch (error) {
        clientLogger.warn(`[AuthenticatedApiSingleton] Failed to clear auth cache key ${key}:`, { detail: error });
      }
    }
    
    console.log(`[AuthenticatedApiSingleton] Cleared ${keysToDelete.length} auth-related cache entries`);
  }

  /**
   * Get custom metrics for authenticated API operations
   */
  protected getCustomMetrics(): Record<string, any> {
    return {
      requestType: 'authenticated',
      defaultTTL: this.cacheTTL,
      authenticatedRequests: this.apiCalls,
      authMethod: 'auth0-cookies'
    };
  }

  /**
   * Health check for authenticated API endpoints
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeAuthenticatedRequest('/api/health');
      return response.success;
    } catch (error) {
      clientLogger.error('[AuthenticatedApiSingleton] Health check failed:', { detail: error });
      return false;
    }
  }

  /**
   * Invalidate cache (alias for clearCache)
   */
  public async invalidateCache(key?: string): Promise<void> {
    return this.clearCache(key);
  }
}

export default AuthenticatedApiSingleton;
