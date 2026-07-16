/**
 * AI-Powered Recommendation Service
 * 
 * Advanced recommendation engine using machine learning algorithms
 * Integrates with platform caching and analytics services
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface RecommendationContext {
  userId?: string;
  productId?: string;
  categoryId?: string;
  tenantId?: string;
  location?: { lat: number; lng: number };
  userBehavior?: {
    viewHistory: string[];
    searchHistory: string[];
    purchaseHistory: string[];
    wishlistItems: string[];
    demographics?: {
      age?: number;
      gender?: string;
      location?: string;
    };
  };
  sessionContext?: {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    deviceType: 'mobile' | 'desktop' | 'tablet';
    referrer: string;
    duration: number;
  };
}

export interface RecommendationResult {
  id: string;
  productId: string;
  score: number;
  reason: string;
  algorithm: 'collaborative' | 'content' | 'hybrid' | 'trending' | 'location' | 'seasonal';
  confidence: number;
  metadata: {
    similarProducts?: string[];
    userPreferences?: string[];
    categoryAffinity?: number;
    priceSensitivity?: number;
    brandLoyalty?: number;
  };
}

export interface RecommendationStrategy {
  name: string;
  algorithm: RecommendationResult['algorithm'];
  weight: number;
  enabled: boolean;
  config: Record<string, any>;
}

/**
 * AI Recommendation Service
 * 
 * Provides intelligent product recommendations using multiple algorithms
 * Leverages platform caching and analytics for optimal performance
 */
class AIRecommendationService extends PublicApiSingleton {
  private static instance: AIRecommendationService;
  private strategies: Map<string, RecommendationStrategy> = new Map();

  private constructor() {
    super('ai-recommendation-service', { encrypt: false });
    this.initializeStrategies();
  }

  public static getInstance(): AIRecommendationService {
    if (!AIRecommendationService.instance) {
      AIRecommendationService.instance = new AIRecommendationService();
    }
    return AIRecommendationService.instance;
  }

  /**
   * Initialize recommendation strategies
   */
  private initializeStrategies(): void {
    const defaultStrategies: RecommendationStrategy[] = [
      {
        name: 'collaborative_filtering',
        algorithm: 'collaborative',
        weight: 0.3,
        enabled: true,
        config: {
          minSimilarity: 0.1,
          maxRecommendations: 50,
          userBased: true,
          itemBased: true
        }
      },
      {
        name: 'content_based',
        algorithm: 'content',
        weight: 0.25,
        enabled: true,
        config: {
          featureWeights: {
            category: 0.3,
            brand: 0.2,
            price: 0.2,
            attributes: 0.3
          },
          similarityThreshold: 0.2
        }
      },
      {
        name: 'trending_products',
        algorithm: 'trending',
        weight: 0.2,
        enabled: true,
        config: {
          timeWindow: '7d',
          minViews: 10,
          trendingThreshold: 0.5
        }
      },
      {
        name: 'location_based',
        algorithm: 'location',
        weight: 0.15,
        enabled: true,
        config: {
          radius: 50, // miles
          minProducts: 5,
          boostLocal: 1.5
        }
      },
      {
        name: 'seasonal_recommendations',
        algorithm: 'seasonal',
        weight: 0.1,
        enabled: true,
        config: {
          seasons: ['spring', 'summer', 'fall', 'winter'],
          boostFactor: 1.2
        }
      }
    ];

    defaultStrategies.forEach(strategy => {
      this.strategies.set(strategy.name, strategy);
    });
  }

  /**
   * Get personalized recommendations for a user
   */
  async getPersonalizedRecommendations(
    context: RecommendationContext,
    limit: number = 20
  ): Promise<RecommendationResult[]> {
    try {
      const cacheKey = `ai-recommendations-personalized-${this.generateContextHash(context)}-${limit}`;
      
      const response = await this.makeDefaultRequest<{
        recommendations: RecommendationResult[];
        metadata: {
          algorithms: string[];
          processingTime: number;
          cacheHit: boolean;
        };
      }>(
        '/api/ai/recommendations/personalized',
        {
          method: 'POST',
          body: JSON.stringify({
            context,
            limit,
            strategies: Array.from(this.strategies.values())
              .filter(s => s.enabled)
              .map(s => ({
                name: s.name,
                algorithm: s.algorithm,
                weight: s.weight,
                config: s.config
              }))
          })
        },
        cacheKey,
        5 * 60 * 1000 // 5 minutes cache for personalized recommendations
      );

      if (!response.success) {
        clientLogger.error('[AIRecommendationService] Failed to get personalized recommendations:', { detail: response.error });
        return this.getFallbackRecommendations(context, limit);
      }

      return response.data?.recommendations || this.getFallbackRecommendations(context, limit);
    } catch (error) {
      clientLogger.error('[AIRecommendationService] Error getting personalized recommendations:', { detail: error });
      return this.getFallbackRecommendations(context, limit);
    }
  }

  /**
   * Get similar products recommendations
   */
  async getSimilarProducts(
    productId: string,
    context: Partial<RecommendationContext> = {},
    limit: number = 10
  ): Promise<RecommendationResult[]> {
    try {
      const cacheKey = `ai-recommendations-similar-${productId}-${limit}`;
      
      const response = await this.makeDefaultRequest<{
        recommendations: RecommendationResult[];
        similarity: number;
      }>(
        `/api/ai/recommendations/similar/${productId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            context,
            limit,
            algorithms: ['content', 'collaborative']
          })
        },
        cacheKey,
        15 * 60 * 1000 // 15 minutes cache for similar products
      );

      if (!response.success) {
        clientLogger.error('[AIRecommendationService] Failed to get similar products:', { detail: response.error });
        return [];
      }

      return response.data?.recommendations || [];
    } catch (error) {
      clientLogger.error('[AIRecommendationService] Error getting similar products:', { detail: error });
      return [];
    }
  }

  /**
   * Get trending recommendations
   */
  async getTrendingRecommendations(
    context: Partial<RecommendationContext> = {},
    limit: number = 20
  ): Promise<RecommendationResult[]> {
    try {
      const cacheKey = `ai-recommendations-trending-${this.generateContextHash(context)}-${limit}`;
      
      const response = await this.makeDefaultRequest<{
        recommendations: RecommendationResult[];
        trends: {
          categories: Array<{ category: string; score: number }>;
          products: Array<{ productId: string; trend: 'up' | 'down' | 'stable' }>;
        };
      }>(
        '/api/ai/recommendations/trending',
        {
          method: 'POST',
          body: JSON.stringify({
            context,
            limit,
            timeWindow: '24h'
          })
        },
        cacheKey,
        2 * 60 * 1000 // 2 minutes cache for trending (more frequent updates)
      );

      if (!response.success) {
        clientLogger.error('[AIRecommendationService] Failed to get trending recommendations:', { detail: response.error });
        return [];
      }

      return response.data?.recommendations || [];
    } catch (error) {
      clientLogger.error('[AIRecommendationService] Error getting trending recommendations:', { detail: error });
      return [];
    }
  }

  /**
   * Get category-based recommendations
   */
  async getCategoryRecommendations(
    categoryId: string,
    context: Partial<RecommendationContext> = {},
    limit: number = 15
  ): Promise<RecommendationResult[]> {
    try {
      const cacheKey = `ai-recommendations-category-${categoryId}-${limit}`;
      
      const response = await this.makeDefaultRequest<{
        recommendations: RecommendationResult[];
        categoryInsights: {
          popularity: number;
          growth: number;
          topProducts: string[];
        };
      }>(
        `/api/ai/recommendations/category/${categoryId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            context,
            limit,
            includeSubcategories: true
          })
        },
        cacheKey,
        10 * 60 * 1000 // 10 minutes cache for category recommendations
      );

      if (!response.success) {
        clientLogger.error('[AIRecommendationService] Failed to get category recommendations:', { detail: response.error });
        return [];
      }

      return response.data?.recommendations || [];
    } catch (error) {
      clientLogger.error('[AIRecommendationService] Error getting category recommendations:', { detail: error });
      return [];
    }
  }

  /**
   * Record user interaction for learning
   */
  async recordInteraction(
    userId: string,
    productId: string,
    interactionType: 'view' | 'click' | 'add_to_cart' | 'purchase' | 'wishlist' | 'share',
    context: Partial<RecommendationContext> = {}
  ): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/ai/recommendations/interaction',
        {
          method: 'POST',
          body: JSON.stringify({
            userId,
            productId,
            interactionType,
            context,
            timestamp: new Date().toISOString(),
            sessionId: this.getSessionId()
          })
        },
        `ai-interaction-${userId}-${productId}-${interactionType}`,
        0 // No caching for interactions - must be recorded immediately
      );
    } catch (error) {
      clientLogger.error('[AIRecommendationService] Failed to record interaction:', { detail: error });
      // Don't throw - interaction recording failures shouldn't break the user experience
    }
  }

  /**
   * Update recommendation strategies
   */
  updateStrategy(strategyName: string, updates: Partial<RecommendationStrategy>): void {
    const strategy = this.strategies.get(strategyName);
    if (strategy) {
      const updatedStrategy = { ...strategy, ...updates };
      this.strategies.set(strategyName, updatedStrategy);
    }
  }

  /**
   * Get recommendation performance metrics
   */
  async getPerformanceMetrics(
    timeRange: '1h' | '24h' | '7d' | '30d' = '24h'
  ): Promise<{
    totalRecommendations: number;
    clickThroughRate: number;
    conversionRate: number;
    algorithmPerformance: Record<string, {
      recommendations: number;
      ctr: number;
      conversion: number;
    }>;
  }> {
    try {
      const cacheKey = `ai-metrics-performance-${timeRange}`;
      
      const response = await this.makeDefaultRequest<{
        metrics: any;
      }>(
        `/api/ai/recommendations/metrics?timeRange=${timeRange}`,
        {},
        cacheKey,
        5 * 60 * 1000 // 5 minutes cache for metrics
      );

      if (!response.success) {
        clientLogger.error('[AIRecommendationService] Failed to get performance metrics:', { detail: response.error });
        return this.getDefaultMetrics();
      }

      return response.data?.metrics || this.getDefaultMetrics();
    } catch (error) {
      clientLogger.error('[AIRecommendationService] Error getting performance metrics:', { detail: error });
      return this.getDefaultMetrics();
    }
  }

  /**
   * Generate context hash for caching
   */
  private generateContextHash(context: RecommendationContext): string {
    const relevantContext = {
      userId: context.userId,
      productId: context.productId,
      categoryId: context.categoryId,
      tenantId: context.tenantId,
      location: context.location,
      // Don't include sensitive user behavior in hash for privacy
    };
    
    return btoa(JSON.stringify(relevantContext)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }

  /**
   * Get session ID for tracking
   */
  private getSessionId(): string {
    // In a real implementation, this would come from session management
    return typeof window !== 'undefined' 
      ? window.sessionStorage.getItem('sessionId') || 'anonymous'
      : 'anonymous';
  }

  /**
   * Get fallback recommendations when AI service fails
   */
  private getFallbackRecommendations(
    context: RecommendationContext,
    limit: number
  ): RecommendationResult[] {
    // Simple fallback based on category or trending
    return [];
  }

  /**
   * Get default metrics
   */
  private getDefaultMetrics() {
    return {
      totalRecommendations: 0,
      clickThroughRate: 0,
      conversionRate: 0,
      algorithmPerformance: {}
    };
  }
}

// Export singleton instance
export const aiRecommendationService = AIRecommendationService.getInstance();
export default AIRecommendationService;
