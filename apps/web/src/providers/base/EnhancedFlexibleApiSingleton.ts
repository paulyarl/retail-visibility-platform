import { UniversalSingleton, SingletonCacheOptions, SingletonMetrics } from './UniversalSingleton';
import { clientTenantContextManager } from '@/lib/clientTenantContext';
import { CacheIsolation, AppContext } from '../../utils/contextCacheManager';
import { ContextAwareCacheManager, EnhancedCacheOptions } from '../../utils/contextAwareCacheManager';

// Define request types and interfaces that were previously in FlexibleApiSingleton
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
  DATABASE = 'database',
  CACHE = 'cache',
  EXTERNAL_API = 'external-api',
  EXTERNAL = 'external',
  WEB = 'web'
}

export interface PublicRequestOptions {
  cacheKey?: string;
  ttl?: number;
  requestTarget?: RequestTarget;
}

export interface AuthenticatedRequestOptions {
  cacheKey?: string;
  ttl?: number;
  requireAuth?: boolean;
}

export interface TenantRequestOptions {
  tenantId: string;
  cacheKey?: string;
  ttl?: number;
  requestTarget?: RequestTarget;
}

export interface AdminRequestOptions {
  cacheKey?: string;
  ttl?: number;
  requireAdmin?: boolean;
  requestTarget?: RequestTarget;
  requireAdminContext?: boolean;
  bypassCache?: boolean;
}

export interface ExternalRequestOptions {
  cacheKey?: string;
  ttl?: number;
  timeout?: number;
  requestTarget?: RequestTarget;
  headers?: Record<string, string>;
}

export interface SystemRequestOptions {
  cacheKey?: string;
  ttl?: number;
  requestTarget?: RequestTarget;
  validateSystemAccess?: boolean;
  bypassCache?: boolean;
  systemKey?: string;
}

export interface RequestOptions {
  requestType?: RequestType;
  requestTarget?: RequestTarget;
  retries?: number;
  headers?: Record<string, string>;
  cacheKey?: string;
  ttl?: number;
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

export interface AuthenticatedApiResponse<T> extends ApiResult<T> {}
export interface TenantApiResponse<T> extends ApiResult<T> {}
export interface AdminApiResponse<T> extends ApiResult<T> {}
export interface PublicApiResponse<T> extends ApiResult<T> {}
export interface ExternalApiResponse<T> extends ApiResult<T> {}

export interface SystemApiResponse<T> extends ApiResult<T> {}

// Extend the imported EnhancedCacheOptions with additional properties needed for API requests
interface ApiEnhancedCacheOptions extends EnhancedCacheOptions {
  tenantId?: string;
  useTenantContext?: boolean;
  useAuthUser?: boolean;
  cacheKey?: string;
  requestTarget?: RequestTarget;
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

  // Basic request methods (to be implemented by concrete classes or FlexibleApiSingleton)
  protected async makePublicRequest<T>(url: string, options?: RequestInit, cacheKey?: string, ttl?: number, requestOptions?: PublicRequestOptions): Promise<ApiResult<T>> {
    throw new Error('makePublicRequest must be implemented by concrete class');
  }

  protected async makeAuthenticatedRequest<T>(url: string, options?: RequestInit, cacheKey?: string, ttl?: number, isAdminRequest?: boolean): Promise<AuthenticatedApiResponse<T>> {
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
   */
  protected async makeEnhancedDefaultRequest<T>(
    url: string,
    options?: RequestInit,
    cacheKey?: string,
    ttl?: number,
    requestOptions?: PublicRequestOptions & ApiEnhancedCacheOptions
  ): Promise<ApiResult<T>> {
    // 🎯 ENHANCED LOGIC: Combine all parameters for maximum uniqueness
    const baseKey = cacheKey || url;  // Use provided cacheKey as base, or URL as fallback
    
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

    // Generate enhanced cache key
    const enhancedCacheKey = this.generateCacheKey(
      baseKey,
      requestOptions?.context,
      requestOptions?.isolation,
      tenantId,
      userId
    );

    // Create enhanced request options
    const enhancedRequestOptions: PublicRequestOptions = {
      cacheKey: enhancedCacheKey,
      ttl: ttl || requestOptions?.ttl || this.cacheTTL,
      requestTarget: requestOptions?.requestTarget
    };

    // Use existing makeDefaultRequest - it will delegate to appropriate request type
    return this.makeDefaultRequest<T>(url, options, enhancedCacheKey, ttl, enhancedRequestOptions);
  }

  /**
   * Enhanced public request with context awareness
   */
  protected async makeEnhancedPublicRequest<T>(
    url: string,
    options?: RequestInit,
    cacheOptions?: ApiEnhancedCacheOptions
  ): Promise<ApiResult<T>> {
    // Generate enhanced cache key
    const enhancedCacheKey = this.generateCacheKey(
      cacheOptions?.cacheKey || url,
      cacheOptions?.context,
      cacheOptions?.isolation,
      cacheOptions?.tenantId
    );

    // Merge with existing cache options
    const mergedOptions: PublicRequestOptions = {
      cacheKey: enhancedCacheKey,
      ttl: cacheOptions?.ttl || this.cacheTTL,
      requestTarget: cacheOptions?.requestTarget
    };

    return this.makePublicRequest<T>(url, options, mergedOptions.cacheKey, mergedOptions.ttl, mergedOptions);
  }

  /**
   * Enhanced authenticated request with auth awareness
   */
  protected async makeEnhancedAuthenticatedRequest<T>(
    url: string,
    options?: RequestInit,
    cacheOptions?: ApiEnhancedCacheOptions
  ): Promise<AuthenticatedApiResponse<T>> {
    // Auto-detect user if requested
    let userId = cacheOptions?.userId;
    if (cacheOptions?.useAuthUser && !userId) {
      userId = this.getCurrentUserId(); // Implement this method
    }

    // Generate enhanced cache key
    const enhancedCacheKey = this.generateCacheKey(
      cacheOptions?.cacheKey || url,
      cacheOptions?.context,
      cacheOptions?.isolation,
      userId
    );

    // Create authenticated options with enhanced cache key
    const authOptions: AuthenticatedRequestOptions = {
      cacheKey: enhancedCacheKey,
      ttl: cacheOptions?.ttl
    };

    return this.makeAuthenticatedRequest<T>(url, options, authOptions.cacheKey, authOptions.ttl);
  }

  /**
   * Enhanced tenant request with tenant context awareness
   */
  protected async makeEnhancedTenantRequest<T>(
    url: string,
    options?: RequestInit,
    cacheOptions?: ApiEnhancedCacheOptions
  ): Promise<TenantApiResponse<T>> {
    // Auto-detect tenant if requested
    let tenantId = cacheOptions?.tenantId;
    if (cacheOptions?.useTenantContext && !tenantId) {
      tenantId = clientTenantContextManager.getCurrentTenantId() || undefined;
    }

    const tenantOptions: TenantRequestOptions = {
      tenantId: tenantId || '',
      cacheKey: cacheOptions?.cacheKey,
      ttl: cacheOptions?.ttl
    };

    return this.makeTenantRequest<T>(url, options, tenantOptions);
  }

  /**
   * Enhanced admin request with admin context awareness
   */
  protected async makeEnhancedAdminRequest<T>(
    url: string,
    options?: RequestInit,
    cacheOptions?: ApiEnhancedCacheOptions
  ): Promise<AdminApiResponse<T>> {
    // Generate enhanced cache key for admin operations
    const enhancedCacheKey = this.generateCacheKey(
      cacheOptions?.cacheKey || url,
      AppContext.ADMIN,
      CacheIsolation.ADMIN,
      cacheOptions?.tenantId
    );

    const adminOptions: AdminRequestOptions = {
      cacheKey: enhancedCacheKey,
      ttl: cacheOptions?.ttl || (5 * 60 * 1000) // 5 minutes for admin operations
    };

    return this.makeAdminRequest<T>(url, options, adminOptions);
  }

  /**
   * Enhanced external request with external context awareness
   */
  protected async makeEnhancedExternalRequest<T>(
    url: string,
    options?: RequestInit,
    cacheOptions?: ApiEnhancedCacheOptions
  ): Promise<ExternalApiResponse<T>> {
    // Generate enhanced cache key for external operations
    const enhancedCacheKey = this.generateCacheKey(
      cacheOptions?.cacheKey || url,
      AppContext.SYSTEM,
      CacheIsolation.SYSTEM
    );

    const externalOptions: ExternalRequestOptions = {
      cacheKey: enhancedCacheKey,
      ttl: cacheOptions?.ttl || (60 * 60 * 1000) // 1 hour for external data
    };

    return this.makeExternalRequest<T>(url, options, externalOptions);
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
