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

import { UniversalSingleton, SingletonCacheOptions, ApiResult } from './UniversalSingleton';

export type { SingletonCacheOptions, ApiResult } from './UniversalSingleton';

// ====================
// REQUEST TYPE ENUMS
// ====================

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
  EXTERNAL ='external'
}

export interface TenantRequestOptions {
  requireTenantContext?: boolean;
  validateTenantAccess?: boolean;
  tenantId?: string;
  bypassCache?: boolean;
}

export interface AdminRequestOptions {
  requireAdminContext?: boolean;
  validateAdminAccess?: boolean;
  bypassCache?: boolean;
}

export interface SystemRequestOptions {
  requireSystemContext?: boolean;
  validateSystemAccess?: boolean;
  systemKey?: string;
  bypassCache?: boolean;
}

// ====================
// RESPONSE TYPES
// ====================

export interface PublicApiResponse<T> extends ApiResult<T> {
  // Public API response structure
}

export interface AuthenticatedApiResponse<T> extends ApiResult<T> {
  // Authenticated API response structure
}

export interface TenantApiResponse<T> extends ApiResult<T> {
  // Tenant API response structure
  tenantId?: string;
}

export interface AdminApiResponse<T> extends ApiResult<T> {
  // Admin API response structure
}

export interface SystemApiResponse<T> extends ApiResult<T> {
  // System API response structure
}

// ====================
// FLEXIBLE API SINGLETON
// ====================

export abstract class FlexibleApiSingleton extends UniversalSingleton {
  // Default request type for this service (can be overridden)
  protected abstract defaultRequestType: RequestType;
  protected abstract defaultRequestTarget: RequestTarget;
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
  }

  // ====================
  // PUBLIC REQUEST METHOD
  // ====================

  /**
   * Make public API request (no authentication)
   */
  protected async makePublicRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number
  ): Promise<PublicApiResponse<T>> {
    const startTime = Date.now();
    const effectiveTTL = ttl || this.cacheTTL;

    try {
      // Public request implementation
      const response = await this.fetchWithCache(
        url,
        {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            ...options.headers,
          },
        },
        cacheKey,
        effectiveTTL
      );

      return await response.json() as PublicApiResponse<T>;
    } catch (error) {
      console.error(`[FlexibleApiSingleton] Public request failed:`, error);
      throw error;
    }
  }

  // ====================
  // AUTHENTICATED REQUEST METHOD
  // ====================

  /**
   * Make authenticated API request (user-level)
   */
  protected async makeAuthenticatedRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number
  ): Promise<AuthenticatedApiResponse<T>> {
    const startTime = Date.now();
    const effectiveTTL = ttl || this.cacheTTL;

    try {
      // Get auth token
      const token = await this.getAuthToken();
      
      const response = await this.fetchWithCache(
        url,
        {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers,
          },
        },
        cacheKey,
        effectiveTTL
      );

      return await response.json() as AuthenticatedApiResponse<T>;
    } catch (error) {
      console.error(`[FlexibleApiSingleton] Authenticated request failed:`, error);
      throw error;
    }
  }

  // ====================
  // TENANT REQUEST METHOD
  // ====================

  /**
   * Make tenant API request with context validation
   */
  protected async makeTenantRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number,
    tenantOptions: TenantRequestOptions = {}
  ): Promise<TenantApiResponse<T>> {
    const startTime = Date.now();
    const effectiveTTL = ttl || this.cacheTTL;
    
    const {
      requireTenantContext = true,
      validateTenantAccess = false,
      tenantId: overrideTenantId,
      bypassCache = false
    } = tenantOptions;

    try {
      // Tenant context validation
      const effectiveTenantId = overrideTenantId || this.getCurrentTenantId();
      
      if (requireTenantContext && !effectiveTenantId) {
        throw new Error('Tenant context required but not provided');
      }

      // Get auth token
      const token = await this.getAuthToken();
      
      const response = await this.fetchWithCache(
        url,
        {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Tenant-ID': effectiveTenantId || '',
            'X-Request-Context': 'tenant',
            ...options.headers,
          },
        },
        bypassCache ? undefined : cacheKey,
        bypassCache ? undefined : effectiveTTL
      );

      return await response.json() as TenantApiResponse<T>;
    } catch (error) {
      console.error(`[FlexibleApiSingleton] Tenant request failed:`, error);
      throw error;
    }
  }

  // ====================
  // ADMIN REQUEST METHOD
  // ====================

  /**
   * Make admin API request with admin privileges
   */
  protected async makeAdminRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number,
    adminOptions: AdminRequestOptions = {}
  ): Promise<AdminApiResponse<T>> {
    const startTime = Date.now();
    const effectiveTTL = ttl || this.cacheTTL;
    
    const {
      requireAdminContext = true,
      validateAdminAccess = true,
      bypassCache = false
    } = adminOptions;

    try {
      // Admin context validation
      if (requireAdminContext) {
        const isAdmin = await this.validateAdminAccess();
        if (!isAdmin) {
          throw new Error('Admin context required but user lacks admin privileges');
        }
      }

      // Get admin token
      const token = await this.getAuthToken();
      
      const response = await this.fetchWithCache(
        url,
        {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Request-Context': 'admin',
            'X-Admin-Access': validateAdminAccess ? 'required' : 'optional',
            ...options.headers,
          },
        },
        bypassCache ? undefined : cacheKey,
        bypassCache ? undefined : effectiveTTL
      );

      return await response.json() as AdminApiResponse<T>;
    } catch (error) {
      console.error(`[FlexibleApiSingleton] Admin request failed:`, error);
      throw error;
    }
  }

  // ====================
  // SYSTEM REQUEST METHOD
  // ====================

  /**
   * Make system API request (background processing)
   */
  protected async makeSystemRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number,
    systemOptions: SystemRequestOptions = {}
  ): Promise<SystemApiResponse<T>> {
    const startTime = Date.now();
    const effectiveTTL = ttl || this.cacheTTL;
    const {
      requireSystemContext = true,
      validateSystemAccess = true,
      systemKey,
      bypassCache = false
    } = systemOptions;

    try {
      // System context validation
      if (requireSystemContext) {
        const isValidSystem = await this.validateSystemAccess(systemKey);
        if (!isValidSystem) {
          throw new Error('System context required but access denied');
        }
      }

      // System request implementation
      const response = await this.fetchWithCache(
        url,
        {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'X-Request-Context': 'system',
            'X-System-Key': systemKey || '',
            'X-System-Access': validateSystemAccess ? 'required' : 'optional',
            ...options.headers,
          },
        },
        bypassCache ? undefined : cacheKey,
        bypassCache ? undefined : effectiveTTL
      );

      return await response.json() as SystemApiResponse<T>;
    } catch (error) {
      console.error(`[FlexibleApiSingleton] System request failed:`, error);
      throw error;
    }
  }

  // ====================
  // EXPLICIT TARGET METHODS
  // ====================

  /**
   * Make request to API server (port 4000) explicitly
   */
  protected async makeApiRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number
  ): Promise<ApiResult<T>> {
    // Temporarily override target for this request
    const originalTarget = this.defaultRequestTarget;
    this.defaultRequestTarget = RequestTarget.API;
    
    try {
      return await this.makeDefaultRequest<T>(url, options, cacheKey, ttl);
    } finally {
      // Restore original target
      this.defaultRequestTarget = originalTarget;
    }
  }

  /**
   * Make request to web server (port 3000) explicitly
   */
  protected async makeWebRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number
  ): Promise<ApiResult<T>> {
    // Temporarily override target for this request
    const originalTarget = this.defaultRequestTarget;
    this.defaultRequestTarget = RequestTarget.WEB;
    
    try {
      return await this.makeDefaultRequest<T>(url, options, cacheKey, ttl);
    } finally {
      // Restore original target
      this.defaultRequestTarget = originalTarget;
    }
  }

  /**
   * Make request to external service explicitly
   */
  protected async makeExternalRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number
  ): Promise<ApiResult<T>> {
    // Temporarily override target for this request
    const originalTarget = this.defaultRequestTarget;
    this.defaultRequestTarget = RequestTarget.EXTERNAL;
    
    try {
      return await this.makeDefaultRequest<T>(url, options, cacheKey, ttl);
    } finally {
      // Restore original target
      this.defaultRequestTarget = originalTarget;
    }
  }

  /**
   * Make request with custom target override
   */
  protected async makeTargetedRequest<T>(
    url: string,
    target: RequestTarget,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number
  ): Promise<ApiResult<T>> {
    // Temporarily override target for this request
    const originalTarget = this.defaultRequestTarget;
    this.defaultRequestTarget = target;
    
    try {
      return await this.makeDefaultRequest<T>(url, options, cacheKey, ttl);
    } finally {
      // Restore original target
      this.defaultRequestTarget = originalTarget;
    }
  }

  /**
   * Make request with custom type AND target override
   * Perfect for cross-type, cross-target scenarios
   */
  protected async makeHybridRequest<T>(
    url: string,
    type: RequestType,
    target: RequestTarget,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number,
    requestOptions?: any
  ): Promise<ApiResult<T>> {
    // Temporarily override both type and target
    const originalType = this.defaultRequestType;
    const originalTarget = this.defaultRequestTarget;
    this.defaultRequestType = type;
    this.defaultRequestTarget = target;
    
    try {
      switch (type) {
        case RequestType.PUBLIC:
          return await this.makePublicRequest<T>(url, options, cacheKey, ttl);
        case RequestType.AUTHENTICATED:
          return await this.makeAuthenticatedRequest<T>(url, options, cacheKey, ttl);
        case RequestType.TENANT:
          return await this.makeTenantRequest<T>(url, options, cacheKey, ttl, requestOptions);
        case RequestType.ADMIN:
          return await this.makeAdminRequest<T>(url, options, cacheKey, ttl, requestOptions);
        case RequestType.SYSTEM:
          return await this.makeSystemRequest<T>(url, options, cacheKey, ttl, requestOptions);
        default:
          throw new Error(`Unsupported request type: ${type}`);
      }
    } finally {
      // Restore original type and target
      this.defaultRequestType = originalType;
      this.defaultRequestTarget = originalTarget;
    }
  }

  // ====================
  // CONVENIENCE HYBRID METHODS
  // ====================

  /**
   * Make PUBLIC request to WEB server
   */
  protected async makePublicWebRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number
  ): Promise<ApiResult<T>> {
    return this.makeHybridRequest<T>(url, RequestType.PUBLIC, RequestTarget.WEB, options, cacheKey, ttl);
  }

  /**
   * Make AUTHENTICATED request to WEB server
   */
  protected async makeAuthWebRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number
  ): Promise<ApiResult<T>> {
    return this.makeHybridRequest<T>(url, RequestType.AUTHENTICATED, RequestTarget.WEB, options, cacheKey, ttl);
  }

  /**
   * Make PUBLIC request to API server
   */
  protected async makePublicApiRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number
  ): Promise<ApiResult<T>> {
    return this.makeHybridRequest<T>(url, RequestType.PUBLIC, RequestTarget.API, options, cacheKey, ttl);
  }

  /**
   * Make TENANT request to WEB server
   */
  protected async makeTenantWebRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number,
    requestOptions?: any
  ): Promise<ApiResult<T>> {
    return this.makeHybridRequest<T>(url, RequestType.TENANT, RequestTarget.WEB, options, cacheKey, ttl, requestOptions);
  }

  // ====================
  // DEFAULT REQUEST METHOD
  // ====================

  /**
   * Make request using service's default method
   * Can be overridden for specific operations
   */
  protected async makeDefaultRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number,
    requestOptions?: any
  ): Promise<ApiResult<T>> {
    switch (this.defaultRequestType) {
      case RequestType.PUBLIC:
        return await this.makePublicRequest<T>(url, options, cacheKey, ttl);
      case RequestType.AUTHENTICATED:
        return await this.makeAuthenticatedRequest<T>(url, options, cacheKey, ttl);
      case RequestType.TENANT:
        return await this.makeTenantRequest<T>(url, options, cacheKey, ttl, requestOptions);
      case RequestType.ADMIN:
        return await this.makeAdminRequest<T>(url, options, cacheKey, ttl, requestOptions);
      case RequestType.SYSTEM:
        return await this.makeSystemRequest<T>(url, options, cacheKey, ttl, requestOptions);
      default:
        throw new Error(`Unsupported default request type: ${this.defaultRequestType}`);
    }
  }

  // ====================
  // HELPER METHODS
  // ====================

  protected async getAuthToken(): Promise<string> {
    // Implementation would get auth token from storage or refresh
    return localStorage.getItem('authToken') || '';
  }

  private getCurrentTenantId(): string | undefined {
    // Implementation would get current tenant context
    return localStorage.getItem('currentTenantId') || undefined;
  }

  private async validateAdminAccess(): Promise<boolean> {
    // Implementation would validate admin privileges
    const token = await this.getAuthToken();
    // Would decode token or make validation call
    return true; // Simplified for example
  }

  /**
   * Get current user information
   * Available to all derived classes for user context validation
   */
  protected async getCurrentUser(): Promise<any> {
    try {
      // This would typically get user info from auth context or decode token
      // For now, return a placeholder that concrete classes can override
      const token = await this.getAuthToken();
      if (!token) {
        return null;
      }

      // Decode JWT payload (simplified)
      const payload = this.decodeJWT(token);
      return payload;

    } catch (error) {
      console.error('Failed to get current user:', error);
      return null;
    }
  }

  /**
   * Decode JWT token (simplified implementation)
   */
  private decodeJWT(token: string): any {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }
      
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    } catch (error) {
      console.error('Failed to decode JWT:', error);
      return null;
    }
  }

  private async validateSystemAccess(systemKey?: string): Promise<boolean> {
    // Implementation would validate system access
    if (systemKey) {
      // Validate system key against stored/system keys
      return systemKey === process.env.SYSTEM_API_KEY || systemKey === localStorage.getItem('systemKey');
    }
    // Fallback to other system validation methods
    return true; // Simplified for example
  }

  private async fetchWithCache(
    url: string,
    options: RequestInit,
    cacheKey?: string,
    ttl?: number
  ): Promise<Response> {
    // Construct full URL based on defaultRequestTarget
    let fullUrl: string;
    
    if (url.startsWith('http')) {
      // Already absolute URL
      fullUrl = url;
    } else {
      // Build URL based on target
      switch (this.defaultRequestTarget) {
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
    
    // Implementation would use cache manager
    return fetch(fullUrl, options);
  }
}
