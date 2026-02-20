/**
 * Admin-Tenant Hybrid Service Example
 * 
 * Demonstrates flexible request method usage:
 * - Admin service with default admin privileges
 * - Can use tenant requests for relaxed security scenarios
 * - Example: Admin allowing tenant owners to call within their context
 */

import { FlexibleApiSingleton, RequestType, SingletonCacheOptions } from '@/providers/base/FlexibleApiSingleton';

export interface TenantAnalytics {
  totalScans: number;
  activeUsers: number;
  lastActivity: string;
}

export interface PlatformStats {
  totalTenants: number;
  totalUsers: number;
  systemHealth: string;
}

/**
 * Admin service that can make tenant-context requests
 * Perfect example of the flexible architecture
 */
class AdminTenantHybridService extends FlexibleApiSingleton {
  private static instance: AdminTenantHybridService;
  
  // Default to admin-level access
  protected defaultRequestType: RequestType.ADMIN = RequestType.ADMIN;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      ttl: 5 * 60 * 1000, // 5 minutes cache
      ...cacheOptions
    });
  }

  static getInstance(): AdminTenantHybridService {
    if (!AdminTenantHybridService.instance) {
      AdminTenantHybridService.instance = new AdminTenantHybridService('admin-tenant-hybrid-service');
    }
    return AdminTenantHybridService.instance;
  }

  // ====================
  // PURE ADMIN OPERATIONS
  // ====================

  /**
   * Get platform-wide statistics (admin only)
   * Uses default admin request method
   */
  async getPlatformStats(): Promise<PlatformStats | null> {
    try {
      const response = await this.makeDefaultRequest<PlatformStats>(
        '/api/admin/platform/stats',
        {},
        'platform-stats',
        this.cacheTTL
      );

      return response.data || null;
    } catch (error) {
      console.error('[AdminTenantHybridService] Failed to get platform stats:', error);
      return null;
    }
  }

  /**
   * Admin operation with explicit admin request
   */
  async getSystemHealth(): Promise<any> {
    try {
      const response = await this.makeAdminRequest<any>(
        '/api/admin/system/health',
        {},
        'system-health',
        this.cacheTTL,
        { requireAdminContext: true, validateAdminAccess: true }
      );

      return response.data;
    } catch (error) {
      console.error('[AdminTenantHybridService] Failed to get system health:', error);
      throw error;
    }
  }

  // ====================
  // EDGE CASE: ADMIN TO TENANT OPERATIONS
  // ====================

  /**
   * Admin service accessing tenant data with relaxed security
   * Edge case: Admin allows tenant owners to call within their context
   */
  async getTenantAnalyticsAsAdmin(
    tenantId: string,
    requestingUserId?: string
  ): Promise<TenantAnalytics | null> {
    try {
      // Use tenant request method but with admin privileges
      // This allows admin to access tenant data while maintaining tenant context
      const response = await this.makeTenantRequest<TenantAnalytics>(
        `/api/tenant/${tenantId}/analytics`,
        {},
        `tenant-analytics-${tenantId}`,
        this.cacheTTL,
        {
          requireTenantContext: true,
          validateTenantAccess: false, // Admin bypasses tenant validation
          tenantId: tenantId
        }
      );

      return response.data || null;
    } catch (error) {
      console.error('[AdminTenantHybridService] Failed to get tenant analytics as admin:', error);
      return null;
    }
  }

  /**
   * Admin operation that needs to act on behalf of a tenant
   * Example: Admin performing maintenance for a specific tenant
   */
  async performTenantMaintenance(
    tenantId: string,
    maintenanceType: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await this.makeTenantRequest<{ success: boolean; message: string }>(
        `/api/tenant/${tenantId}/maintenance`,
        {
          method: 'POST',
          body: JSON.stringify({ maintenanceType, initiatedBy: 'admin' })
        },
        `tenant-maintenance-${tenantId}`,
        0, // No caching for write operations
        {
          requireTenantContext: true,
          validateTenantAccess: false, // Admin bypass
          tenantId: tenantId
        }
      );

      return response.data || { success: false, message: 'No data returned' };
    } catch (error) {
      console.error('[AdminTenantHybridService] Failed to perform tenant maintenance:', error);
      throw error;
    }
  }

  // ====================
  // PUBLIC OPERATIONS FROM ADMIN SERVICE
  // ====================

  /**
   * Admin service accessing public data
   * Example: Admin checking public configuration
   */
  async getPublicConfig(): Promise<any> {
    try {
      const response = await this.makePublicRequest<any>(
        '/api/public/config',
        {},
        'public-config',
        this.cacheTTL
      );

      return response.data;
    } catch (error) {
      console.error('[AdminTenantHybridService] Failed to get public config:', error);
      return null;
    }
  }

  // ====================
  // AUTHENTICATED OPERATIONS
  // ====================

  /**
   * Admin service accessing user-specific data
   * Example: Admin checking user profile
   */
  async getUserProfile(userId: string): Promise<any> {
    try {
      const response = await this.makeAuthenticatedRequest<any>(
        `/api/users/${userId}/profile`,
        {},
        `user-profile-${userId}`,
        this.cacheTTL
      );

      return response.data;
    } catch (error) {
      console.error('[AdminTenantHybridService] Failed to get user profile:', error);
      return null;
    }
  }

  // ====================
  // MIXED SECURITY OPERATIONS
  // ====================

  /**
   * Complex operation requiring multiple security levels
   * Example: Generate report that combines platform and tenant data
   */
  async generateHybridReport(tenantId: string): Promise<any> {
    try {
      // Step 1: Get platform stats (admin level)
      const platformStats = await this.getPlatformStats();
      
      // Step 2: Get tenant analytics (tenant context with admin bypass)
      const tenantAnalytics = await this.getTenantAnalyticsAsAdmin(tenantId);
      
      // Step 3: Get public config (public level)
      const publicConfig = await this.getPublicConfig();

      return {
        platform: platformStats,
        tenant: tenantAnalytics,
        config: publicConfig,
        generatedAt: new Date().toISOString(),
        generatedBy: 'admin-tenant-hybrid-service'
      };
    } catch (error) {
      console.error('[AdminTenantHybridService] Failed to generate hybrid report:', error);
      throw error;
    }
  }
}

export const adminTenantHybridService = AdminTenantHybridService.getInstance();
