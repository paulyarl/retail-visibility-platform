/**
 * Public Platform Dashboard Service
 * 
 * Extends PublicApiSingleton to provide public platform dashboard operations
 * Uses public API endpoints for visitors and prospective merchants
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { PlatformDashboardData, PlatformStats, TenantMetrics, PlatformActivity } from './interfaces/PlatformDashboardInterfaces';

class PublicPlatformDashboardService extends PublicApiSingleton {
  private static instance: PublicPlatformDashboardService;

  private constructor() {
    super('public-platform-dashboard');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes for dashboard data (refreshes frequently)
  }

  public static getInstance(): PublicPlatformDashboardService {
    if (!PublicPlatformDashboardService.instance) {
      PublicPlatformDashboardService.instance = new PublicPlatformDashboardService();
    }
    return PublicPlatformDashboardService.instance;
  }

  /**
   * Get public platform dashboard data with caching
   * Uses the /api/public/platform/dashboard endpoint (public version)
   * Returns platform information suitable for visitors and prospective merchants
   */
  async getPublicPlatformDashboard(): Promise<PlatformDashboardData | null> {
    const result = await this.makePublicRequest<PlatformDashboardData>(
      '/api/public/platform/dashboard',
      {},
      'public-platform-dashboard'
    );

    if (!result.success) {
      console.error('[PublicPlatformDashboardService] Failed to get public platform dashboard:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Get public platform statistics only
   * Uses the /api/public/platform/stats endpoint (public version)
   * Returns basic platform metrics for public display
   */
  async getPublicPlatformStats(): Promise<PlatformStats | null> {
    const result = await this.makePublicRequest<PlatformStats>(
      '/api/public/platform/stats',
      {},
      'public-platform-stats'
    );

    if (!result.success) {
      console.error('[PublicPlatformDashboardService] Failed to get public platform stats:', result.error);
      return null;
    }

    return result.data || null;
  }
}

// Export singleton instance
export const publicPlatformDashboardService = PublicPlatformDashboardService.getInstance();
