/**
 * Dashboard Data Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached dashboard data operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';

export interface DashboardStats {
  totalItems: number;
  activeItems: number;
  syncIssues: number;
  locations: number;
}

export interface DashboardData {
  stats: DashboardStats;
  tenant: {
    id: string;
    name: string;
  } | null;
  isChain: boolean;
  organizationName: string | null;
}

export interface UseDashboardDataReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

class DashboardDataSingletonService extends AuthenticatedApiSingleton {
  private static instance: DashboardDataSingletonService;

  private constructor() {
    super('dashboard-data-singleton');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes for dashboard data (changes frequently)
  }

  public static getInstance(): DashboardDataSingletonService {
    if (!DashboardDataSingletonService.instance) {
      DashboardDataSingletonService.instance = new DashboardDataSingletonService();
    }
    return DashboardDataSingletonService.instance;
  }

  /**
   * Get dashboard data for a specific tenant
   */
  async getDashboardData(tenantId: string): Promise<DashboardData> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const url = `/api/dashboard?tenantId=${encodeURIComponent(tenantId)}`;
      
      const result = await this.makeAuthenticatedRequest<DashboardData>(
        url,
        {},
        `dashboard-data-${tenantId}`
      );

      return result || {} as DashboardData;
    } catch (error) {
      console.error('[DashboardDataSingleton] Failed to get dashboard data:', error);
      return {} as DashboardData;
    }
  }

  /**
   * Get dashboard stats only
   */
  async getDashboardStats(tenantId: string): Promise<DashboardStats> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const url = `/api/dashboard/stats?tenantId=${encodeURIComponent(tenantId)}`;
      
      const result = await this.makeAuthenticatedRequest<DashboardStats>(
        url,
        {},
        `dashboard-stats-${tenantId}`
      );

      return result || {} as DashboardStats;
    } catch (error) {
      console.error('[DashboardDataSingleton] Failed to get dashboard stats:', error);
      return {} as DashboardStats;
    }
  }

  /**
   * Invalidate dashboard cache for a specific tenant
   */
  public async invalidateDashboardCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`dashboard-data-${tenantId}*`);
    await this.invalidateCache(`dashboard-stats-${tenantId}*`);
  }

  /**
   * Invalidate all dashboard cache
   */
  public async invalidateAllDashboardCache(): Promise<void> {
    await this.invalidateCache('dashboard-*');
  }
}

// Export singleton instance
export const dashboardDataService = DashboardDataSingletonService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateDashboardCache = async (tenantId: string): Promise<void> => {
  const service = DashboardDataSingletonService.getInstance();
  await service.invalidateDashboardCache(tenantId);
};

export const invalidateAllDashboardCache = async (): Promise<void> => {
  const service = DashboardDataSingletonService.getInstance();
  await service.invalidateAllDashboardCache();
};
