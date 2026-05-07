/**
 * FlexibleApiSingleton - Stable Version
 * 
 * Clean, stable version based on FlexibleApiSingletonV2
 * Uses delegation pattern with utility services
 * Eliminates execution drift and provides consistent behavior
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
 * FlexibleApiSingleton - Stable Version
 * 
 * Clean base class using delegation pattern
 * All requests go through setup → execution flow
 * Prevents execution drift and ensures consistent behavior
 */
export abstract class FlexibleApiSingletonStable extends UniversalSingleton {
  protected defaultRequestType: RequestType = RequestType.PUBLIC;
  protected defaultRequestTarget: RequestTarget = RequestTarget.API;
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes default

  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    const ttl = cacheOptions?.ttl || 5 * 60 * 1000; // 5 minutes default
    super(singletonKey, {
      ttl
    });
    this.cacheTTL = ttl;
  }

  /**
   * Public request method
   */
  protected async makePublicRequest<T>(
    url: string,
    options: RequestInit = {},
    requestOptions?: PublicRequestOptions
  ): Promise<PublicApiResponse<T>> {
    const setupResult = await RequestSetupUtility.setupPublicRequestOptions<T>(
      url, 
      options, 
      requestOptions?.cacheKey, 
      requestOptions?.ttl, 
      this.cacheTTL
    );
    const finalSetup = RequestSetupUtility.applyTargetOverride(setupResult, requestOptions?.requestTarget);
    const result = await RequestExecutionUtility.executeUnifiedRequest<T>(url, finalSetup, this.fetchWithCache.bind(this));
    return RequestExecutionUtility.convertToResponseType<T, PublicApiResponse<T>>(result, 'public');
  }

  /**
   * Authenticated request method
   */
  protected async makeAuthenticatedRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number,
    isAdminRequest: boolean = false
  ): Promise<AuthenticatedApiResponse<T>> {
    const setupResult = await RequestSetupUtility.setupAuthenticatedRequestOptions<T>(
      url, 
      options, 
      cacheKey, 
      ttl, 
      this.cacheTTL
    );
    const result = await RequestExecutionUtility.executeUnifiedRequest<T>(url, setupResult, this.fetchWithCache.bind(this));
    return RequestExecutionUtility.convertToResponseType<T, AuthenticatedApiResponse<T>>(result, 'authenticated');
  }

  /**
   * Tenant request method
   */
  protected async makeTenantRequest<T>(
    url: string,
    options: RequestInit = {},
    requestOptions?: TenantRequestOptions
  ): Promise<TenantApiResponse<T>> {
    const setupResult = await RequestSetupUtility.setupTenantRequestOptions<T>(url, options, requestOptions, this.cacheTTL);
    const result = await RequestExecutionUtility.executeUnifiedRequest<T>(url, setupResult, this.fetchWithCache.bind(this));
    return RequestExecutionUtility.convertToResponseType<T, TenantApiResponse<T>>(result, 'tenant');
  }

  /**
   * Admin request method
   */
  protected async makeAdminRequest<T>(
    url: string,
    options: RequestInit = {},
    requestOptions?: AdminRequestOptions
  ): Promise<AdminApiResponse<T>> {
    const setupResult = await RequestSetupUtility.setupAdminRequestOptions<T>(url, options, requestOptions, this.cacheTTL);
    const result = await RequestExecutionUtility.executeUnifiedRequest<T>(url, setupResult, this.fetchWithCache.bind(this));
    return RequestExecutionUtility.convertToResponseType<T, AdminApiResponse<T>>(result, 'admin');
  }

  /**
   * System request method
   */
  protected async makeSystemRequest<T>(
    url: string,
    options: RequestInit = {},
    requestOptions?: SystemRequestOptions
  ): Promise<SystemApiResponse<T>> {
    const setupResult = await RequestSetupUtility.setupSystemRequestOptions<T>(url, options, requestOptions, this.cacheTTL);
    const result = await RequestExecutionUtility.executeUnifiedRequest<T>(url, setupResult, this.fetchWithCache.bind(this));
    return RequestExecutionUtility.convertToResponseType<T, SystemApiResponse<T>>(result, 'system');
  }

  /**
   * Default request method with delegation pattern
   */
  protected async makeDefaultRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number,
    requestOptions?: RequestOptions
  ): Promise<ApiResult<T>> {
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

  // Hook methods for customization
  protected async onPublicRequest<T>(url: string, options: RequestInit, cacheKey?: string, ttl?: number): Promise<RequestInit> {
    return options;
  }

  protected async onAuthenticatedRequest<T>(url: string, options: RequestInit, cacheKey?: string, ttl?: number, isAdminRequest?: boolean): Promise<RequestInit> {
    return options;
  }

  protected async onTenantRequest<T>(url: string, options: RequestInit, requestOptions?: TenantRequestOptions): Promise<RequestInit> {
    return options;
  }

  protected async onAdminRequest<T>(url: string, options: RequestInit, requestOptions?: AdminRequestOptions): Promise<RequestInit> {
    return options;
  }

  protected async onSystemRequest<T>(url: string, options: RequestInit, requestOptions?: SystemRequestOptions): Promise<RequestInit> {
    return options;
  }

  // Utility methods
  protected async fetchWithCache(url: string, options: RequestInit, cacheKey?: string, ttl?: number, target?: RequestTarget): Promise<Response> {
    // Implement caching logic here
    return fetch(url, options);
  }

  protected async getAuthToken(): Promise<string | null> {
    // Implement auth token retrieval
    return null;
  }

  protected async getCurrentTenantId(): Promise<string | null> {
    // Implement tenant ID retrieval
    return null;
  }

  protected async validateAdminAccess(): Promise<boolean> {
    // Implement admin validation
    return false;
  }

  protected async validateSystemAccess(systemKey?: string): Promise<boolean> {
    // Implement system access validation
    return false;
  }
}
