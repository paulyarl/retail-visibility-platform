import { logger } from '../logger';
import { getDirectPool } from '../utils/db-pool';

export interface ShopCategory {
  shop_category: string;
  count: number;
}

/**
 * Shop Categories Service - Singleton with caching
 * 
 * Provides shop categories data from mv_storefront_discovery with caching
 * Used for category dropdowns and filters in the shops interface
 * 
 * Features:
 * - Singleton pattern for consistent caching
 * - 30-minute cache TTL (categories change infrequently)
 * - Materialized view optimization
 * - Error handling and logging
 */
export default class ShopCategoriesService {
  private static instance: ShopCategoriesService;
  private cache: Map<string, { data: ShopCategory[]; timestamp: number; ttl: number }> = new Map();
  private cacheTTL: number = 30 * 60 * 1000; // 30 minutes

  private constructor() {
    // Initialize cache
  }

  static getInstance(): ShopCategoriesService {
    if (!ShopCategoriesService.instance) {
      ShopCategoriesService.instance = new ShopCategoriesService();
    }
    return ShopCategoriesService.instance;
  }

  /**
   * Get shop categories with caching
   */
  async getShopCategories(): Promise<ShopCategory[]> {
    const cacheKey = 'shop-categories:all';
    const now = Date.now();

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && (now - cached.timestamp) < cached.ttl) {
      logger.info('[ShopCategoriesService] Cache hit for shop categories');
      return cached.data;
    }

    logger.info('[ShopCategoriesService] Cache miss, fetching from database');

    try {
      const categories = await this.fetchCategoriesFromDatabase();
      
      // Store in cache
      this.cache.set(cacheKey, {
        data: categories,
        timestamp: now,
        ttl: this.cacheTTL
      });

      return categories;
    } catch (error) {
      console.error('[ShopCategoriesService] Error fetching categories:', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Fetch shop categories from mv_storefront_discovery
   */
  private async fetchCategoriesFromDatabase(): Promise<ShopCategory[]> {
    const query = `
      SELECT 
        shop_category,
        COUNT(*) as count
      FROM mv_storefront_discovery
      WHERE shop_category IS NOT NULL
        AND shop_category != ''
        AND item_status = 'active'
        AND visibility = 'public'
      GROUP BY shop_category
      ORDER BY count DESC, shop_category ASC
    `;

    const pool = getDirectPool();
    const result = await pool.query(query);

    return result.rows;
  }

  /**
   * Clear cache for shop categories
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('[ShopCategoriesService] Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  /**
   * Set cache TTL (for testing or configuration)
   */
  setCacheTTL(ttl: number): void {
    this.cacheTTL = ttl;
    logger.info(`[ShopCategoriesService] Cache TTL set to ${ttl}ms`);
  }
}
