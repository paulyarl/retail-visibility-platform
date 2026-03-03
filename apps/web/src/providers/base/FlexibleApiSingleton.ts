/**
 * Flexible API Singleton - Multi-Context Request Methods
 * 
 * Base abstract class providing all request method types:
 * - makePublicRequest() - No authentication required
 * - makeAuthenticatedRequest() - User-level authentication
 * - makeTenantRequest() - Tenant context with group validation
 * - makeAdminRequest() - Admin-level privileges
 * 
 * Services can choose appropriate method per operation
 * Default request type can be overridden per service
 */

import { UniversalSingleton, SingletonCacheOptions, ApiResult, SingletonMetrics } from './UniversalSingleton';
import { clientTenantContextManager } from '@/lib/clientTenantContext';

export type { SingletonCacheOptions, ApiResult, SingletonMetrics } from './UniversalSingleton';

// ====================
// REQUEST TYPE ENUMS
// ====================

export enum RequestType {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
  TENANT = 'tenant',
  ADMIN = 'admin',
  SYSTEM = 'system',
  EXTERNAL = 'external'
}

export enum RequestTarget {
  API = 'api',
  WEB = 'web',
  EXTERNAL = 'external'
}

export interface PublicRequestOptions {
  cacheKey?: string;
  ttl?: number;
  requestTarget?: RequestTarget;
}

export interface AuthenticatedRequestOptions {
  cacheKey?: string;
  ttl?: number;
  requestTarget?: RequestTarget;
  isAdminRequest?: boolean;
}

export interface TenantRequestOptions {
  requireTenantContext?: boolean;
  validateTenantAccess?: boolean;
  tenantId?: string;
  bypassCache?: boolean;
  cacheKey?: string;
  ttl?: number;
  requestTarget?: RequestTarget;
}

export interface AdminRequestOptions {
  requireAdminContext?: boolean;
  validateAdminAccess?: boolean;
  bypassCache?: boolean;
  cacheKey?: string;
  ttl?: number;
  requestTarget?: RequestTarget;
}

export interface SystemRequestOptions {
  requireSystemAccess?: boolean;
  validateSystemAccess?: boolean;
  bypassCache?: boolean;
  cacheKey?: string;
  ttl?: number;
  requestTarget?: RequestTarget;
  systemKey?: string;
}

export interface ExternalRequestOptions {
  timeout?: number;
  retries?: number;
  headers?: Record<string, string>;
  cacheKey?: string;
  ttl?: number;
  requestTarget?: RequestTarget;
}

export interface RequestOptions {
  requestType?: RequestType;
  requestTarget?: RequestTarget;
}

// Response interfaces
export interface PublicApiResponse<T> extends ApiResult<T> {}
export interface AuthenticatedApiResponse<T> extends ApiResult<T> {}
export interface TenantApiResponse<T> extends ApiResult<T> {}
export interface AdminApiResponse<T> extends ApiResult<T> {}
export interface SystemApiResponse<T> extends ApiResult<T> {}
export interface ExternalApiResponse<T> extends ApiResult<T> {}

// ====================
// FLEXIBLE API SINGLETON
// ====================

export abstract class FlexibleApiSingleton extends UniversalSingleton {
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes default
  
  // Default request type for this service (can be overridden)
  protected abstract defaultRequestType: RequestType;
  protected abstract defaultRequestTarget: RequestTarget;
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
  }

  // ====================
  // CORE UTILITY METHODS
  // ====================

  /**
   * Generate a unique key for the current request context
   */
  private getRequestKey(method: string, url: string, requestType?: RequestType): string {
    return `${method}:${requestType || this.defaultRequestType}:${url}`;
  }

  /**
   * Unified execution method - single source of truth for all requests
   */
  private async executeUnifiedRequest<T>(
    url: string,
    setupResult: { options: RequestInit; cacheKey?: string; ttl: number; target: RequestTarget }
  ): Promise<ApiResult<T>> {
    try {
      const response = await this.fetchWithCache(
        url,
        setupResult.options,
        setupResult.cacheKey,
        setupResult.ttl,
        setupResult.target
      );

      // Check if response is successful
      if (!response.ok) {
        // Try to parse error response from API
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        let errorCode = 'HTTP_ERROR';
        
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
          if (errorData.error) {
            errorCode = errorData.error;
          }
        } catch (parseError) {
          // If we can't parse JSON, use default message
          console.warn('[FlexibleApiSingleton] Could not parse error response:', parseError);
        }
        
        return {
          success: false,
          error: {
            status: response.status,
            message: errorMessage,
            code: errorCode
          }
        } as ApiResult<T>;
      }

      // Handle 204 No Content responses
      if (response.status === 204) {
        return {
          success: true,
          data: null as T,
          status: 204
        } as ApiResult<T>;
      }

      const data = await response.json();
      
      return {
        success: true,
        data: data
      } as ApiResult<T>;
    } catch (error) {
      console.error(`[FlexibleApiSingleton] Request failed:`, error);
      this.errors++;
      
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

  // ====================
  // ERROR HANDLING UTILITIES
  // ====================

  /**
   * Helper function to log errors without triggering Next.js error overlay
   * Uses warn for expected HTTP errors (4xx) and error for unexpected issues (5xx, network, etc.)
   */
  protected logError(context: string, error: any): void {
    // Handle both structured error objects and raw errors
    const status = error?.status || error?.response?.status;
    const message = error?.message || error?.error || error?.toString();
    
    if (status >= 400 && status < 500) {
      // Expected client errors - use warn to avoid error overlay
      console.warn(`[${this.constructor.name}] ${context} (HTTP ${status}):`, message);
    } else {
      // Unexpected server errors, network issues, etc. - use error
      console.error(`[${this.constructor.name}] ${context}:`, error);
    }
  }

  /**
   * Create a user-friendly response object that includes error information
   * Instead of returning null, services can return this for better UX
   */
  protected createResponse<T>(
    success: boolean,
    data?: T,
    error?: any,
    userMessage?: string
  ): {
    success: boolean;
    data?: T;
    error?: {
      code: string;
      message: string;
      status?: number;
    };
    userMessage?: string;
  } {
    return {
      success,
      data,
      error: error ? {
        code: error.code || 'UNKNOWN_ERROR',
        message: error.message || 'An error occurred',
        status: error.status
      } : undefined,
      userMessage: userMessage || (error?.message) || undefined
    };
  }

  // ====================
  // REQUEST SETUP METHODS
  // ====================

  /**
   * Setup options for public requests
   */
  private async setupPublicRequestOptions<T>(
    url: string, 
    options: RequestInit, 
    cacheKey?: string, 
    ttl?: number
  ): Promise<{ options: RequestInit; cacheKey?: string; ttl: number; target: RequestTarget }> {
    const modifiedOptions = await this.onPublicRequest<T>(url, options, cacheKey, ttl);
    
    // Don't set Content-Type for FormData - let browser set it with boundary
    const isFormData = modifiedOptions.body instanceof FormData;
    
    return {
      options: {
        ...modifiedOptions,
        headers: isFormData ? {
          ...modifiedOptions.headers,
        } : {
          'Content-Type': 'application/json',
          ...modifiedOptions.headers,
        },
      },
      cacheKey,
      ttl: ttl || this.cacheTTL,
      target: this.defaultRequestTarget
    };
  }

  /**
   * Setup options for authenticated requests
   */
  private async setupAuthenticatedRequestOptions<T>(
    url: string, 
    options: RequestInit, 
    cacheKey?: string, 
    ttl?: number
  ): Promise<{ options: RequestInit; cacheKey?: string; ttl: number; target: RequestTarget }> {
    const modifiedOptions = await this.onAuthenticatedRequest<T>(url, options, cacheKey, ttl);
    
    // Don't set Content-Type for FormData - let browser set it with boundary
    const isFormData = modifiedOptions.body instanceof FormData;
    
    return {
      options: {
        ...modifiedOptions,
        headers: isFormData ? {
          ...modifiedOptions.headers,
        } : {
          'Content-Type': 'application/json',
          ...modifiedOptions.headers,
        },
      },
      cacheKey,
      ttl: ttl || this.cacheTTL,
      target: this.defaultRequestTarget
    };
  }

  /**
   * Setup options for tenant requests
   */
  private async setupTenantRequestOptions<T>(
    url: string, 
    options: RequestInit, 
    requestOptions?: TenantRequestOptions
  ): Promise<{ options: RequestInit; cacheKey?: string; ttl: number; target: RequestTarget }> {
    const modifiedOptions = await this.onTenantRequest<T>(url, options, requestOptions);
    
    // Don't set Content-Type for FormData - let browser set it with boundary
    const isFormData = modifiedOptions.body instanceof FormData;
    
    return {
      options: {
        ...modifiedOptions,
        headers: isFormData ? {
          ...modifiedOptions.headers,
        } : {
          'Content-Type': 'application/json',
          ...modifiedOptions.headers,
        },
      },
      cacheKey: requestOptions?.cacheKey,
      ttl: requestOptions?.ttl || this.cacheTTL,
      target: requestOptions?.requestTarget || this.defaultRequestTarget
    };
  }

  /**
   * Setup options for admin requests
   */
  private async setupAdminRequestOptions<T>(
    url: string, 
    options: RequestInit, 
    requestOptions?: AdminRequestOptions
  ): Promise<{ options: RequestInit; cacheKey?: string; ttl: number; target: RequestTarget }> {
    const modifiedOptions = await this.onAdminRequest<T>(url, options, requestOptions);
    
    // Don't set Content-Type for FormData - let browser set it with boundary
    const isFormData = modifiedOptions.body instanceof FormData;
    
    return {
      options: {
        ...modifiedOptions,
        headers: isFormData ? {
          ...modifiedOptions.headers,
        } : {
          'Content-Type': 'application/json',
          ...modifiedOptions.headers,
        },
      },
      cacheKey: requestOptions?.cacheKey,
      ttl: requestOptions?.ttl || this.cacheTTL,
      target: requestOptions?.requestTarget || this.defaultRequestTarget
    };
  }

  /**
   * Setup options for system requests
   */
  private async setupSystemRequestOptions<T>(
    url: string, 
    options: RequestInit, 
    requestOptions?: SystemRequestOptions
  ): Promise<{ options: RequestInit; cacheKey?: string; ttl: number; target: RequestTarget }> {
    const modifiedOptions = await this.onSystemRequest<T>(url, options, requestOptions);
    
    // Don't set Content-Type for FormData - let browser set it with boundary
    const isFormData = modifiedOptions.body instanceof FormData;
    
    return {
      options: {
        ...modifiedOptions,
        headers: isFormData ? {
          ...modifiedOptions.headers,
        } : {
          'Content-Type': 'application/json',
          ...modifiedOptions.headers,
        },
      },
      cacheKey: requestOptions?.cacheKey,
      ttl: requestOptions?.ttl || this.cacheTTL,
      target: requestOptions?.requestTarget || this.defaultRequestTarget
    };
  }

  /**
   * Setup options for external requests
   */
  private async setupExternalRequestOptions<T>(
    url: string, 
    options: RequestInit, 
    requestOptions?: ExternalRequestOptions
  ): Promise<{ options: RequestInit; cacheKey?: string; ttl: number; target: RequestTarget }> {
    const modifiedOptions = await this.onExternalRequest<T>(url, options, requestOptions);
    
    // Don't set Content-Type for FormData - let browser set it with boundary
    const isFormData = modifiedOptions.body instanceof FormData;
    
    return {
      options: {
        ...modifiedOptions,
        headers: isFormData ? {
          ...modifiedOptions.headers,
        } : {
          'Content-Type': 'application/json',
          'User-Agent': 'RVP-Platform/1.0',
          ...modifiedOptions.headers,
        },
      },
      cacheKey: requestOptions?.cacheKey,
      ttl: requestOptions?.ttl || this.cacheTTL,
      target: requestOptions?.requestTarget || RequestTarget.EXTERNAL
    };
  }

  // ====================
  // REQUEST TYPE METHODS
  // ====================

  /**
   * Public request method
   */
  protected async makePublicRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: PublicRequestOptions
  ): Promise<PublicApiResponse<T>> {
    const requestKey = this.getRequestKey('makePublicRequest', url, RequestType.PUBLIC);
    
    // Delegate to setup method
    const setupResult = await this.setupPublicRequestOptions<T>(
      url, 
      options || {}, 
      requestOptions?.cacheKey, 
      requestOptions?.ttl
    );
    
    // Override target if provided in requestOptions
    if (requestOptions?.requestTarget) {
      setupResult.target = requestOptions.requestTarget;
    }
    
    // Delegate to unified execution
    const result = await this.executeUnifiedRequest<T>(url, setupResult);
    
    // Convert to PublicApiResponse format
    return result as PublicApiResponse<T>;
  }

  /**
   * Authenticated request method
   */
  protected async makeAuthenticatedRequest<T>(
    url: string,
    options?: RequestInit,
    cacheKey?: string,
    ttl?: number,
    isAdminRequest: boolean = false
  ): Promise<AuthenticatedApiResponse<T>> {
    const requestKey = this.getRequestKey('makeAuthenticatedRequest', url, RequestType.AUTHENTICATED);
    
    // Delegate to setup method
    const setupResult = await this.setupAuthenticatedRequestOptions<T>(
      url, 
      options || {}, 
      cacheKey, 
      ttl
    );
    
    // Delegate to unified execution
    const result = await this.executeUnifiedRequest<T>(url, setupResult);
    
    // Convert to AuthenticatedApiResponse format
    return result as AuthenticatedApiResponse<T>;
  }

  /**
   * Tenant request method
   */
  protected async makeTenantRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: TenantRequestOptions
  ): Promise<TenantApiResponse<T>> {
    const requestKey = this.getRequestKey('makeTenantRequest', url, RequestType.TENANT);
    
    // Delegate to setup method
    const setupResult = await this.setupTenantRequestOptions<T>(url, options || {}, requestOptions);
    
    // Delegate to unified execution
    const result = await this.executeUnifiedRequest<T>(url, setupResult);
    
    // Convert to TenantApiResponse format
    return result as TenantApiResponse<T>;
  }

  /**
   * Admin request method
   */
  protected async makeAdminRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: AdminRequestOptions
  ): Promise<AdminApiResponse<T>> {
    const requestKey = this.getRequestKey('makeAdminRequest', url, RequestType.ADMIN);
    
    // Delegate to setup method
    const setupResult = await this.setupAdminRequestOptions<T>(url, options || {}, requestOptions);
    
    // Delegate to unified execution
    const result = await this.executeUnifiedRequest<T>(url, setupResult);
    
    // Convert to AdminApiResponse format
    return result as AdminApiResponse<T>;
  }

  /**
   * System request method
   */
  protected async makeSystemRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: SystemRequestOptions
  ): Promise<SystemApiResponse<T>> {
    const requestKey = this.getRequestKey('makeSystemRequest', url, RequestType.SYSTEM);
    
    // Delegate to setup method
    const setupResult = await this.setupSystemRequestOptions<T>(url, options || {}, requestOptions);
    
    // Delegate to unified execution
    const result = await this.executeUnifiedRequest<T>(url, setupResult);
    
    // Convert to SystemApiResponse format
    return result as SystemApiResponse<T>;
  }

  /**
   * External request method
   */
  protected async makeExternalRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: ExternalRequestOptions
  ): Promise<ExternalApiResponse<T>> {
    const requestKey = this.getRequestKey('makeExternalRequest', url, RequestType.EXTERNAL);
    
    // Delegate to setup method
    const setupResult = await this.setupExternalRequestOptions<T>(url, options || {}, requestOptions);
    
    // Delegate to unified execution
    const result = await this.executeUnifiedRequest<T>(url, setupResult);
    
    // Convert to ExternalApiResponse format
    return result as ExternalApiResponse<T>;
  }

  /**
   * Default request method with delegation pattern
   */
  protected async makeDefaultRequest<T>(
    url: string,
    options?: RequestInit,
    cacheKey?: string,
    ttl?: number,
    requestOptions?: RequestOptions
  ): Promise<ApiResult<T>> {
    const requestType = requestOptions?.requestType || this.defaultRequestType;
    const requestTarget = requestOptions?.requestTarget || this.defaultRequestTarget;

    console.log(`[${this.constructor.name}] ----------------------------------------`);
    console.log(`[${this.constructor.name}] start         : ${requestType}`);
    console.log(`[${this.constructor.name}] url           : ${url}`);
    console.log(`[${this.constructor.name}] options       : ${JSON.stringify(options)}`);
    console.log(`[${this.constructor.name}] cacheKey      : ${cacheKey}`);
    console.log(`[${this.constructor.name}] requestOptions: ${JSON.stringify(requestOptions)}`);
    console.log(`[${this.constructor.name}] end           : ${requestTarget}  `);
    
    let setupResult: { options: RequestInit; cacheKey?: string; ttl: number; target: RequestTarget };
    
    // Delegate to appropriate setup method based on request type
    switch (requestType) {
      case RequestType.PUBLIC:
        setupResult = await this.setupPublicRequestOptions<T>(url, options || {}, cacheKey, ttl);
        break;
      case RequestType.AUTHENTICATED:
        setupResult = await this.setupAuthenticatedRequestOptions<T>(url, options || {}, cacheKey, ttl);
        break;
      case RequestType.TENANT:
        const tenantOptions = { cacheKey, ttl, requestTarget } as TenantRequestOptions;
        setupResult = await this.setupTenantRequestOptions<T>(url, options || {}, tenantOptions);
        break;
      case RequestType.ADMIN:
        const adminOptions = { cacheKey, ttl, requestTarget } as AdminRequestOptions;
        setupResult = await this.setupAdminRequestOptions<T>(url, options || {}, adminOptions);
        break;
      case RequestType.SYSTEM:
        const systemOptions = { cacheKey, ttl, requestTarget } as SystemRequestOptions;
        setupResult = await this.setupSystemRequestOptions<T>(url, options || {}, systemOptions);
        break;
      case RequestType.EXTERNAL:
        const externalOptions = { cacheKey, ttl, requestTarget } as ExternalRequestOptions;
        setupResult = await this.setupExternalRequestOptions<T>(url, options || {}, externalOptions);
        break;
      default:
        throw new Error(`Unsupported request type: ${requestType}`);
    }
    
    // Apply target override if provided
    if (requestTarget && requestTarget !== setupResult.target) {
      setupResult.target = requestTarget;
    }
    
    // Delegate to unified execution - single source of truth
    return await this.executeUnifiedRequest<T>(url, setupResult);
  }

  // ====================
  // HOOK METHODS FOR CUSTOMIZATION
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
    return options;
  }

  /**
   * Override hook for subclasses to customize authenticated request behavior
   * Base implementation adds authentication headers
   */
  protected async onAuthenticatedRequest<T>(
    url: string,
    options: RequestInit,
    cacheKey?: string,
    ttl?: number,
    isAdminRequest?: boolean
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
      console.warn('[FlexibleApiSingleton] No auth token available for authenticated request');
    }

    return modifiedOptions;
  }

  /**
   * Override hook for subclasses to customize tenant request behavior
   */
  protected async onTenantRequest<T>(
    url: string,
    options: RequestInit,
    requestOptions?: TenantRequestOptions
  ): Promise<RequestInit> {
    return options;
  }

  /**
   * Override hook for subclasses to customize admin request behavior
   */
  protected async onAdminRequest<T>(
    url: string,
    options: RequestInit,
    requestOptions?: AdminRequestOptions
  ): Promise<RequestInit> {
    return options;
  }

  /**
   * Override hook for subclasses to customize system request behavior
   */
  protected async onSystemRequest<T>(
    url: string,
    options: RequestInit,
    requestOptions?: SystemRequestOptions
  ): Promise<RequestInit> {
    return options;
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

  // ====================
  // UTILITY METHODS
  // ====================

  /**
   * Fetch with cache - delegated to base class caching system
   */
  protected async fetchWithCache(
    url: string,
    options: RequestInit,
    cacheKey?: string,
    ttl?: number,
    requestTarget?: RequestTarget
  ): Promise<Response> {
    // Construct full URL based on requestTarget parameter
    let fullUrl: string;
    
    // Use provided requestTarget or fall back to default
    const target = requestTarget || this.defaultRequestTarget;
    
    if (url.startsWith('http')) {
      // Already absolute URL
      fullUrl = url;
    } else {
      // Build URL based on target
      switch (target) {
        case RequestTarget.API:
          const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
          fullUrl = `${apiUrl}${url}`;
          break;
          
        case RequestTarget.WEB:
          const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 
                       process.env.FRONTEND_URL || 
                       process.env.WEB_URL || 
                       'http://localhost:3000';
          fullUrl = `${webUrl}${url}`;
          break;
          
        case RequestTarget.EXTERNAL:
          // For external requests, use URL as-is
          fullUrl = url;
          break;
          
        default:
          // Fallback to API
          const fallbackUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
          fullUrl = `${fallbackUrl}${url}`;
          break;
      }
    }
    
    // Check cache first ONLY for GET requests (delegated to base class)
    const method = (options.method || 'GET').toUpperCase();
    if (cacheKey && method === 'GET') {
      const cachedResponse = await this.getFromCache<string>(cacheKey);
      if (cachedResponse) {
        // Return cached response as a Response object
        return new Response(cachedResponse, {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Increment API calls counter
    this.apiCalls++;
    
    // Fetch from network
    const response = await fetch(fullUrl, options);
    
    // Auto-invalidate cache for non-GET requests
    if (method !== 'GET' && cacheKey) {
      await this.clearCache(cacheKey);
    }
    
    // Cache successful responses ONLY for GET requests
    if (response.ok && cacheKey && method === 'GET') {
      const responseText = await response.text();
      await this.setCache(cacheKey, responseText, { useAutoUser: true });
      
      // Return new Response from cached text
      return new Response(responseText, {
        status: response.status,
        headers: response.headers
      });
    }
    
    return response;
  }

  // ====================
  // AUTHENTICATION & VALIDATION METHODS
  // ====================

  /**
   * Get authentication token
   */
  protected async getAuthToken(): Promise<string | null> {
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        console.warn('[FlexibleApiSingleton] Cannot access auth token in server-side environment');
        return null;
      }
      
      // Check multiple sources for auth token
      const token = localStorage.getItem('access_token') || 
                   sessionStorage.getItem('access_token') ||
                   document.cookie.split(';').find(c => c.trim().startsWith('access_token='))?.split('=')[1] ||
                   localStorage.getItem('authToken') ||
                   sessionStorage.getItem('authToken') ||
                   document.cookie.split(';').find(c => c.trim().startsWith('authToken='))?.split('=')[1];
      
      if (!token) {
        console.warn('[FlexibleApiSingleton] No auth token found in any storage');
        return null;
      }
      
      // Validate token format (basic JWT validation)
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.warn('[FlexibleApiSingleton] Invalid token format');
        return null;
      }
      
      return token;
    } catch (error) {
      console.error('[FlexibleApiSingleton] Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Get current tenant ID
   * Uses centralized tenant context utility for consistency
   */
  protected async getCurrentTenantId(): Promise<string | null> {
    return clientTenantContextManager.getCurrentTenantId();
  }

  /**
   * Validate admin access
   */
  protected async validateAdminAccess(): Promise<boolean> {
    try {
      const token = await this.getAuthToken();
      if (!token) {
        return false;
      }
      
      // Decode JWT to check admin role
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role === 'admin' || payload.isAdmin === true;
    } catch (error) {
      console.error('[FlexibleApiSingleton] Error validating admin access:', error);
      return false;
    }
  }

  /**
   * Validate system access
   */
  protected async validateSystemAccess(systemKey?: string): Promise<boolean> {
    try {
      // Check system key if provided
      if (systemKey) {
        return systemKey === process.env.SYSTEM_API_KEY || 
               systemKey === localStorage.getItem('systemKey');
      }
      
      // Check if current user has system access
      const token = await this.getAuthToken();
      if (!token) {
        return false;
      }
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role === 'system' || payload.hasSystemAccess === true;
    } catch (error) {
      console.error('[FlexibleApiSingleton] Error validating system access:', error);
      return false;
    }
  }

  // ====================
  // LEGACY COMPATIBILITY METHODS
  // ====================

  /**
   * Legacy method for backward compatibility
   * @deprecated Use makeDefaultRequest instead
   */
  protected async makeApiRequest<T>(
    url: string,
    options?: RequestInit,
    cacheKey?: string,
    ttl?: number
  ): Promise<ApiResult<T>> {
    return this.makeDefaultRequest<T>(url, options, cacheKey, ttl, {
      requestType: this.defaultRequestType,
      requestTarget: this.defaultRequestTarget
    });
  }
}
