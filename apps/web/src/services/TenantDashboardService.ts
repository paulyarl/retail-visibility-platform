/**
 * Tenant Dashboard Service
 *
 * Extends TenantApiSingleton to provide tenant-specific dashboard operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 * Provides tenant-level dashboard data and metrics
 */

import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';

export interface TenantDashboardData {
  tenant: {
    id: string;
    name: string;
    subscription_tier: string;
    created_at: string;
    status: string;
  };
  metrics: {
    total_items: number;
    active_items: number;
    total_orders: number;
    recent_orders: number;
    total_revenue: number;
    recent_revenue: number;
    featured_products_count: number;
    featured_products_limit: number;
  };
  activity: {
    recent_scans: Array<{
      id: string;
      scanned_at: string;
      item_name: string;
      status: string;
    }>;
    recent_updates: Array<{
      id: string;
      updated_at: string;
      item_name: string;
      update_type: string;
    }>;
  };
  performance: {
    scan_success_rate: number;
    average_scan_time: number;
    inventory_accuracy: number;
    last_sync_at: string;
  };
}

class TenantDashboardService extends TenantApiSingleton {
  private static instance: TenantDashboardService;
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes for dashboard data

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-dashboard*',
      'tenant-metrics*',
      'tenant-activity*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(): Promise<void> {
    await this.invalidateCachePattern('tenant-dashboard*');
    await this.invalidateCachePattern('tenant-metrics*');
    await this.invalidateCachePattern('tenant-activity*');
  }

  protected constructor() {
    super('tenant-dashboard', {
      ttl: 5 * 60 * 1000 // 5 minutes for dashboard data
    });
  }

  public static getInstance(): TenantDashboardService {
    if (!TenantDashboardService.instance) {
      TenantDashboardService.instance = new TenantDashboardService();
    }
    return TenantDashboardService.instance;
  }

  /**
   * Get tenant dashboard data with caching
   * Uses the /api/dashboard endpoint with tenant context
   */
  async getTenantDashboard(tenantId: string): Promise<TenantDashboardData | null> {
    if (!tenantId) {
      console.error('[TenantDashboardService] Tenant ID is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<TenantDashboardData>(
        `/api/dashboard?tenantId=${encodeURIComponent(tenantId)}`,
        {},
        `tenant-dashboard-${tenantId}`,
        this.cacheTTL
      );
      
      if (!result.success) {
        console.error('[TenantDashboardService] Failed to get tenant dashboard:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantDashboardService] Failed to get tenant dashboard:', error);
      return null;
    }
  }

  /**
   * Get tenant metrics only
   * Uses the /api/tenant/{id}/metrics endpoint
   */
  async getTenantMetrics(tenantId: string): Promise<TenantDashboardData['metrics'] | null> {
    if (!tenantId) {
      console.error('[TenantDashboardService] Tenant ID is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<TenantDashboardData['metrics']>(
        `/api/tenant/${tenantId}/metrics`,
        {},
        `tenant-metrics-${tenantId}`,
        this.cacheTTL
      );
      
      if (!result.success) {
        console.error('[TenantDashboardService] Failed to get tenant metrics:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantDashboardService] Failed to get tenant metrics:', error);
      return null;
    }
  }

  /**
   * Get tenant activity
   * Uses the /api/tenant/{id}/activity endpoint
   */
  async getTenantActivity(tenantId: string, limit: number = 20): Promise<TenantDashboardData['activity'] | null> {
    if (!tenantId) {
      console.error('[TenantDashboardService] Tenant ID is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<TenantDashboardData['activity']>(
        `/api/tenant/${tenantId}/activity?limit=${limit}`,
        {},
        `tenant-activity-${tenantId}-${limit}`,
        this.cacheTTL
      );
      
      if (!result.success) {
        console.error('[TenantDashboardService] Failed to get tenant activity:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantDashboardService] Failed to get tenant activity:', error);
      return null;
    }
  }

  /**
   * Get tenant performance metrics
   * Uses the /api/tenant/{id}/performance endpoint
   */
  async getTenantPerformance(tenantId: string): Promise<TenantDashboardData['performance'] | null> {
    if (!tenantId) {
      console.error('[TenantDashboardService] Tenant ID is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<TenantDashboardData['performance']>(
        `/api/tenant/${tenantId}/performance`,
        {},
        `tenant-performance-${tenantId}`,
        this.cacheTTL
      );
      
      if (!result.success) {
        console.error('[TenantDashboardService] Failed to get tenant performance:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantDashboardService] Failed to get tenant performance:', error);
      return null;
    }
  }

  /**
   * Refresh tenant dashboard cache
   * Call this after significant tenant data changes
   */
  async refreshTenantDashboard(tenantId: string): Promise<void> {
    if (!tenantId) return;

    try {
      await this.invalidateCache(`tenant-dashboard-${tenantId}`);
      await this.invalidateCache(`tenant-metrics-${tenantId}`);
      await this.invalidateCache(`tenant-activity-${tenantId}*`);
      await this.invalidateCache(`tenant-performance-${tenantId}`);
    } catch (error) {
      console.error('[TenantDashboardService] Failed to refresh tenant dashboard cache:', error);
    }
  }
}

// Export singleton instance
export const tenantDashboardService = TenantDashboardService.getInstance();
