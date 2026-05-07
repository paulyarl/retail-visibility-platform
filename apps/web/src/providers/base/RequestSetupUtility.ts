/**
 * Request Setup Utility Service
 * 
 * Handles setup and configuration for different request types
 * Extracted from FlexibleApiSingleton to reduce complexity and improve maintainability
 */

// Request option interfaces
export interface PublicRequestOptions {
  cacheKey?: string;
  ttl?: number;
  requestTarget?: any; // Will be defined in FlexibleApiSingleton
}

export interface AuthenticatedRequestOptions {
  cacheKey?: string;
  ttl?: number;
  requestTarget?: any;
  isAdminRequest?: boolean;
}

export interface TenantRequestOptions {
  cacheKey?: string;
  ttl?: number;
  requestTarget?: any;
  requireTenantContext?: boolean;
  validateTenantAccess?: boolean;
  tenantId?: string;
}

export interface AdminRequestOptions {
  cacheKey?: string;
  ttl?: number;
  requestTarget?: any;
  requireAdminAccess?: boolean;
}

export interface SystemRequestOptions {
  cacheKey?: string;
  ttl?: number;
  requestTarget?: any;
  systemKey?: string;
}

export interface SystemRequestOptionsExtended extends SystemRequestOptions {
  validateSystemAccess?: boolean;
}

export interface RequestOptions {
  requestType?: any;
  requestTarget?: any;
}

// Setup result interface
export interface RequestSetupResult {
  options: RequestInit;
  cacheKey?: string;
  ttl: number;
  target: any;
}

/**
 * Request Setup Utility
 * 
 * Centralizes request configuration logic for all request types
 * Prevents execution drift by ensuring consistent setup across all request methods
 */
export class RequestSetupUtility {
  private defaultTTL: number = 5 * 60 * 1000; // 5 minutes default

  /**
   * Setup options for public requests
   */
  static async setupPublicRequestOptions<T>(
    url: string, 
    options: RequestInit, 
    cacheKey?: string, 
    ttl?: number,
    defaultTTL?: number
  ): Promise<RequestSetupResult> {
    const effectiveTTL = ttl || defaultTTL || 5 * 60 * 1000;
    
    return {
      options: {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      },
      cacheKey,
      ttl: effectiveTTL,
      target: 'API' as any
    };
  }

  /**
   * Setup options for authenticated requests
   */
  static async setupAuthenticatedRequestOptions<T>(
    url: string, 
    options: RequestInit, 
    cacheKey?: string, 
    ttl?: number,
    defaultTTL?: number
  ): Promise<RequestSetupResult> {
    const effectiveTTL = ttl || defaultTTL || 5 * 60 * 1000;
    
    return {
      options: {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      },
      cacheKey,
      ttl: effectiveTTL,
      target: 'API' as any
    };
  }

  /**
   * Setup options for tenant requests
   */
  static async setupTenantRequestOptions<T>(
    url: string, 
    options: RequestInit, 
    requestOptions?: TenantRequestOptions,
    defaultTTL?: number
  ): Promise<RequestSetupResult> {
    const effectiveTTL = requestOptions?.ttl || defaultTTL || 5 * 60 * 1000;
    
    return {
      options: {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      },
      cacheKey: requestOptions?.cacheKey,
      ttl: effectiveTTL,
      target: requestOptions?.requestTarget || 'API' as any
    };
  }

  /**
   * Setup options for admin requests
   */
  static async setupAdminRequestOptions<T>(
    url: string, 
    options: RequestInit, 
    requestOptions?: AdminRequestOptions,
    defaultTTL?: number
  ): Promise<RequestSetupResult> {
    const effectiveTTL = requestOptions?.ttl || defaultTTL || 5 * 60 * 1000;
    
    return {
      options: {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      },
      cacheKey: requestOptions?.cacheKey,
      ttl: effectiveTTL,
      target: requestOptions?.requestTarget || 'API' as any
    };
  }

  /**
   * Setup options for system requests
   */
  static async setupSystemRequestOptions<T>(
    url: string, 
    options: RequestInit, 
    requestOptions?: SystemRequestOptions,
    defaultTTL?: number
  ): Promise<RequestSetupResult> {
    const effectiveTTL = requestOptions?.ttl || defaultTTL || 5 * 60 * 1000;
    
    return {
      options: {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      },
      cacheKey: requestOptions?.cacheKey,
      ttl: effectiveTTL,
      target: requestOptions?.requestTarget || 'API' as any
    };
  }

  /**
   * Override target if provided in request options
   */
  static applyTargetOverride(
    setupResult: RequestSetupResult, 
    requestTarget?: any
  ): RequestSetupResult {
    if (requestTarget) {
      setupResult.target = requestTarget;
    }
    return setupResult;
  }
}
