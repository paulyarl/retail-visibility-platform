/**
 * Request Execution Utility Service
 * 
 * Handles unified execution logic for all request types
 * Extracted from FlexibleApiSingleton to reduce complexity and improve maintainability
 */

import { RequestSetupResult } from './RequestSetupUtility';

// Response interfaces
export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: {
    status: number;
    message: string;
    code: string;
  };
}

export interface PublicApiResponse<T> extends ApiResult<T> {}
export interface AuthenticatedApiResponse<T> extends ApiResult<T> {}
export interface TenantApiResponse<T> extends ApiResult<T> {}
export interface AdminApiResponse<T> extends ApiResult<T> {}
export interface SystemApiResponse<T> extends ApiResult<T> {}

/**
 * Request Execution Utility
 * 
 * Centralizes request execution logic for all request types
 * Prevents execution drift by ensuring single execution path for all requests
 */
export class RequestExecutionUtility {
  
  /**
   * Unified execution method - single source of truth for all requests
   */
  static async executeUnifiedRequest<T>(
    url: string,
    setupResult: RequestSetupResult,
    fetchWithCacheFn: (
      url: string,
      options: RequestInit,
      cacheKey?: string,
      ttl?: number,
      target?: any
    ) => Promise<Response>
  ): Promise<ApiResult<T>> {
    try {
      const response = await fetchWithCacheFn(
        url,
        setupResult.options,
        setupResult.cacheKey,
        setupResult.ttl,
        setupResult.target
      );

      const data = await response.json();
      
      return {
        success: true,
        data: data
      } as ApiResult<T>;
    } catch (error) {
      console.error(`[RequestExecutionUtility] Request failed:`, error);
      
      return {
        success: false,
        error: {
          status: 500,
          message: error instanceof Error ? error.message : 'Unknown error',
          code: 'REQUEST_ERROR'
        }
      } as ApiResult<T>;
    }
  }

  /**
   * Convert ApiResult to specific response type
   */
  static convertToResponseType<T, R extends ApiResult<T>>(
    result: ApiResult<T>,
    responseType: 'public' | 'authenticated' | 'tenant' | 'admin' | 'system'
  ): R {
    return result as R;
  }

  /**
   * Track performance metrics
   */
  static trackPerformanceMetrics(url: string, startTime: number, cacheKey?: string): void {
    // const duration = Date.now() - startTime;
    // console.log(`[RequestExecutionUtility] Request to ${url} took ${duration}ms`);
    // if (cacheKey) {
    //   console.log(`[RequestExecutionUtility] Cache key: ${cacheKey}`);
    // }
  }

  /**
   * Generate request key for tracking
   */
  static generateRequestKey(method: string, url: string, requestType: string): string {
    return `${method}:${requestType}:${url}`;
  }
}
