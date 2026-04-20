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

import { EnhancedFlexibleApiSingleton, RequestType, RequestTarget, SingletonCacheOptions, PublicRequestOptions, TenantRequestOptions, AuthenticatedRequestOptions, AdminRequestOptions, ExternalRequestOptions, SystemRequestOptions, RequestOptions, ApiResult, AuthenticatedApiResponse, TenantApiResponse, AdminApiResponse, PublicApiResponse, ExternalApiResponse, SystemApiResponse, ApiEnhancedCacheOptions } from './EnhancedFlexibleApiSingleton';
import { clientTenantContextManager } from '@/lib/clientTenantContext';
import { AppContext, CacheIsolation } from '../../utils/contextCacheManager';
import { ContextAwareCacheOptions } from '../../services/contextAwareCacheService';
import { EnhancedCacheOptions } from '@/utils/contextAwareCacheManager';

// Re-export all types for compatibility with existing services
export {
  RequestType,
  RequestTarget
} from './EnhancedFlexibleApiSingleton';

export type {
  SingletonCacheOptions,
  PublicRequestOptions,
  TenantRequestOptions,
  AuthenticatedRequestOptions,
  AdminRequestOptions,
  ExternalRequestOptions,
  SystemRequestOptions,
  RequestOptions,
  ApiResult,
  AuthenticatedApiResponse,
  TenantApiResponse,
  AdminApiResponse,
  PublicApiResponse,
  ExternalApiResponse,
  SystemApiResponse
} from './EnhancedFlexibleApiSingleton';

export type { SingletonMetrics } from './UniversalSingleton';

// Helper functions for safe error handling
export function getErrorMessage(error?: string | { status: number; message: string; code: string }): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object') {
    return error.message;
  }
  return 'Unknown error';
}

export function getErrorStatus(error?: string | { status: number; message: string; code: string }): number | undefined {
  if (error && typeof error === 'object') {
    return error.status;
  }
  return undefined;
}

export function getErrorCode(error?: string | { status: number; message: string; code: string }): string | undefined {
  if (error && typeof error === 'object') {
    return error.code;
  }
  return undefined;
}

// ====================
// FLEXIBLE API SINGLETON
// ====================

export abstract class FlexibleApiSingleton extends EnhancedFlexibleApiSingleton {
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes default
  
  // Default request type for this service (can be overridden)
  protected abstract defaultRequestType: RequestType;
  protected defaultIncludeCredentials?: boolean = true; // Default to include credentials
  protected abstract defaultContext?: AppContext;
  protected abstract defaultIsolation?: CacheIsolation;
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
  }

  /**
   * Detect context and isolation from an enhanced cacheKey
   * Returns null if cacheKey doesn't contain context/isolation pattern
   */
  protected detectContextFromCacheKey(cacheKey: string): { context: AppContext; isolation: CacheIsolation } | null {
    // Enhanced cacheKey format: /path/to/api:context:isolation
    const parts = cacheKey.split(':');
    if (parts.length >= 3) {
      const context = parts[parts.length - 2] as AppContext;
      const isolation = parts[parts.length - 1] as CacheIsolation;
      
      // Validate that these are legitimate context/isolation values
      if (Object.values(AppContext).includes(context) && Object.values(CacheIsolation).includes(isolation)) {
        return { context, isolation };
      }
    }
    return null;
  }

  /**
   * URL-based context detection for fallback when defaults are missing
   * Returns GLOBAL context when no confident match is found (to be ignored by calling logic)
   */
  protected detectContextFromUrl(url: string): { context: AppContext; isolation: CacheIsolation } {
    // Tenant context - very specific patterns
    if (url.includes('/tenants/') || url.includes('/tenant-') || url.includes('/dashboard') || url.includes('/tenants')) {
      return { context: AppContext.TENANT, isolation: CacheIsolation.TENANT };
    }
    
    // Admin context - very specific patterns
    if (url.includes('/admin/') || url.includes('/platform/admin') || url.includes('/system/')) {
      return { context: AppContext.ADMIN, isolation: CacheIsolation.ADMIN };
    }
    
    // Public context - very specific patterns
    if (url.includes('/public/') || url.includes('/platform/public')) {
      return { context: AppContext.PUBLIC, isolation: CacheIsolation.PUBLIC };
    }
    
    // Product context - very specific patterns
    if (url.includes('/products/') || url.includes('/products') || url.includes('/product/') || url.includes('/product') || url.includes('/recommendations/') || url.includes('/featured-products')) {
      return { context: AppContext.PRODUCT, isolation: CacheIsolation.PRODUCT };
    }
    
    // Store context - very specific patterns
    if (url.includes('/store/') || url.includes('/stores/') || url.includes('/tenant/') || url.includes('/storefront')) {
      return { context: AppContext.STORE, isolation: CacheIsolation.STORE };
    }
    
    // Shop context - very specific patterns
    if (url.includes('/shops/') || url.includes('/shop/') || url.includes('/shops/directory') || url.includes('/shops')) {
      return { context: AppContext.SHOP, isolation: CacheIsolation.SHOP };
    }
    
    // Directory context - very specific patterns
    if (url.includes('/directory/') || url.includes('/directory')) {
      return { context: AppContext.DIRECTORY, isolation: CacheIsolation.DIRECTORY };
    }
    
    // System context - very specific patterns
    if (url.includes('/external/') || url.includes('/integrations/')) {
      return { context: AppContext.SYSTEM, isolation: CacheIsolation.SYSTEM };
    }
    
    // Return GLOBAL context to indicate no confident match
    // The calling logic will check for this and ignore it
    return { context: AppContext.GLOBAL, isolation: CacheIsolation.GLOBAL };
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
          // Check for detailed error structure
          if (errorData.error === 'invalid_payload' && errorData.details?.fieldErrors) {
            // Handle validation errors specifically
            const fieldErrors = errorData.details.fieldErrors;
            const fieldNames: Record<string, string> = {
              email: 'Email',
              phone_number: 'Phone number',
              business_name: 'Business name',
              address_line1: 'Address',
              city: 'City',
              state: 'State',
              postal_code: 'Postal code',
              country_code: 'Country',
              website: 'Website',
              contact_person: 'Contact person',
            };
            
            const messages: string[] = [];
            for (const [field, errors] of Object.entries(fieldErrors)) {
              const fieldName = fieldNames[field] || field;
              const errorList = errors as string[];
              messages.push(`${fieldName}: ${errorList.join(', ')}`);
            }
            
            errorMessage = messages.join(' | ') || 'Please check your input';
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
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
          data: null as T,
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
        data: null as T,
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
    ttl?: number,
    ssrAuth?: { auth0Email?: string; auth0Id?: string }
  ): Promise<{ options: RequestInit; cacheKey?: string; ttl: number; target: RequestTarget }> {
    const modifiedOptions = await this.onAuthenticatedRequest<T>(url, options, cacheKey, ttl, false, ssrAuth);
    
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
    // Don't set Content-Type for GET requests - they don't have a body
    const isGetRequest = !modifiedOptions.method || modifiedOptions.method === 'GET';
    
    return {
      options: {
        ...modifiedOptions,
        // For external requests, only add headers if absolutely necessary
        // Many third-party APIs (like Google Maps) don't allow Content-Type in CORS
        headers: isFormData ? {
          ...modifiedOptions.headers,
        } : isGetRequest ? {
          // Don't add any default headers for GET requests to external APIs
          ...modifiedOptions.headers,
        } : {
          // Only add Content-Type for POST/PUT/PATCH with JSON body
          ...(modifiedOptions.body ? { 'Content-Type': 'application/json' } : {}),
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
   * Public request method with context awareness
   * Delegates to enhanced version for context-aware caching
   */
  protected async makePublicRequest<T>(
    url: string,
    options?: RequestInit,
    cacheKey?: string,
    ttl?: number,
    requestOptions?: PublicRequestOptions & EnhancedCacheOptions
  ): Promise<PublicApiResponse<T>> {
    // 🎯 ENHANCED: Check if we should delegate to enhanced version
    // If context/isolation are not explicitly provided, use enhanced defaults
    if (!requestOptions || (!('context' in requestOptions) && !('isolation' in requestOptions))) {
      // Delegate to enhanced version with base class defaults
      const enhancedResult = await this.makeEnhancedPublicRequest<T>(
        url,
        options,
        cacheKey,
        {
          ttl: ttl || requestOptions?.ttl || this.cacheTTL,
          // Use base class defaults - these will be applied in makeEnhancedPublicRequest
        }
      );
      return enhancedResult as PublicApiResponse<T>;
    }

    // Legacy path for explicit context/isolation
    const requestKey = this.getRequestKey('makePublicRequest', url, RequestType.PUBLIC);
    
    // 🎯 STRATEGY 1: Generate enhanced cacheKey if context data is present
    let finalCacheKey = requestOptions?.cacheKey;
    if (requestOptions && ('context' in requestOptions || 'isolation' in requestOptions)) {
      const context = (requestOptions as any).context;
      const isolation = (requestOptions as any).isolation;
      const tenantId = (requestOptions as any).tenantId;
      const userId = (requestOptions as any).userId;
      
      finalCacheKey = this.generateCacheKey(
        requestOptions?.cacheKey || url,
        context,
        isolation,
        tenantId,
        userId
      );
      
    console.log(`[${this.constructor.name}] ----------------------------------------`);
    console.log(`[${this.constructor.name}] start           : makePublicRequest`);
    console.log(`[${this.constructor.name}] url             : ${url}`);
    console.log(`[${this.constructor.name}] options         : ${JSON.stringify(options)}`);
    console.log(`[${this.constructor.name}] cacheKey        : ${cacheKey}`);
    console.log(`[${this.constructor.name}] requestOptions 2: ${JSON.stringify(requestOptions)}`);
    console.log(`[${this.constructor.name}] end             : makePublicRequest  `);      
    console.log(`[${this.constructor.name}] 🎯 makePublicRequest Enhanced cacheKey generated: ${finalCacheKey}`);


    }
    
    // Delegate to setup method
    const setupResult = await this.setupPublicRequestOptions<T>(
      url, 
      options || {}, 
      finalCacheKey, 
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
   * Authenticated request method with context awareness
   * Delegates to enhanced version for context-aware caching
   */
  protected async makeAuthenticatedRequest<T>(
    url: string,
    options?: RequestInit,
    cacheKey?: string,
    ttl?: number,
    requestOptions?: AuthenticatedRequestOptions & EnhancedCacheOptions
  ): Promise<AuthenticatedApiResponse<T>> {
    // 🎯 ENHANCED: Check if we should delegate to enhanced version
    // If context/isolation are not explicitly provided, use enhanced defaults
    if (!requestOptions || (!('context' in requestOptions) && !('isolation' in requestOptions))) {
      // Delegate to enhanced version with base class defaults
      const enhancedResult = await this.makeEnhancedAuthenticatedRequest<T>(
        url,
        options,
        cacheKey,
        {
          ttl: ttl || this.cacheTTL,
          // Use base class defaults - these will be applied in makeEnhancedAuthenticatedRequest
        }
      );
      return enhancedResult as AuthenticatedApiResponse<T>;
    }

    // 🎯 STRATEGY 1: Generate enhanced cacheKey if context data is present
    let finalCacheKey = requestOptions?.cacheKey || cacheKey;
    if (requestOptions && ('context' in requestOptions || 'isolation' in requestOptions)) {
      const context = requestOptions.context;
      const isolation = requestOptions.isolation;
      const userId = requestOptions.userId;
      
      finalCacheKey = this.generateCacheKey(
        requestOptions?.cacheKey || cacheKey || url,
        context,
        isolation,
        undefined,  // tenantId
        userId
      );
      
    console.log(`[${this.constructor.name}] ----------------------------------------`);
    console.log(`[${this.constructor.name}] start           : makeAuthenticatedRequest`);
    console.log(`[${this.constructor.name}] url             : ${url}`);
    console.log(`[${this.constructor.name}] options         : ${JSON.stringify(options)}`);
    console.log(`[${this.constructor.name}] cacheKey        : ${cacheKey}`);
    console.log(`[${this.constructor.name}] requestOptions 3: ${JSON.stringify(requestOptions)}`);
    console.log(`[${this.constructor.name}] end             : makeAuthenticatedRequest  `);      
    console.log(`[${this.constructor.name}] 🎯 makeAuthenticatedRequest Enhanced cacheKey generated: ${finalCacheKey}`);

    }
    
    // Delegate to setup method
    const setupResult = await this.setupAuthenticatedRequestOptions<T>(
      url, 
      options || {}, 
      finalCacheKey, 
      requestOptions?.ttl || ttl
    );
    
    // Handle requireAuth if specified
    if (requestOptions?.requireAuth) {
      // Add auth headers or validation as needed
      // TODO: Implement getCurrentAuthToken() in concrete classes
      // console.log(`[${this.constructor.name}] 🔐 Auth required for request`);
    }
    
    // Delegate to unified execution
    const result = await this.executeUnifiedRequest<T>(url, setupResult);
    
    // Convert to AuthenticatedApiResponse format
    return result as AuthenticatedApiResponse<T>;
  }

  /**
   * Tenant request method with context awareness
   * Delegates to enhanced version for context-aware caching
   */
  protected async makeTenantRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: TenantRequestOptions & ApiEnhancedCacheOptions
  ): Promise<TenantApiResponse<T>> {
    // 🎯 ENHANCED: Check if we should delegate to enhanced version
    // If context/isolation are not explicitly provided, use enhanced defaults
    if (!requestOptions || (!('context' in requestOptions) && !('isolation' in requestOptions))) {
      // Delegate to enhanced version with base class defaults
      const enhancedResult = await this.makeEnhancedTenantRequest<T>(
        url,
        options,
        requestOptions?.cacheKey,
        {
          ttl: requestOptions?.ttl || this.cacheTTL,          
          tenantId: requestOptions?.tenantId || '',
          requestTarget: requestOptions?.requestTarget
        }
      );
      return enhancedResult as TenantApiResponse<T>;
    }

    // 🎯 STRATEGY 1: Generate enhanced cacheKey if context data is present
    let finalCacheKey = requestOptions?.cacheKey;
    if (requestOptions && ('context' in requestOptions || 'isolation' in requestOptions)) {
      const context = (requestOptions as any).context;
      const isolation = (requestOptions as any).isolation;
      const tenantId = (requestOptions as any).tenantId;
      const userId = (requestOptions as any).userId;
      
      finalCacheKey = this.generateCacheKey(
        requestOptions?.cacheKey || url,
        context,
        isolation,
        tenantId,
        userId
      );

      
    console.log(`[${this.constructor.name}] ----------------------------------------`);
    console.log(`[${this.constructor.name}] start           : makeTenantRequest`);
    console.log(`[${this.constructor.name}] url             : ${url}`);
    console.log(`[${this.constructor.name}] options         : ${JSON.stringify(options)}`);
    console.log(`[${this.constructor.name}] requestOptions 4: ${JSON.stringify(requestOptions)}`);
    console.log(`[${this.constructor.name}] end             : makeTenantRequest  `);            
    console.log(`[${this.constructor.name}] 🎯 makeTenantRequest Enhanced cacheKey generated: ${finalCacheKey}`);

    }
    
    // Delegate to setup method
    const setupResult = await this.setupTenantRequestOptions<T>(
      url, 
      options || {}, 
      {
        tenantId: requestOptions?.tenantId || '',
        cacheKey: finalCacheKey,
        ttl: requestOptions?.ttl,
        requestTarget: requestOptions?.requestTarget
      }
    );
    
    // Override target if provided in requestOptions
    if (requestOptions?.requestTarget && requestOptions.requestTarget !== setupResult.target) {
      setupResult.target = requestOptions.requestTarget;
    }
    
    // Delegate to unified execution
    const result = await this.executeUnifiedRequest<T>(url, setupResult);
    
    // Convert to TenantApiResponse format
    return result as TenantApiResponse<T>;
  }

  /**
   * Admin request method with context awareness
   * Delegates to enhanced version for context-aware caching
   */
  protected async makeAdminRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: AdminRequestOptions & ApiEnhancedCacheOptions
  ): Promise<AdminApiResponse<T>> {
    // 🎯 ENHANCED: Check if we should delegate to enhanced version
    // If context/isolation are not explicitly provided, use enhanced defaults
    if (!requestOptions || (!('context' in requestOptions) && !('isolation' in requestOptions))) {
      // Delegate to enhanced version with base class defaults
      const enhancedResult = await this.makeEnhancedAdminRequest<T>(
        url,
        options,
        requestOptions?.cacheKey,
        {
          cacheKey: requestOptions?.cacheKey,
          ttl: requestOptions?.ttl || this.cacheTTL,
          requestTarget: requestOptions?.requestTarget
        }
      );
      return enhancedResult as AdminApiResponse<T>;
    }

    // 🎯 STRATEGY 1: Generate enhanced cacheKey if context data is present
    let finalCacheKey = requestOptions?.cacheKey;
    if (requestOptions && ('context' in requestOptions || 'isolation' in requestOptions)) {
      const context = (requestOptions as any).context;
      const isolation = (requestOptions as any).isolation;
      const tenantId = (requestOptions as any).tenantId;
      const userId = (requestOptions as any).userId;
      
      finalCacheKey = this.generateCacheKey(
        requestOptions?.cacheKey || url,
        context,
        isolation,
        tenantId,
        userId
      );

      
      console.log(`[${this.constructor.name}] ----------------------------------------`);
      console.log(`[${this.constructor.name}] start           : makeAdminRequest`);
      console.log(`[${this.constructor.name}] url             : ${url}`);
      console.log(`[${this.constructor.name}] options         : ${JSON.stringify(options)}`);
      console.log(`[${this.constructor.name}] requestOptions 5: ${JSON.stringify(requestOptions)}`);
      console.log(`[${this.constructor.name}] end             : makeAdminRequest  `);      
      console.log(`[${this.constructor.name}] 🎯 makeAdminRequest Enhanced cacheKey generated: ${finalCacheKey}`);
    

    }
    
    // Delegate to setup method
    const setupResult = await this.setupAdminRequestOptions<T>(
      url, 
      options || {}, 
      {
        cacheKey: finalCacheKey,
        ttl: requestOptions?.ttl,
        requestTarget: requestOptions?.requestTarget,
        requireAdmin: requestOptions?.requireAdmin,
        requireAdminContext: requestOptions?.requireAdminContext,
        bypassCache: requestOptions?.bypassCache
      }
    );
    
    // Override target if provided in requestOptions
    if (requestOptions?.requestTarget && requestOptions.requestTarget !== setupResult.target) {
      setupResult.target = requestOptions.requestTarget;
    }
    
    // Delegate to unified execution
    const result = await this.executeUnifiedRequest<T>(url, setupResult);
    
    // Convert to AdminApiResponse format
    return result as AdminApiResponse<T>;
  }

  /**
   * System request method with context awareness
   * Delegates to enhanced default version for context-aware caching
   */
  protected async makeSystemRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: SystemRequestOptions & EnhancedCacheOptions
  ): Promise<SystemApiResponse<T>> {
    // 🎯 ENHANCED: Always delegate to enhanced version for context-aware caching
    const enhancedResult = await this.makeEnhancedDefaultRequest<T>(
      url,
      options,
      requestOptions?.cacheKey,
      requestOptions?.ttl,
      {
        // Use base class defaults - these will be applied in makeEnhancedDefaultRequest
      }
    );
    return enhancedResult as SystemApiResponse<T>;
  }

  /**
   * External request method with context awareness
   * Delegates to enhanced version for context-aware caching
   */
  protected async makeExternalRequest<T>(
    url: string,
    options?: RequestInit,
    requestOptions?: ExternalRequestOptions & EnhancedCacheOptions
  ): Promise<ExternalApiResponse<T>> {
    // 🎯 ENHANCED: Check if we should delegate to enhanced version
    // If context/isolation are not explicitly provided, use enhanced defaults
    if (!requestOptions || (!('context' in requestOptions) && !('isolation' in requestOptions))) {
      // Delegate to enhanced version with base class defaults
      const enhancedResult = await this.makeEnhancedExternalRequest<T>(
        url,
        options,
        {
          cacheKey: requestOptions?.cacheKey,
          ttl: requestOptions?.ttl || this.cacheTTL,
          requestTarget: requestOptions?.requestTarget
        }
      );
      return enhancedResult as ExternalApiResponse<T>;
    }

    // 🎯 STRATEGY 1: Generate enhanced cacheKey if context data is present
    let finalCacheKey = requestOptions?.cacheKey;
    if (requestOptions && ('context' in requestOptions || 'isolation' in requestOptions)) {
      const context = (requestOptions as any).context;
      const isolation = (requestOptions as any).isolation;
      const tenantId = (requestOptions as any).tenantId;
      const userId = (requestOptions as any).userId;
      
      finalCacheKey = this.generateCacheKey(
        requestOptions?.cacheKey || url,
        context,
        isolation,
        tenantId,
        userId
      );
      
      // console.log(`[${this.constructor.name}] 🎯 makeExternalRequest Enhanced cacheKey generated: ${finalCacheKey}`);
    }
    
    // Delegate to setup method
    const setupResult = await this.setupExternalRequestOptions<T>(
      url, 
      options || {}, 
      {
        cacheKey: finalCacheKey,
        ttl: requestOptions?.ttl,
        timeout: requestOptions?.timeout,
        requestTarget: requestOptions?.requestTarget,
        headers: requestOptions?.headers
      }
    );
    
    // Override target if provided in requestOptions
    if (requestOptions?.requestTarget && requestOptions.requestTarget !== setupResult.target) {
      setupResult.target = requestOptions.requestTarget;
    }
    
    // Delegate to unified execution
    const result = await this.executeUnifiedRequest<T>(url, setupResult);
    
    // Convert to ExternalApiResponse format
    return result as ExternalApiResponse<T>;
  }

  /**
   * Default request method with context awareness and delegation pattern
   * Now automatically uses base class defaults for context and isolation
   * Delegates to makeEnhancedDefaultRequest for enhanced caching capabilities
   */
  protected async makeDefaultRequest<T>(
    url: string,
    options?: RequestInit,
    cacheKey?: string,
    ttl?: number,
    requestOptions?: RequestOptions & EnhancedCacheOptions
  ): Promise<ApiResult<T>> {
    const requestType = requestOptions?.requestType || this.defaultRequestType;
    const requestTarget = requestOptions?.requestTarget || this.defaultRequestTarget;
    // const requestContext = requestOptions?.context || this.defaultContext;
    // const requestIsolation = requestOptions?.isolation || this.defaultIsolation;
    let requestContext = requestOptions?.context ;
    let requestIsolation = requestOptions?.isolation ;
    // console.log(`[FlexibleApiSingleton] makeDefaultRequest - requestType: ${requestType}, requestTarget: ${requestTarget}, requestContext: ${requestContext}, requestIsolation: ${requestIsolation}`);


    // 🎯 ENHANCED: Check if we should delegate to enhanced version
    // If context/isolation are not explicitly provided, use enhanced defaults
    if (!requestOptions || (!(requestContext) && !(requestIsolation))) {
      // Delegate to enhanced version with base class defaults
      // console.log(`[FlexibleApiSingleton] makeDefaultRequest - delegating to enhanced version, url: ${url}, cacheKey: ${cacheKey}`);
      return this.makeEnhancedDefaultRequest<T>(
        url,
        options,
        cacheKey,
        ttl
      );
    } else {
      // console.log(`[FlexibleApiSingleton] makeDefaultRequest - using standard caching: ${JSON.stringify(requestOptions)}`);
    }
     // 🎯 STRATEGY 1: Generate enhanced cacheKey if context data is present
     if (!requestContext){
      requestContext = requestOptions?.context || this.defaultContext;
     }
     if (!requestIsolation){
         requestIsolation = requestOptions?.isolation || this.defaultIsolation;
     }
    //  console.log(`[FlexibleApiSingleton] makeDefaultRequest - context: ${requestContext}, isolation: ${requestIsolation}`);

    let finalCacheKey = cacheKey;
    if (requestOptions && ('context' in requestOptions || 'isolation' in requestOptions)) {
      const context = requestContext;
      const isolation = requestIsolation;
      const tenantId = (requestOptions as any).tenantId;
      const userId = (requestOptions as any).userId;
      
      finalCacheKey = this.generateCacheKey(
        cacheKey || url,
        context,
        isolation,
        tenantId,
        userId
      );
      

    // console.log(`[${this.constructor.name}] ----------------------------------------`);
    // console.log(`[${this.constructor.name}] start           : ${requestType}`);
    // console.log(`[${this.constructor.name}] url             : ${url}`);
    // console.log(`[${this.constructor.name}] requestOptions 1: ${JSON.stringify(options)}`);
    // console.log(`[${this.constructor.name}] cacheKey        : ${cacheKey}`);
    // console.log(`[${this.constructor.name}] cacheOptions    : ${JSON.stringify(requestOptions)}`);
    // console.log(`[${this.constructor.name}] end             : ${requestTarget}  `);   
    // console.log(`[${this.constructor.name}] 🎯 Enhanced cacheKey generated: ${finalCacheKey}`);


    }
    
    let setupResult: { options: RequestInit; cacheKey?: string; ttl: number; target: RequestTarget };
    
    // Delegate to appropriate setup method based on request type
    switch (requestType) {
      case RequestType.PUBLIC:
        setupResult = await this.setupPublicRequestOptions<T>(url, options || {}, finalCacheKey, ttl);
        break;
      case RequestType.AUTHENTICATED:
        setupResult = await this.setupAuthenticatedRequestOptions<T>(url, options || {}, finalCacheKey, ttl, requestOptions?.ssrAuth);
        break;
      case RequestType.TENANT:
        const tenantOptions = { cacheKey: finalCacheKey, ttl, requestTarget } as TenantRequestOptions;
        setupResult = await this.setupTenantRequestOptions<T>(url, options || {}, tenantOptions);
        break;
      case RequestType.ADMIN:
        const adminOptions = { cacheKey: finalCacheKey, ttl, requestTarget } as AdminRequestOptions;
        setupResult = await this.setupAdminRequestOptions<T>(url, options || {}, adminOptions);
        break;
      case RequestType.SYSTEM:
        const systemOptions = { cacheKey: finalCacheKey, ttl, requestTarget } as SystemRequestOptions;
        setupResult = await this.setupSystemRequestOptions<T>(url, options || {}, systemOptions);
        break;
      case RequestType.EXTERNAL:
        const externalOptions = { cacheKey: finalCacheKey, ttl, requestTarget } as ExternalRequestOptions;
        setupResult = await this.setupExternalRequestOptions<T>(url, options || {}, externalOptions);
        break;
      default:
        throw new Error(`Unsupported request type: ${requestType}`);
    }
    
    // Apply target override if provided
    if (requestTarget && requestTarget !== setupResult.target) {
      setupResult.target = requestTarget;
    }
    

    // console.log(`[${this.constructor.name}] 🎯 Enhanced setupResult generated: ${JSON.stringify(setupResult)}`);

    
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
   * Get Auth0 access token from session storage
   */
  protected async getAccessToken(): Promise<string | null> {
    if (typeof window === 'undefined') {
      return null;
    }
    
    try {
      // Try to get from sessionStorage (Auth0 stores it there)
      const token = sessionStorage.getItem('auth0_token');
      if (token) return token;
      
      // Try to get from localStorage
      const localToken = localStorage.getItem('auth0_token');
      if (localToken) return localToken;
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get Auth0 user email from cookies (set by Auth0 callback)
   */
  protected getAuth0Email(): string | null {
    if (typeof document === 'undefined') return null;
    
    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'auth0_email' && value) {
          return decodeURIComponent(value);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get Auth0 user ID from cookies (set by Auth0 callback)
   */
  protected getAuth0Id(): string | null {
    if (typeof document === 'undefined') return null;
    
    try {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'auth0_id' && value) {
          return decodeURIComponent(value);
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Override hook for subclasses to customize authenticated request behavior
   * Auth0 session is handled via HTTP-only cookies (credentials: 'include' in fetchWithCache)
   * Also add x-auth0-id and x-auth0-email headers for API to identify user
   * For SSR, ssrAuth can be passed explicitly to add auth headers
   */
  protected async onAuthenticatedRequest<T>(
    url: string,
    options: RequestInit,
    cacheKey?: string,
    ttl?: number,
    isAdminRequest?: boolean,
    ssrAuth?: { auth0Email?: string; auth0Id?: string }
  ): Promise<RequestInit> {
    // Add x-auth0-id and x-auth0-email headers for API to identify user
    // For client-side: read from document.cookie
    // For SSR: use ssrAuth parameter
    const auth0Id = ssrAuth?.auth0Id || this.getAuth0Id();
    const email = ssrAuth?.auth0Email || this.getAuth0Email();
    
      // console.log('[FlexibleApiSingleton] Making authenticated request to:', url);
    
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    
    if (auth0Id) {
      headers['x-auth0-id'] = auth0Id;
    }
    if (email) {
      headers['x-auth0-email'] = email;
    }
    
    return {
      ...options,
      headers,
    };
  }

  /**
   * Override hook for subclasses to customize tenant request behavior
   */
  protected async onTenantRequest<T>(
    url: string,
    options: RequestInit,
    requestOptions?: TenantRequestOptions
  ): Promise<RequestInit> {
    // Add x-auth0-id and x-auth0-email headers for API to identify user
    const auth0Id = this.getAuth0Id();
    const email = this.getAuth0Email();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    
    if (auth0Id) {
      headers['x-auth0-id'] = auth0Id;
    }
    if (email) {
      headers['x-auth0-email'] = email;
    }
    
    return {
      ...options,
      headers,
    };
  }

  /**
   * Override hook for subclasses to customize admin request behavior
   */
  protected async onAdminRequest<T>(
    url: string,
    options: RequestInit,
    requestOptions?: AdminRequestOptions
  ): Promise<RequestInit> {
    // Add x-auth0-id and x-auth0-email headers for API to identify user
    const auth0Id = this.getAuth0Id();
    const email = this.getAuth0Email();
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    
    if (auth0Id) {
      headers['x-auth0-id'] = auth0Id;
    }
    if (email) {
      headers['x-auth0-email'] = email;
    }
    
    return {
      ...options,
      headers,
    };
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
    // Add external-specific options
    // Note: Don't set User-Agent - it's a forbidden header in browser CORS requests
    const externalOptions = {
      ...options,
      headers: {
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
   * Get constructed request URL without making the request
   * Uses same URL construction logic as fetchWithCache for consistency
   */
  protected getRequestUrl(
    url: string,
    requestTarget?: RequestTarget
  ): string {
    // Use provided requestTarget or fall back to default
    const target = requestTarget || this.defaultRequestTarget;

    if (url.startsWith('http')) {
      // Already absolute URL
      return url;
    }

    // Build URL based on target
    switch (target) {
      case RequestTarget.API:
        const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        return `${apiUrl}${url}`;

      case RequestTarget.WEB:
        const webUrl = process.env.NEXT_PUBLIC_WEB_URL ||
                     process.env.FRONTEND_URL ||
                     process.env.WEB_URL ||
                     'http://localhost:3000';
        return `${webUrl}${url}`;

      case RequestTarget.EXTERNAL:
        // For external requests, use URL as-is
        return url;

      default:
        // Fallback to API
        const fallbackUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        return `${fallbackUrl}${url}`;
    }
  }

  /**
   * Send data using navigator.sendBeacon API for reliable delivery
   * Useful for tracking data on page unload or other fire-and-forget scenarios
   * Uses platform-aligned URL construction
   */
  protected sendBeacon(
    url: string,
    data: any,
    requestTarget?: RequestTarget
  ): boolean {
    if (typeof window === 'undefined' || !navigator.sendBeacon) {
      console.warn(`[${this.constructor.name}] Beacon API not available, skipping beacon send`);
      return false;
    }

    const fullUrl = this.getRequestUrl(url, requestTarget);

    try {
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      const success = navigator.sendBeacon(fullUrl, blob);

      if (!success) {
        console.warn(`[${this.constructor.name}] Beacon send failed to ${fullUrl}`);
      }

      return success;
    } catch (error) {
      console.warn(`[${this.constructor.name}] Beacon send error:`, error);
      return false;
    }
  }
  protected async fetchWithCache(
    url: string,
    options: RequestInit,
    cacheKey?: string,
    ttl?: number,
    requestTarget?: RequestTarget
  ): Promise<Response> {
    // Construct full URL using centralized method
    const fullUrl = this.getRequestUrl(url, requestTarget);

    // console.log(`[${this.constructor.name}] fullUrl: ${fullUrl}`);
    // console.log(`[${this.constructor.name}] options: ${JSON.stringify(options)}`);
    // console.log(`[${this.constructor.name}] cacheKey: ${cacheKey}`);
    // console.log(`[${this.constructor.name}] url: ${url}`);
    
    // Check cache first using context-aware caching with correct priority hierarchy
    const method = (options.method || 'GET').toUpperCase();
    
    // console.log(`[${this.constructor.name}] method: ${method}`);
    
    // 🚀 OPTIMIZATION 1: Check if cacheKey is already enhanced (has context:isolation)
    // This happens for ALL requests to extract context for potential cache invalidation
    let context = this.defaultContext;
    let isolation = this.defaultIsolation;
    let skipContextDetection = false;
    
    if (cacheKey && cacheKey.includes(':')) {
      const detectedFromKey = this.detectContextFromCacheKey(cacheKey);
      if (detectedFromKey) {
        // CacheKey already has context and isolation - use them directly
        context = detectedFromKey.context;
        isolation = detectedFromKey.isolation;
        skipContextDetection = true;
        // console.log(`[${this.constructor.name}] 🎯 Using enhanced cacheKey - context: ${context}, isolation: ${isolation}`);
      }
    }
    
    // 🚀 OPTIMIZATION 2: Skip context detection if already determined from cacheKey
    if (!skipContextDetection && cacheKey) {
      // Priority: Explicit defaults → URL detection → Generic fallback
      // Only use URL detection if no defaults are set
      if (!context && !isolation) {
        const urlDetected = this.detectContextFromUrl(url);
        // Only use URL detection if it's not GLOBAL (our fallback indicator)
        if (urlDetected.context !== AppContext.GLOBAL && urlDetected.isolation !== CacheIsolation.GLOBAL) {
          context = urlDetected.context;
          isolation = urlDetected.isolation;
        }
      }
    }
    
    // 🚀 OPTIMIZATION 3: Check cache as soon as we have the enhanced cacheKey (GET requests only)
    if (cacheKey && method === 'GET') {
      if (context || isolation) {
        // Use context-aware caching
        const cacheOptions: ContextAwareCacheOptions = {
          context: context as any,
          isolation: isolation as any,
          tenantId: undefined,
          userId: undefined
        };
        const cachedResponse = await this.getContextAwareCache<string>(cacheKey, cacheOptions);
        
            // console.log("---------------------------------------------------------------------------------");
            // console.log(`[${this.constructor.name}] 🎯 Cache HIT (context-aware) for key: ${cacheKey}`);
            // console.log(`[${this.constructor.name}] 🎯 Cache HIT (context-aware) response: ${cachedResponse}`);          
            // console.log("---------------------------------------------------------------------------------");

        if (cachedResponse && typeof cachedResponse === 'string' && cachedResponse.trim() !== '' && cachedResponse !== 'undefined') {
          // Validate that cached response is valid JSON before returning
          try {
            JSON.parse(cachedResponse); // Validate JSON
            
            // console.log("---------------------------------------------------------------------------------");
            // console.log(`[${this.constructor.name}] 🎯 Cache HIT (context-aware) for key: ${cacheKey}`);
            // console.log(`[${this.constructor.name}] 🎯 Cache HIT (context-aware) response: ${cachedResponse}`);          
            // console.log("---------------------------------------------------------------------------------");
            // Return cached response as a Response object
            return new Response(cachedResponse, {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          } catch (jsonError) {
            console.warn(`[${this.constructor.name}] Invalid JSON in cache for key: ${cacheKey}, fetching fresh:`, jsonError);
            // Continue to fetch fresh data
          }
        }
      } else {
        // Fallback to generic caching
        const cachedResponse = await this.getFromCache<string>(cacheKey);
        if (cachedResponse && typeof cachedResponse === 'string' && cachedResponse.trim() !== '' && cachedResponse !== 'undefined') {
          // Validate that cached response is valid JSON before returning
          try {
            JSON.parse(cachedResponse); // Validate JSON
            
            // console.log("---------------------------------------------------------------------------------");
            // console.log(`[${this.constructor.name}] 🎯 Cache HIT (generic) for key: ${cacheKey}`);
            // console.log(`[${this.constructor.name}] 🎯 Cache HIT (generic) response: ${cachedResponse}`);          
            // console.log("---------------------------------------------------------------------------------");
            // console.log(`[${this.constructor.name}] 🎯 Cache HIT (generic) for key: ${cacheKey}`);
            // Return cached response as a Response object
            return new Response(cachedResponse, {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          } catch (jsonError) {
            console.warn(`[${this.constructor.name}] Invalid JSON in generic cache for key: ${cacheKey}, fetching fresh:`, jsonError);
            // Continue to fetch fresh data
          }
        }
      }
      
      // console.log(`[${this.constructor.name}] 🎯 Cache MISS for key: ${cacheKey}`);
    }
    
    // Increment API calls counter
    this.apiCalls++;
    
    // Fetch from network - include credentials for Auth0 HTTP-only cookies
    
    // console.log(`[${this.constructor.name}] about to fetch from: ${fullUrl}`);
    
    // console.log(`[${this.constructor.name}] options: ${JSON.stringify(options)}`);
    
    let response: Response;
    try {
      response = await fetch(fullUrl, {
        ...options,
        credentials: this.defaultIncludeCredentials !== false ? 'include' : 'omit', // Use service default
      });
    } catch (fetchError: any) {
      // Handle timeout/abort errors gracefully - log and return error response
      if (fetchError?.name === 'TimeoutError' || fetchError?.name === 'AbortError') {
        console.log(`[${this.constructor.name}] Request timed out or aborted for: ${fullUrl}`);
        // Return a 504 Gateway Timeout response - callers will handle !response.ok
        return new Response(JSON.stringify({ error: 'timeout', message: fetchError.message || 'Request timed out' }), {
          status: 504,
          statusText: 'Gateway Timeout',
          headers: { 'Content-Type': 'application/json' }
        });
      }
      // Re-throw other errors to be handled by callers
      throw fetchError;
    }
    
    // console.log(`[${this.constructor.name}] response: ${JSON.stringify(response)}`);
    // console.log(`[${this.constructor.name}] response status: ${response.status}`);
    
        
    // Auto-invalidate cache for non-GET requests (with login exception)
    if (method !== 'GET' && cacheKey) {
      // Skip cache invalidation for login endpoints (they use ttl: 0 and don't need cache management)
      if (url.includes('/api/auth/login')) {
        // console.log(`[${this.constructor.name}] Skipping cache invalidation for login endpoint`);
      } else {
        // 🚀 OPTIMIZATION 4: Use already determined context/isolation for cache invalidation
        if (context || isolation) {
          await this.invalidateCacheWithContext(cacheKey, context, isolation);
        } else {
          // Fallback to generic cache invalidation
          await this.clearCache(cacheKey);
        }
      }
    }
    
    // Cache successful responses ONLY for GET requests
    if (response.ok && cacheKey && method === 'GET') {
      const responseText = await response.text();
      
      // 🚀 OPTIMIZATION 5: Reuse already determined context/isolation for cache setting
      if (context || isolation) {
        // Use context-aware caching
        const cacheOptions: ContextAwareCacheOptions = {
          context: context as any,
          isolation: isolation as any,
          tenantId: undefined,
          userId: undefined,
          ttl: ttl || this.cacheTTL
        };
        
        // console.log(`[${this.constructor.name}] Setting context-aware cache for key: ${cacheKey}`);
        // console.log(`[${this.constructor.name}] Cache options: ${JSON.stringify(cacheOptions)}`);
        // console.log(`[${this.constructor.name}] Response text: ${responseText}`);
        await this.setContextAwareCache(cacheKey, responseText, cacheOptions);
      } else {
        // Fallback to generic caching
        // console.log(`[${this.constructor.name}] Setting generic cache for key: ${cacheKey}`);
        await this.setCache(cacheKey, responseText, { useAutoUser: true });
      }
      
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
   * Get current tenant ID
   * Uses centralized tenant context utility for consistency
   */
  protected async getCurrentTenantId(): Promise<string | null> {
    return clientTenantContextManager.getCurrentTenantId();
  }

  /**
   * Refresh materialized view(s) via API
   * 
   * @param views - Array of view names or single view name
   * @param all - Refresh all known views
   * @returns Promise with refresh results
   * 
   * Available views: mv_global_discovery, mv_category_discovery, mv_shop_discovery,
   * mv_trending_scores, directory_category_products, directory_category_listings,
   * directory_category_stats, directory_gbp_listings, directory_gbp_stats, storefront_products_mv
   */
  protected async refreshMaterializedView(
    views?: string | string[],
    all?: boolean
  ): Promise<{ success: boolean; refreshed: number; total: number; results: any[] }> {
    try {
      const viewArray = typeof views === 'string' ? [views] : views;
      
      const result = await this.makeDefaultRequest<{ refreshed: number; total: number; results: any[] }>(
        '/api/cache/refresh-mv',
        {
          method: 'POST',
          body: JSON.stringify({ views: viewArray, all }),
          headers: { 'Content-Type': 'application/json' }
        },
        undefined, // no cache
        0, // no TTL - immediate request
        { requestType: RequestType.SYSTEM, requestTarget: RequestTarget.API }
      );

      if (result.success && result.data) {
        console.log(`[${this.constructor.name}] MV refresh successful: ${result.data.refreshed}/${result.data.total} views`);
        return { success: true, ...result.data };
      } else {
        console.warn(`[${this.constructor.name}] MV refresh failed:`, result.error);
        return { success: false, refreshed: 0, total: viewArray?.length || 0, results: [] };
      }
    } catch (error) {
      console.error(`[${this.constructor.name}] MV refresh error:`, error);
      return { success: false, refreshed: 0, total: 0, results: [] };
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
