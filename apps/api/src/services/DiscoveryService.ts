import { UniversalIdentifierCache } from './UniversalIdentifierCache';

export interface DiscoveryQuery {
  scope?: 'shop' | 'global' | 'location' | 'category' | 'timezone';
  tenantId?: string;
  limit?: number;
  sortBy?: 'priority' | 'featuredAt' | 'expiresAt' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  location?: {
    latitude?: number;
    longitude?: number;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    radius?: number;
  };
  category?: {
    productName?: string;
    productId?: string;
    googleProductId?: string;
    shopCategoryName?: string;
    shopCategoryId?: string;
    shopGoogleCategoryId?: string;
    categoryType?: 'product' | 'shop' | 'both';
  };
  timezone?: {
    timezone?: string;
    offset?: number;
  };
}

export interface DiscoveryResult {
  products: any[];
  scope: string;
  bucketType: string;
  cached: boolean;
  metrics: {
    cacheHit: boolean;
    responseTime: number;
    itemCount: number;
  };
}

export class DiscoveryService {
  private static instance: DiscoveryService;
  private cache: Map<string, { data: DiscoveryResult; timestamp: number }> = new Map();
  private readonly cacheTTL = 10 * 60 * 1000; // 10 minutes for discovery results

  private constructor() {
    // Clean up expired cache entries periodically
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 15 * 60 * 1000); // Every 15 minutes
  }

  static getInstance(): DiscoveryService {
    if (!DiscoveryService.instance) {
      DiscoveryService.instance = new DiscoveryService();
    }
    return DiscoveryService.instance;
  }

  /**
   * Route discovery request based on bucket type
   */
  async routeDiscovery(bucketType: string, query: DiscoveryQuery): Promise<DiscoveryResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(bucketType, query);

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[DiscoveryService] Cache hit for ${bucketType} discovery`);
      return {
        ...cached,
        metrics: {
          ...cached.metrics,
          responseTime: Date.now() - startTime
        }
      };
    }

    console.log(`[DiscoveryService] Cache miss, routing ${bucketType} discovery with query:`, query);

    let products: any[] = [];

    // Route based on bucket type
    switch (bucketType) {
      case 'random':
        products = await this.getRandomProducts(query);
        break;
      case 'trending':
        products = await this.getTrendingProducts(query);
        break;
      case 'new':
        products = await this.getNewProducts(query);
        break;
      case 'sale':
        products = await this.getSaleProducts(query);
        break;
      case 'seasonal':
        products = await this.getSeasonalProducts(query);
        break;
      case 'staff':
        products = await this.getStaffPicks(query);
        break;
      case 'selection':
        products = await this.getStoreSelections(query);
        break;
      default:
        throw new Error(`Invalid bucket type: ${bucketType}`);
    }

    const result: DiscoveryResult = {
      products,
      scope: query.scope || 'global',
      bucketType,
      cached: false,
      metrics: {
        cacheHit: false,
        responseTime: Date.now() - startTime,
        itemCount: products.length
      }
    };

    // Cache the result
    this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Get random products for discovery
   */
  private async getRandomProducts(query: DiscoveryQuery): Promise<any[]> {
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    const limit = query.limit || 12;
    const conditions: string[] = ['sp.item_status = $1'];
    const params: any[] = ['active'];

    // Add scope-based conditions
    this.addScopeConditions(conditions, params, query);

    const whereClause = conditions.join(' AND ');

    const querySQL = `
      SELECT
        sp.*,
        COALESCE(mv.sale_price_cents, null) as sale_price_cents,
        COALESCE(mv.has_variants, false) as has_variants
      FROM storefront_products sp
      LEFT JOIN storefront_products_mv mv ON sp.tenant_id = mv.tenant_id AND sp.id = mv.id
      WHERE ${whereClause}
      ORDER BY RANDOM()
      LIMIT $${params.length + 1}
    `;

    params.push(limit);
    const result = await pool.query(querySQL, params);

    return result.rows.map(row => this.transformDiscoveryProduct(row));
  }

  /**
   * Get trending products for discovery
   */
  private async getTrendingProducts(query: DiscoveryQuery): Promise<any[]> {
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    const limit = query.limit || 12;
    const conditions: string[] = ['sp.item_status = $1'];
    const params: any[] = ['active'];

    // Add scope-based conditions
    this.addScopeConditions(conditions, params, query);

    const whereClause = conditions.join(' AND ');

    const querySQL = `
      SELECT DISTINCT
        sp.*,
        COALESCE(mv.sale_price_cents, null) as sale_price_cents,
        COALESCE(mv.has_variants, false) as has_variants
      FROM storefront_products sp
      LEFT JOIN storefront_products_mv mv ON sp.tenant_id = mv.tenant_id AND sp.id = mv.id
      WHERE ${whereClause}
      ORDER BY sp.rating_avg DESC NULLS LAST, sp.rating_count DESC, sp.created_at DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);
    const result = await pool.query(querySQL, params);

    return result.rows.map(row => this.transformDiscoveryProduct(row));
  }

  /**
   * Get new products for discovery
   */
  private async getNewProducts(query: DiscoveryQuery): Promise<any[]> {
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    const limit = query.limit || 12;
    const conditions: string[] = ['sp.item_status = $1'];
    const params: any[] = ['active'];

    // Add scope-based conditions
    this.addScopeConditions(conditions, params, query);

    const whereClause = conditions.join(' AND ');

    const querySQL = `
      SELECT DISTINCT
        sp.*,
        COALESCE(mv.sale_price_cents, null) as sale_price_cents,
        COALESCE(mv.has_variants, false) as has_variants
      FROM storefront_products sp
      LEFT JOIN storefront_products_mv mv ON sp.tenant_id = mv.tenant_id AND sp.id = mv.id
      WHERE ${whereClause}
      ORDER BY sp.created_at DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);
    const result = await pool.query(querySQL, params);

    return result.rows.map(row => this.transformDiscoveryProduct(row));
  }

  /**
   * Get sale products for discovery
   */
  private async getSaleProducts(query: DiscoveryQuery): Promise<any[]> {
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    const limit = query.limit || 12;
    const conditions: string[] = ['sp.item_status = $1', 'sp.price_cents > 0'];
    const params: any[] = ['active'];

    // Add scope-based conditions
    this.addScopeConditions(conditions, params, query);

    const whereClause = conditions.join(' AND ');

    const querySQL = `
      SELECT DISTINCT
        sp.*,
        COALESCE(mv.sale_price_cents, null) as sale_price_cents,
        COALESCE(mv.has_variants, false) as has_variants,
        CASE
          WHEN mv.sale_price_cents IS NOT NULL AND mv.sale_price_cents < sp.price_cents
          THEN ROUND(((sp.price_cents - mv.sale_price_cents) / sp.price_cents::float) * 100, 0)
          ELSE 0
        END as discount_percentage
      FROM storefront_products sp
      LEFT JOIN storefront_products_mv mv ON sp.tenant_id = mv.tenant_id AND sp.id = mv.id
      WHERE ${whereClause}
        AND (mv.sale_price_cents IS NOT NULL AND mv.sale_price_cents < sp.price_cents)
      ORDER BY discount_percentage DESC, sp.created_at DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);
    const result = await pool.query(querySQL, params);

    return result.rows.map(row => this.transformDiscoveryProduct(row));
  }

  /**
   * Get seasonal products for discovery
   */
  private async getSeasonalProducts(query: DiscoveryQuery): Promise<any[]> {
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    const limit = query.limit || 12;
    const conditions: string[] = ['sp.item_status = $1'];
    const params: any[] = ['active'];

    // Add scope-based conditions
    this.addScopeConditions(conditions, params, query);

    // Add seasonal conditions (simplified - could be enhanced with actual seasonal logic)
    conditions.push("sp.metadata->>'seasonal' = 'true'");
    conditions.push("sp.metadata->>'current_season' = 'true'");

    const whereClause = conditions.join(' AND ');

    const querySQL = `
      SELECT DISTINCT
        sp.*,
        COALESCE(mv.sale_price_cents, null) as sale_price_cents,
        COALESCE(mv.has_variants, false) as has_variants
      FROM storefront_products sp
      LEFT JOIN storefront_products_mv mv ON sp.tenant_id = mv.tenant_id AND sp.id = mv.id
      WHERE ${whereClause}
      ORDER BY sp.featured_priority DESC, sp.created_at DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);
    const result = await pool.query(querySQL, params);

    return result.rows.map(row => this.transformDiscoveryProduct(row));
  }

  /**
   * Get staff picks for discovery
   */
  private async getStaffPicks(query: DiscoveryQuery): Promise<any[]> {
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    const limit = query.limit || 12;
    const conditions: string[] = ['sp.item_status = $1'];
    const params: any[] = ['active'];

    // Add scope-based conditions
    this.addScopeConditions(conditions, params, query);

    const whereClause = conditions.join(' AND ');

    const querySQL = `
      SELECT DISTINCT
        sp.*,
        COALESCE(mv.sale_price_cents, null) as sale_price_cents,
        COALESCE(mv.has_variants, false) as has_variants
      FROM storefront_products sp
      LEFT JOIN storefront_products_mv mv ON sp.tenant_id = mv.tenant_id AND sp.id = mv.id
      LEFT JOIN featured_products fp ON sp.id = fp.inventory_item_id
      WHERE ${whereClause}
        AND fp.featured_type = 'staff_pick'
        AND fp.is_active = true
      ORDER BY fp.priority DESC, sp.created_at DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);
    const result = await pool.query(querySQL, params);

    return result.rows.map(row => this.transformDiscoveryProduct(row));
  }

  /**
   * Get store selections for discovery
   */
  private async getStoreSelections(query: DiscoveryQuery): Promise<any[]> {
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    const limit = query.limit || 12;
    const conditions: string[] = ['sp.item_status = $1'];
    const params: any[] = ['active'];

    // Add scope-based conditions
    this.addScopeConditions(conditions, params, query);

    const whereClause = conditions.join(' AND ');

    const querySQL = `
      SELECT DISTINCT
        sp.*,
        COALESCE(mv.sale_price_cents, null) as sale_price_cents,
        COALESCE(mv.has_variants, false) as has_variants
      FROM storefront_products sp
      LEFT JOIN storefront_products_mv mv ON sp.tenant_id = mv.tenant_id AND sp.id = mv.id
      LEFT JOIN featured_products fp ON sp.id = fp.inventory_item_id
      WHERE ${whereClause}
        AND fp.featured_type = 'store_selection'
        AND fp.is_active = true
      ORDER BY fp.priority DESC, sp.created_at DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);
    const result = await pool.query(querySQL, params);

    return result.rows.map(row => this.transformDiscoveryProduct(row));
  }

  /**
   * Add scope-based conditions to the query
   */
  private addScopeConditions(conditions: string[], params: any[], query: DiscoveryQuery): void {
    let paramIndex = params.length;

    switch (query.scope) {
      case 'shop':
        if (query.tenantId) {
          conditions.push(`sp.tenant_id = $${paramIndex + 1}`);
          params.push(query.tenantId);
          paramIndex++;
        }
        break;

      case 'location':
        if (query.location) {
          if (query.location.city) {
            conditions.push(`sp.city = $${paramIndex + 1}`);
            params.push(query.location.city);
            paramIndex++;
          }
          if (query.location.state) {
            conditions.push(`sp.state = $${paramIndex + 1}`);
            params.push(query.location.state);
            paramIndex++;
          }
          if (query.location.zip) {
            conditions.push(`sp.zip = $${paramIndex + 1}`);
            params.push(query.location.zip);
            paramIndex++;
          }
        }
        break;

      case 'category':
        if (query.category) {
          // This would need more complex logic based on category type
          // For now, we'll use a simplified approach
          if (query.category.productName) {
            conditions.push(`sp.category_slug = $${paramIndex + 1}`);
            params.push(query.category.productName);
            paramIndex++;
          }
        }
        break;

      case 'global':
      default:
        // No additional conditions for global scope
        break;
    }
  }

  /**
   * Transform database row to discovery product format
   */
  private transformDiscoveryProduct(row: any): any {
    return {
      id: row.id,
      sku: row.sku,
      name: row.name,
      title: row.title,
      brand: row.brand,
      description: row.description,
      priceCents: row.price_cents,
      salePriceCents: row.sale_price_cents,
      stock: row.stock,
      imageUrl: row.image_url,
      hasVariants: row.has_variants,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      tenantSlug: row.tenant_slug,
      subscriptionTier: row.subscription_tier,
      locationStatus: row.location_status,
      city: row.city,
      state: row.state,
      directoryListingId: row.directory_listing_id,
      isPublished: row.is_published,
      listingIsFeatured: row.listing_is_featured,
      ratingAvg: row.rating_avg,
      ratingCount: row.rating_count,
      directoryProductCount: row.directory_product_count,
      featuredExpiresAt: row.featured_expires_at,
      autoUnfeature: row.auto_unfeature,
      daysUntilExpiration: row.days_until_expiration,
      isExpired: row.is_expired,
      isExpiringSoon: row.is_expiring_soon,
      itemStatus: row.item_status,
      categoryId: row.category_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      featuredType: row.featured_type,
      featuredPriority: row.featured_priority,
      featuredAt: row.featured_at,
      isActivelyFeatured: row.is_actively_featured,
      metadata: row.metadata
    };
  }

  /**
   * Generate cache key for discovery query
   */
  private generateCacheKey(bucketType: string, query: DiscoveryQuery): string {
    const keyParts = [
      'discovery',
      bucketType,
      `scope:${query.scope || 'global'}`,
      `tenant:${query.tenantId || 'all'}`,
      `limit:${query.limit || 12}`,
      `sort:${query.sortBy || 'priority'}-${query.sortOrder || 'desc'}`,
      `location:${JSON.stringify(query.location || {})}`,
      `category:${JSON.stringify(query.category || {})}`,
      `timezone:${JSON.stringify(query.timezone || {})}`
    ];
    return keyParts.join('|');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: string[];
    totalMemoryUsage: number;
  } {
    const entries = Array.from(this.cache.keys());
    let totalMemoryUsage = 0;

    this.cache.forEach((value, key) => {
      totalMemoryUsage += key.length * 2;
      totalMemoryUsage += JSON.stringify(value.data).length * 2;
      totalMemoryUsage += 16;
    });

    return {
      size: this.cache.size,
      entries,
      totalMemoryUsage
    };
  }

  /**
   * Invalidate discovery cache
   */
  invalidateCache(): void {
    console.log(`[DiscoveryService] Invalidating all discovery caches`);
    this.cache.clear();
  }

  private getFromCache(key: string): DiscoveryResult | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return { ...cached.data, cached: true, metrics: { ...cached.data.metrics, cacheHit: true } };
  }

  private setCache(key: string, data: DiscoveryResult): void {
    this.cache.set(key, {
      data: { ...data, cached: false },
      timestamp: Date.now()
    });
  }

  private cleanupExpiredCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cache.forEach((value, key) => {
      if (now - value.timestamp > this.cacheTTL) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.cache.delete(key));

    if (expiredKeys.length > 0) {
      console.log(`[DiscoveryService] Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }
}
