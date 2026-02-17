/**
 * Recently Viewed Service - Public API Pattern
 * 
 * Manages recently viewed items for users and public pages
 * Extends PublicApiSingleton for consistent caching and metrics
 */

import { PublicApiSingleton } from '@/providers/base/UniversalSingleton';

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
 * Recently Viewed Service - Public API Pattern
 * 
 * Manages recently viewed items for personalization and user tracking
 * Uses PublicApiSingleton for consistent caching and metrics
 */
class RecentlyViewedService extends PublicApiSingleton {
  private static instance: RecentlyViewedService;
  private recentlyViewedConfig: RecentlyViewedConfig;
  private currentViewStart: string | null = null;
  private currentItemId: string | null = null;

  // TTL constants for different data types
  private readonly RECENT_ITEMS_TTL = 2 * 60 * 1000; // 2 minutes for recent items
  private readonly STATS_TTL = 10 * 60 * 1000; // 10 minutes for stats
  private readonly TRENDS_TTL = 15 * 60 * 1000; // 15 minutes for trends
  private readonly RECOMMENDATIONS_TTL = 5 * 60 * 1000; // 5 minutes for recommendations

  private constructor() {
    super('recently-viewed-service');
    
    // Default configuration
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
   * Track a recently viewed item
   */
  async trackItem(item: Omit<RecentlyViewedItem, 'viewedAt'>): Promise<void> {
    const recentlyViewedItem: RecentlyViewedItem = {
      ...item,
      viewedAt: new Date().toISOString()
    };

    try {
      // Send to API
      await this.makePublicRequest<void>(
        '/api/user/recently-viewed',
        {
          method: 'POST',
          body: JSON.stringify(recentlyViewedItem)
        },
        `track-item-${item.id}-${item.sessionId}`,
        0 // No caching for write operations
      );

      console.log('[RecentlyViewedService] Item tracked successfully:', recentlyViewedItem.id);
    } catch (error) {
      console.error('[RecentlyViewedService] Failed to track item:', error);
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
   * End tracking view duration and record it
   */
  async endView(): Promise<void> {
    if (!this.currentItemId || !this.currentViewStart) {
      return;
    }

    const duration = Math.floor((Date.now() - new Date(this.currentViewStart).getTime()) / 1000);

    try {
      await this.makePublicRequest<void>(
        `/api/user/recently-viewed/${this.currentItemId}/duration`,
        {
          method: 'PUT',
          body: JSON.stringify({ duration })
        },
        `view-duration-${this.currentItemId}`,
        0 // No caching for write operations
      );

      console.log('[RecentlyViewedService] View duration recorded:', duration);
    } catch (error) {
      console.error('[RecentlyViewedService] Failed to record view duration:', error);
    } finally {
      this.currentItemId = null;
      this.currentViewStart = null;
    }
  }

  /**
   * Get recently viewed items for a user or session
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

      const items = await this.makePublicRequest<RecentlyViewedItem[]>(
        endpoint,
        {},
        cacheKey,
        this.RECENT_ITEMS_TTL
      );

      return items.data || [];
    } catch (error) {
      console.error('[RecentlyViewedService] Error fetching recently viewed items:', error);
      return [];
    }
  }

  /**
   * Remove a specific item from recently viewed
   */
  async removeItem(itemId: string, userId?: string): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);

      await this.makePublicRequest<void>(
        `/api/user/recently-viewed/${itemId}${params ? `?${params}` : ''}`,
        { method: 'DELETE' },
        `remove-item-${itemId}-${userId || 'anonymous'}`,
        0 // No caching for write operations
      );

      console.log('[RecentlyViewedService] Item removed:', itemId);
    } catch (error) {
      console.error('[RecentlyViewedService] Failed to remove item:', error);
    }
  }

  /**
   * Clear all recently viewed items for a user
   */
  async clearRecentlyViewed(userId?: string): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);

      await this.makePublicRequest<void>(
        `/api/user/recently-viewed${params ? `?${params}` : ''}`,
        { method: 'DELETE' },
        `clear-recently-viewed-${userId || 'anonymous'}`,
        0 // No caching for write operations
      );

      console.log('[RecentlyViewedService] Recently viewed cleared for user:', userId || 'anonymous');
    } catch (error) {
      console.error('[RecentlyViewedService] Failed to clear recently viewed:', error);
    }
  }

  /**
   * Get recently viewed statistics
   */
  async getStats(userId?: string, days: number = 30): Promise<RecentlyViewedStats> {
    const cacheKey = `recently-viewed-stats-${userId || 'anonymous'}-${days}`;

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      params.append('days', days.toString());

      const queryString = params.toString();
      const endpoint = `/api/user/recently-viewed/stats?${queryString}`;

      const stats = await this.makePublicRequest<RecentlyViewedStats>(
        endpoint,
        {},
        cacheKey,
        this.STATS_TTL
      );

      return stats.data || {
        totalViews: 0,
        uniqueItems: 0,
        averageViewDuration: 0,
        topViewedTypes: [],
        viewTrends: []
      };
    } catch (error) {
      console.error('[RecentlyViewedService] Error fetching recently viewed stats:', error);
      
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
   * Get viewing trends over time
   */
  async getTrends(userId?: string, days: number = 30): Promise<Array<{ date: string; views: number }>> {
    const cacheKey = `recently-viewed-trends-${userId || 'anonymous'}-${days}`;

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      params.append('days', days.toString());

      const queryString = params.toString();
      const endpoint = `/api/user/recently-viewed/trends?${queryString}`;

      const trends = await this.makePublicRequest<Array<{ date: string; views: number }>>(
        endpoint,
        {},
        cacheKey,
        this.TRENDS_TTL
      );

      return trends.data || [];
    } catch (error) {
      console.error('[RecentlyViewedService] Error fetching recently viewed trends:', error);
      return [];
    }
  }

  /**
   * Get personalized recommendations based on recently viewed items
   */
  async getRecommendations(userId?: string, limit: number = 10): Promise<RecentlyViewedItem[]> {
    const cacheKey = `recently-viewed-recommendations-${userId || 'anonymous'}-${limit}`;

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      params.append('limit', limit.toString());

      const queryString = params.toString();
      const endpoint = `/api/user/recently-viewed/recommendations?${queryString}`;

      const recommendations = await this.makePublicRequest<RecentlyViewedItem[]>(
        endpoint,
        {},
        cacheKey,
        this.RECOMMENDATIONS_TTL
      );

      return recommendations.data || [];
    } catch (error) {
      console.error('[RecentlyViewedService] Error fetching personalized recommendations:', error);
      return [];
    }
  }

  /**
   * Get similar items based on a recently viewed item
   */
  async getSimilarItems(itemId: string, limit: number = 5): Promise<RecentlyViewedItem[]> {
    const cacheKey = `similar-items-${itemId}-${limit}`;

    try {
      const similarItems = await this.makePublicRequest<RecentlyViewedItem[]>(
        `/api/user/recently-viewed/${itemId}/similar?limit=${limit}`,
        {},
        cacheKey,
        this.RECOMMENDATIONS_TTL
      );

      return similarItems.data || [];
    } catch (error) {
      console.error('[RecentlyViewedService] Error fetching similar items:', error);
      return [];
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
