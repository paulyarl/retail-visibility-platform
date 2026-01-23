/**
 * Recently Viewed Singleton - Consumer Pattern
 * 
 * Consumes and manages recently viewed items for users
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';

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
 * Recently Viewed Singleton - Consumer Pattern
 * 
 * Consumes and manages recently viewed items for personalization
 */
class RecentlyViewedSingleton extends UniversalSingleton {
  private static instance: RecentlyViewedSingleton;
  private recentlyViewedConfig: RecentlyViewedConfig;
  private currentViewStart: string | null = null;
  private currentItemId: string | null = null;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
    this.recentlyViewedConfig = {
      maxItems: 50,
      retentionDays: 30,
      enableTracking: true,
      trackDuration: true,
      enablePersonalization: true,
      itemTypes: ['product', 'store', 'category', 'page']
    };
  }

  static getInstance(): RecentlyViewedSingleton {
    if (!RecentlyViewedSingleton.instance) {
      RecentlyViewedSingleton.instance = new RecentlyViewedSingleton('recently-viewed-singleton');
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
      // Send to API
      const response = await fetch('/api/user/recently-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recentlyViewedItem)
      });

      if (!response.ok) {
        throw new Error('Failed to add recently viewed item');
      }

      const createdItem = await response.json();

      // Start tracking view duration
      this.currentItemId = createdItem.id;
      this.currentViewStart = new Date().toISOString();

      // Clear cache to force refresh
      await this.clearCache(`recently-viewed-${options.userId || 'anonymous'}`);

      return createdItem;
    } catch (error) {
      console.error('Error adding recently viewed item:', error);
      throw error;
    }
  }

  /**
   * End current view tracking
   */
  async endCurrentView(): Promise<void> {
    if (!this.currentItemId || !this.currentViewStart) return;

    const duration = Math.floor((Date.now() - new Date(this.currentViewStart).getTime()) / 1000);

    try {
      const response = await fetch(`/api/user/recently-viewed/${this.currentItemId}/duration`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration })
      });

      if (!response.ok) {
        throw new Error('Failed to update view duration');
      }
    } catch (error) {
      console.error('Error updating view duration:', error);
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
    const cacheKey = `recently-viewed-${userId || 'anonymous'}-${JSON.stringify(options)}`;
    
    const cached = await this.getFromCache<RecentlyViewedItem[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.itemType) params.append('itemType', options.itemType);
      if (options.tenantId) params.append('tenantId', options.tenantId);

      const response = await fetch(`/api/user/recently-viewed?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch recently viewed items');
      }

      const items = await response.json();
      
      await this.setCache(cacheKey, items);
      return items;
    } catch (error) {
      console.error('Error fetching recently viewed items:', error);
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
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);

      const response = await fetch(`/api/user/recently-viewed/${itemId}?${params}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to remove recently viewed item');
      }

      // Clear cache
      await this.clearCache(`recently-viewed-${userId || 'anonymous'}`);
    } catch (error) {
      console.error('Error removing recently viewed item:', error);
      throw error;
    }
  }

  /**
   * Clear all recently viewed items for a user
   */
  async clearRecentlyViewed(userId?: string): Promise<void> {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);

      const response = await fetch(`/api/user/recently-viewed?${params}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to clear recently viewed items');
      }

      // Clear cache
      await this.clearCache(`recently-viewed-${userId || 'anonymous'}`);
    } catch (error) {
      console.error('Error clearing recently viewed items:', error);
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
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      params.append('days', days.toString());

      const response = await fetch(`/api/user/recently-viewed/stats?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch recently viewed stats');
      }

      const stats = await response.json();
      
      await this.setCache(cacheKey, stats);
      return stats;
    } catch (error) {
      console.error('Error fetching recently viewed stats:', error);
      
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
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      params.append('days', days.toString());

      const response = await fetch(`/api/user/recently-viewed/trends?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch recently viewed trends');
      }

      const trends = await response.json();
      
      await this.setCache(cacheKey, trends);
      return trends;
    } catch (error) {
      console.error('Error fetching recently viewed trends:', error);
      return [];
    }
  }

  // ====================
  // RECENTLY VIEWED CONFIGURATION
  // ====================

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

      const response = await fetch(`/api/user/recently-viewed/recommendations?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch personalized recommendations');
      }

      const recommendations = await response.json();
      
      await this.setCache(cacheKey, recommendations);
      return recommendations;
    } catch (error) {
      console.error('Error fetching personalized recommendations:', error);
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
      const response = await fetch(`/api/user/recently-viewed/${itemId}/similar?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch similar items');
      }

      const similarItems = await response.json();
      
      await this.setCache(cacheKey, similarItems);
      return similarItems;
    } catch (error) {
      console.error('Error fetching similar items:', error);
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
