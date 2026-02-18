/**
 * Platform Public Service - Public API Pattern
 * 
 * Handles public platform data that doesn't require authentication
 * Extends PublicApiSingleton for consistent caching and metrics
 */

import { PublicApiSingleton } from '@/providers/base/UniversalSingleton';

export interface PlatformStats {
  totalTenants: number;
  totalProducts: number;
  totalCategories: number;
  activeUsers: number;
  featuredStores: number;
  totalScans: number;
  uptime: number;
  version: string;
}

export interface FeaturesShowcaseConfig {
  mode: 'hybrid' | 'featured' | 'recent' | 'trending';
  enabled: boolean;
  maxItems: number;
  refreshInterval: number;
}

/**
 * Platform Public Service - Public API Pattern
 * 
 * Handles public platform data that doesn't require authentication
 * Uses PublicApiSingleton for consistent caching and metrics
 */
class PlatformPublicService extends PublicApiSingleton {
  private static instance: PlatformPublicService;

  // TTL constants for different data types
  private readonly PLATFORM_STATS_TTL = 5 * 60 * 1000; // 5 minutes for stats
  private readonly SHOWCASE_CONFIG_TTL = 30 * 60 * 1000; // 30 minutes for showcase config

  private constructor() {
    super('platform-public-service');
  }

  static getInstance(): PlatformPublicService {
    if (!PlatformPublicService.instance) {
      PlatformPublicService.instance = new PlatformPublicService();
    }
    return PlatformPublicService.instance;
  }

  /**
   * Get public platform statistics
   */
  async getPlatformStats(): Promise<PlatformStats> {
    try {
      const response = await this.makePublicRequest<PlatformStats>(
        '/api/public/platform/stats',
        {},
        'platform-stats',
        this.PLATFORM_STATS_TTL
      );
      if (!response.success) {
        console.error('[PlatformPublicService] Failed to get platform stats:', response.error);
        return {
          totalTenants: 0,
          totalProducts: 0,
          totalCategories: 0,
          activeUsers: 0,
          featuredStores: 0,
          totalScans: 0,
          uptime: 0,
          version: '1.0.0'
        };
      }

      return response.data || {
        totalTenants: 0,
        totalProducts: 0,
        totalCategories: 0,
        activeUsers: 0,
        featuredStores: 0,
        totalScans: 0,
        uptime: 0,
        version: '1.0.0'
      };
    } catch (error) {
      console.error('[PlatformPublicService] Failed to get platform stats:', error);
      return {
        totalTenants: 0,
        totalProducts: 0,
        totalCategories: 0,
        activeUsers: 0,
        featuredStores: 0,
        totalScans: 0,
        uptime: 0,
        version: '1.0.0'
      };
    }
  }

  /**
   * Get features showcase configuration
   */
  async getFeaturesShowcaseConfig(): Promise<FeaturesShowcaseConfig> {
    try {
      const response = await this.makePublicRequest<FeaturesShowcaseConfig>(
        '/api/public/features-showcase-config',
        {},
        'features-showcase-config',
        this.SHOWCASE_CONFIG_TTL
      );

      if (!response.success) {
        console.error('[PlatformPublicService] Failed to get features showcase config:', response.error);
        return {
          mode: 'hybrid',
          enabled: true,
          maxItems: 10,
          refreshInterval: 300000 // 5 minutes
        };
      }

      return response.data || {
        mode: 'hybrid',
        enabled: true,
        maxItems: 10,
        refreshInterval: 300000 // 5 minutes
      };
    } catch (error) {
      console.error('[PlatformPublicService] Failed to get features showcase config:', error);
      return {
        mode: 'hybrid',
        enabled: true,
        maxItems: 10,
        refreshInterval: 300000 // 5 minutes
      };
    }
  }

  /**
   * Invalidate platform stats cache
   */
  async invalidatePlatformStatsCache(): Promise<void> {
    await this.invalidateCache('platform-stats');
  }

  /**
   * Invalidate showcase config cache
   */
  async invalidateShowcaseConfigCache(): Promise<void> {
    await this.invalidateCache('features-showcase-config');
  }
}

// Export singleton instance
export const platformPublicService = PlatformPublicService.getInstance();
