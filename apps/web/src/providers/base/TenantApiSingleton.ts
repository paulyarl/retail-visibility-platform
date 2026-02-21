/**
 * Tenant API Singleton
 * 
 * Extends FlexibleApiSingleton with tenant-specific defaults
 * Handles tenant context validation and enhanced request processing
 * Provides tenant-specific caching and header management
 */

import { FlexibleApiSingleton, RequestType, RequestTarget, SingletonCacheOptions, TenantRequestOptions, TenantApiResponse } from './FlexibleApiSingleton';

// ====================
// TENANT API SINGLETON
// ====================

export abstract class TenantApiSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.TENANT;
  protected defaultRequestTarget: RequestTarget = RequestTarget.API;
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
    // Use the inherited WEB target override from FlexibleApiSingleton
    return super.makeWebRequest(url, options, cacheKey, customTTL);
  }

  /**
   * Make public tenant request to API server
   * Uses convenience method for PUBLIC + API combination
   */
  protected async makePublicRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404: boolean = true
  ): Promise<TenantApiResponse<T>> {
    // Use the new PUBLIC + API convenience method
    return this.makePublicApiRequest(url, options, cacheKey, customTTL);
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
