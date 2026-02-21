/**
 * Admin API Singleton
 * 
 * Extends FlexibleApiSingleton with admin-specific defaults
 * Handles admin privilege validation and enhanced request processing
 * Provides admin-specific caching and error handling
 */

import { FlexibleApiSingleton, RequestType, RequestTarget, SingletonCacheOptions, AdminRequestOptions, AdminApiResponse } from './FlexibleApiSingleton';

// ====================
// ADMIN API SINGLETON
// ====================

export abstract class AdminApiSingleton extends FlexibleApiSingleton {
  protected defaultRequestType: RequestType = RequestType.ADMIN;
  protected defaultRequestTarget: RequestTarget = RequestTarget.API;
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes for admin operations
  
  constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      ttl: 5 * 60 * 1000, // 5 minutes for admin operations
      ...cacheOptions
    });
  }

  /**
   * Validate admin privileges
   */
  private async validateAdminPrivileges(): Promise<boolean> {
    // Implementation would validate admin privileges
    const token = await this.getAuthToken();
    // Would decode token or make validation call
    return true; // Simplified for example
  }

  /**
   * Validate tenant access for admin operations
   */
  private async validateTenantAccess(endpoint: string): Promise<boolean> {
    // Implementation would validate tenant access
    return true; // Simplified for example
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
  private logAdminOperation(endpoint: string, status: string, startTime: number, auditId: string, error?: any): void {
    const duration = Date.now() - startTime;
    console.log(`[AdminApiSingleton] ${status} ${endpoint} (${duration}ms) [${auditId}]`, error || '');
  }

  /**
   * Process admin-specific errors
   */
  private processAdminError(error: any, endpoint: string, startTime: number, auditId: string): Error {
    // Enhanced error processing for admin operations
    const adminError = new Error(`Admin operation failed: ${endpoint}`);
    (adminError as any).auditId = auditId;
    (adminError as any).duration = Date.now() - startTime;
    (adminError as any).originalError = error;
    return adminError;
  }

  /**
   * Make admin request to web server when needed
   * Demonstrates cross-target capability from API default
   */
  protected async makeWebRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404: boolean = true
  ): Promise<AdminApiResponse<T>> {
    // Use the inherited WEB target override from FlexibleApiSingleton
    return super.makeWebRequest(url, options, cacheKey, customTTL);
  }

  /**
   * Make public admin request to API server
   * Uses convenience method for PUBLIC + API combination
   */
  protected async makePublicRequest<T>(
    url: string,
    options: RequestInit = {},
    cacheKey?: string,
    customTTL?: number,
    handle404: boolean = true
  ): Promise<AdminApiResponse<T>> {
    // Use the new PUBLIC + API convenience method
    return this.makePublicApiRequest(url, options, cacheKey, customTTL);
  }

  /**
   * Get custom metrics for admin operations
   */
  protected getCustomMetrics(): Record<string, any> {
    return {
      requestType: 'admin',
      defaultTTL: this.cacheTTL,
      adminRequests: this.apiCalls
    };
  }
}

export default AdminApiSingleton;
