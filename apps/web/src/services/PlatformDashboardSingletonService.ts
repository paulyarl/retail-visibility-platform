/**
 * Platform Dashboard Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached platform dashboard operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';

export interface PlatformStats {
  totalTenants: number;
  activeTenants: number;
  totalItems: number;
  activeItems: number;
  totalUsers: number;
  activeUsers: number;
  totalOrganizations: number;
  systemHealth: {
    database: 'healthy' | 'degraded' | 'down';
    cache: 'healthy' | 'degraded' | 'down';
    api: 'healthy' | 'degraded' | 'down';
  };
  growthMetrics: {
    newTenantsThisMonth: number;
    newItemsThisMonth: number;
    newUsersThisMonth: number;
  };
}

export interface TenantMetrics {
  id: string;
  name: string;
  subscriptionTier: string;
  subscriptionStatus: string;
  locationStatus: string;
  itemCount: number;
  userCount: number;
  lastActive: string;
  healthScore: number;
}

export interface PlatformActivity {
  type: 'tenant_created' | 'item_added' | 'user_registered';
  tenantId: string;
  tenantName: string;
  timestamp: string;
  details: string;
}

export interface PlatformDashboardData {
  stats: PlatformStats;
  topTenants: TenantMetrics[];
  recentActivity: PlatformActivity[];
}

class PlatformDashboardSingletonService extends AuthenticatedApiSingleton {
  private static instance: PlatformDashboardSingletonService;

  private constructor() {
    super('platform-dashboard-singleton');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes for dashboard data (refreshes frequently)
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
   */
  async getPlatformDashboard(): Promise<PlatformDashboardData | null> {
    try {
      const result = await this.makeAuthenticatedRequest<PlatformDashboardData>(
        '/api/platform/dashboard',
        {},
        'platform-dashboard-complete'
      );

      return result;
    } catch (error) {
      console.error('[PlatformDashboardSingleton] Failed to get platform dashboard:', error);
      return null;
    }
  }

  /**
   * Get platform statistics only
   * Uses the /api/platform/stats endpoint
   */
  async getPlatformStats(): Promise<PlatformStats | null> {
    try {
      const result = await this.makeAuthenticatedRequest<PlatformStats>(
        '/api/platform/stats',
        {},
        'platform-stats'
      );

      return result;
    } catch (error) {
      console.error('[PlatformDashboardSingleton] Failed to get platform stats:', error);
      return null;
    }
  }

  /**
   * Get top performing tenants
   * Uses the /api/platform/tenants/top endpoint
   */
  async getTopTenants(limit: number = 10): Promise<TenantMetrics[] | null> {
    try {
      const result = await this.makeAuthenticatedRequest<TenantMetrics[]>(
        `/api/platform/tenants/top?limit=${limit}`,
        {},
        `platform-top-tenants-${limit}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformDashboardSingleton] Failed to get top tenants:', error);
      return null;
    }
  }

  /**
   * Get recent platform activity
   * Uses the /api/platform/activity endpoint
   */
  async getRecentActivity(limit: number = 20): Promise<PlatformActivity[] | null> {
    try {
      const result = await this.makeAuthenticatedRequest<PlatformActivity[]>(
        `/api/platform/activity?limit=${limit}`,
        {},
        `platform-activity-${limit}`
      );

      return result;
    } catch (error) {
      console.error('[PlatformDashboardSingleton] Failed to get recent activity:', error);
      return null;
    }
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
