/**
 * Admin API Singleton
 * 
 * Extends FlexibleApiSingleton with admin-specific defaults
 * Handles admin privilege validation and enhanced request processing
 * Provides admin-specific caching and error handling
 */

import { FlexibleApiSingleton, RequestType, SingletonCacheOptions, AdminRequestOptions, AdminApiResponse } from './FlexibleApiSingleton';

// ====================
// ADMIN API SINGLETON
// ====================

export abstract class AdminApiSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.ADMIN;
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes for admin operations
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      ttl: 5 * 60 * 1000, // 5 minutes for admin operations
      ...cacheOptions
    });
  }

  /**
   * Make admin API request with enhanced validation and logging
   */
  async makeAdminRequest<T = any>(
    endpoint: string,
    options: RequestInit = {},
    cacheKey?: string,
    ttl?: number,
    adminOptions: AdminRequestOptions = {}
  ): Promise<AdminApiResponse<T>> {
    const {
      requireAdminContext = true,
      validateAdminAccess = false,
      bypassCache = false
    } = adminOptions;

    const startTime = Date.now();
    const auditId = this.generateAuditId();

    try {
      // Admin privilege validation
      if (requireAdminContext) {
        await this.validateAdminPrivileges();
      }

      // Tenant access validation (if required)
      if (validateAdminAccess) {
        await this.validateTenantAccess(endpoint);
      }

      // Enhanced headers for admin requests
      const enhancedOptions: RequestInit = {
        ...options,
        headers: {
          ...options.headers,
          'X-Admin-Request': 'true',
          'X-Admin-Audit-ID': auditId || '',
          'X-Request-Timestamp': new Date().toISOString(),
          ...(requireAdminContext && { 'X-Require-Admin-Privileges': 'true' }),
          ...(validateAdminAccess && { 'X-Validate-Tenant-Access': 'true' })
        }
      };

      // Make the authenticated request with admin enhancements
      const response = await this.makeAuthenticatedRequest<T>(
        endpoint,
        enhancedOptions,
        bypassCache ? undefined : cacheKey,
        bypassCache ? 0 : ttl
      );

      // Admin-specific response processing
      const adminResponse: AdminApiResponse<T> = {
        success: true,
        data: response.data
      };

      // Log admin operation
      this.logAdminOperation(endpoint, 'SUCCESS', startTime, auditId);

      return adminResponse;

    } catch (error) {
      // Enhanced error handling for admin operations
      const adminError = this.processAdminError(error, endpoint, startTime, auditId);

      // Log admin error
      this.logAdminOperation(endpoint, 'ERROR', startTime, auditId, error);

      throw adminError;
    }
  }

  /**
   * Validate admin privileges
   */
  private async validateAdminPrivileges(): Promise<void> {
    try {
      // Get current user info from auth token
      const userInfo = await this.getCurrentUser();
      
      if (!userInfo) {
        throw new Error('Authentication required for admin operations');
      }

      // Check if user has admin privileges
      const adminRoles = ['PLATFORM_ADMIN', 'PLATFORM_SUPPORT', 'OWNER', 'TENANT_ADMIN'];
      const hasAdminRole = adminRoles.includes(userInfo.role);

      if (!hasAdminRole) {
        throw new Error(`Insufficient privileges. Required: ${adminRoles.join(' or ')}, Current: ${userInfo.role}`);
      }

    } catch (error) {
      throw new Error(`Admin privilege validation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Validate tenant access for admin operations
   */
  private async validateTenantAccess(endpoint: string): Promise<void> {
    try {
      // Extract tenant ID from endpoint if applicable
      const tenantMatch = endpoint.match(/\/tenants\/([^\/]+)/);
      if (!tenantMatch) {
        return; // No tenant-specific validation needed
      }

      const tenantId = tenantMatch[1];
      const userInfo = await this.getCurrentUser();

      if (!userInfo) {
        throw new Error('Authentication required for tenant operations');
      }

      // Platform admins can access any tenant
      if (userInfo.role === 'PLATFORM_ADMIN' || userInfo.role === 'PLATFORM_SUPPORT') {
        return;
      }

      // Check if user has access to this tenant
      const hasTenantAccess = await this.checkTenantAccess(userInfo.id, tenantId);
      
      if (!hasTenantAccess) {
        throw new Error(`Access denied to tenant ${tenantId}`);
      }

    } catch (error) {
      throw new Error(`Tenant access validation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Check if user has access to specific tenant
   */
  private async checkTenantAccess(userId: string, tenantId: string): Promise<boolean> {
    try {
      // This would typically check user-tenant relationships
      // For now, return true - implement based on your tenant access logic
      return true;

    } catch (error) {
      console.error('Failed to check tenant access:', error);
      return false;
    }
  }

  /**
   * Process admin-specific errors
   */
  private processAdminError(error: any, endpoint: string, startTime: number, auditId?: string): Error {
    const duration = Date.now() - startTime;
    const errorMessage = error.message || 'Unknown admin error';

    // Enhanced error message for admin operations
    const enhancedMessage = `Admin operation failed on ${endpoint}: ${errorMessage} (Duration: ${duration}ms, AuditID: ${auditId || 'N/A'})`;

    const adminError = new Error(enhancedMessage);
    adminError.name = 'AdminApiError';
    
    // Add admin-specific error properties
    (adminError as any).endpoint = endpoint;
    (adminError as any).auditId = auditId;
    (adminError as any).duration = duration;
    (adminError as any).originalError = error;

    return adminError;
  }

  /**
   * Generate audit ID for admin operations
   */
  private generateAuditId(): string {
    return `admin_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log admin operation
   */
  private logAdminOperation(
    endpoint: string, 
    status: 'SUCCESS' | 'ERROR', 
    startTime: number, 
    auditId?: string, 
    error?: any
  ): void {
    const duration = Date.now() - startTime;
    const logLevel = status === 'SUCCESS' ? 'info' : 'error';
    
    const logData = {
      auditId,
      endpoint,
      status,
      duration,
      timestamp: new Date().toISOString(),
      ...(error && { error: error.message })
    };

    console[logLevel](`[AdminApiSingleton] ${status} ${endpoint}`, logData);

    // In production, you might want to send this to your audit logging service
    // this.sendToAuditService(logData);
  }

  /**
   * Invalidate admin cache with enhanced logging
   */
  async invalidateAdminCache(pattern?: string): Promise<void> {
    const startTime = Date.now();
    const auditId = this.generateAuditId();

    try {
      if (pattern) {
        await this.invalidateCache(pattern);
        console.log(`[AdminApiSingleton] Invalidated cache pattern: ${pattern}`, { auditId });
      } else {
        await this.clearCache();
        console.log(`[AdminApiSingleton] Cleared all admin cache`, { auditId });
      }

      const duration = Date.now() - startTime;
      console.log(`[AdminApiSingleton] Cache invalidation completed in ${duration}ms`, { auditId });

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`[AdminApiSingleton] Cache invalidation failed after ${duration}ms`, { auditId, error });
      throw error;
    }
  }

  /**
   * Get admin metrics for monitoring
   */
  getAdminMetrics() {
    const baseMetrics = this.getMetrics();
    
    return {
      ...baseMetrics,
      adminOperations: {
        totalRequests: 0, // Would track admin-specific requests
        failedRequests: 0, // Would track admin failures
        averageResponseTime: 0, // Would track admin response times
        lastOperation: null // Would track last admin operation
      }
    };
  }
}

export default AdminApiSingleton;
