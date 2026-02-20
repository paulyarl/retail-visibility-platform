/**
 * Public API Singleton - Public Data Operations
 * 
 * Extends FlexibleApiSingleton with public-specific defaults:
 * - Default request type: PUBLIC
 * - Public request handling (no authentication required)
 * - Public-specific TTL (15 minutes)
 * - Public headers and validation
 * - Optimized for public data that changes infrequently
 */

import { FlexibleApiSingleton, RequestType, SingletonCacheOptions, ApiResult } from './FlexibleApiSingleton';

// ====================
// PUBLIC API SINGLETON
// ====================

export abstract class PublicApiSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.PUBLIC;
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes for public data
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      ttl: 15 * 60 * 1000, // 15 minutes for public data
      ...cacheOptions
    });
  }
  
  /**
   * Make public API request
   * Automatically handles public headers and skips authentication
   */
  protected async makePublicRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404: boolean = true
  ): Promise<ApiResult<T>> {
    // Add public API headers
    const publicOptions: RequestInit & { skipAuth?: boolean } = {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
        'X-Public-Request': 'true', // Mark as public request for backend validation
      },
      skipAuth: true // Skip authentication headers for public requests
    };
    
    return this.makeApiRequest<T>(url, publicOptions, cacheKey, customTTL, handle404);
  }

  /**
   * Make API request with public-specific configuration
   * Uses default public API base URL
   */
  protected async makeApiRequest<T>(
    url: string,
    options: RequestInit & { skipAuth?: boolean } = {},
    cacheKey?: string,
    customTTL?: number,
    handle404: boolean = true,
    apiUrl: string = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000',
    isAdminRequest: boolean = false
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
        skipAuth: options.skipAuth, // Pass skipAuth to apiRequest
      });

      if (!response.ok) {
        // Handle 404 errors gracefully if requested
        if ((handle404 ?? true) && response.status === 404) {
          console.warn(`[PublicApiSingleton] 404 Not Found for ${url} - handled gracefully`);
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
        (error as any).code = errorDetails.code;
        
        // Handle HTTP errors appropriately
        this.handleHttpError(error, false);
        
        return {
          success: false,
          error: {
            status: errorDetails.status,
            message: errorDetails.message,
            code: errorDetails.code
          },
          status: errorDetails.status
        };
      }

      const data = await response.json();
      
      // Cache successful GET requests
      if (cacheKey && (options.method === 'GET' || !options.method)) {
        const ttl = customTTL || this.cacheTTL;
        this.setCachedData(cacheKey, data, ttl);
        await this.setCache(cacheKey, data);
      }

      return {
        success: true,
        data,
        status: response.status
      };
      
    } catch (error) {
      this.errors++;
      console.error(`[PublicApiSingleton] API request failed for ${url}:`, error);
      
      return {
        success: false,
        error: {
          status: 500,
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'API_ERROR'
        },
        status: 500
      };
    }
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
   * Handle HTTP errors with appropriate logging and error processing
   */
  protected handleHttpError(error: any, shouldThrow: boolean = false): void {
    const statusCode = error?.status;
    
    if (!statusCode) {
      console.warn(`[PublicApiSingleton] Unknown error:`, error?.message || 'Unknown error');
      return;
    }
    
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
      console.warn('Bad request error:', error.message || 'Invalid request');
    }
  }

  /**
   * Handle authentication errors
   */
  protected handleAuthError(error: any): void {
    if (error.status === 401) {
      console.warn('Authentication token expired');
    }
  }

  /**
   * Handle not found errors (404)
   */
  protected handleNotFound(error: any): void {
    if (error.status === 404) {
      console.warn('Resource not found:', error.message || 'Not found');
    }
  }

  // ====================
  // CACHE HELPERS
  // ====================

  /**
   * Check if data is cached and valid
   */
  protected isCached(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;
    
    const now = Date.now();
    return (now - cached.timestamp) < cached.ttl;
  }

  /**
   * Get cached data
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
   * Set cached data
   */
  protected setCachedData(key: string, data: any, customTTL?: number): void {
    const ttl = customTTL || this.cacheTTL;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  // ====================
  // PUBLIC-SPECIFIC UTILITIES
  // ====================

  /**
   * Get custom metrics for public API operations
   */
  protected getCustomMetrics(): Record<string, any> {
    return {
      requestType: 'public',
      defaultTTL: this.cacheTTL,
      publicRequests: this.apiCalls
    };
  }

  /**
   * Health check for public API endpoints
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makePublicRequest('/api/health');
      return response.success;
    } catch (error) {
      console.error('[PublicApiSingleton] Health check failed:', error);
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

export default PublicApiSingleton;
