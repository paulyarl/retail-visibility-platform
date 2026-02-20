/**
 * Tenant API Singleton
 * 
 * Extends FlexibleApiSingleton with tenant-specific defaults
 * Handles tenant context validation and enhanced request processing
 * Provides tenant-specific caching and header management
 */

import { FlexibleApiSingleton, RequestType, SingletonCacheOptions, TenantRequestOptions, TenantApiResponse } from './FlexibleApiSingleton';

// ====================
// TENANT API SINGLETON
// ====================

export abstract class TenantApiSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.TENANT;
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
   * Make tenant API request with enhanced validation and headers
   */
  async makeTenantRequest<T = any>(
    endpoint: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number,
    tenantOptions: TenantRequestOptions = {}
  ): Promise<TenantApiResponse<T>> {
    const {
      requireTenantContext = true,
      validateTenantAccess = false,
      tenantId: overrideTenantId,
      bypassCache = false
    } = tenantOptions;

    const startTime = Date.now();
    const effectiveTenantId = overrideTenantId || this.currentTenantId;

    try {
      // Tenant context validation
      if (requireTenantContext && !effectiveTenantId) {
        throw new Error('Tenant context required but not provided');
      }

      // Tenant access validation (if required)
      if (validateTenantAccess && effectiveTenantId) {
        await this.validateTenantAccess(effectiveTenantId, endpoint);
      }

      // Enhanced headers for tenant requests
      const enhancedOptions: RequestInit = {
        ...options,
        headers: {
          ...options.headers,
          'X-Tenant-ID': effectiveTenantId || '',
          'X-Tenant-Request': 'true',
          'X-Request-Timestamp': new Date().toISOString(),
          ...(requireTenantContext && { 'X-Require-Tenant-Context': 'true' }),
          ...(validateTenantAccess && { 'X-Validate-Tenant-Access': 'true' })
        }
      };

      // Make the authenticated request with tenant enhancements
      const response = await this.makeAuthenticatedRequest<T>(
        endpoint,
        enhancedOptions,
        bypassCache ? undefined : cacheKey,
        bypassCache ? 0 : ttl
      );

      // Tenant-specific response processing
      const tenantResponse: TenantApiResponse<T> = {
        success: true,
        data: response.data,
        tenantId: effectiveTenantId
      };

      // Log tenant operation
      this.logTenantOperation(endpoint, 'SUCCESS', startTime, effectiveTenantId);

      return tenantResponse;

    } catch (error) {
      // Enhanced error handling for tenant operations
      const tenantError = this.processTenantError(error, endpoint, startTime, effectiveTenantId);

      // Log tenant error
      this.logTenantOperation(endpoint, 'ERROR', startTime, effectiveTenantId, error);

      throw tenantError;
    }
  }

  /**
   * Validate tenant access for specific operations
   */
  private async validateTenantAccess(tenantId: string, endpoint: string): Promise<void> {
    try {
      // Get current user info
      const userInfo = await this.getCurrentUser();
      
      if (!userInfo) {
        throw new Error('Authentication required for tenant operations');
      }

      // Check if user has access to this tenant
      const hasTenantAccess = await this.checkUserTenantAccess(userInfo.id, tenantId);
      
      if (!hasTenantAccess) {
        throw new Error(`Access denied to tenant ${tenantId}`);
      }

      // Additional tenant-specific validations based on endpoint
      if (endpoint.includes('/admin/') || endpoint.includes('/settings/')) {
        // Check for admin or owner privileges
        const hasAdminRole = ['PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'OWNER', 'TENANT_ADMIN'].includes(userInfo.role);
        if (!hasAdminRole) {
          throw new Error(`Admin privileges required for ${endpoint}`);
        }
      }

    } catch (error) {
      throw new Error(`Tenant access validation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Check if user has access to specific tenant
   */
  private async checkUserTenantAccess(userId: string, tenantId: string): Promise<boolean> {
    try {
      // This would typically check user-tenant relationships
      // For now, return true - implement based on your tenant access logic
      // In a real implementation, you might:
      // 1. Check user-tenant mapping table
      // 2. Validate tenant membership
      // 3. Check role-based permissions
      
      // Platform admins can access any tenant
      const userInfo = await this.getCurrentUser();
      if (userInfo?.role === 'PLATFORM_ADMIN' || userInfo?.role === 'PLATFORM_SUPPORT') {
        return true;
      }

      return true; // Placeholder - implement actual tenant access check

    } catch (error) {
      console.error('Failed to check tenant access:', error);
      return false;
    }
  }

  /**
   * Process tenant-specific errors
   */
  private processTenantError(error: any, endpoint: string, startTime: number, tenantId?: string): Error {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || 'Unknown tenant error';

    // Enhanced error message for tenant operations
    const enhancedMessage = `Tenant operation failed on ${endpoint}: ${errorMessage} (Duration: ${duration}ms, TenantID: ${tenantId || 'N/A'})`;

    const tenantError = new Error(enhancedMessage);
    tenantError.name = 'TenantApiError';
    
    // Add tenant-specific error properties
    (tenantError as any).endpoint = endpoint;
    (tenantError as any).tenantId = tenantId;
    (tenantError as any).duration = duration;
    (tenantError as any).originalError = error;

    return tenantError;
  }

  /**
   * Log tenant operation
   */
  private logTenantOperation(
    endpoint: string, 
    status: 'SUCCESS' | 'ERROR', 
    startTime: number, 
    tenantId?: string, 
    error?: any
  ): void {
    const duration = Date.now() - startTime;
    const logLevel = status === 'SUCCESS' ? 'info' : 'error';
    
    const logData = {
      tenantId,
      endpoint,
      status,
      duration,
      timestamp: new Date().toISOString(),
      ...(error && { error: error.message })
    };

    console[logLevel](`[TenantApiSingleton] ${status} ${endpoint}`, logData);

    // In production, you might want to send this to your tenant logging service
    // this.sendToTenantLoggingService(logData);
  }

  /**
   * Invalidate tenant cache with enhanced logging
   */
  async invalidateTenantCache(pattern?: string): Promise<void> {
    const startTime = Date.now();
    const tenantId = this.currentTenantId;

    try {
      if (pattern) {
        await this.invalidateCache(pattern);
        console.log(`[TenantApiSingleton] Invalidated cache pattern: ${pattern}`, { tenantId });
      } else {
        await this.clearCache();
        console.log(`[TenantApiSingleton] Cleared all tenant cache`, { tenantId });
      }

      const duration = Date.now() - startTime;
      console.log(`[TenantApiSingleton] Cache invalidation completed in ${duration}ms`, { tenantId });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[TenantApiSingleton] Cache invalidation failed after ${duration}ms`, { tenantId, error });
      throw error;
    }
  }

  /**
   * Get tenant metrics for monitoring
   */
  getTenantMetrics() {
    const baseMetrics = this.getMetrics();
    
    return {
      ...baseMetrics,
      tenantOperations: {
        currentTenant: this.currentTenantId,
        totalRequests: 0, // Would track tenant-specific requests
        failedRequests: 0, // Would track tenant failures
        averageResponseTime: 0, // Would track tenant response times
        lastOperation: null // Would track last tenant operation
      }
    };
  }

  /**
   * Create tenant-specific cache key
   */
  createTenantCacheKey(baseKey: string): string {
    const tenantId = this.currentTenantId || 'no-tenant';
    return `tenant:${tenantId}:${baseKey}`;
  }

  /**
   * Get tenant-specific TTL based on operation type
   */
  getTenantTTL(operationType: 'read' | 'write' | 'admin'): number {
    const baseTTL = this.cacheTTL;
    
    switch (operationType) {
      case 'read':
        return baseTTL; // 10 minutes
      case 'write':
        return 0; // No caching for write operations
      case 'admin':
        return baseTTL * 2; // 20 minutes for admin operations
      default:
        return baseTTL;
    }
  }
}

export default TenantApiSingleton;
