/**
 * Tenant API Singleton
 * 
 * Extends FlexibleApiSingleton with tenant-specific defaults
 * Handles tenant context validation and enhanced request processing
 * Provides tenant-specific caching and header management
 */

import { FlexibleApiSingleton, RequestType, RequestTarget, SingletonCacheOptions, TenantRequestOptions, TenantApiResponse, PublicRequestOptions } from './FlexibleApiSingleton';
import { AppContext, CacheIsolation } from '../../utils/contextCacheManager';

// ====================
// TENANT API SINGLETON
// ====================

export abstract class TenantApiSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.TENANT;
  protected defaultRequestTarget: RequestTarget = RequestTarget.API;
  protected defaultContext: AppContext = AppContext.TENANT;
  protected defaultIsolation: CacheIsolation = CacheIsolation.TENANT;
  protected cacheTTL: number = 10 * 60 * 1000; // 10 minutes for tenant operations
  protected currentTenantId?: string;
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      ttl: 10 * 60 * 1000, // 10 minutes for tenant operations
      ...cacheOptions
    });
  }

  /**
   * Set current tenant context
   */
  setCurrentTenant(tenantId: string): void {
    this.currentTenantId = tenantId;
  }

  /**
   * Get current tenant context
   */
  getCurrentTenant(): string | undefined {
    return this.currentTenantId;
  }

  /**
   * Clear current tenant context
   */
  clearCurrentTenant(): void {
    this.currentTenantId = undefined;
  }

  /**
   * Validate tenant context
   */
  private async validateTenantContext(): Promise<boolean> {
    if (!this.currentTenantId) {
      throw new Error('Tenant context required but not set');
    }
    return true;
  }

  /**
   * Make tenant request to web server when needed
   * Demonstrates cross-target capability from API default
   */
  protected async makeWebRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404: boolean = true
  ): Promise<TenantApiResponse<T>> {
    // Use the inherited makeDefaultRequest from FlexibleApiSingleton
    const modifiedOptions = await this.onTenantRequest(url, options);
    return super.makeDefaultRequest(url, modifiedOptions, cacheKey, customTTL);
  }
 

  /**
   * Override hook for tenant request behavior
   */
  protected async onTenantRequest<T>(
    url: string,
    options: RequestInit,
    requestOptions?: TenantRequestOptions
  ): Promise<RequestInit> {
    const modifiedOptions = { ...options };

    // Add Authorization header with bearer token
    const token = await this.getAuthToken();
    if (token) {
      modifiedOptions.headers = {
        ...modifiedOptions.headers,
        'Authorization': `Bearer ${token}`,
      };
    } else {
      console.warn('[TenantApiSingleton] No auth token available for tenant request');
    }

    // Add tenant context headers
    const tenantId = requestOptions?.tenantId || this.currentTenantId || await this.getCurrentTenantId();
    if (tenantId) {
      modifiedOptions.headers = {
        ...modifiedOptions.headers,
        'X-Tenant-ID': tenantId,
        'X-Request-Context': 'tenant',
      };
    }

    return modifiedOptions;
  }

  /**
   * Get custom metrics for tenant operations
   */
  protected getCustomMetrics(): Record<string, any> {
    return {
      requestType: 'tenant',
      defaultTTL: this.cacheTTL,
      tenantRequests: this.apiCalls,
      currentTenantId: this.currentTenantId
    };
  }
}

export default TenantApiSingleton;
