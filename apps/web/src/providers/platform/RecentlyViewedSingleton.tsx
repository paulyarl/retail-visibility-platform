/**
 * Recently Viewed Singleton - Consumer Pattern
 * 
 * Consumes and manages recently viewed items for users
 * Extends PublicApiSingleton for public request context
 */

import { PublicApiSingleton } from '../base/PublicApiSingleton';
import { recentlyViewedService } from '@/services/RecentlyViewedService';
import { clientLogger } from '@/lib/client-logger';

// Recently Viewed Data Interfaces
export interface RecentlyViewedItem {
  id: string;
  type: 'product' | 'store' | 'category' | 'page' | 'shop' | 'directory';
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
 * Recently Viewed Singleton - Consumer Pattern
 * 
 * Consumes and manages recently viewed items for personalization
 * Uses PublicApiSingleton for public request context
 */
class RecentlyViewedSingleton extends PublicApiSingleton {
  private static instance: RecentlyViewedSingleton;
  private recentlyViewedConfig: RecentlyViewedConfig;
  private currentViewStart: string | null = null;
  private currentItemId: string | null = null;

  private constructor() {
    super('recently-viewed-singleton');
    this.recentlyViewedConfig = {
      maxItems: 50,
      retentionDays: 30,
      enableTracking: true,
      trackDuration: true,
      enablePersonalization: true,
      itemTypes: ['product', 'store', 'category', 'page','shop', 'directory']
    };
  }

  static getInstance(): RecentlyViewedSingleton {
    if (!RecentlyViewedSingleton.instance) {
      RecentlyViewedSingleton.instance = new RecentlyViewedSingleton();
    }
    return RecentlyViewedSingleton.instance;
  }

  // ====================
  // RECENTLY VIEWED MANAGEMENT
  // ====================

  /**
   * Add item to recently viewed
   */
  async addRecentlyViewed(
    item: Omit<RecentlyViewedItem, 'viewedAt' | 'sessionId'>,
    options: {
      userId?: string;
      tenantId?: string;
      sessionId?: string;
    } = {}
  ): Promise<RecentlyViewedItem> {
    if (!this.recentlyViewedConfig.enableTracking) {
      throw new Error('Recently viewed tracking is disabled');
    }

    // End current view tracking
    if (this.currentItemId && this.currentViewStart) {
      await this.endCurrentView();
    }

    const recentlyViewedItem: RecentlyViewedItem = {
      ...item,
      viewedAt: new Date().toISOString(),
      userId: options.userId,
      tenantId: options.tenantId,
      sessionId: options.sessionId || this.generateSessionId()
    };

    try {
      // Filter to only valid types for the service
      const validItem = {
        ...recentlyViewedItem,
        type: recentlyViewedItem.type as 'product' | 'store' | 'category' | 'page'
      };
      
      // Track item using service
      await recentlyViewedService.trackItem(validItem);

      // Start tracking view duration
      this.currentItemId = recentlyViewedItem.id;
      this.currentViewStart = new Date().toISOString();

      // Clear cache to force refresh
      await this.clearCache(`recently-viewed-${options.userId || 'anonymous'}`);

      return recentlyViewedItem;
    } catch (error) {
      clientLogger.error('Error adding recently viewed item:', { detail: error });
      throw error;
    }
  }

  /**
   * End current view tracking
   */
  async endCurrentView(): Promise<void> {
    if (!this.currentItemId || !this.currentViewStart) return;

    try {
      // End view using service
      await recentlyViewedService.endView();
    } catch (error) {
      clientLogger.error('Error updating view duration:', { detail: error });
    } finally {
      this.currentItemId = null;
      this.currentViewStart = null;
    }
  }

  /**
   * Get recently viewed items for a user
   */
  async getRecentlyViewed(
    userId?: string,
    options: {
      limit?: number;
      itemType?: string;
      tenantId?: string;
    } = {}
  ): Promise<RecentlyViewedItem[]> {
    const cacheKey = `recently-viewed-${userId || 'anonymous'}-${options.limit || 20}-${options.itemType || 'all'}-${options.tenantId || 'no-tenant'}`;
    
    const cached = await this.getFromCache<RecentlyViewedItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Get items using service
      const items = await recentlyViewedService.getRecentlyViewed({
        userId,
        itemType: options.itemType,
        tenantId: options.tenantId,
        limit: options.limit
      });
      
      await this.setCache(cacheKey, items);
      return items;
    } catch (error) {
      clientLogger.error('Error fetching recently viewed items:', { detail: error });
      return [];
    }
  }

  /**
   * Get recently viewed items by type
   */
  async getRecentlyViewedByType(
    itemType: string,
    userId?: string,
    limit: number = 10
  ): Promise<RecentlyViewedItem[]> {
    return this.getRecentlyViewed(userId, { itemType, limit });
  }

  /**
   * Get recently viewed products
   */
  async getRecentlyViewedProducts(userId?: string, limit: number = 10): Promise<RecentlyViewedItem[]> {
    return this.getRecentlyViewedByType('product', userId, limit);
  }

  /**
   * Get recently viewed stores
   */
  async getRecentlyViewedStores(userId?: string, limit: number = 10): Promise<RecentlyViewedItem[]> {
    return this.getRecentlyViewedByType('store', userId, limit);
  }

  /**
   * Remove item from recently viewed
   */
  async removeRecentlyViewed(itemId: string, userId?: string): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        `/api/user/recently-viewed/${itemId}`,
        { method: 'DELETE' },
        `remove-${itemId}-${userId || 'anonymous'}`
      );

      // Clear cache
      await this.clearCache(`recently-viewed-${userId || 'anonymous'}`);
    } catch (error) {
      clientLogger.error('Failed to remove recently viewed item:', { detail: error });
      throw error;
    }
  }

  /**
   * Clear all recently viewed items for a user
   */
  async clearRecentlyViewed(userId?: string): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/user/recently-viewed',
        { method: 'DELETE' },
        `clear-${userId || 'anonymous'}`
      );

      // Clear cache
      await this.clearCache(`recently-viewed-${userId || 'anonymous'}`);
    } catch (error) {
      clientLogger.error('Failed to clear recently viewed items:', { detail: error });
      throw error;
    }
  }

  // ====================
  // RECENTLY VIEWED ANALYTICS
  // ====================

  /**
   * Get recently viewed statistics
   */
  async getRecentlyViewedStats(userId?: string, days: number = 30): Promise<RecentlyViewedStats> {
    const cacheKey = `recently-viewed-stats-${userId || 'anonymous'}-${days}`;
    
    const cached = await this.getFromCache<RecentlyViewedStats>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const stats = await this.makeDefaultRequest<RecentlyViewedStats>(
        `/api/user/recently-viewed/stats?userId=${userId || 'anonymous'}&days=${days}`,
        {},
        cacheKey
      );
      
      return stats.data || {
        totalViews: 0,
        uniqueItems: 0,
        averageViewDuration: 0,
        topViewedTypes: [],
        viewTrends: []
      };
    } catch (error) {
      clientLogger.error('Failed to fetch recently viewed stats:', { detail: error });
      // Return default stats on error
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
   * Get recently viewed trends
   */
  async getRecentlyViewedTrends(userId?: string, days: number = 7): Promise<Array<{
    date: string;
    views: number;
    uniqueItems: number;
  }>> {
    const cacheKey = `recently-viewed-trends-${userId || 'anonymous'}-${days}`;
    
    const cached = await this.getFromCache<Array<{
      date: string;
      views: number;
      uniqueItems: number;
    }>>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const trends = await this.makeDefaultRequest<Array<{date: string; views: number; uniqueItems: number}>>(
        `/api/user/recently-viewed/trends?userId=${userId || 'anonymous'}&days=${days}`,
        {},
        cacheKey
      );
      
      return trends.data || [];
    } catch (error) {
      clientLogger.error('Failed to fetch recently viewed trends:', { detail: error });
      return [];
    }
  }

  /**
   * Update recently viewed configuration
   */
  async updateRecentlyViewedConfig(config: Partial<RecentlyViewedConfig>): Promise<void> {
    this.recentlyViewedConfig = { ...this.recentlyViewedConfig, ...config };
    
    // Cache configuration
    await this.setCache('recently-viewed-config', this.recentlyViewedConfig);
  }

  /**
   * Get recently viewed configuration
   */
  async getRecentlyViewedConfig(): Promise<RecentlyViewedConfig> {
    const cached = await this.getFromCache<RecentlyViewedConfig>('recently-viewed-config');
    if (cached) {
      return cached;
    }

    await this.setCache('recently-viewed-config', this.recentlyViewedConfig);
    return this.recentlyViewedConfig;
  }

  // ====================
  // PERSONALIZATION FEATURES
  // ====================

  /**
   * Get personalized recommendations based on recently viewed
   */
  async getPersonalizedRecommendations(
    userId?: string,
    limit: number = 10
  ): Promise<RecentlyViewedItem[]> {
    const cacheKey = `personalized-recommendations-${userId || 'anonymous'}-${limit}`;
    
    const cached = await this.getFromCache<RecentlyViewedItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      params.append('limit', limit.toString());

      const recommendations = await this.makeDefaultRequest<RecentlyViewedItem[]>(
        `/api/user/recently-viewed/recommendations?${params}`,
        {},
        cacheKey
      );
      if (!recommendations.success){
        clientLogger.error('Error fetching personalized recommendations:', { detail: recommendations.error });
        return [];
      }
      
      return recommendations.data || [];
    } catch (error) {
      clientLogger.error('Error fetching personalized recommendations:', { detail: error });
      return [];
    }
  }

  /**
   * Get similar items based on recently viewed
   */
  async getSimilarItems(itemId: string, limit: number = 5): Promise<RecentlyViewedItem[]> {
    const cacheKey = `similar-items-${itemId}-${limit}`;
    
    const cached = await this.getFromCache<RecentlyViewedItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const similarItems = await this.makeDefaultRequest<RecentlyViewedItem[]>(
        `/api/user/recently-viewed/${itemId}/similar?limit=${limit}`,
        {},
        cacheKey
      );
      
      return similarItems.data || [];
    } catch (error) {
      clientLogger.error('Error fetching similar items:', { detail: error });
      return [];
    }
  }

  // ====================
  // RECENTLY VIEWED SPECIFIC METRICS
  // ====================

  protected getCustomMetrics(): Record<string, any> {
    return {
      trackingEnabled: this.recentlyViewedConfig.enableTracking,
      currentViewActive: !!this.currentItemId,
      maxItems: this.recentlyViewedConfig.maxItems,
      retentionDays: this.recentlyViewedConfig.retentionDays,
      lastViewUpdate: new Date().toISOString()
    };
  }

  // ====================
  // UTILITY METHODS
  // ====================

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ====================
  // CLEANUP
  // ====================

  /**
   * Cleanup recently viewed resources
   */
  async cleanup(): Promise<void> {
    // End current view tracking
    await this.endCurrentView();
    
    // Clear cache
    await this.clearCache();
  }
}

// Export singleton instance
export const recentlyViewedSingleton = RecentlyViewedSingleton.getInstance();

export default RecentlyViewedSingleton;
