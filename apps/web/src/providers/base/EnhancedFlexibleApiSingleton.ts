import { UniversalSingleton, SingletonCacheOptions, SingletonMetrics } from './UniversalSingleton';
import { clientTenantContextManager } from '@/lib/clientTenantContext';
import { CacheIsolation, AppContext } from '../../utils/contextCacheManager';
import { ContextAwareCacheManager, EnhancedCacheOptions } from '../../utils/contextAwareCacheManager';
import { ContextAwareCacheOptions } from '../../services/contextAwareCacheService';

// Define request types and interfaces that were previously in FlexibleApiSingleton
export enum RequestType {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
  TENANT = 'tenant',
  ADMIN = 'admin',
  SYSTEM = 'system',
  EXTERNAL = 'external'
}

export enum ResponseType {
  JSON = 'json',
  TEXT = 'text',
  BLOB = 'blob',
  ARRAY_BUFFER = 'arrayBuffer',
  STREAM = 'stream',
  NONE = 'none'
}


export enum RequestTarget {
  API = 'api',
  DATABASE = 'database',
  CACHE = 'cache',
  EXTERNAL_API = 'external-api',
  EXTERNAL = 'external',
  WEB = 'web'
}

export interface UniversalResponseOptions {
  responseType?: ResponseType;
}

export interface PublicRequestOptions extends UniversalResponseOptions {
  cacheKey?: string;
  ttl?: number;
  requestTarget?: RequestTarget;
  responseType?: ResponseType;
  // 🎯 STRATEGY 1: Context data for enhanced cacheKey generation
  context?: AppContext;
  isolation?: CacheIsolation;
  tenantId?: string;
  userId?: string;
}

export interface AuthenticatedRequestOptions extends UniversalResponseOptions {
  cacheKey?: string;
  ttl?: number;
  requireAuth?: boolean;
  responseType?: ResponseType;
  // 🎯 STRATEGY 1: Context data for enhanced cacheKey generation
  context?: AppContext;
  isolation?: CacheIsolation;
  userId?: string;
}

export interface TenantRequestOptions extends UniversalResponseOptions {
  tenantId: string;
  ttl?: number;
  requestTarget?: RequestTarget;
  responseType?: ResponseType;
  // 🎯 STRATEGY 1: Context data for enhanced cacheKey generation
  context?: AppContext;
  isolation?: CacheIsolation;
  userId?: string;
  cacheKey?: string;
}

export interface AdminRequestOptions extends UniversalResponseOptions {
  cacheKey?: string;
  ttl?: number;
  requireAdmin?: boolean;
  requestTarget?: RequestTarget;
  responseType?: ResponseType;
  requireAdminContext?: boolean;
  bypassCache?: boolean;
  // 🎯 STRATEGY 1: Context data for enhanced cacheKey generation
  context?: AppContext;
  isolation?: CacheIsolation;
  userId?: string;
}

export interface ExternalRequestOptions extends UniversalResponseOptions {
  cacheKey?: string;
  ttl?: number;
  timeout?: number;
  requestTarget?: RequestTarget;
  responseType?: ResponseType;
  headers?: Record<string, string>;
  // 🎯 STRATEGY 1: Context data for enhanced cacheKey generation
  context?: AppContext;
  isolation?: CacheIsolation;
  userId?: string;
  includeCredentials?: boolean; // Allow controlling credential inclusion for external APIs
}

export interface SystemRequestOptions extends UniversalResponseOptions {
  cacheKey?: string;
  ttl?: number;
  requestTarget?: RequestTarget;
  validateSystemAccess?: boolean;
  bypassCache?: boolean;
  systemKey?: string;
}


export interface RequestOptions extends UniversalResponseOptions {
  requestType?: RequestType;
  requestTarget?: RequestTarget;
  retries?: number;
  headers?: Record<string, string>;
  cacheKey?: string;
  ttl?: number;
  includeCredentials?: boolean; // Allow controlling credential inclusion
  ssrAuth?: { auth0Email?: string; auth0Id?: string }; // SSR: Auth headers for server-side requests
  responseType?: ResponseType; // Control response parsing behavior
}

export interface ApiResult<T> {
  data: T;
  success: boolean;
  error?: string | {
    status: number;
    message: string;
    code: string;
  };
  status?: number;
  metadata?: {
    cached: boolean;
    timestamp: number;
    source: string;
  };
}

export interface AuthenticatedApiResponse<T> extends ApiResult<T> {
  cacheKey?: string;
}
export interface TenantApiResponse<T> extends ApiResult<T> {
  cacheKey?: string;
  tenantId?: string;
}
export interface AdminApiResponse<T> extends ApiResult<T> {
  cacheKey?: string;
  userId?: string;
}
export interface PublicApiResponse<T> extends ApiResult<T> {
  cacheKey?: string;
}
export interface ExternalApiResponse<T> extends ApiResult<T> {
  cacheKey?: string;
}

export interface SystemApiResponse<T> extends ApiResult<T> {
  cacheKey?: string;
}

// Extend the imported EnhancedCacheOptions with additional properties needed for API requests
interface ApiEnhancedCacheOptions extends EnhancedCacheOptions {
  tenantId?: string;
  useTenantContext?: boolean;
  useAuthUser?: boolean;
  cacheKey?: string;
  requestTarget?: RequestTarget;
  responseType?: ResponseType;
  invalidateOnMutation?: boolean;
  cacheTags?: string[];
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Enhanced Flexible API Singleton - Base Class with Enhanced Features
 * 
 * Extends UniversalSingleton to provide:
 * - All existing UniversalSingleton functionality
 * - Context-aware caching
 * - Intelligent storage strategies  
 * - Enhanced cache key generation
 * - Automatic tenant/user detection
 * - Request type system for different access patterns
 */
export abstract class EnhancedFlexibleApiSingleton extends UniversalSingleton {
  
  constructor(singletonKey: string, cacheOptions?: ApiEnhancedCacheOptions) {
    super(singletonKey, cacheOptions);
  }

  // Default request configuration
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes default
  protected abstract defaultRequestType: RequestType;
  protected abstract defaultRequestTarget: RequestTarget;
  protected abstract defaultContext?: AppContext;
  protected abstract defaultIsolation?: CacheIsolation;

  /**
   * Enhanced context detection based on URL path and request options
   */
  protected detectContextFromUrl(url: string): { context: AppContext; isolation: CacheIsolation } {
    // 🎯 URL-based context detection
    if (url.includes('/tenants/') || url.includes('/tenant-') || url.includes('/dashboard')|| url.includes('/tenants')) {
      return { context: AppContext.TENANT, isolation: CacheIsolation.TENANT };
    }
    
    if (url.includes('/admin/') || url.includes('/platform/admin') || url.includes('/system/')) {
      return { context: AppContext.ADMIN, isolation: CacheIsolation.ADMIN };
    }
    
    if (url.includes('/settings/') || url.includes('/platform/') || url.includes('/items/')|| url.includes('/items')|| url.includes('/settings')) {
      return { context: AppContext.TENANT, isolation: CacheIsolation.TENANT };
    }
    if (url.includes('/shops/') ||url.includes('/shop/') || url.includes('/shops/directory') || url.includes('/shops')) {
      return { context: AppContext.SHOP, isolation: CacheIsolation.SHOP };
    }
    
    if (url.includes('/products/')  ||url.includes('/products') ||url.includes('/product/') ||url.includes('/product') ||url.includes('/recommendations/') ||url.includes('/featured-products')) {
      return { context: AppContext.PRODUCT, isolation: CacheIsolation.PRODUCT };
    }
    
    if (url.includes('/store/')  ||url.includes('/stores/')||url.includes('/tenant/') || url.includes('/storefront')) {
      return { context: AppContext.STORE, isolation: CacheIsolation.STORE };
    }
    
    if (url.includes('/external/') || url.includes('/integrations/')) {
      return { context: AppContext.SYSTEM, isolation: CacheIsolation.SYSTEM };
    }
    
    
    if (url.includes('/directory/') || url.includes('/directory')) {
      return { context: AppContext.DIRECTORY, isolation: CacheIsolation.DIRECTORY };
    }
    
    
    if (url.includes('/public/') || url.includes('/platform/public')) {
      return { context: AppContext.PUBLIC, isolation: CacheIsolation.PUBLIC };
    }
    
    // Default to user context for authenticated endpoints
    return { context: AppContext.USER, isolation: CacheIsolation.USER };
  }

  /**
   * Enhanced cache key generation with context awareness
   */
  protected generateCacheKey<T>(
    baseKey: string,
    context?: AppContext,
    isolation?: CacheIsolation,
    tenantId?: string,
    userId?: string
  ): string {
    const parts = [baseKey];
    
    if (context) parts.push(context);
    if (isolation) parts.push(isolation);
    if (tenantId) parts.push(tenantId);
    if (userId) parts.push(userId);
    
    return parts.join(':');
  }

  /**
   * Enhanced context-aware cache get method
   */
  protected async getEnhancedContextCache<T>(key: string, context?: AppContext, isolation?: CacheIsolation, tenantId?: string, userId?: string): Promise<T | null> {
    const options: ContextAwareCacheOptions = {
      context: context as any,
      isolation: isolation as any,
      tenantId,
      userId
    };
    
    return super.getContextAwareCache<T>(key, options);
  }

  /**
   * Enhanced context-aware cache set method
   */
  protected async setEnhancedContextCache<T>(key: string, data: T, context?: AppContext, isolation?: CacheIsolation, tenantId?: string, userId?: string): Promise<void> {
    const options: ContextAwareCacheOptions = {
      context: context as any,
      isolation: isolation as any,
      tenantId,
      userId
    };
    
    return super.setContextAwareCache<T>(key, data, options);
  }

  // Basic request methods (to be implemented by concrete classes or FlexibleApiSingleton)
  protected async makePublicRequest<T>(url: string, options?: RequestInit, cacheKey?: string, ttl?: number, requestOptions?: PublicRequestOptions): Promise<ApiResult<T>> {
    throw new Error('makePublicRequest must be implemented by concrete class');
  }

  protected async makeAuthenticatedRequest<T>(url: string, options?: RequestInit, cacheKey?: string, ttl?: number, requestOptions?: AuthenticatedRequestOptions): Promise<AuthenticatedApiResponse<T>> {
    throw new Error('makeAuthenticatedRequest must be implemented by concrete class');
  }

  protected async makeTenantRequest<T>(url: string, options?: RequestInit, requestOptions?: TenantRequestOptions): Promise<TenantApiResponse<T>> {
    throw new Error('makeTenantRequest must be implemented by concrete class');
  }

  protected async makeAdminRequest<T>(url: string, options?: RequestInit, requestOptions?: AdminRequestOptions): Promise<AdminApiResponse<T>> {
    throw new Error('makeAdminRequest must be implemented by concrete class');
  }

  protected async makeExternalRequest<T>(url: string, options?: RequestInit, requestOptions?: ExternalRequestOptions): Promise<ExternalApiResponse<T>> {
    throw new Error('makeExternalRequest must be implemented by concrete class');
  }

  protected async makeDefaultRequest<T>(url: string, options?: RequestInit, cacheKey?: string, ttl?: number, requestOptions?: RequestOptions): Promise<ApiResult<T>> {
    throw new Error('makeDefaultRequest must be implemented by concrete class');
  }

  /**
   * Enhanced default request method - Drop-in replacement for makeDefaultRequest
   * Supports existing API + enhanced cache options
   * Uses base class defaults for context and isolation
   */
  protected async makeEnhancedDefaultRequest<T>(
    url: string,
    options?: RequestInit,
    cacheKey?: string,
    ttl?: number,
    requestOptions?: PublicRequestOptions & ApiEnhancedCacheOptions
  ): Promise<ApiResult<T>> {
    // 🎯 STRATEGY 1: Context-Only Passing - Don't pass cacheKey back, only context data
    // Auto-detect tenant if requested
    let tenantId = requestOptions?.tenantId;
    if (requestOptions?.useTenantContext && !tenantId) {
      tenantId = clientTenantContextManager.getCurrentTenantId() || undefined;
    }

    // Auto-detect user if requested
    let userId = requestOptions?.userId;
    if (requestOptions?.useAuthUser && !userId) {
      userId = this.getCurrentUserId(); // Implement this method
    }

    // 🎯 ENHANCED: Use service defaults first, then URL detection as fallback
    const urlDetectedContext = this.detectContextFromUrl(url);
    const context = requestOptions?.context ?? this.defaultContext ?? urlDetectedContext.context;
    const isolation = requestOptions?.isolation ?? this.defaultIsolation ?? urlDetectedContext.isolation;

    // console.log(`[${this.constructor.name}] ----------------------------------------`);
    // console.log(`[${this.constructor.name}] url                   : ${url}`);
    // console.log(`[${this.constructor.name}] context               : ${context}`);
    // console.log(`[${this.constructor.name}] DEFAULT context       : ${this.defaultContext}`);
    // console.log(`[${this.constructor.name}] isolation             : ${isolation}`);
    // console.log(`[${this.constructor.name}] DEFAULT isolation     : ${this.defaultIsolation}`);
    // console.log(`[${this.constructor.name}] tenantId              : ${tenantId}`);
    // console.log(`[${this.constructor.name}] userId                : ${userId}`);
    // console.log(`[${this.constructor.name}] end                   :`);

    // 🎯 STRATEGY 1: Return with context data, no cacheKey pollution
    // Base method will generate enhanced cacheKey with this context
    const contextEnhancedRequestOptions: PublicRequestOptions = {
      ttl: ttl || requestOptions?.ttl || this.cacheTTL,
      requestTarget: requestOptions?.requestTarget,
      // 🚀 Context data for cacheKey generation in base method
      context,
      isolation,
      tenantId,
      userId,
      // Preserve responseType for blob/text/etc responses
      responseType: requestOptions?.responseType,
    };

    // Use existing makeDefaultRequest - it will generate enhanced cacheKey with context
    return this.makeDefaultRequest<T>(url, options, undefined, ttl, contextEnhancedRequestOptions);
  }

  /**
   * Enhanced public request with context awareness
   * 🎯 STRATEGY 1: Context-Only Passing - No cacheKey pollution
   */
  protected async makeEnhancedPublicRequest<T>(
    url: string,
    options?: RequestInit,
    cacheKey?: string,
    cacheOptions?: ApiEnhancedCacheOptions
  ): Promise<ApiResult<T>> {
    // 🎯 STRATEGY 1: Get context data, don't generate cacheKey here
    // 🎯 ENHANCED: Use service defaults first, then URL detection as fallback
    const urlDetectedContext = this.detectContextFromUrl(url);
    const context = cacheOptions?.context ?? this.defaultContext ?? urlDetectedContext.context;
    const isolation = cacheOptions?.isolation ?? this.defaultIsolation ?? urlDetectedContext.isolation;
    
    // console.log(`[${this.constructor.name}] ----------------------------------------`);
    // console.log(`[${this.constructor.name}] makeEnhancedPublicRequest url: ${url}`);
    // console.log(`[${this.constructor.name}] context: ${context}`);
    // console.log(`[${this.constructor.name}] isolation: ${isolation}`);
    // console.log(`[${this.constructor.name}] end:`);

    // 🎯 STRATEGY 1: Return with context data only
    const contextEnhancedRequestOptions: PublicRequestOptions = {
      ttl: cacheOptions?.ttl || this.cacheTTL,
      requestTarget: cacheOptions?.requestTarget,
      // 🚀 Context data for cacheKey generation in base method
      context,
      isolation
    };

    // Base method will generate enhanced cacheKey with this context
    return this.makePublicRequest<T>(url, options, undefined, cacheOptions?.ttl, contextEnhancedRequestOptions);
  }

  /**
   * Enhanced authenticated request with auth awareness
   * 🎯 STRATEGY 1: Context-Only Passing - No cacheKey pollution
   */
  protected async makeEnhancedAuthenticatedRequest<T>(
    url: string,
    options?: RequestInit,
    cacheKey?: string,
    cacheOptions?: ApiEnhancedCacheOptions
  ): Promise<AuthenticatedApiResponse<T>> {
    // 🎯 STRATEGY 1: Get context data, don't generate cacheKey here
    // 🎯 ENHANCED: Use service defaults first, then URL detection as fallback
    const urlDetectedContext = this.detectContextFromUrl(url);
    const context = cacheOptions?.context ?? this.defaultContext ?? urlDetectedContext.context;
    const isolation = cacheOptions?.isolation ?? this.defaultIsolation ?? urlDetectedContext.isolation;
    
    // Auto-detect user if requested
    let userId = cacheOptions?.userId;
    if (cacheOptions?.useAuthUser && !userId) {
      userId = this.getCurrentUserId();
    }

    // console.log(`[${this.constructor.name}] ----------------------------------------`);
    // console.log(`[${this.constructor.name}] makeEnhancedAuthenticatedRequest url: ${url}`);
    // console.log(`[${this.constructor.name}] context: ${context}`);
    // console.log(`[${this.constructor.name}] isolation: ${isolation}`);
    // console.log(`[${this.constructor.name}] userId: ${userId}`);
    // console.log(`[${this.constructor.name}] end:`);

    // 🎯 STRATEGY 1: Return with context data only
    const contextEnhancedRequestOptions: AuthenticatedRequestOptions = {
      ttl: cacheOptions?.ttl || this.cacheTTL,
      // 🚀 Context data for cacheKey generation in base method
      context,
      isolation,
      userId
    };

    // Base method will generate enhanced cacheKey with this context
    return this.makeAuthenticatedRequest<T>(url, options, undefined, cacheOptions?.ttl, contextEnhancedRequestOptions);
  }

  /**
   * Enhanced tenant request with tenant context awareness
   * 🎯 STRATEGY 1: Context-Only Passing - No cacheKey pollution
   */
  protected async makeEnhancedTenantRequest<T>(
    url: string,
    options?: RequestInit,
    cacheKey?: string,
    cacheOptions?: TenantRequestOptions & ApiEnhancedCacheOptions   
  ): Promise<TenantApiResponse<T>> {
    // 🎯 STRATEGY 1: Get context data, don't generate cacheKey here
    const context = cacheOptions?.context ?? this.defaultContext;
    const isolation = cacheOptions?.isolation ?? this.defaultIsolation;
    
    // Auto-detect tenant if requested
    let tenantId = cacheOptions?.tenantId;
    if (cacheOptions?.useTenantContext && !tenantId) {
      tenantId = clientTenantContextManager.getCurrentTenantId() || undefined;
    }

    // console.log(`[${this.constructor.name}] ----------------------------------------`);
    // console.log(`[${this.constructor.name}] makeEnhancedTenantRequest url: ${url}`);
    // console.log(`[${this.constructor.name}] context: ${context}`);
    // console.log(`[${this.constructor.name}] isolation: ${isolation}`);
    // console.log(`[${this.constructor.name}] tenantId: ${tenantId}`);
    // console.log(`[${this.constructor.name}] end:`);

    // 🎯 STRATEGY 1: Return with context data only
    const contextEnhancedRequestOptions: TenantRequestOptions = {
      tenantId: tenantId || '',
      ttl: cacheOptions?.ttl || this.cacheTTL,
      requestTarget: cacheOptions?.requestTarget,
      // 🚀 Context data for cacheKey generation in base method
      context,
      isolation
    };

    // Base method will generate enhanced cacheKey with this context
    return this.makeTenantRequest<T>(url, options, contextEnhancedRequestOptions);
  }

  /**
   * Enhanced admin request with admin context awareness
   * 🎯 STRATEGY 1: Context-Only Passing - No cacheKey pollution
   */
  protected async makeEnhancedAdminRequest<T>(
    url: string,
    options?: RequestInit,
    cacheKey?: string,
    cacheOptions?:AdminRequestOptions & ApiEnhancedCacheOptions
  ): Promise<AdminApiResponse<T>> {
    // 🎯 STRATEGY 1: Get context data, don't generate cacheKey here
    const context = cacheOptions?.context ?? this.defaultContext;
    const isolation = cacheOptions?.isolation ?? this.defaultIsolation;

    // console.log(`[${this.constructor.name}] ----------------------------------------`);
    // console.log(`[${this.constructor.name}] makeEnhancedAdminRequest url: ${url}`);
    // console.log(`[${this.constructor.name}] context: ${context}`);
    // console.log(`[${this.constructor.name}] isolation: ${isolation}`);
    // console.log(`[${this.constructor.name}] end:`);

    // 🎯 STRATEGY 1: Return with context data only
    const contextEnhancedRequestOptions: AdminRequestOptions = {
      ttl: cacheOptions?.ttl || (5 * 60 * 1000), // 5 minutes for admin operations
      // 🚀 Context data for cacheKey generation in base method
      context,
      isolation
    };

    // Base method will generate enhanced cacheKey with this context
    return this.makeAdminRequest<T>(url, options, contextEnhancedRequestOptions);
  }

  /**
   * Enhanced external request with external context awareness
   * 🎯 STRATEGY 1: Context-Only Passing - No cacheKey pollution
   */
  protected async makeEnhancedExternalRequest<T>(
    url: string,
    options?: RequestInit,
    cacheOptions?: ApiEnhancedCacheOptions
  ): Promise<ExternalApiResponse<T>> {
    // 🎯 STRATEGY 1: Get context data, don't generate cacheKey here
    const context = cacheOptions?.context ?? this.defaultContext;
    const isolation = cacheOptions?.isolation ?? this.defaultIsolation;

    // console.log(`[${this.constructor.name}] ----------------------------------------`);
    // console.log(`[${this.constructor.name}] makeEnhancedExternalRequest url: ${url}`);
    // console.log(`[${this.constructor.name}] context: ${context}`);
    // console.log(`[${this.constructor.name}] isolation: ${isolation}`);
    // console.log(`[${this.constructor.name}] end:`);

    // 🎯 STRATEGY 1: Return with context data only
    const contextEnhancedRequestOptions: ExternalRequestOptions = {
      ttl: cacheOptions?.ttl || (60 * 60 * 1000), // 1 hour for external data
      requestTarget: cacheOptions?.requestTarget,
      // 🚀 Context data for cacheKey generation in base method
      context,
      isolation
    };

    // Base method will generate enhanced cacheKey with this context
    return this.makeExternalRequest<T>(url, options, contextEnhancedRequestOptions);
  }

  /**
   * Get current user ID - to be implemented by concrete classes
   */
  protected getCurrentUserId(): string | undefined {
    // This should be implemented by concrete classes based on their auth context
    // For example: return this.authService.getCurrentUserId();
    return undefined;
  }

  /**
   * Get enhanced cache statistics
   */
  public getEnhancedCacheStats() {
    return {
      // Basic stats from UniversalSingleton
      cacheSize: 0, // Would need to implement actual cache size tracking
      enhancedFeatures: {
        contextAwareCaching: true,
        intelligentStorage: true,
        automaticKeyGeneration: true,
        tenantContextSupport: true,
        authContextSupport: true
      }
    };
  }
}

// Export the enhanced options interface for external use
export type { ApiEnhancedCacheOptions };

// Re-export UniversalSingleton types
export type { SingletonCacheOptions, SingletonMetrics } from './UniversalSingleton';
