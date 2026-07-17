/**
 * Recently Viewed Service - Real-Time Behavior Tracking
 * 
 * Manages recently viewed items for real-time behavior display
 * NO CACHE for instant behavior updates and live user tracking
 * Extends PublicApiSingleton for consistent metrics and targeting
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { clientLogger } from '@/lib/client-logger';

// Recently Viewed Data Interfaces
export interface RecentlyViewedItem {
  id: string;
  type: 'product' | 'store' | 'category' | 'page';
  title: string;
  description?: string;
  imageUrl?: string;
  url: string;
  viewedAt: string;
  userId?: string;
  tenantId?: string;
  sessionId: string;
  duration?: number; // Time spent on item in seconds
  metadata?: Record<string, any>;
}

export interface RecentlyViewedConfig {
  maxItems: number;
  retentionDays: number;
  enableTracking: boolean;
  trackDuration: boolean;
  enablePersonalization: boolean;
  itemTypes: string[];
}

export interface RecentlyViewedStats {
  totalViews: number;
  uniqueItems: number;
  averageViewDuration: number;
  topViewedTypes: Array<{
    type: string;
    count: number;
  }>;
  viewTrends: Array<{
    date: string;
    views: number;
  }>;
}

/**
 * Recently Viewed Service - Real-Time Behavior Tracking
 * 
 * Manages recently viewed items for real-time behavior display
 * Uses NO CACHE for instant updates and live user tracking
 * Optimized for real-time dashboards and behavior monitoring
 */
class RecentlyViewedService extends PublicApiSingleton {
  private static instance: RecentlyViewedService;
  private recentlyViewedConfig: RecentlyViewedConfig;
  private currentViewStart: string | null = null;
  private currentItemId: string | null = null;

  // ⚡ NO CACHE - Real-time behavior tracking
  // All operations use TTL = 0 for instant data
  private readonly NO_CACHE = 0;

  private constructor() {
    super('recently-viewed-service');
    
    // Default configuration optimized for real-time tracking
    this.recentlyViewedConfig = {
      maxItems: 50,
      retentionDays: 30,
      enableTracking: true,
      trackDuration: true,
      enablePersonalization: true,
      itemTypes: ['product', 'store', 'category', 'page']
    };
  }

  static getInstance(): RecentlyViewedService {
    if (!RecentlyViewedService.instance) {
      RecentlyViewedService.instance = new RecentlyViewedService();
    }
    return RecentlyViewedService.instance;
  }

  /**
   * Track a recently viewed item (REAL-TIME)
   * No cache - instant behavior tracking
   */
  async trackItem(item: Omit<RecentlyViewedItem, 'viewedAt'>): Promise<void> {
    const recentlyViewedItem: RecentlyViewedItem = {
      ...item,
      viewedAt: new Date().toISOString()
    };

    try {
      // ⚡ REAL-TIME: No cache for instant tracking
      await this.makeDefaultRequest<void>(
        '/api/user/recently-viewed',
        {
          method: 'POST',
          body: JSON.stringify(recentlyViewedItem)
        },
        `track-item-${item.id}-${item.sessionId}`,
        this.NO_CACHE // ⚡ NO CACHE - Real-time tracking
      );

      console.log('[RecentlyViewedService] ⚡ Item tracked in real-time:', recentlyViewedItem.id);
    } catch (error) {
      clientLogger.error('[RecentlyViewedService] Failed to track item:', { detail: error });
    }
  }

  /**
   * Start tracking view duration for an item
   */
  async startView(itemId: string): Promise<void> {
    this.currentItemId = itemId;
    this.currentViewStart = new Date().toISOString();
  }

  /**
   * End tracking view duration and record it (REAL-TIME)
   */
  async endView(): Promise<void> {
    if (!this.currentItemId || !this.currentViewStart) {
      return;
    }

    const duration = Math.floor((Date.now() - new Date(this.currentViewStart).getTime()) / 1000);

    try {
      // ⚡ REAL-TIME: No cache for instant duration tracking
      await this.makeDefaultRequest<void>(
        `/api/user/recently-viewed/${this.currentItemId}/duration`,
        {
          method: 'PUT',
          body: JSON.stringify({ duration })
        },
        `view-duration-${this.currentItemId}`,
        this.NO_CACHE // ⚡ NO CACHE - Real-time duration
      );

      console.log('[RecentlyViewedService] ⚡ View duration recorded in real-time:', duration);
    } catch (error) {
      clientLogger.error('[RecentlyViewedService] Failed to record view duration:', { detail: error });
    } finally {
      this.currentItemId = null;
      this.currentViewStart = null;
    }
  }

  /**
   * Get recently viewed items (REAL-TIME)
   * No cache - always show latest behavior
   */
  async getRecentlyViewed(options: {
    userId?: string;
    sessionId?: string;
    itemType?: string;
    tenantId?: string;
    limit?: number;
  } = {}): Promise<RecentlyViewedItem[]> {
    const cacheKey = `recently-viewed-${options.userId || 'anonymous'}-${options.sessionId || 'no-session'}-${options.itemType || 'all'}-${options.tenantId || 'no-tenant'}-${options.limit || 20}`;

    try {
      const params = new URLSearchParams();
      if (options.userId) params.append('userId', options.userId);
      if (options.sessionId) params.append('sessionId', options.sessionId);
      if (options.itemType) params.append('itemType', options.itemType);
      if (options.tenantId) params.append('tenantId', options.tenantId);
      if (options.limit) params.append('limit', options.limit.toString());

      const queryString = params.toString();
      const endpoint = `/api/user/recently-viewed${queryString ? `?${queryString}` : ''}`;

      // ⚡ REAL-TIME: No cache for latest behavior data
      const items = await this.makeDefaultRequest<RecentlyViewedItem[]>(
        endpoint,
        {},
        cacheKey,
        this.NO_CACHE // ⚡ NO CACHE - Real-time data
      );

      return items.data || [];
    } catch (error) {
      clientLogger.error('[RecentlyViewedService] Error fetching recently viewed items:', { detail: error });
      return [];
    }
  }

  /**
   * Remove a specific item from recently viewed (REAL-TIME)
   */
  async removeItem(itemId: string, userId?: string): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);

      await this.makeDefaultRequest<void>(
        `/api/user/recently-viewed/${itemId}${params ? `?${params}` : ''}`,
        { method: 'DELETE' },
        `remove-item-${itemId}-${userId || 'anonymous'}`,
        this.NO_CACHE // ⚡ NO CACHE - Real-time removal
      );

      console.log('[RecentlyViewedService] ⚡ Item removed in real-time:', itemId);
    } catch (error) {
      clientLogger.error('[RecentlyViewedService] Failed to remove item:', { detail: error });
    }
  }

  /**
   * Clear all recently viewed items for a user (REAL-TIME)
   */
  async clearRecentlyViewed(userId?: string): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);

      await this.makeDefaultRequest<void>(
        `/api/user/recently-viewed${params ? `?${params}` : ''}`,
        { method: 'DELETE' },
        `clear-recently-viewed-${userId || 'anonymous'}`,
        this.NO_CACHE // ⚡ NO CACHE - Real-time clearing
      );

      console.log('[RecentlyViewedService] ⚡ Recently viewed cleared in real-time for user:', userId || 'anonymous');
    } catch (error) {
      clientLogger.error('[RecentlyViewedService] Failed to clear recently viewed:', { detail: error });
    }
  }

  /**
   * Get recently viewed statistics (REAL-TIME)
   * No cache - always show latest behavior stats
   */
  async getStats(userId?: string, days: number = 30): Promise<RecentlyViewedStats> {
    const cacheKey = `recently-viewed-stats-${userId || 'anonymous'}-${days}`;

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      params.append('days', days.toString());

      const queryString = params.toString();
      const endpoint = `/api/user/recently-viewed/stats?${queryString}`;

      // ⚡ REAL-TIME: No cache for latest statistics
      const stats = await this.makeDefaultRequest<RecentlyViewedStats>(
        endpoint,
        {},
        cacheKey,
        this.NO_CACHE // ⚡ NO CACHE - Real-time stats
      );

      return stats.data || {
        totalViews: 0,
        uniqueItems: 0,
        averageViewDuration: 0,
        topViewedTypes: [],
        viewTrends: []
      };
    } catch (error) {
      clientLogger.error('[RecentlyViewedService] Error fetching recently viewed stats:', { detail: error });
      
      // Return default stats
      return {
        totalViews: 0,
        uniqueItems: 0,
        averageViewDuration: 0,
        topViewedTypes: [],
        viewTrends: []
      };
    }
  }

  /**
   * Get viewing trends over time (REAL-TIME)
   * No cache - always show latest trends
   */
  async getTrends(userId?: string, days: number = 30): Promise<Array<{ date: string; views: number }>> {
    const cacheKey = `recently-viewed-trends-${userId || 'anonymous'}-${days}`;

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      params.append('days', days.toString());

      const queryString = params.toString();
      const endpoint = `/api/user/recently-viewed/trends?${queryString}`;

      // ⚡ REAL-TIME: No cache for latest trends
      const trends = await this.makeDefaultRequest<Array<{ date: string; views: number }>>(
        endpoint,
        {},
        cacheKey,
        this.NO_CACHE // ⚡ NO CACHE - Real-time trends
      );

      return trends.data || [];
    } catch (error) {
      clientLogger.error('[RecentlyViewedService] Error fetching recently viewed trends:', { detail: error });
      return [];
    }
  }

  /**
   * Get personalized recommendations (REAL-TIME)
   * No cache - always show latest recommendations based on current behavior
   */
  async getRecommendations(userId?: string, limit: number = 10): Promise<RecentlyViewedItem[]> {
    const cacheKey = `recently-viewed-recommendations-${userId || 'anonymous'}-${limit}`;

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      params.append('limit', limit.toString());

      const queryString = params.toString();
      const endpoint = `/api/user/recently-viewed/recommendations?${queryString}`;

      // ⚡ REAL-TIME: No cache for latest recommendations
      const recommendations = await this.makeDefaultRequest<RecentlyViewedItem[]>(
        endpoint,
        {},
        cacheKey,
        this.NO_CACHE // ⚡ NO CACHE - Real-time recommendations
      );

      return recommendations.data || [];
    } catch (error) {
      clientLogger.error('[RecentlyViewedService] Error fetching personalized recommendations:', { detail: error });
      return [];
    }
  }

  /**
   * Get similar items based on a recently viewed item (REAL-TIME)
   * No cache - always show latest similar items
   */
  async getSimilarItems(itemId: string, limit: number = 5): Promise<RecentlyViewedItem[]> {
    const cacheKey = `similar-items-${itemId}-${limit}`;

    try {
      // ⚡ REAL-TIME: No cache for latest similar items
      const similarItems = await this.makeDefaultRequest<RecentlyViewedItem[]>(
        `/api/user/recently-viewed/${itemId}/similar?limit=${limit}`,
        {},
        cacheKey,
        this.NO_CACHE // ⚡ NO CACHE - Real-time similar items
      );

      return similarItems.data || [];
    } catch (error) {
      clientLogger.error('[RecentlyViewedService] Error fetching similar items:', { detail: error });
      return [];
    }
  }

  /**
   * ⚡ REAL-TIME BEHAVIOR MONITORING
   * Get live behavior data for dashboards
   */
  async getLiveBehavior(options: {
    userId?: string;
    sessionId?: string;
    tenantId?: string;
  } = {}): Promise<{
    currentView?: RecentlyViewedItem;
    recentViews: RecentlyViewedItem[];
    stats: RecentlyViewedStats;
    trends: Array<{ date: string; views: number }>;
  }> {
    try {
      // ⚡ ALL REAL-TIME: No cache anywhere
      const [recentViews, stats, trends] = await Promise.all([
        this.getRecentlyViewed({ ...options, limit: 10 }),
        this.getStats(options.userId),
        this.getTrends(options.userId, 7) // 7 days for live trends
      ]);

      return {
        recentViews,
        stats,
        trends
      };
    } catch (error) {
      clientLogger.error('[RecentlyViewedService] Error fetching live behavior:', { detail: error });
      return {
        recentViews: [],
        stats: {
          totalViews: 0,
          uniqueItems: 0,
          averageViewDuration: 0,
          topViewedTypes: [],
          viewTrends: []
        },
        trends: []
      };
    }
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RecentlyViewedConfig>): void {
    this.recentlyViewedConfig = { ...this.recentlyViewedConfig, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): RecentlyViewedConfig {
    return { ...this.recentlyViewedConfig };
  }
}

// Export singleton instance
export const recentlyViewedService = RecentlyViewedService.getInstance();
