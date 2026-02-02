/**
 * Recommendations Singleton Service
 * 
 * Extends UniversalSingletonClient to provide cached recommendations operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { UniversalSingletonClient } from '@/lib/shops/universal-singleton-client';

export interface StoreRecommendation {
  id: string;
  name: string;
  slug?: string;
  [key: string]: any;
}

export interface RecommendationGroup {
  type: string;
  title: string;
  recommendations: StoreRecommendation[];
}

class RecommendationsSingletonService {
  private static instance: RecommendationsSingletonService;
  private client: UniversalSingletonClient;

  private constructor() {
    // Initialize UniversalSingletonClient with platform defaults
    this.client = UniversalSingletonClient.getInstance({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      enableCache: true,
      defaultTTL: 10 * 60 * 1000, // 10 minutes for recommendations
      enableLogging: true,
      enableMetrics: true
    });
  }

  public static getInstance(): RecommendationsSingletonService {
    if (!RecommendationsSingletonService.instance) {
      RecommendationsSingletonService.instance = new RecommendationsSingletonService();
    }
    return RecommendationsSingletonService.instance;
  }

  /**
   * Get storefront recommendations for a tenant
   * Uses the /api/recommendations/for-storefront/:tenantId endpoint
   */
  async getStorefrontRecommendations(tenantId: string): Promise<StoreRecommendation[]> {
    if (!tenantId) {
      console.error('[RecommendationsSingleton] getStorefrontRecommendations: tenantId is required');
      return [];
    }

    try {
      const result = await this.client.makeRequest<{
        recommendations: RecommendationGroup[];
      }>(
        `/api/recommendations/for-storefront/${tenantId}`
      );
      
      // API returns nested structure: { recommendations: [{ type, title, recommendations: [...stores] }] }
      // Flatten to get the actual store recommendations
      const allStores = (result.data?.recommendations || []).flatMap(
        (group: RecommendationGroup) => group.recommendations || []
      );
      
      return allStores;
    } catch (error) {
      console.error('[RecommendationsSingleton] Failed to get storefront recommendations:', error);
      return [];
    }
  }

  /**
   * Get performance metrics
   */
  public getMetrics() {
    return this.client.getMetrics();
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.client.resetMetrics();
  }
}

// Export singleton instance
export const recommendationsService = RecommendationsSingletonService.getInstance();
