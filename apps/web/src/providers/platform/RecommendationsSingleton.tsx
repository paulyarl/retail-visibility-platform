/**
 * Recommendations Singleton - Consumer Pattern
 * 
 * Consumes and manages recommendation data for users
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';
import { RecentlyViewedItem } from './RecentlyViewedSingleton';

// Recommendations Data Interfaces
export interface Recommendation {
  id: string;
  type: 'product' | 'store' | 'category' | 'content';
  itemId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  url: string;
  score: number; // 0-1 confidence score
  reason: string;
  source: 'collaborative' | 'content' | 'behavior' | 'popularity' | 'hybrid';
  metadata?: Record<string, any>;
  generatedAt: string;
  expiresAt?: string;
  userId?: string;
  tenantId?: string;
}

export interface RecommendationConfig {
  enableRecommendations: boolean;
  maxRecommendations: number;
  cacheMinutes: number;
  sources: Array<'collaborative' | 'content' | 'behavior' | 'popularity' | 'hybrid'>;
  minScore: number;
  enablePersonalization: boolean;
  enableAIBased: boolean;
}

export interface RecommendationAnalytics {
  totalRecommendations: number;
  clickThroughRate: number;
  conversionRate: number;
  topSources: Array<{
    source: string;
    count: number;
    ctr: number;
  }>;
  topTypes: Array<{
    type: string;
    count: number;
    ctr: number;
  }>;
  averageScore: number;
  performanceTrends: Array<{
    date: string;
    recommendations: number;
    clicks: number;
    conversions: number;
  }>;
}

export interface RecommendationFeedback {
  recommendationId: string;
  userId?: string;
  action: 'click' | 'view' | 'dismiss' | 'convert' | 'like' | 'dislike';
  timestamp: string;
  context?: Record<string, any>;
}

/**
 * Recommendations Singleton - Consumer Pattern
 * 
 * Consumes and manages recommendation data for personalization
 */
class RecommendationsSingleton extends UniversalSingleton {
  private static instance: RecommendationsSingleton;
  private recommendationConfig: RecommendationConfig;
  private feedbackQueue: RecommendationFeedback[] = [];
  private feedbackInterval: NodeJS.Timeout | null = null;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
    this.recommendationConfig = {
      enableRecommendations: true,
      maxRecommendations: 20,
      cacheMinutes: 15,
      sources: ['collaborative', 'content', 'behavior', 'popularity', 'hybrid'],
      minScore: 0.3,
      enablePersonalization: true,
      enableAIBased: false
    };
    this.initializeFeedbackProcessing();
  }

  static getInstance(): RecommendationsSingleton {
    if (!RecommendationsSingleton.instance) {
      RecommendationsSingleton.instance = new RecommendationsSingleton('recommendations-singleton');
    }
    return RecommendationsSingleton.instance;
  }

  // ====================
  // RECOMMENDATIONS INITIALIZATION
  // ====================

  private initializeFeedbackProcessing(): void {
    // Start feedback processing
    this.feedbackInterval = setInterval(() => {
      this.processFeedbackBatch();
    }, 30000); // Process every 30 seconds
  }

  // ====================
  // RECOMMENDATIONS CONSUMPTION
  // ====================

  /**
   * Get personalized recommendations for a user
   */
  async getPersonalizedRecommendations(
    userId?: string,
    options: {
      type?: string;
      limit?: number;
      sources?: Array<'collaborative' | 'content' | 'behavior' | 'popularity' | 'hybrid'>;
      minScore?: number;
      tenantId?: string;
    } = {}
  ): Promise<Recommendation[]> {
    if (!this.recommendationConfig.enableRecommendations) {
      return [];
    }

    const cacheKey = `recommendations-${userId || 'anonymous'}-${JSON.stringify(options)}`;
    
    const cached = await this.getFromCache<Recommendation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams();
      if (userId) params.append('userId', userId);
      if (options.type) params.append('type', options.type);
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.sources) params.append('sources', options.sources.join(','));
      if (options.minScore) params.append('minScore', options.minScore.toString());
      if (options.tenantId) params.append('tenantId', options.tenantId);

      const response = await fetch(`/api/recommendations/personalized?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch personalized recommendations');
      }

      const recommendations = await response.json();
      
      // Filter by minimum score
      const filteredRecommendations = recommendations.filter((rec: Recommendation) => 
        rec.score >= (options.minScore || this.recommendationConfig.minScore)
      );

      await this.setCache(cacheKey, filteredRecommendations);
      return filteredRecommendations;
    } catch (error) {
      console.error('Error fetching personalized recommendations:', error);
      return [];
    }
  }

  /**
   * Get popular recommendations
   */
  async getPopularRecommendations(
    options: {
      type?: string;
      limit?: number;
      tenantId?: string;
      timeRange?: number; // hours
    } = {}
  ): Promise<Recommendation[]> {
    const cacheKey = `popular-recommendations-${JSON.stringify(options)}`;
    
    const cached = await this.getFromCache<Recommendation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams();
      if (options.type) params.append('type', options.type);
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.tenantId) params.append('tenantId', options.tenantId);
      if (options.timeRange) params.append('timeRange', options.timeRange.toString());

      const response = await fetch(`/api/recommendations/popular?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch popular recommendations');
      }

      const recommendations = await response.json();
      
      await this.setCache(cacheKey, recommendations);
      return recommendations;
    } catch (error) {
      console.error('Error fetching popular recommendations:', error);
      return [];
    }
  }

  /**
   * Get similar item recommendations
   */
  async getSimilarItemRecommendations(
    itemId: string,
    itemType: string,
    options: {
      limit?: number;
      userId?: string;
      tenantId?: string;
    } = {}
  ): Promise<Recommendation[]> {
    const cacheKey = `similar-recommendations-${itemId}-${itemType}-${JSON.stringify(options)}`;
    
    const cached = await this.getFromCache<Recommendation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams();
      params.append('itemId', itemId);
      params.append('itemType', itemType);
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.userId) params.append('userId', options.userId);
      if (options.tenantId) params.append('tenantId', options.tenantId);

      const response = await fetch(`/api/recommendations/similar?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch similar item recommendations');
      }

      const recommendations = await response.json();
      
      await this.setCache(cacheKey, recommendations);
      return recommendations;
    } catch (error) {
      console.error('Error fetching similar item recommendations:', error);
      return [];
    }
  }

  /**
   * Get recommendations based on recently viewed
   */
  async getRecommendationsFromRecentlyViewed(
    recentlyViewed: RecentlyViewedItem[],
    userId?: string,
    limit: number = 10
  ): Promise<Recommendation[]> {
    const cacheKey = `recommendations-from-recently-viewed-${userId || 'anonymous'}-${limit}`;
    
    const cached = await this.getFromCache<Recommendation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch('/api/recommendations/from-recently-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recentlyViewed,
          userId,
          limit
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations from recently viewed');
      }

      const recommendations = await response.json();
      
      await this.setCache(cacheKey, recommendations);
      return recommendations;
    } catch (error) {
      console.error('Error fetching recommendations from recently viewed:', error);
      return [];
    }
  }

  /**
   * Get contextual recommendations
   */
  async getContextualRecommendations(
    context: {
      page: string;
      itemType?: string;
      itemId?: string;
      userSegment?: string;
    },
    userId?: string,
    limit: number = 10
  ): Promise<Recommendation[]> {
    const cacheKey = `contextual-recommendations-${JSON.stringify(context)}-${userId || 'anonymous'}-${limit}`;
    
    const cached = await this.getFromCache<Recommendation[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch('/api/recommendations/contextual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          userId,
          limit
        })
      });

      if (!response.ok) {
        throw new Error('Failed to fetch contextual recommendations');
      }

      const recommendations = await response.json();
      
      await this.setCache(cacheKey, recommendations);
      return recommendations;
    } catch (error) {
      console.error('Error fetching contextual recommendations:', error);
      return [];
    }
  }

  // ====================
  // RECOMMENDATION FEEDBACK
  // ====================

  /**
   * Record recommendation feedback
   */
  async recordFeedback(
    recommendationId: string,
    action: 'click' | 'view' | 'dismiss' | 'convert' | 'like' | 'dislike',
    options: {
      userId?: string;
      context?: Record<string, any>;
    } = {}
  ): Promise<void> {
    const feedback: RecommendationFeedback = {
      recommendationId,
      userId: options.userId,
      action,
      timestamp: new Date().toISOString(),
      context: options.context
    };

    // Add to feedback queue
    this.feedbackQueue.push(feedback);

    // Process immediately for conversion events
    if (action === 'convert') {
      await this.sendFeedback(feedback);
    }
  }

  /**
   * Process feedback batch
   */
  private async processFeedbackBatch(): Promise<void> {
    if (this.feedbackQueue.length === 0) return;

    const batch = [...this.feedbackQueue];
    this.feedbackQueue = [];

    try {
      await this.sendFeedbackBatch(batch);
    } catch (error) {
      console.error('Error processing recommendation feedback batch:', error);
      // Re-add failed feedback to queue for retry
      this.feedbackQueue.unshift(...batch);
    }
  }

  /**
   * Send single feedback to API
   */
  private async sendFeedback(feedback: RecommendationFeedback): Promise<void> {
    try {
      const response = await fetch('/api/recommendations/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback)
      });

      if (!response.ok) {
        throw new Error('Failed to send recommendation feedback');
      }
    } catch (error) {
      console.error('Error sending recommendation feedback:', error);
      throw error;
    }
  }

  /**
   * Send feedback batch to API
   */
  private async sendFeedbackBatch(feedbacks: RecommendationFeedback[]): Promise<void> {
    try {
      const response = await fetch('/api/recommendations/feedback/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedbacks })
      });

      if (!response.ok) {
        throw new Error('Failed to send recommendation feedback batch');
      }
    } catch (error) {
      console.error('Error sending recommendation feedback batch:', error);
      throw error;
    }
  }

  // ====================
  // RECOMMENDATION ANALYTICS
  // ====================

  /**
   * Get recommendation analytics
   */
  async getRecommendationAnalytics(days: number = 30): Promise<RecommendationAnalytics> {
    const cacheKey = `recommendation-analytics-${days}`;
    
    const cached = await this.getFromCache<RecommendationAnalytics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/recommendations/analytics?days=${days}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch recommendation analytics');
      }

      const analytics = await response.json();
      
      await this.setCache(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error('Error fetching recommendation analytics:', error);
      
      // Return default analytics
      return {
        totalRecommendations: 0,
        clickThroughRate: 0,
        conversionRate: 0,
        topSources: [],
        topTypes: [],
        averageScore: 0,
        performanceTrends: []
      };
    }
  }

  /**
   * Get recommendation performance metrics
   */
  async getRecommendationPerformance(
    source?: string,
    type?: string,
    days: number = 7
  ): Promise<{
    impressions: number;
    clicks: number;
    conversions: number;
    ctr: number;
    conversionRate: number;
    averageScore: number;
  }> {
    const cacheKey = `recommendation-performance-${source || 'all'}-${type || 'all'}-${days}`;
    
    const cached = await this.getFromCache<{
      impressions: number;
      clicks: number;
      conversions: number;
      ctr: number;
      conversionRate: number;
      averageScore: number;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const params = new URLSearchParams();
      if (source) params.append('source', source);
      if (type) params.append('type', type);
      params.append('days', days.toString());

      const response = await fetch(`/api/recommendations/performance?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch recommendation performance');
      }

      const performance = await response.json();
      
      await this.setCache(cacheKey, performance);
      return performance;
    } catch (error) {
      console.error('Error fetching recommendation performance:', error);
      
      // Return default performance
      return {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        ctr: 0,
        conversionRate: 0,
        averageScore: 0
      };
    }
  }

  // ====================
  // RECOMMENDATION CONFIGURATION
  // ====================

  /**
   * Update recommendation configuration
   */
  async updateRecommendationConfig(config: Partial<RecommendationConfig>): Promise<void> {
    this.recommendationConfig = { ...this.recommendationConfig, ...config };
    
    // Cache configuration
    await this.setCache('recommendation-config', this.recommendationConfig);

    // Clear recommendation cache to apply new config
    await this.clearCache();
  }

  /**
   * Get recommendation configuration
   */
  async getRecommendationConfig(): Promise<RecommendationConfig> {
    const cached = await this.getFromCache<RecommendationConfig>('recommendation-config');
    if (cached) {
      return cached;
    }

    await this.setCache('recommendation-config', this.recommendationConfig);
    return this.recommendationConfig;
  }

  // ====================
  // RECOMMENDATION SPECIFIC METRICS
  // ====================

  protected getCustomMetrics(): Record<string, any> {
    return {
      recommendationsEnabled: this.recommendationConfig.enableRecommendations,
      feedbackQueueSize: this.feedbackQueue.length,
      feedbackProcessingActive: !!this.feedbackInterval,
      maxRecommendations: this.recommendationConfig.maxRecommendations,
      cacheMinutes: this.recommendationConfig.cacheMinutes,
      lastFeedbackProcess: new Date().toISOString()
    };
  }

  // ====================
  // UTILITY METHODS
  // ====================

  /**
   * Refresh recommendations for a user
   */
  async refreshRecommendations(userId?: string): Promise<void> {
    // Clear cache for the user
    await this.clearCache(`recommendations-${userId || 'anonymous'}`);
  }

  /**
   * Get recommendation diversity score
   */
  async getRecommendationDiversity(recommendations: Recommendation[]): Promise<{
    typeDiversity: number;
    sourceDiversity: number;
    overallDiversity: number;
  }> {
    const typeCounts = recommendations.reduce((acc, rec) => {
      acc[rec.type] = (acc[rec.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sourceCounts = recommendations.reduce((acc, rec) => {
      acc[rec.source] = (acc[rec.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const typeDiversity = Object.keys(typeCounts).length / recommendations.length;
    const sourceDiversity = Object.keys(sourceCounts).length / recommendations.length;
    const overallDiversity = (typeDiversity + sourceDiversity) / 2;

    return {
      typeDiversity,
      sourceDiversity,
      overallDiversity
    };
  }

  // ====================
  // CLEANUP
  // ====================

  /**
   * Cleanup recommendation resources
   */
  async cleanup(): Promise<void> {
    // Process remaining feedback
    await this.processFeedbackBatch();
    
    // Clear feedback interval
    if (this.feedbackInterval) {
      clearInterval(this.feedbackInterval);
      this.feedbackInterval = null;
    }
    
    // Clear cache
    await this.clearCache();
  }
}

// Export singleton instance
export const recommendationsSingleton = RecommendationsSingleton.getInstance();

export default RecommendationsSingleton;
