/**
 * Authenticated API Singleton - Protected Data Operations
 * 
 * Extends FlexibleApiSingleton with authenticated-specific defaults:
 * - Default request type: AUTHENTICATED
 * - Automatic token handling
 * - Authenticated request headers
 * - Auth-specific TTL (5 minutes)
 * - Token refresh and error handling
 * - Optimized for user-specific data
 */

import { FlexibleApiSingleton, RequestType, SingletonCacheOptions, AuthenticatedApiResponse, ApiResult } from './FlexibleApiSingleton';

// ====================
// AUTHENTICATED API SINGLETON
// ====================

export abstract class AuthenticatedApiSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType.AUTHENTICATED = RequestType.AUTHENTICATED;
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes for authenticated data
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
  }
  
  /**
   * Make authenticated API request with automatic token handling
   * Uses makeDefaultRequest() for primary authenticated operations
   */
  protected async makeAuthenticatedRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404: boolean = true,
    isAdminRequest: boolean = false
  ): Promise<ApiResult<T>> {
    // Use makeDefaultRequest() which routes to makeAuthenticatedRequest
    return this.makeDefaultRequest<T>(url, options, cacheKey, customTTL, handle404);
  }

  /**
   * Handle authentication errors with token refresh
   */
  private async handleAuthErrorWithRetry<T>(
    response: Response,
    url: string,
    options: RequestInit & { skipAuth?: boolean },
    cacheKey?: string,
    customTTL?: number,
    handle404: boolean = true,
    isAdminRequest: boolean = false
  ): Promise<ApiResult<T>> {
    console.warn(`[AuthenticatedApiSingleton] Authentication error for ${url}`);
    
    // Try to refresh token and retry once
    try {
      const refreshSuccess = await this.refreshAuthToken();
      
      if (refreshSuccess) {
        console.log(`[AuthenticatedApiSingleton] Token refreshed, retrying request: ${url}`);
        
        // Retry the request with new token
        return this.makeAuthenticatedRequest<T>(url, options, cacheKey, customTTL, handle404, isAdminRequest);
      } else {
        console.warn(`[AuthenticatedApiSingleton] Token refresh failed for ${url}`);
        
        // Clear auth-related cache
        await this.clearAuthCache();
        
        return {
          success: false,
          error: {
            status: 401,
            message: 'Authentication failed - please log in again',
            code: 'AUTH_FAILED'
          },
          status: 401
        };
      }
    } catch (refreshError) {
      console.error(`[AuthenticatedApiSingleton] Token refresh error:`, refreshError);
      
      // Clear auth-related cache
      await this.clearAuthCache();
      
      return {
        success: false,
        error: {
          status: 401,
          message: 'Authentication session expired',
          code: 'AUTH_EXPIRED'
        },
        status: 401
      };
    }
  }

  protected async refreshAuthToken(): Promise<boolean> {
    try {
      // For now, just clear the token and let the user re-authenticate
      // In a real implementation, this would call a token refresh endpoint
      console.warn('[AuthenticatedApiSingleton] Token refresh not implemented - clearing token');
      
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      }
      
      return false;
    } catch (error) {
      console.error('[AuthenticatedApiSingleton] Token refresh error:', error);
      return false;
    }
  }

  /**
   * Clear authentication-related cache
   */
  protected async clearAuthCache(): Promise<void> {
    // Clear all cache entries that might contain user-specific data
    const keysToDelete: string[] = [];
    
    for (const [key] of this.cache) {
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
        console.warn(`[AuthenticatedApiSingleton] Failed to clear auth cache key ${key}:`, error);
      }
    }
    
    console.log(`[AuthenticatedApiSingleton] Cleared ${keysToDelete.length} auth-related cache entries`);
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
    } catch (parseError) {
      // If we can't parse JSON, use default message
    }
    
    return {
      status: response.status,
      message,
      code
    };
  }

  /**
   * Get custom metrics for authenticated API operations
   */
  protected getCustomMetrics(): Record<string, any> {
    return {
      requestType: 'authenticated',
      defaultTTL: this.cacheTTL,
      authenticatedRequests: this.apiCalls,
      // Note: This is synchronous for metrics, so we can't use async here
      // In a real implementation, you might want to track this differently
      hasAuthToken: false // Simplified for metrics
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
      console.error('[AuthenticatedApiSingleton] Health check failed:', error);
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
