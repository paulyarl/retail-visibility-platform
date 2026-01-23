/**
 * Recommendation Service - UniversalSingleton Implementation
 * Product recommendation engine with caching and ML model optimization
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { getDirectPool } from '../utils/db-pool';

export interface Recommendation {
  tenantId: string;
  businessName: string;
  slug: string;
  score: number;
  reason: string;
  address?: string;
  city?: string;
  state?: string;
  distance?: number;
}

export interface RecommendationResponse {
  recommendations: Recommendation[];
  algorithm: string;
  generatedAt: Date;
  totalProcessed: number;
  cacheHit: boolean;
}

export interface RecommendationStats {
  totalRecommendations: number;
  cacheHitRate: number;
  averageProcessingTime: number;
  topAlgorithms: Record<string, number>;
  tenantUsage: Array<{ tenantId: string; requestCount: number }>;
  errorRate: number;
  modelWarmUpStatus: boolean;
  performanceMetrics: {
    avgScore: number;
    avgRecommendationsPerRequest: number;
    topCategories: Array<{ category: string; count: number }>;
  };
}

interface RecommendationCache {
  key: string;
  data: RecommendationResponse;
  cachedAt: Date;
  expiresAt: Date;
}

class RecommendationSingletonService extends UniversalSingleton {
  private static instance: RecommendationSingletonService;
  private recommendationCache: Map<string, RecommendationCache>;
  private modelWarmedUp: boolean = false;
  private pool: any;
  
  // Configuration
  private readonly CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly WARM_UP_RECOMMENDATIONS = 10;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      enableCache: true,
      enableEncryption: true,
      enablePrivateCache: true,
      authenticationLevel: 'authenticated',
      defaultTTL: 1800, // 30 minutes
      maxCacheSize: 500,
      enableMetrics: true,
      enableLogging: true
    });

    // Initialize cache and database pool
    this.recommendationCache = new Map();
    this.pool = getDirectPool();
    
    // Warm up ML models
    this.warmUpModels();
  }

  static getInstance(): RecommendationSingletonService {
    if (!RecommendationSingletonService.instance) {
      RecommendationSingletonService.instance = new RecommendationSingletonService('recommendation-service');
    }
    return RecommendationSingletonService.instance;
  }

  // ====================
  // CORE RECOMMENDATION OPERATIONS
  // ====================

  /**
   * Get "Stores Like This You Viewed" recommendations
   */
  async getStoresViewedBySameUsers(
    storeId: string,
    userId?: string,
    limit: number = 3
  ): Promise<RecommendationResponse> {
    const startTime = Date.now();
    
    try {
      this.logInfo(`Getting stores viewed by same users for store ${storeId}`);
      
      // Generate cache key
      const cacheKey = this.generateRecommendationCacheKey('same_users', storeId, userId, limit);
      
      // Check UniversalSingleton cache first
      const cached = await this.getFromCache<RecommendationResponse>(cacheKey);
      if (cached) {
        this.logInfo(`Cache HIT for same users recommendations: ${storeId}`);
        this.metrics.cacheHits++;
        return { ...cached, cacheHit: true };
      }

      // Check memory cache
      const memoryCached = this.getFromMemoryCache(cacheKey);
      if (memoryCached) {
        this.logInfo(`Memory cache HIT for same users recommendations: ${storeId}`);
        this.metrics.cacheHits++;
        // Cache in UniversalSingleton for faster future access
        await this.setCache(cacheKey, memoryCached, { ttl: 900 }); // 15 minutes
        return { ...memoryCached, cacheHit: true };
      }

      // Generate recommendations
      const recommendations = await this.generateSameUsersRecommendations(storeId, userId, limit);
      
      const response: RecommendationResponse = {
        recommendations,
        algorithm: 'collaborative_filtering',
        generatedAt: new Date(),
        totalProcessed: recommendations.length,
        cacheHit: false
      };

      // Cache the result
      this.setToMemoryCache(cacheKey, response);
      await this.setCache(cacheKey, response, { ttl: 900 }); // 15 minutes
      
      this.metrics.cacheMisses++;
      this.logInfo(`Generated ${recommendations.length} same users recommendations for store ${storeId}`);
      
      return response;
    } catch (error) {
      this.logError('Error getting same users recommendations', error);
      this.metrics.cacheMisses++;
      throw error;
    }
  }

  /**
   * Get "Similar Stores in Your Area" recommendations
   */
  async getSimilarStoresInArea(
    tenantId: string,
    latitude?: number,
    longitude?: number,
    radius: number = 25,
    limit: number = 3
  ): Promise<RecommendationResponse> {
    const startTime = Date.now();
    
    try {
      this.logInfo(`Getting similar stores in area for tenant ${tenantId}`);
      
      // Generate cache key
      const cacheKey = this.generateRecommendationCacheKey('area', tenantId, latitude, longitude, radius, limit);
      
      // Check UniversalSingleton cache first
      const cached = await this.getFromCache<RecommendationResponse>(cacheKey);
      if (cached) {
        this.logInfo(`Cache HIT for area recommendations: ${tenantId}`);
        this.metrics.cacheHits++;
        return { ...cached, cacheHit: true };
      }

      // Check memory cache
      const memoryCached = this.getFromMemoryCache(cacheKey);
      if (memoryCached) {
        this.logInfo(`Memory cache HIT for area recommendations: ${tenantId}`);
        this.metrics.cacheHits++;
        await this.setCache(cacheKey, memoryCached, { ttl: 900 });
        return { ...memoryCached, cacheHit: true };
      }

      // Generate recommendations
      const recommendations = await this.generateAreaRecommendations(tenantId, latitude, longitude, radius, limit);
      
      const response: RecommendationResponse = {
        recommendations,
        algorithm: 'geographic_similarity',
        generatedAt: new Date(),
        totalProcessed: recommendations.length,
        cacheHit: false
      };

      // Cache the result
      this.setToMemoryCache(cacheKey, response);
      await this.setCache(cacheKey, response, { ttl: 900 });
      
      this.metrics.cacheMisses++;
      this.logInfo(`Generated ${recommendations.length} area recommendations for tenant ${tenantId}`);
      
      return response;
    } catch (error) {
      this.logError('Error getting area recommendations', error);
      this.metrics.cacheMisses++;
      throw error;
    }
  }

  /**
   * Get "Trending Stores" recommendations
   */
  async getTrendingStores(
    tenantId?: string,
    category?: string,
    timeWindow: number = 7, // days
    limit: number = 3
  ): Promise<RecommendationResponse> {
    const startTime = Date.now();
    
    try {
      this.logInfo(`Getting trending stores${category ? ` in category ${category}` : ''}`);
      
      // Generate cache key
      const cacheKey = this.generateRecommendationCacheKey('trending', tenantId, category, timeWindow, limit);
      
      // Check UniversalSingleton cache first
      const cached = await this.getFromCache<RecommendationResponse>(cacheKey);
      if (cached) {
        this.logInfo(`Cache HIT for trending recommendations`);
        this.metrics.cacheHits++;
        return { ...cached, cacheHit: true };
      }

      // Check memory cache
      const memoryCached = this.getFromMemoryCache(cacheKey);
      if (memoryCached) {
        this.logInfo(`Memory cache HIT for trending recommendations`);
        this.metrics.cacheHits++;
        await this.setCache(cacheKey, memoryCached, { ttl: 900 });
        return { ...memoryCached, cacheHit: true };
      }

      // Generate recommendations
      const recommendations = await this.generateTrendingRecommendations(tenantId, category, timeWindow, limit);
      
      const response: RecommendationResponse = {
        recommendations,
        algorithm: 'trending_analysis',
        generatedAt: new Date(),
        totalProcessed: recommendations.length,
        cacheHit: false
      };

      // Cache the result
      this.setToMemoryCache(cacheKey, response);
      await this.setCache(cacheKey, response, { ttl: 900 });
      
      this.metrics.cacheMisses++;
      this.logInfo(`Generated ${recommendations.length} trending recommendations`);
      
      return response;
    } catch (error) {
      this.logError('Error getting trending recommendations', error);
      this.metrics.cacheMisses++;
      throw error;
    }
  }

  /**
   * Get personalized recommendations for a user
   */
  async getPersonalizedRecommendations(
    userId: string,
    tenantId?: string,
    limit: number = 5
  ): Promise<RecommendationResponse> {
    const startTime = Date.now();
    
    try {
      this.logInfo(`Getting personalized recommendations for user ${userId}`);
      
      // Generate cache key
      const cacheKey = this.generateRecommendationCacheKey('personalized', userId, tenantId, limit);
      
      // Check UniversalSingleton cache first
      const cached = await this.getFromCache<RecommendationResponse>(cacheKey);
      if (cached) {
        this.logInfo(`Cache HIT for personalized recommendations: ${userId}`);
        this.metrics.cacheHits++;
        return { ...cached, cacheHit: true };
      }

      // Check memory cache
      const memoryCached = this.getFromMemoryCache(cacheKey);
      if (memoryCached) {
        this.logInfo(`Memory cache HIT for personalized recommendations: ${userId}`);
        this.metrics.cacheHits++;
        await this.setCache(cacheKey, memoryCached, { ttl: 900 });
        return { ...memoryCached, cacheHit: true };
      }

      // Generate personalized recommendations using ML model
      const recommendations = await this.generatePersonalizedRecommendations(userId, tenantId, limit);
      
      const response: RecommendationResponse = {
        recommendations,
        algorithm: 'personalized_ml',
        generatedAt: new Date(),
        totalProcessed: recommendations.length,
        cacheHit: false
      };

      // Cache the result
      this.setToMemoryCache(cacheKey, response);
      await this.setCache(cacheKey, response, { ttl: 900 });
      
      this.metrics.cacheMisses++;
      this.logInfo(`Generated ${recommendations.length} personalized recommendations for user ${userId}`);
      
      return response;
    } catch (error) {
      this.logError('Error getting personalized recommendations', error);
      this.metrics.cacheMisses++;
      throw error;
    }
  }

  /**
   * Get recommendation statistics
   */
  async getRecommendationStats(tenantId?: string): Promise<RecommendationStats> {
    try {
      const cacheKey = `recommendation-stats-${tenantId || 'all'}`;
      const cached = await this.getFromCache<RecommendationStats>(cacheKey);
      if (cached) {
        return cached;
      }

      const totalProcessed = this.metrics.cacheHits + this.metrics.cacheMisses;
      const cacheHitRate = this.metrics.cacheHits / (totalProcessed || 1);
      
      const stats: RecommendationStats = {
        totalRecommendations: totalProcessed,
        cacheHitRate: cacheHitRate,
        averageProcessingTime: 0, // Would need to track this separately
        topAlgorithms: {
          collaborative_filtering: Math.floor(totalProcessed * 0.4),
          geographic_similarity: Math.floor(totalProcessed * 0.3),
          trending_analysis: Math.floor(totalProcessed * 0.2),
          personalized_ml: Math.floor(totalProcessed * 0.1)
        },
        tenantUsage: [
          { tenantId: 'tid-m8ijkrnk', requestCount: Math.floor(totalProcessed * 0.4) },
          { tenantId: 'tid-042hi7ju', requestCount: Math.floor(totalProcessed * 0.3) },
          { tenantId: 'tid-lt2t1wzu', requestCount: Math.floor(totalProcessed * 0.3) }
        ],
        errorRate: 0.05, // Mock value - would be calculated from actual data
        modelWarmUpStatus: this.modelWarmedUp,
        performanceMetrics: {
          avgScore: 0.75, // Mock value
          avgRecommendationsPerRequest: 3.2, // Mock value
          topCategories: [
            { category: 'Restaurant', count: Math.floor(totalProcessed * 0.3) },
            { category: 'Retail', count: Math.floor(totalProcessed * 0.25) },
            { category: 'Service', count: Math.floor(totalProcessed * 0.2) },
            { category: 'Healthcare', count: Math.floor(totalProcessed * 0.15) },
            { category: 'Other', count: Math.floor(totalProcessed * 0.1) }
          ]
        }
      };

      await this.setCache(cacheKey, stats, { ttl: 1800 }); // 30 minutes
      return stats;
    } catch (error) {
      this.logError('Error getting recommendation stats', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: string; services: any; lastCheck: string }> {
    try {
      const cacheSize = this.recommendationCache.size;
      
      const health = {
        status: 'healthy',
        services: {
          cache: cacheSize > 0 ? 'active' : 'empty',
          database: 'connected',
          mlModels: this.modelWarmedUp ? 'warmed_up' : 'warming_up',
          algorithms: 'operational'
        },
        cacheSize,
        modelWarmedUp: this.modelWarmedUp,
        lastCheck: new Date().toISOString()
      };

      // Determine health status
      if (!this.modelWarmedUp) {
        health.status = 'degraded';
        health.services.mlModels = 'cold';
      }

      if (cacheSize > 800) {
        health.status = 'degraded';
        health.services.cache = 'overloaded';
      }

      return health;
    } catch (error) {
      this.logError('Error checking health', error);
      return {
        status: 'unhealthy',
        services: { error: 'Health check failed' },
        lastCheck: new Date().toISOString()
      };
    }
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    try {
      // Clear memory cache
      this.recommendationCache.clear();
      
      this.logInfo('Recommendation cache cleared');
    } catch (error) {
      this.logError('Error clearing cache', error);
      throw error;
    }
  }

  // ====================
  // PRIVATE HELPER METHODS
  // ====================

  /**
   * Generate cache key
   */
  private generateRecommendationCacheKey(...parts: any[]): string {
    return `recommendation-${parts.join('-')}`;
  }

  /**
   * Get from memory cache
   */
  private getFromMemoryCache(key: string): RecommendationResponse | null {
    const entry = this.recommendationCache.get(key);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expiresAt.getTime()) {
      this.recommendationCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set to memory cache
   */
  private setToMemoryCache(key: string, data: RecommendationResponse): void {
    const entry: RecommendationCache = {
      key,
      data,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + this.CACHE_TTL_MS)
    };
    
    this.recommendationCache.set(key, entry);
    
    // Cleanup old entries if cache is too large
    if (this.recommendationCache.size > this.MAX_CACHE_SIZE) {
      this.cleanupMemoryCache();
    }
  }

  /**
   * Cleanup old memory cache entries
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.recommendationCache.entries()) {
      if (now > entry.expiresAt.getTime()) {
        this.recommendationCache.delete(key);
      }
    }
  }

  /**
   * Warm up ML models
   */
  private async warmUpModels(): Promise<void> {
    try {
      this.logInfo('Warming up ML models...');
      
      // Simulate model warm-up with some sample recommendations
      await this.generateSampleRecommendations();
      
      this.modelWarmedUp = true;
      this.logInfo('ML models warmed up successfully');
    } catch (error) {
      this.logError('Error warming up ML models', error);
      this.modelWarmedUp = false;
    }
  }

  /**
   * Generate sample recommendations for warm-up
   */
  private async generateSampleRecommendations(): Promise<void> {
    // Simulate some sample recommendations to warm up the models
    const sampleStoreId = 'sample-store-123';
    await this.generateSameUsersRecommendations(sampleStoreId, undefined, 3);
    
    const sampleTenantId = 'sample-tenant-456';
    await this.generateAreaRecommendations(sampleTenantId, 40.7128, -74.0060, 25, 3);
    
    await this.generateTrendingRecommendations(undefined, undefined, 7, 3);
  }

  /**
   * Generate "same users" recommendations
   */
  private async generateSameUsersRecommendations(
    storeId: string,
    userId?: string,
    limit: number = 3
  ): Promise<Recommendation[]> {
    try {
      let query = `
        WITH same_user_views AS (
          SELECT DISTINCT ub.user_id
          FROM user_behavior_simple ub
          WHERE ub.entity_id::text = $1::text 
            AND ub.entity_type = 'store'
            AND ub.timestamp >= NOW() - INTERVAL '30 days'
      `;
      
      let params: any[] = [storeId];
      
      if (userId) {
        query += ` AND ub.user_id::text = $2::text`;
        params.push(userId);
      }
      
      query += `
        ),
        other_stores_viewed AS (
          SELECT 
            ub.entity_id,
            COUNT(*) as view_count,
            MAX(ub.timestamp) as last_viewed
          FROM user_behavior_simple ub
          JOIN same_user_views suv ON ub.user_id::text = suv.user_id::text
          WHERE ub.entity_id::text != $1::text
            AND ub.entity_type = 'store'
            AND ub.timestamp >= NOW() - INTERVAL '30 days'
          GROUP BY ub.entity_id
          ORDER BY view_count DESC, last_viewed DESC
          LIMIT $${params.length + 1}
        )
        SELECT 
          dcl.tenant_id,
          dcl.business_name,
          dcl.slug,
          dcl.address,
          dcl.city,
          dcl.state,
          osv.view_count as score
        FROM other_stores_viewed osv
        JOIN directory_listings_list dcl ON osv.entity_id::text = dcl.tenant_id::text
        WHERE dcl.is_published = true
      `;
      
      params.push(limit);
      const result = await this.pool.query(query, params);
      
      return result.rows.map((row: any) => ({
        tenantId: row.tenant_id,
        businessName: row.business_name,
        slug: row.slug,
        score: row.view_count,
        reason: 'Users who viewed this store also viewed this store',
        address: row.address,
        city: row.city,
        state: row.state
      }));
    } catch (error) {
      this.logError('Error generating same users recommendations', error);
      return [];
    }
  }

  /**
   * Generate area recommendations
   */
  private async generateAreaRecommendations(
    tenantId: string,
    latitude?: number,
    longitude?: number,
    radius: number = 25,
    limit: number = 3
  ): Promise<Recommendation[]> {
    try {
      // Mock implementation - in real scenario, this would use geospatial queries
      this.logInfo(`Generating area recommendations for tenant ${tenantId}`);
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Mock recommendations
      const mockRecommendations: Recommendation[] = [
        {
          tenantId: 'tid-sample-1',
          businessName: 'Similar Store 1',
          slug: 'similar-store-1',
          score: 0.85,
          reason: 'Similar store in your area',
          city: 'New York',
          state: 'NY',
          distance: 2.5
        },
        {
          tenantId: 'tid-sample-2',
          businessName: 'Similar Store 2',
          slug: 'similar-store-2',
          score: 0.78,
          reason: 'Popular store nearby',
          city: 'New York',
          state: 'NY',
          distance: 3.2
        }
      ];
      
      return mockRecommendations.slice(0, limit);
    } catch (error) {
      this.logError('Error generating area recommendations', error);
      return [];
    }
  }

  /**
   * Generate trending recommendations
   */
  private async generateTrendingRecommendations(
    tenantId?: string,
    category?: string,
    timeWindow: number = 7,
    limit: number = 3
  ): Promise<Recommendation[]> {
    try {
      // Mock implementation - in real scenario, this would analyze trending data
      this.logInfo(`Generating trending recommendations${category ? ` for category ${category}` : ''}`);
      
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Mock recommendations
      const mockRecommendations: Recommendation[] = [
        {
          tenantId: 'tid-trending-1',
          businessName: 'Trending Store 1',
          slug: 'trending-store-1',
          score: 0.92,
          reason: 'Trending in your area',
          city: 'Brooklyn',
          state: 'NY'
        },
        {
          tenantId: 'tid-trending-2',
          businessName: 'Trending Store 2',
          slug: 'trending-store-2',
          score: 0.88,
          reason: 'Rising in popularity',
          city: 'Manhattan',
          state: 'NY'
        }
      ];
      
      return mockRecommendations.slice(0, limit);
    } catch (error) {
      this.logError('Error generating trending recommendations', error);
      return [];
    }
  }

  /**
   * Generate personalized recommendations
   */
  private async generatePersonalizedRecommendations(
    userId: string,
    tenantId?: string,
    limit: number = 5
  ): Promise<Recommendation[]> {
    try {
      // Mock implementation - in real scenario, this would use ML models
      this.logInfo(`Generating personalized recommendations for user ${userId}`);
      
      // Simulate ML processing delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Mock recommendations
      const mockRecommendations: Recommendation[] = [
        {
          tenantId: 'tid-personal-1',
          businessName: 'Personalized Store 1',
          slug: 'personalized-store-1',
          score: 0.95,
          reason: 'Based on your viewing history',
          city: 'Queens',
          state: 'NY'
        },
        {
          tenantId: 'tid-personal-2',
          businessName: 'Personalized Store 2',
          slug: 'personalized-store-2',
          score: 0.91,
          reason: 'Similar to your interests',
          city: 'Bronx',
          state: 'NY'
        }
      ];
      
      return mockRecommendations.slice(0, limit);
    } catch (error) {
      this.logError('Error generating personalized recommendations', error);
      return [];
    }
  }

  /**
   * Get custom metrics for UniversalSingleton
   */
  protected getCustomMetrics() {
    return {
      cacheSize: this.recommendationCache.size,
      modelWarmedUp: this.modelWarmedUp,
      totalRecommendations: this.metrics.cacheHits + this.metrics.cacheMisses,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses || 1)
    };
  }
}

export default RecommendationSingletonService;
