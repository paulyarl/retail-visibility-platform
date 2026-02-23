/**
 * FlexibleApiSingleton v2 - Clean Architecture
 * 
 * Refactored version that delegates to utility services for setup and execution
 * Prevents execution drift and reduces file complexity
 */

import { UniversalSingleton } from './UniversalSingleton';
import { RequestSetupUtility, RequestSetupResult, PublicRequestOptions, AuthenticatedRequestOptions, TenantRequestOptions, AdminRequestOptions, SystemRequestOptions, SystemRequestOptionsExtended, RequestOptions } from './RequestSetupUtility';
import { RequestExecutionUtility, ApiResult, PublicApiResponse, AuthenticatedApiResponse, TenantApiResponse, AdminApiResponse, SystemApiResponse } from './RequestExecutionUtility';

// Enums and interfaces
export enum RequestType {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated', 
  TENANT = 'tenant',
  ADMIN = 'admin',
  SYSTEM = 'system'
}

export enum RequestTarget {
  API = 'api',
  WEB = 'web',
  EXTERNAL = 'external'
}

export interface SingletonCacheOptions {
  ttl?: number;
  maxSize?: number;
}

/**
 * FlexibleApiSingleton v2
 * 
 * Clean architecture with delegation to utility services
 * Much smaller and more maintainable than the original
 */
export abstract class FlexibleApiSingletonV2 extends UniversalSingleton {
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes default
  
  // Default request type for this service (can be overridden)
  protected abstract defaultRequestType: RequestType;
  protected abstract defaultRequestTarget: RequestTarget;
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
  }

  // ====================
  // CORE DELEGATION METHODS
  // ====================

  /**
   * Make public API request (no authentication)
   */
  protected async makePublicRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: PublicRequestOptions
  ): Promise<PublicApiResponse<T>> {
    // Delegate to setup utility
    const setupResult = await RequestSetupUtility.setupPublicRequestOptions<T>(
      url, 
      options || {}, 
      requestOptions?.cacheKey, 
      requestOptions?.ttl,
      this.cacheTTL
    );
    
    // Apply target override if provided
    const finalSetup = RequestSetupUtility.applyTargetOverride(setupResult, requestOptions?.requestTarget);
    
    // Delegate to execution utility
    const result = await RequestExecutionUtility.executeUnifiedRequest<T>(
      url, 
      finalSetup, 
      this.fetchWithCache.bind(this)
    );
    
    // Convert to specific response type
    return RequestExecutionUtility.convertToResponseType<T, PublicApiResponse<T>>(result, 'public');
  }

  /**
   * Make authenticated API request (user-level)
   */
  protected async makeAuthenticatedRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: AuthenticatedRequestOptions
  ): Promise<AuthenticatedApiResponse<T>> {
    // Delegate to setup utility
    const setupResult = await RequestSetupUtility.setupAuthenticatedRequestOptions<T>(
      url, 
      options || {}, 
      requestOptions?.cacheKey, 
      requestOptions?.ttl,
      this.cacheTTL
    );
    
    // Apply target override if provided
    const finalSetup = RequestSetupUtility.applyTargetOverride(setupResult, requestOptions?.requestTarget);
    
    // Delegate to execution utility
    const result = await RequestExecutionUtility.executeUnifiedRequest<T>(
      url, 
      finalSetup, 
      this.fetchWithCache.bind(this)
    );
    
    // Convert to specific response type
    return RequestExecutionUtility.convertToResponseType<T, AuthenticatedApiResponse<T>>(result, 'authenticated');
  }

  /**
   * Make tenant API request with context validation
   */
  protected async makeTenantRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: TenantRequestOptions
  ): Promise<TenantApiResponse<T>> {
    // Delegate to setup utility
    const setupResult = await RequestSetupUtility.setupTenantRequestOptions<T>(
      url, 
      options || {}, 
      requestOptions,
      this.cacheTTL
    );
    
    // Apply target override if provided
    const finalSetup = RequestSetupUtility.applyTargetOverride(setupResult, requestOptions?.requestTarget);
    
    // Delegate to execution utility
    const result = await RequestExecutionUtility.executeUnifiedRequest<T>(
      url, 
      finalSetup, 
      this.fetchWithCache.bind(this)
    );
    
    // Convert to specific response type
    return RequestExecutionUtility.convertToResponseType<T, TenantApiResponse<T>>(result, 'tenant');
  }

  /**
   * Make admin API request with admin privileges
   */
  protected async makeAdminRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: AdminRequestOptions
  ): Promise<AdminApiResponse<T>> {
    // Delegate to setup utility
    const setupResult = await RequestSetupUtility.setupAdminRequestOptions<T>(
      url, 
      options || {}, 
      requestOptions,
      this.cacheTTL
    );
    
    // Apply target override if provided
    const finalSetup = RequestSetupUtility.applyTargetOverride(setupResult, requestOptions?.requestTarget);
    
    // Delegate to execution utility
    const result = await RequestExecutionUtility.executeUnifiedRequest<T>(
      url, 
      finalSetup, 
      this.fetchWithCache.bind(this)
    );
    
    // Convert to specific response type
    return RequestExecutionUtility.convertToResponseType<T, AdminApiResponse<T>>(result, 'admin');
  }

  /**
   * Make system API request (background processing)
   */
  protected async makeSystemRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: SystemRequestOptionsExtended
  ): Promise<SystemApiResponse<T>> {
    // Delegate to setup utility
    const setupResult = await RequestSetupUtility.setupSystemRequestOptions<T>(
      url, 
      options || {}, 
      requestOptions,
      this.cacheTTL
    );
    
    // Apply target override if provided
    const finalSetup = RequestSetupUtility.applyTargetOverride(setupResult, requestOptions?.requestTarget);
    
    // Delegate to execution utility
    const result = await RequestExecutionUtility.executeUnifiedRequest<T>(
      url, 
      finalSetup, 
      this.fetchWithCache.bind(this)
    );
    
    // Convert to specific response type
    return RequestExecutionUtility.convertToResponseType<T, SystemApiResponse<T>>(result, 'system');
  }

  /**
   * Make request using service's default method with smart defaults
   */
  protected async makeDefaultRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number,
    requestOptions?: RequestOptions
  ): Promise<ApiResult<T>> {
    // Use smart defaults - parent values when not provided
    const requestType = requestOptions?.requestType || this.defaultRequestType;
    const requestTarget = requestOptions?.requestTarget || this.defaultRequestTarget;
    
    let setupResult: RequestSetupResult;
    
    // Delegate to appropriate setup method based on request type
    switch (requestType) {
      case RequestType.PUBLIC:
        setupResult = await RequestSetupUtility.setupPublicRequestOptions<T>(url, options, cacheKey, ttl, this.cacheTTL);
        break;
      case RequestType.AUTHENTICATED:
        setupResult = await RequestSetupUtility.setupAuthenticatedRequestOptions<T>(url, options, cacheKey, ttl, this.cacheTTL);
        break;
      case RequestType.TENANT:
        const tenantOptions = { cacheKey, ttl, requestTarget } as TenantRequestOptions;
        setupResult = await RequestSetupUtility.setupTenantRequestOptions<T>(url, options, tenantOptions, this.cacheTTL);
        break;
      case RequestType.ADMIN:
        const adminOptions = { cacheKey, ttl, requestTarget } as AdminRequestOptions;
        setupResult = await RequestSetupUtility.setupAdminRequestOptions<T>(url, options, adminOptions, this.cacheTTL);
        break;
      case RequestType.SYSTEM:
        const systemOptions = { cacheKey, ttl, requestTarget } as SystemRequestOptions;
        setupResult = await RequestSetupUtility.setupSystemRequestOptions<T>(url, options, systemOptions, this.cacheTTL);
        break;
      default:
        throw new Error(`Unsupported request type: ${requestType}`);
    }
    
    // Apply target override if provided
    const finalSetup = RequestSetupUtility.applyTargetOverride(setupResult, requestTarget);
    
    // Delegate to unified execution - single source of truth
    return await RequestExecutionUtility.executeUnifiedRequest<T>(url, finalSetup, this.fetchWithCache.bind(this));
  }

  // ====================
  // HOOK METHODS (for subclass customization)
  // ====================

  /**
   * Override hook for subclasses to customize public request behavior
   */
  protected async onPublicRequest<T>(
    url: string,
    options: RequestInit,
    cacheKey?: string,
    ttl?: number
  ): Promise<RequestInit> {
    // Default implementation - subclasses can override for custom headers, etc.
    return options;
  }

  /**
   * Override hook for subclasses to customize authenticated request behavior
   */
  protected async onAuthenticatedRequest<T>(
    url: string,
    options: RequestInit,
    cacheKey?: string,
    ttl?: number,
    isAdminRequest?: boolean
  ): Promise<RequestInit> {
    // Default implementation - subclasses can override for custom headers, etc.
    return options;
  }

  /**
   * Override hook for subclasses to customize tenant request behavior
   */
  protected async onTenantRequest<T>(
    url: string,
    options: RequestInit,
    requestOptions?: TenantRequestOptions
  ): Promise<RequestInit> {
    // Default implementation - subclasses can override for custom headers, etc.
    return options;
  }

  // ====================
  // UTILITY METHODS
  // ====================

  /**
   * Fetch with cache - unified caching method for all request types
   */
  protected async fetchWithCache(
    url: string,
    options: RequestInit,
    cacheKey?: string,
    ttl?: number,
    target?: RequestTarget
  ): Promise<Response> {
    // This would implement caching logic - simplified for now
    return fetch(url, options);
  }

  /**
   * Get authentication token
   */
  protected async getAuthToken(): Promise<string> {
    // Implementation would get auth token from storage or refresh
    return localStorage.getItem('authToken') || '';
  }

  /**
   * Get current tenant ID
   */
  protected getCurrentTenantId(): string | undefined {
    // Implementation would get current tenant context
    return localStorage.getItem('currentTenantId') || undefined;
  }

  /**
   * Validate admin access
   */
  protected async validateAdminAccess(): Promise<boolean> {
    // Implementation would validate admin privileges
    const token = await this.getAuthToken();
    return !!token; // Simplified for example
  }

  /**
   * Validate system access
   */
  protected async validateSystemAccess(systemKey: string): Promise<boolean> {
    // Implementation would validate system access
    const token = await this.getAuthToken();
    return !!token; // Simplified for example
  }

  /**
   * Get singleton instance
   * Note: Subclasses should implement their own getInstance method
   */
  static getInstance(): any {
    // Implementation would handle singleton pattern
    throw new Error('Singleton pattern must be implemented in subclass');
  }
}
