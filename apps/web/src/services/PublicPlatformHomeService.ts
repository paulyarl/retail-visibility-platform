/**
 * Public Platform Home Service
 * 
 * Extends PublicApiSingleton to provide cached public platform home page operations
 * Used for public platform home page data that doesn't require authentication
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface PublicTenant {
  id: string;
  name: string;
  logoUrl?: string;
  bannerUrl?: string;
  subscriptionTier?: string;
  status?: string;
  subscriptionStatus?: string;
  createdAt?: string;
  updatedAt?: string;
  region?: string;
  language?: string;
  currency?: string;
  data_policy_accepted?: boolean;
  metadata?: any;
  organization?: {
    id: string;
    name: string;
  } | null;
}

export interface PublicPlatformHomeData {
  featuredTenants: PublicTenant[];
  totalTenants: number;
  activeTenants: number;
  totalProducts: number;
  totalOrders: number;
  recentActivity: any[];
  platformStats: {
    totalRevenue: number;
    totalUsers: number;
    totalOrders: number;
    totalProducts: number;
  };
}

class PublicPlatformHomeService extends PublicApiSingleton {
  private static instance: PublicPlatformHomeService;

  private constructor() {
    super('public-platform-home-service');
    this.cacheTTL = 15 * 60 * 1000; // 15 minutes for public home data
  }

  public static getInstance(): PublicPlatformHomeService {
    if (!PublicPlatformHomeService.instance) {
      PublicPlatformHomeService.instance = new PublicPlatformHomeService();
    }
    return PublicPlatformHomeService.instance;
  }

  /**
   * Get public platform home page data
   * Uses the /api/public/platform/home endpoint
   */
  async getPublicPlatformHomeData(): Promise<PublicPlatformHomeData | null> {
    try {
      const response = await this.makePublicRequest<PublicPlatformHomeData>(
        '/public/platform/home',
        {},
        'public-platform-home'
      );

      if (!response.success) {
        console.error('[PublicPlatformHomeService] Failed to get public platform home data:', response.error);
        return null;
      }

      return response.data || null;
    } catch (error) {
      console.error('[PublicPlatformHomeService] Error getting public platform home data:', error);
      return null;
    }
  }

  /**
   * Get public featured tenants
   * Uses the /api/public/platform/featured-tenants endpoint
   */
  async getPublicFeaturedTenants(limit: number = 10): Promise<PublicTenant[] | null> {
    try {
      const response = await this.makePublicRequest<PublicTenant[]>(
        `/public/platform/featured-tenants?limit=${limit}`,
        {},
        'public-featured-tenants'
      );

      if (!response.success) {
        console.error('[PublicPlatformHomeService] Failed to get public featured tenants:', response.error);
        return null;
      }

      return response.data || null;
    } catch (error) {
      console.error('[PublicPlatformHomeService] Error getting public featured tenants:', error);
      return null;
    }
  }
}

// Export singleton instance
export const publicPlatformHomeService = PublicPlatformHomeService.getInstance();
