/**
 * External API Singleton Base Class
 * 
 * Base class for external API services that need caching and proper error handling
 * Extends FlexibleApiSingleton for platform alignment
 * Provides unified external request handling with RequestTarget.EXTERNAL
 * 
 * Services that need external API access should extend this class:
 * - WeatherService, GeolocationService, PaymentGatewayService, etc.
 */

import { FlexibleApiSingleton, RequestTarget, RequestType, ExternalRequestOptions, ExternalApiResponse } from './FlexibleApiSingleton';

export interface ExternalSingletonCacheOptions {
  encrypt?: boolean;
  userId?: string;
  ttl?: number;
}

/**
 * Base class for external API singletons
 * Extends FlexibleApiSingleton with external-specific functionality
 * Default: EXTERNAL type + EXTERNAL target (port 443/80)
 */
export abstract class ExternalApiSingleton extends FlexibleApiSingleton {
  
  protected defaultRequestType: RequestType = RequestType.EXTERNAL;
  protected defaultRequestTarget: RequestTarget = RequestTarget.EXTERNAL;
  protected defaultIncludeCredentials: boolean = false; // External APIs don't need credentials by default
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes for external data
  
  constructor(singletonKey: string, cacheOptions?: ExternalSingletonCacheOptions) {
    super(singletonKey, {
      ttl: cacheOptions?.ttl || 15 * 60 * 1000, // 15 minutes default
      ...cacheOptions
    });
  }

  /**
   * Make external API request with proper error handling and caching
   * Uses RequestTarget.EXTERNAL automatically
   */
  protected async makeExternalRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: ExternalRequestOptions
  ): Promise<ExternalApiResponse<T>> {
    const cacheKey = requestOptions?.cacheKey || `external-${url}`;
    const ttl = requestOptions?.ttl || this.cacheTTL;

    // Temporarily override includeCredentials if specified in requestOptions
    const originalDefault = this.defaultIncludeCredentials;
    if (requestOptions?.includeCredentials !== undefined) {
      this.defaultIncludeCredentials = requestOptions.includeCredentials;
    }

    try {
      // Use makeDefaultRequest with EXTERNAL type
      const result = await this.makeDefaultRequest<T>(
        url,
        options,
        cacheKey,
        ttl,
        {
          requestType: this.defaultRequestType,
          requestTarget: this.defaultRequestTarget
        }
      );

      return result as ExternalApiResponse<T>;
    } finally {
      // Restore original default
      if (requestOptions?.includeCredentials !== undefined) {
        this.defaultIncludeCredentials = originalDefault;
      }
    }
  }

  /**
   * Override hook for subclasses to customize external request behavior
   */
  protected async onExternalRequest<T>(
    url: string,
    options: RequestInit,
    requestOptions?: ExternalRequestOptions
  ): Promise<RequestInit> {
    // Add external-specific headers and options
    const externalOptions = {
      ...options,
      headers: {
        'User-Agent': 'RVP-Platform/1.0',
        ...options.headers,
        ...requestOptions?.headers
      },
      // Add timeout if specified
      ...(requestOptions?.timeout && { signal: AbortSignal.timeout(requestOptions.timeout) })
    };

    return externalOptions;
  }

  /**
   * Batch multiple external API requests
   * Useful for loading multiple external data points in parallel
   */
  protected async batchExternalRequest<T>(
    requests: Array<{ url: string; options?: RequestInit; requestOptions?: ExternalRequestOptions }>
  ): Promise<Array<ExternalApiResponse<T>>> {
    const promises = requests.map(({ url, options, requestOptions }) => 
      this.makeExternalRequest<T>(url, options, requestOptions)
    );

    return Promise.allSettled(promises).then(results => 
      results.map(result => 
        result.status === 'fulfilled' ? result.value : { 
          success: false, 
          data: undefined, 
          error: { status: 500, message: 'Request failed', code: 'BATCH_REQUEST_FAILED' }, 
          status: 500 
        } as ExternalApiResponse<T>
      )
    );
  }

  /**
   * Health check for external services
   * Tests connectivity to common external services
   */
  async healthCheck(services: Array<{ name: string; url: string; timeout?: number }>): Promise<{
    results: { [key: string]: boolean };
    timestamp: string;
  }> {
    const results = await Promise.allSettled(
      services.map(service => 
        this.makeExternalRequest(service.url, { signal: AbortSignal.timeout(service.timeout || 5000) })
          .catch(() => null)
      )
    );

    const healthResults: { [key: string]: boolean } = {};
    results.forEach((result, index) => {
      const serviceName = services[index].name;
      if (result.status === 'fulfilled' && result.value !== null && 'data' in result.value) {
        healthResults[serviceName] = !!result.value.data;
      } else {
        healthResults[serviceName] = false;
      }
    });

    return {
      results: healthResults,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear external API cache
   * Note: Cache clearing would need to be implemented in the base class
   * For now, we'll just log the intent
   */
  async clearCache(pattern?: string): Promise<void> {
    console.log(`[${this.constructor.name}] Cache clear requested for pattern: ${pattern || 'all'}`);
  }
}
