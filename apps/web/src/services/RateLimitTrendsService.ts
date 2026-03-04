/**
 * Rate Limit Trends Service - Admin API Pattern
 *
 * Handles rate limiting trend data and analytics
 * Extends AdminApiSingleton for admin-level security operations
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

// Trend Data Interfaces
export interface TrendData {
  aggregatedData: Array<{
    date: string;
    pathname: string;
    totalWarnings: number;
    blockedWarnings: number;
    uniqueClients: number;
  }>;
  topPaths: Array<{
    pathname: string;
    totalWarnings: number;
    blockedWarnings: number;
    uniqueClients: number;
  }>;
  totalWarnings: number;
  dateRange: {
    start: string;
    end: string;
  };
}

class RateLimitTrendsService extends AdminApiSingleton {
  private static instance: RateLimitTrendsService;

  // TTL constants for different data types
  private readonly TRENDS_TTL = 5 * 60 * 1000; // 5 minutes for trends (frequently updated)

  private constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, {
      ttl: 5 * 60 * 1000, // 5 minutes for admin operations
      ...cacheOptions
    });
  }

  static getInstance(): RateLimitTrendsService {
    if (!RateLimitTrendsService.instance) {
      RateLimitTrendsService.instance = new RateLimitTrendsService('rate-limit-trends-service');
    }
    return RateLimitTrendsService.instance;
  }

  /**
   * Get rate limiting trends data
   * Uses the /api/rate-limit-warnings endpoint
   */
  async getRateLimitTrends(days: number = 7): Promise<TrendData> {
    try {
      const response = await this.makeDefaultRequest<TrendData>(
        `/rate-limit-warnings?days=${days}`,
        {},
        `rate-limit-trends-${days}`,
        this.TRENDS_TTL
      );

      return response.data || {
        aggregatedData: [],
        topPaths: [],
        totalWarnings: 0,
        dateRange: {
          start: '',
          end: ''
        }
      };
    } catch (error) {
      console.error('[RateLimitTrendsService] Failed to get rate limit trends:', error);
      return {
        aggregatedData: [],
        topPaths: [],
        totalWarnings: 0,
        dateRange: {
          start: '',
          end: ''
        }
      };
    }
  }

  /**
   * Invalidate trends cache
   */
  async invalidateTrendsCache(days?: number): Promise<void> {
    if (days) {
      await this.invalidateCache(`rate-limit-trends-${days}`);
    } else {
      // Clear all trend caches
      await this.invalidateCache('rate-limit-trends-1');
      await this.invalidateCache('rate-limit-trends-7');
      await this.invalidateCache('rate-limit-trends-30');
      await this.invalidateCache('rate-limit-trends-90');
    }
  }
}

// Export singleton instance
export const rateLimitTrendsService = RateLimitTrendsService.getInstance();
