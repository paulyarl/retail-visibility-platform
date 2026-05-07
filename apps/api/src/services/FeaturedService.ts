import { UniversalIdentifierCache } from './UniversalIdentifierCache';

export interface FeaturedProductQuery {
  limit?: number;
  tenantId?: string;
  lat?: string;
  lng?: string;
  radius?: number;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface FeaturedProduct {
  // Product Info
  id: string;
  name: string;
  title?: string;
  description: string;
  marketingDescription?: string;
  price: number | null;
  priceFormatted?: string;
  priceCents?: number;
  listPriceCents?: number;
  salePriceCents?: number;
  currency?: string;
  imageUrl: string | null;
  imageGallery?: string[];

  // Product Details
  sku: string;
  brand?: string;
  manufacturer?: string;
  condition?: string;
  gtin?: string;
  mpn?: string;
  stock: number;
  quantity: number;
  availability: string;
  itemStatus: string;
  visibility: string;

  // Featured Info
  featuredType: string;
  featuredPriority: number;
  featuredAt?: Date;
  featuredUntil?: Date;
  isFeatured: boolean;
  isActivelyFeatured: boolean;

  // Category Info
  categoryName?: string;
  categorySlug?: string;
  googleCategoryId?: string;

  // Flags
  hasImage: boolean;
  hasGallery: boolean;
  hasDescription: boolean;
  hasBrand: boolean;
  hasPrice: boolean;
  inStock: boolean;
  hasActivePaymentGateway: boolean;
  defaultGatewayType?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;

  // Tenant Info
  tenant: {
    id: string;
    name: string;
    slug: string;
    subscriptionTier?: string;
    city?: string;
    state?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };

  distance?: number;
}

export interface FeaturedProductsResponse {
  products: FeaturedProduct[];
  location?: {
    lat: number;
    lng: number;
    radius: number;
  };
}

export class FeaturedService {
  private static instance: FeaturedService;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly cacheTTL = 5 * 60 * 1000; // 5 minutes for featured products

  private constructor() {
    // Clean up expired cache entries periodically
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  static getInstance(): FeaturedService {
    if (!FeaturedService.instance) {
      FeaturedService.instance = new FeaturedService();
    }
    return FeaturedService.instance;
  }

  /**
   * Get featured products with location awareness and complex fallback logic
   */
  async getFeaturedProducts(query: FeaturedProductQuery = {}): Promise<FeaturedProductsResponse> {
    const cacheKey = this.generateCacheKey(query);

    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      console.log(`[FeaturedService] Cache hit for featured products`);
      return cached;
    }

    //console.log(`[FeaturedService] Cache miss, fetching featured products with query:`, query);

    const limit = Math.min(query.limit || 20, 50); // Cap at 50 for performance
    let products: FeaturedProduct[] = [];

    try {
      // Try primary query using materialized view
      products = await this.getFeaturedProductsFromMV(query, limit);
      console.log(`[FeaturedService] Primary query successful, found ${products.length} products`);
    } catch (error) {
      console.error('[FeaturedService] Primary query failed:', error);

      try {
        // Fallback: Also use mv_global_discovery with direct pool
        products = await this.getFeaturedProductsFallback(query, limit);
        console.log(`[FeaturedService] Fallback query successful, found ${products.length} products`);
      } catch (fallbackError) {
        console.error('[FeaturedService] Fallback query also failed:', fallbackError);
        throw new Error('Unable to fetch featured products');
      }
    }

    // Apply randomization for variety (preserve featured type assignments)
    if (products.length > limit) {
      const shuffled = products.sort(() => Math.random() - 0.5);
      products = shuffled.slice(0, limit);
    }

    const result: FeaturedProductsResponse = {
      products,
      location: query.lat && query.lng ? {
        lat: parseFloat(query.lat),
        lng: parseFloat(query.lng),
        radius: query.radius || 50
      } : undefined
    };

    // Cache the result
    this.setCache(cacheKey, result);

    return result;
  }

  /**
   * Primary query using materialized view
   */
  private async getFeaturedProductsFromMV(query: FeaturedProductQuery, limit: number): Promise<FeaturedProduct[]> {
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    const sqlQuery = `
      SELECT DISTINCT
        mv.*,
        t.name as tenant_name,
        t.slug as tenant_slug,
        t.subscription_tier,
        dsl.city as tenant_city,
        dsl.state as tenant_state,
        dsl.address as tenant_address,
        dsl.latitude as tenant_latitude,
        dsl.longitude as tenant_longitude
      FROM mv_global_discovery mv
      JOIN tenants t ON t.id = mv.tenant_id
      LEFT JOIN directory_listings_list dsl ON dsl.tenant_id = mv.tenant_id
      WHERE mv.tenant_id = COALESCE($1, mv.tenant_id)
        AND mv.featured_is_active = true
        AND mv.item_status = 'active'
        AND mv.visibility = 'public'
        AND t.subscription_status = 'active'
      ORDER BY mv.featured_priority DESC, mv.featured_at DESC
      LIMIT $2
    `;

    const result = await pool.query(sqlQuery, [query.tenantId || null, limit * 3]); // Get more for randomization

    return result.rows.map(row => this.transformFeaturedProduct(row));
  }

  /**
   * Fallback query using mv_global_discovery
   */
  private async getFeaturedProductsFallback(query: FeaturedProductQuery, limit: number): Promise<FeaturedProduct[]> {
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    const fallbackQuery = `
      SELECT DISTINCT
        mv.*
      FROM mv_global_discovery mv
      WHERE mv.tenant_id = COALESCE($1, mv.tenant_id)
        AND mv.featured_is_active = true
        AND mv.item_status = 'active'
        AND mv.visibility = 'public'
      ORDER BY mv.featured_priority DESC, mv.featured_at DESC
      LIMIT $2
    `;

    const fallbackResult = await pool.query(fallbackQuery, [query.tenantId || null, limit * 3]);

    const allFeaturedProducts = fallbackResult.rows;

    // Get tenant information for fallback
    const tenantIds = [...new Set(allFeaturedProducts.map((fp: any) => fp.tenant_id))];
    const tenants = await this.getTenantsByIds(tenantIds);

    const tenantMap = new Map(tenants.map(t => [t.id, t]));

    return allFeaturedProducts.map((row: any) => this.transformFeaturedProduct(row, tenantMap.get(row.tenant_id)));
  }

  /**
   * Transform database row to FeaturedProduct
   */
  private transformFeaturedProduct(row: any, tenantOverride?: any): FeaturedProduct {
    const tenant = tenantOverride || {
      id: row.tenant_id,
      name: row.tenant_name,
      slug: row.tenant_slug || 'store-slug',
      subscriptionTier: row.subscription_tier,
      city: row.tenant_city,
      state: row.tenant_state,
      address: row.tenant_address,
      latitude: row.tenant_latitude,
      longitude: row.tenant_longitude
    };

    return {
      // Product Info
      id: row.inventory_item_id,
      name: row.product_name,
      title: row.product_title,
      description: row.product_description,
      marketingDescription: row.marketing_description,
      price: row.current_price_cents ? row.current_price_cents / 100 : null,
      priceFormatted: row.price,
      priceCents: row.current_price_cents,
      listPriceCents: row.list_price_cents,
      salePriceCents: row.sale_price_cents,
      currency: row.currency,
      imageUrl: row.image_url || null,
      imageGallery: row.image_urls,

      // Product Details
      sku: row.sku,
      brand: row.brand,
      manufacturer: row.manufacturer,
      condition: row.condition,
      gtin: row.gtin,
      mpn: row.mpn,
      stock: row.stock,
      quantity: row.quantity,
      availability: row.availability,
      itemStatus: row.item_status,
      visibility: row.visibility,

      // Featured Info
      featuredType: row.featured_type,
      featuredPriority: row.featured_priority,
      featuredAt: row.featured_at ? new Date(row.featured_at) : undefined,
      featuredUntil: row.featured_until ? new Date(row.featured_until) : undefined,
      isFeatured: row.featured_is_active,
      isActivelyFeatured: row.is_actively_featured,

      // Category Info
      categoryName: row.product_category,
      categorySlug: row.product_category_slug,
      googleCategoryId: row.product_google_category_id,

      // Flags
      hasImage: row.has_image,
      hasGallery: row.has_gallery,
      hasDescription: row.has_description,
      hasBrand: row.has_brand,
      hasPrice: row.has_price,
      inStock: row.in_stock,
      hasActivePaymentGateway: row.has_active_payment_gateway,
      defaultGatewayType: row.default_gateway_type,

      // Timestamps
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),

      // Tenant Info
      tenant,

      distance: undefined // Will be calculated if location provided
    };
  }

  /**
   * Get tenants by IDs for fallback queries
   */
  private async getTenantsByIds(tenantIds: string[]): Promise<any[]> {
    if (tenantIds.length === 0) return [];

    const { prisma } = await import('../prisma');

    return await prisma.tenants.findMany({
      where: { id: { in: tenantIds } },
      select: {
        id: true,
        name: true,
        slug: true,
        subscription_tier: true
      }
    });
  }

  /**
   * Generate cache key for featured products query
   */
  private generateCacheKey(query: FeaturedProductQuery): string {
    const keyParts = [
      'featured_products',
      `limit:${query.limit || 20}`,
      `tenant:${query.tenantId || 'all'}`,
      `location:${query.lat || 'none'}-${query.lng || 'none'}-${query.radius || 'none'}`,
      `category:${query.category || 'all'}`,
      `price:${query.minPrice || 'none'}-${query.maxPrice || 'none'}`
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
   * Invalidate featured products cache
   */
  invalidateCache(): void {
    console.log(`[FeaturedService] Invalidating all featured products cache`);
    this.cache.clear();
  }

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
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
      console.log(`[FeaturedService] Cleaned up ${expiredKeys.length} expired cache entries`);
    }
  }
}
