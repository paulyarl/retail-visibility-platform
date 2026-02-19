import { UniversalSingleton, SingletonCacheOptions, ApiResult } from './UniversalSingleton';

/**
 * Base class for API system singletons
 * Extends UniversalSingleton with backend API functionality
 * Uses port 4000 for backend API operations
 */
export abstract class ApiSystemSingleton extends UniversalSingleton {
  protected cacheTTL: number = 10 * 60 * 1000; // 10 minutes for API data
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
    // Override the default TTL for API data
    this.cacheTTL = (cacheOptions as any)?.ttl || this.cacheTTL;
  }


  /**
   * Make API request to backend (port 4000)
   * All API services should use this method by default
   */
  protected async makeApiRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404?: boolean
  ): Promise<ApiResult<T>> {
    // Use port 4000 environment variables for API requests
    // Priority order: NEXT_PUBLIC_API_BASE_URL > API_BASE_URL > http://localhost:4000
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 
                   process.env.API_BASE_URL || 
                   'http://localhost:4000';
    
    // Add API-specific headers
    const apiOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'X-API-Request': 'true', // Mark as API request for backend validation
      }
    };

    // Use UniversalSingleton's makeApiRequest for proper platform caching
    return super.makeApiRequest(url, apiOptions, cacheKey, customTTL, handle404, apiUrl);
  }

  /**
   * Make authenticated API request with automatic token handling
   */
  protected async makeAuthenticatedApiRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404?: boolean
  ): Promise<ApiResult<T>> {
    return this.makeApiRequest(url, options, cacheKey, customTTL, handle404);
  }

  /**
   * Make public API request with automatic public validation
   * All public services should use this method by default
   * Uses port 4000 environment variables for public data operations
   */
  protected async makePublicRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404?: boolean
  ): Promise<ApiResult<T>> {
    // Add public-specific headers to the options
    const publicOptions: RequestInit = {
      ...options,
      headers: {
        ...options.headers,
        'X-Public-Request': 'true', // Mark as public request for backend validation
      }
    };
    
    // Use longer cache for public data (15 minutes)
    const publicTTL = customTTL || (15 * 60 * 1000);
    
    return this.makeApiRequest(url, publicOptions, cacheKey, publicTTL, handle404);
  }

  /**
   * Extract data from ApiResult
   * Helper method to extract data from successful ApiResult
   */
  protected extractData<T>(result: ApiResult<T>): T {
    if (!result.success || !result.data) {
      throw new Error(result.error?.message || 'Request failed');
    }
    return result.data;
  }

  /**
   * Public API request with data extraction
   * Convenience method that returns data directly
   */
  protected async getPublicData<T>(
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
