/**
 * Platform Dashboard Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached platform dashboard operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '../providers/base/AuthenticatedApiSingleton';
import { PlatformDashboardData, PlatformStats, TenantMetrics, PlatformActivity } from './interfaces/PlatformDashboardInterfaces';

class PlatformDashboardSingletonService extends AuthenticatedApiSingleton {
  private static instance: PlatformDashboardSingletonService;
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes for dashboard data

  protected constructor() {
    super('platform-dashboard-singleton');
  }

  public static getInstance(): PlatformDashboardSingletonService {
    if (!PlatformDashboardSingletonService.instance) {
      PlatformDashboardSingletonService.instance = new PlatformDashboardSingletonService();
    }
    return PlatformDashboardSingletonService.instance;
  }

  /**
   * Get complete platform dashboard data with caching
   * Uses the /api/platform/dashboard endpoint
   * For authenticated tenant merchants only
   */
  async getPlatformDashboard(): Promise<PlatformDashboardData | null> {
    const result = await this.makeDefaultRequest<PlatformDashboardData>(
      '/api/platform/dashboard',
      {},
      'platform-dashboard-complete'
    );

    if (!result.success) {
      console.error('[PlatformDashboardSingleton] Failed to get platform dashboard:', result.error);
      return null;
    }
//    console.log(`[PlatformDashboardSingleton] Got platform dashboard:`, result.data)

    // Handle nested data structure from API response
    const dashboardData = (result.data as any)?.data || result.data;
    return dashboardData || null;
  }

  /**
   * Get platform statistics only
   * Uses the /api/platform/stats endpoint
   */
  async getPlatformStats(): Promise<PlatformStats | null> {
    const result = await this.makeDefaultRequest<PlatformStats>(
      '/api/platform/stats',
      {},
      'platform-stats'
    );

    if (!result.success) {
      console.error('[PlatformDashboardSingleton] Failed to get platform stats:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get top performing tenants
   * Uses the /api/platform/tenants/top endpoint
   */
  async getTopTenants(limit: number = 10): Promise<TenantMetrics[] | null> {
    const result = await this.makeDefaultRequest<TenantMetrics[]>(
      `/api/platform/tenants/top?limit=${limit}`,
      {},
      `platform-top-tenants-${limit}`
    );

    if (!result.success) {
      console.error('[PlatformDashboardSingleton] Failed to get top tenants:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get recent platform activity
   * Uses the /api/platform/activity endpoint
   */
  async getRecentActivity(limit: number = 20): Promise<PlatformActivity[] | null> {
    const result = await this.makeDefaultRequest<PlatformActivity[]>(
      `/api/platform/activity?limit=${limit}`,
      {},
      `platform-activity-${limit}`
    );

    if (!result.success) {
      console.error('[PlatformDashboardSingleton] Failed to get recent activity:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Invalidate platform dashboard cache
   */
  public async invalidateDashboardCache(): Promise<void> {
    await this.invalidateCache('platform-dashboard-*');
  }

  /**
   * Invalidate platform stats cache
   */
  public async invalidateStatsCache(): Promise<void> {
    await this.invalidateCache('platform-stats*');
  }
}

// Export singleton instance
export const platformDashboardService = PlatformDashboardSingletonService.getInstance();

// Export cache invalidation helper for external use
export const invalidatePlatformDashboardCache = async (): Promise<void> => {
  const service = PlatformDashboardSingletonService.getInstance();
  await service.invalidateDashboardCache();
};
