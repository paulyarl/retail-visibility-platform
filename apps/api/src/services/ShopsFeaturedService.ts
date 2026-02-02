import FeaturedProductsSingletonService, { FeaturedProduct } from './FeaturedProductsSingletonService';
import { logger } from '../logger';
import { BaseDiscoveryService } from './BaseDiscoveryService';
import { PrismaClient } from '@prisma/client';
import { transformProductsWithVariants, ProductWithVariants } from '../utils/variant-transformer';
import { getDirectPool } from '../utils/db-pool';

/**
 * Shops Featured Service - Smart routing for shops discovery
 * 
 * Extends BaseDiscoveryService to provide shops-specific discovery methods.
 * Handles both shop-specific (tenant) and global discovery scopes.
 * 
 * Usage:
 * - Shop scope: Get featured products for a specific shop
 * - Global scope: Get featured products across all shops (shops directory)
 */
export default class ShopsFeaturedService extends BaseDiscoveryService {
  private static instance: ShopsFeaturedService;
  private prisma: PrismaClient;

  private constructor() {
    super();
    this.prisma = new PrismaClient();
  }

  static getInstance(): ShopsFeaturedService {
    if (!ShopsFeaturedService.instance) {
      ShopsFeaturedService.instance = new ShopsFeaturedService();
    }
    return ShopsFeaturedService.instance;
  }

  
  /**
   * Get trending products for shops discovery (MV-OPTIMIZED with RICH DATA)
   * Uses mv_global_discovery with trending scores and engagement metrics
   */
  async getShopTrendingProducts(options: {
    tenantId?: string;
    limit?: number;
    shopScope?: 'global' | 'shop';
  } = {}) {
    const { tenantId, limit = 12, shopScope = 'global' } = options;

    this.logger.info('[SHOPS FEATURED] Fetching trending products from MV', {
      tenantId,
      limit,
      shopScope
    } as any);

    try {
      // Build WHERE conditions
      const whereConditions = [
        `item_status = 'active'`,
        `visibility = 'public'`
        // NOTE: Not filtering by in_stock - trending shows all products regardless of stock status
      ];

      const params: any[] = [];

      // Add tenant filter for shop scope
      if (shopScope === 'shop' && tenantId) {
        whereConditions.push(`tenant_id = $${params.length + 1}`);
        params.push(tenantId);
      }

      // Query mv_global_discovery - simplified to SELECT *
      const query = `
        SELECT *
        FROM mv_global_discovery
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY trending_score DESC, featured_priority DESC, featured_at DESC
        LIMIT $${params.length + 1}
      `;

      params.push(limit);

      const results = await this.prisma.$queryRawUnsafe(query, ...params) as ProductWithVariants[];
      
      this.logger.info(`[SHOPS FEATURED] MV global discovery query returned ${results.length} products`);
      
      // Transform products with computed variant fields
      const transformedResults = transformProductsWithVariants(results);
      
      return transformedResults;

    } catch (error) {
      this.logger.error('[SHOPS FEATURED] Error fetching from mv_global_discovery for trending products, falling back', {
        error: (error as Error).message
      } as any);
      
      // Fallback to legacy method
      return this.routeFeaturedProducts({
        tenantId,
        scope: shopScope,
        featuredType: 'trending',
        limit,
        sortBy: 'priority',
        sortOrder: 'desc'
      });
    }
  }

  /**
   * Get new products for shops discovery (MV-OPTIMIZED with RICH DATA)
   * Uses mv_new_products for recently added products with full metadata
   */
  async getShopNewProducts(options: {
    tenantId?: string;
    limit?: number;
    shopScope?: 'global' | 'shop';
  } = {}) {
    const { tenantId, limit = 12, shopScope = 'global' } = options;

    this.logger.info('[SHOPS FEATURED] Fetching new products from MV', {
      tenantId,
      limit,
      shopScope
    } as any);

    try {
      // Build WHERE conditions
      const whereConditions = [
        `item_status = 'active'`,
        `visibility = 'public'`,
        `in_stock = true`
      ];

      const params: any[] = [];

      // Add tenant filter for shop scope
      if (shopScope === 'shop' && tenantId) {
        whereConditions.push(`tenant_id = $${params.length + 1}`);
        params.push(tenantId);
      }

      // Query mv_new_products - just select all columns
      const query = `
        SELECT *
        FROM mv_new_products
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY featured_at DESC, featured_priority DESC
        LIMIT $${params.length + 1}
      `;

      params.push(limit);

      const results = await this.prisma.$queryRawUnsafe(query, ...params) as ProductWithVariants[];
      
      this.logger.info(`[SHOPS FEATURED] MV new products query returned ${results.length} products`);
      
      // Transform products with computed variant fields
      const transformedResults = transformProductsWithVariants(results);
      
      return transformedResults;

    } catch (error) {
      this.logger.error('[SHOPS FEATURED] Error fetching from mv_new_products, falling back', {
        error: (error as Error).message
      } as any);
      
      // Fallback to legacy method
      return this.routeFeaturedProducts({
        tenantId,
        scope: shopScope,
        featuredType: 'new_arrival',
        limit,
        sortBy: 'priority',
        sortOrder: 'desc'
      });
    }
  }

  /**
   * Generic bucket method for future extensibility
   */
  private async getFeaturedProductsByBucket(bucketType: string, options: {
    tenantId?: string;
    limit: number;
    shopScope?: 'global' | 'shop';
    sortBy?: 'priority' | 'featuredAt' | 'expiresAt';
    sortOrder?: 'asc' | 'desc';
  }) {
    const { tenantId, limit, shopScope = 'global', sortBy = 'priority', sortOrder = 'desc' } = options;
    
    // Map bucket types to featured types
    const bucketToFeaturedType: Record<string, string> = {
      'random': 'store_selection',
      'trending': 'trending',
      'new': 'new_arrival',
      'sale': 'sale',
      'seasonal': 'seasonal',
      'staff': 'staff_pick',
      'selection': 'store_selection'
    };
    
    const featuredType = bucketToFeaturedType[bucketType] || bucketType;

    return this.routeFeaturedProducts({
      tenantId,
      scope: shopScope,
      featuredType,
      limit,
      sortBy,
      sortOrder
    });
  }

  /**
   * Get shop identifiers (tenantId, autoId, slug) for URL generation
   */
  async getShopIdentifiers(tenantId: string, slug?: string) {
    return this.baseService.getTenantIdentifiers(tenantId, slug);
  }

  /**
   * Get shop autoId for URL generation
   */
  async getShopAutoId(tenantId: string) {
    const identifiers = await this.getShopIdentifiers(tenantId);
    return identifiers?.autoId || null;
  }

  /**
   * Get shop URLs for frontend navigation
   */
  async getShopUrls(tenantId: string, slug?: string) {
    const identifiers = await this.getShopIdentifiers(tenantId, slug);
    if (!identifiers) return null;

    return {
      shopUrl: `/shops/${identifiers.slug}`,
      shopUrlWithAutoId: `/shops/${identifiers.slug}-${identifiers.autoId}`,
      shopUrlWithTenantId: `/shops/${identifiers.slug}?tenantId=${identifiers.tenantId}`
    };
  }

  /**
   * Resolve shop by identifier (slug, autoId, or tenantId)
   */
  async resolveShop(identifier: string) {
    // Try to resolve by slug first
    const bySlug = await this.getShopIdentifiers('', identifier);
    if (bySlug) return bySlug;

    // Try to resolve by autoId
    const byAutoId = await this.getShopIdentifiers('', undefined);
    if (byAutoId && byAutoId.autoId === identifier) return byAutoId;

    // Try to resolve by tenantId
    const byTenantId = await this.getShopIdentifiers(identifier);
    if (byTenantId) return byTenantId;

    return null;
  }

  /**
   * Get shop products with identifiers for frontend
   */
  async getShopProductsWithIdentifiers(tenantId: string, options: {
    limit?: number;
    featuredType?: string;
  } = {}) {
    const { limit = 12, featuredType } = options;
    
    // Get featured products
    const featuredProducts = await this.baseService.getFeaturedProductsByTenant(tenantId, {
      featuredType: featuredType as any,
      isActive: true,
      limit,
      sortBy: 'priority',
      sortOrder: 'desc'
    });

    // Add shop identifiers to each product
    const shopIdentifiers = await this.getShopIdentifiers(tenantId);
    
    return featuredProducts.map(product => ({
      ...product,
      shop: {
        tenantId: shopIdentifiers?.tenantId,
        slug: shopIdentifiers?.slug,
        autoId: shopIdentifiers?.autoId
      }
    }));
  }

  /**
   * Get trending shops
   */
  async getTrendingShops(options: {
    limit?: number;
    region?: string;
  } = {}) {
    const { limit = 12, region } = options;
    
    this.logger.info('[SHOPS FEATURED] Fetching trending shops from database', {
      limit,
      region
    } as any);

    try {
      // Use mv_trending_products for trending shops data
      const pool = getDirectPool();
      const query = `
        SELECT DISTINCT
          tenant_id,
          tenant_name,
          tenant_slug,
          tenant_logo_url as imageUrl,
          tenant_address,
          tenant_city,
          tenant_state,
          tenant_zip,
          shop_category as primary_category,
          subscription_tier,
          AVG(average_rating) as rating_avg,
          MAX(CAST(review_count AS INTEGER)) as rating_count,
          COUNT(DISTINCT inventory_item_id) as productCount,
          MAX(trending_score) as trending_score
        FROM mv_trending_products
        WHERE item_status = 'active'
          AND visibility = 'public'
          AND trending_score IS NOT NULL
        GROUP BY 
          tenant_id, tenant_name, tenant_slug,
          tenant_logo_url, tenant_address, tenant_city, tenant_state,
          tenant_zip, shop_category, subscription_tier
        HAVING COUNT(DISTINCT inventory_item_id) > 0
        ORDER BY trending_score DESC, tenant_name ASC
        LIMIT $1
      `;

      const result = await pool.query(query, [limit]);
      
      const trendingShops = result.rows.map(row => {
        return {
          tenantId: row.tenant_id,
          name: row.tenant_name,
          slug: row.tenant_slug || '',
          autoId: row.tenant_id, // Using tenant_id as autoId for now
          imageUrl: row.imageurl || null,
          location: `${row.tenant_city || ''}${row.tenant_city && row.tenant_state ? ', ' : ''}${row.tenant_state || ''}`,
          productCount: parseInt(row.productcount) || 0,
          rating: row.rating_avg ? parseFloat(row.rating_avg) : (4.2 + Math.random() * 0.8),
          rating_count: parseInt(row.rating_count) || 0,
          reviewCount: parseInt(row.rating_count) || 0,
          primary_category: row.primary_category || 'General',
          trendingScore: parseFloat(row.trending_score) || 0,
          urls: {
            slugUrl: `/shops/${row.tenant_slug || row.tenant_id}`,
            tenantIdUrl: `/shops/${row.tenant_id}`,
            autoIdUrl: `/shops/${row.tenant_id}`,
            canonicalUrl: `/shops/${row.tenant_slug || row.tenant_id}` 
          }
        };
      });

      this.logger.info('[SHOPS FEATURED] Returning trending shops from database', {
        count: trendingShops.length,
        shops: trendingShops.map(s => ({
          tenantId: s.tenantId,
          name: s.name,
          trendingScore: s.trendingScore
        }))
      } as any);

      
      return trendingShops;
    } catch (error) {
      this.logger.error('[SHOPS FEATURED] Error fetching trending shops', error);
      
      // Fallback to mock data if database fails
      const fallbackShops = [
        {
          tenantId: 'tid-m8ijkrnk',
          name: 'Baraka International Market',
          slug: 'baraka-market',
          autoId: 'ULCW',
          imageUrl: 'https://nbwsiobosqawrugnqddo.supabase.co/storage/v1/object/public/tenants/logos/tid-m8ijkrnk/tenant-logo-tid-m8ijkrnk-1768711118513.jpeg',
          location: 'Pittsburgh, PA',
          productCount: 156,
          rating: 4.8,
          trendingScore: 95,
          urls: {
            slugUrl: '/shops/baraka-market',
            tenantIdUrl: '/shops/tid-m8ijkrnk',
            autoIdUrl: '/shops/ULCW',
            canonicalUrl: '/shops/baraka-market'
          }
        }
      ].slice(0, limit);
      
      return fallbackShops;
    }
  }

  /**
   * Get global trending shops (alias for getTrendingShops)
   */
  async getGlobalTrendingShops(options: {
    limit?: number;
    region?: string;
  } = {}) {
    return this.getTrendingShops(options);
  }

  /**
   * Get trending categories
   */
  async getTrendingCategories(options: {
    limit?: number;
    minProducts?: number;
  } = {}) {
    const { limit = 10, minProducts = 3 } = options;
    
    this.logger.info('[SHOPS FEATURED] Fetching trending categories', { limit } as any);

    try {
      const pool = getDirectPool();
      const query = `
        SELECT 
          shop_category as category,
          COUNT(DISTINCT tenant_id) as shop_count,
          COUNT(DISTINCT inventory_item_id) as product_count,
          AVG(trending_score) as avg_trending_score
        FROM mv_trending_products
        WHERE item_status = 'active'
          AND visibility = 'public'
          AND shop_category IS NOT NULL
        GROUP BY shop_category
        HAVING COUNT(DISTINCT inventory_item_id) >= $2
        ORDER BY avg_trending_score DESC, product_count DESC
        LIMIT $1
      `;

      const result = await pool.query(query, [limit, minProducts]);
      
      const categories = result.rows.map(row => ({
        category: row.category,
        shopCount: parseInt(row.shop_count),
        productCount: parseInt(row.product_count),
        avgTrendingScore: parseFloat(row.avg_trending_score) || 0
      }));

      this.logger.info('[SHOPS FEATURED] Returning trending categories', {
        count: categories.length
      } as any);

      return categories;
    } catch (error) {
      this.logger.error('[SHOPS FEATURED] Error fetching trending categories', error);
      return [];
    }
  }

  /**
   * Get shop sale products
   */
  async getShopSaleProducts(options: {
    tenantId?: string;
    limit?: number;
    shopScope?: 'global' | 'shop';
  } = {}) {
    const { tenantId, limit = 12, shopScope = 'global' } = options;
    
    this.logger.info('[SHOPS FEATURED] Fetching sale products', {
      tenantId, limit, shopScope
    } as any);

    try {
      const pool = getDirectPool();
      const whereConditions = [
        `item_status = 'active'`,
        `visibility = 'public'`,
        `featured_type_array @> '"sale"'::jsonb`,
        `featured_is_active = true`,
        `(featured_until IS NULL OR featured_until > NOW())`
      ];

      const params: any[] = [];
      if (shopScope === 'shop' && tenantId) {
        whereConditions.push(`tenant_id = $${params.length + 1}`);
        params.push(tenantId);
      }

      const query = `
        SELECT *
        FROM mv_trending_products
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY featured_priority DESC, featured_at DESC
        LIMIT $${params.length + 1}
      `;

      params.push(limit);
      const result = await pool.query(query, params);
      
      this.logger.info('[SHOPS FEATURED] Sale products query returned', {
        count: result.rows.length
      } as any);
      
      return result.rows;
    } catch (error) {
      this.logger.error('[SHOPS FEATURED] Error fetching sale products', error);
      return [];
    }
  }

  /**
   * Get shop seasonal products
   */
  async getShopSeasonalProducts(options: {
    tenantId?: string;
    limit?: number;
    shopScope?: 'global' | 'shop';
  } = {}) {
    const { tenantId, limit = 12, shopScope = 'global' } = options;
    
    this.logger.info('[SHOPS FEATURED] Fetching seasonal products', {
      tenantId, limit, shopScope
    } as any);

    try {
      const pool = getDirectPool();
      const whereConditions = [
        `item_status = 'active'`,
        `visibility = 'public'`,
        `featured_type_array @> '"seasonal"'::jsonb`,
        `featured_is_active = true`,
        `(featured_until IS NULL OR featured_until > NOW())`
      ];

      const params: any[] = [];
      if (shopScope === 'shop' && tenantId) {
        whereConditions.push(`tenant_id = $${params.length + 1}`);
        params.push(tenantId);
      }

      const query = `
        SELECT *
        FROM mv_trending_products
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY featured_priority DESC, featured_at DESC
        LIMIT $${params.length + 1}
      `;

      params.push(limit);
      const result = await pool.query(query, params);
      
      this.logger.info('[SHOPS FEATURED] Seasonal products query returned', {
        count: result.rows.length
      } as any);
      
      return result.rows;
    } catch (error) {
      this.logger.error('[SHOPS FEATURED] Error fetching seasonal products', error);
      return [];
    }
  }

  /**
   * Get shop staff picks
   */
  async getShopStaffPicks(options: {
    tenantId?: string;
    limit?: number;
    shopScope?: 'global' | 'shop';
  } = {}) {
    const { tenantId, limit = 12, shopScope = 'global' } = options;
    
    this.logger.info('[SHOPS FEATURED] Fetching staff picks', {
      tenantId, limit, shopScope
    } as any);

    try {
      const pool = getDirectPool();
      const whereConditions = [
        `item_status = 'active'`,
        `visibility = 'public'`,
        `featured_type_array @> '"staff_pick"'::jsonb`,
        `featured_is_active = true`,
        `(featured_until IS NULL OR featured_until > NOW())`
      ];

      const params: any[] = [];
      if (shopScope === 'shop' && tenantId) {
        whereConditions.push(`tenant_id = $${params.length + 1}`);
        params.push(tenantId);
      }

      const query = `
        SELECT *
        FROM mv_trending_products
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY featured_priority DESC, featured_at DESC
        LIMIT $${params.length + 1}
      `;

      params.push(limit);
      const result = await pool.query(query, params);
      
      this.logger.info('[SHOPS FEATURED] Staff picks query returned', {
        count: result.rows.length
      } as any);
      
      return result.rows;
    } catch (error) {
      this.logger.error('[SHOPS FEATURED] Error fetching staff picks', error);
      return [];
    }
  }

  /**
   * Get shop store selections
   */
  async getShopStoreSelections(options: {
    tenantId?: string;
    limit?: number;
    shopScope?: 'global' | 'shop';
  } = {}) {
    const { tenantId, limit = 12, shopScope = 'global' } = options;
    
    this.logger.info('[SHOPS FEATURED] Fetching store selections', {
      tenantId, limit, shopScope
    } as any);

    try {
      const pool = getDirectPool();
      const whereConditions = [
        `item_status = 'active'`,
        `visibility = 'public'`,
        `featured_type_array @> '"store_selection"'::jsonb`,
        `featured_is_active = true`,
        `(featured_until IS NULL OR featured_until > NOW())`
      ];

      const params: any[] = [];
      if (shopScope === 'shop' && tenantId) {
        whereConditions.push(`tenant_id = $${params.length + 1}`);
        params.push(tenantId);
      }

      const query = `
        SELECT *
        FROM mv_trending_products
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY featured_priority DESC, featured_at DESC
        LIMIT $${params.length + 1}
      `;

      params.push(limit);
      const result = await pool.query(query, params);
      
      this.logger.info('[SHOPS FEATURED] Store selections query returned', {
        count: result.rows.length
      } as any);
      
      return result.rows;
    } catch (error) {
      this.logger.error('[SHOPS FEATURED] Error fetching store selections', error);
      return [];
    }
  }

  /**
   * Get global random products (alias for shop random products)
   */
  async getGlobalRandomProducts(options: {
    limit?: number;
  } = {}) {
    return this.getShopRandomProducts({ ...options, shopScope: 'global' });
  }

  /**
   * Get global random products weighted
   */
  async getGlobalRandomProductsWeighted(options: {
    limit?: number;
  } = {}) {
    const { limit = 12 } = options;
    
    this.logger.info('[SHOPS FEATURED] Fetching weighted random products', { limit } as any);

    try {
      const pool = getDirectPool();
      const query = `
        SELECT *
        FROM mv_trending_products
        WHERE item_status = 'active'
          AND visibility = 'public'
        ORDER BY (trending_score * RANDOM()) DESC
        LIMIT $1
      `;

      const result = await pool.query(query, [limit]);
      
      this.logger.info('[SHOPS FEATURED] Weighted random products query returned', {
        count: result.rows.length
      } as any);
      
      return result.rows;
    } catch (error) {
      this.logger.error('[SHOPS FEATURED] Error fetching weighted random products', error);
      return [];
    }
  }

  /**
   * Get products by location
   */
  async getProductsByLocation(options: {
    city?: string;
    state?: string;
    limit?: number;
  } = {}) {
    const { city, state, limit = 12 } = options;
    
    this.logger.info('[SHOPS FEATURED] Fetching products by location', {
      city, state, limit
    } as any);

    try {
      const pool = getDirectPool();
      const whereConditions = [
        `item_status = 'active'`,
        `visibility = 'public'`
      ];

      const params: any[] = [];
      if (city) {
        whereConditions.push(`tenant_city ILIKE $${params.length + 1}`);
        params.push(`%${city}%`);
      }
      if (state) {
        whereConditions.push(`tenant_state ILIKE $${params.length + 1}`);
        params.push(`%${state}%`);
      }

      const query = `
        SELECT *
        FROM mv_trending_products
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY trending_score DESC
        LIMIT $${params.length + 1}
      `;

      params.push(limit);
      const result = await pool.query(query, params);
      
      this.logger.info('[SHOPS FEATURED] Products by location query returned', {
        count: result.rows.length
      } as any);
      
      return result.rows;
    } catch (error) {
      this.logger.error('[SHOPS FEATURED] Error fetching products by location', error);
      return [];
    }
  }

  /**
   * Get products by location address
   */
  async getProductsByLocationAddress(options: {
    address?: string;
    limit?: number;
  } = {}) {
    const { address, limit = 12 } = options;
    
    this.logger.info('[SHOPS FEATURED] Fetching products by location address', {
      address, limit
    } as any);

    try {
      const pool = getDirectPool();
      const whereConditions = [
        `item_status = 'active'`,
        `visibility = 'public'`
      ];

      const params: any[] = [];
      if (address) {
        whereConditions.push(`tenant_address ILIKE $${params.length + 1}`);
        params.push(`%${address}%`);
      }

      const query = `
        SELECT *
        FROM mv_trending_products
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY trending_score DESC
        LIMIT $${params.length + 1}
      `;

      params.push(limit);
      const result = await pool.query(query, params);
      
      this.logger.info('[SHOPS FEATURED] Products by location address query returned', {
        count: result.rows.length
      } as any);
      
      return result.rows;
    } catch (error) {
      this.logger.error('[SHOPS FEATURED] Error fetching products by location address', error);
      return [];
    }
  }

  /**
   * Get products by product category
   */
  async getProductsByProductCategory(options: {
    category?: string;
    limit?: number;
  } = {}) {
    const { category, limit = 12 } = options;
    
    this.logger.info('[SHOPS FEATURED] Fetching products by product category', {
      category, limit
    } as any);

    try {
      const pool = getDirectPool();
      const whereConditions = [
        `item_status = 'active'`,
        `visibility = 'public'`
      ];

      const params: any[] = [];
      if (category) {
        whereConditions.push(`product_category ILIKE $${params.length + 1}`);
        params.push(`%${category}%`);
      }

      const query = `
        SELECT *
        FROM mv_trending_products
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY trending_score DESC
        LIMIT $${params.length + 1}
      `;

      params.push(limit);
      const result = await pool.query(query, params);
      
      this.logger.info('[SHOPS FEATURED] Products by product category query returned', {
        count: result.rows.length
      } as any);
      
      return result.rows;
    } catch (error) {
      this.logger.error('[SHOPS FEATURED] Error fetching products by product category', error);
      return [];
    }
  }

  /**
   * Get products by shop category
   */
  async getProductsByShopCategory(options: {
    category?: string;
    limit?: number;
  } = {}) {
    const { category, limit = 12 } = options;
    
    this.logger.info('[SHOPS FEATURED] Fetching products by shop category', {
      category, limit
    } as any);

    try {
      const pool = getDirectPool();
      const whereConditions = [
        `item_status = 'active'`,
        `visibility = 'public'`
      ];

      const params: any[] = [];
      if (category) {
        whereConditions.push(`shop_category ILIKE $${params.length + 1}`);
        params.push(`%${category}%`);
      }

      const query = `
        SELECT *
        FROM mv_trending_products
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY trending_score DESC
        LIMIT $${params.length + 1}
      `;

      params.push(limit);
      const result = await pool.query(query, params);
      
      this.logger.info('[SHOPS FEATURED] Products by shop category query returned', {
        count: result.rows.length
      } as any);
      
      return result.rows;
    } catch (error) {
      this.logger.error('[SHOPS FEATURED] Error fetching products by shop category', error);
      return [];
    }
  }

  /**
   * Get shop random products
   */
  async getShopRandomProducts(options: {
    tenantId?: string;
    limit?: number;
    shopScope?: 'global' | 'shop';
  } = {}) {
    const { tenantId, limit = 12, shopScope = 'global' } = options;
    
    this.logger.info('[SHOPS FEATURED] Fetching random products', {
      tenantId, limit, shopScope
    } as any);

    try {
      const pool = getDirectPool();
      const whereConditions = [
        `item_status = 'active'`,
        `visibility = 'public'`
      ];

      const params: any[] = [];
      if (shopScope === 'shop' && tenantId) {
        whereConditions.push(`tenant_id = $${params.length + 1}`);
        params.push(tenantId);
      }

      const query = `
        SELECT *
        FROM mv_trending_products
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY RANDOM()
        LIMIT $${params.length + 1}
      `;

      params.push(limit);
      const result = await pool.query(query, params);
      
      this.logger.info('[SHOPS FEATURED] Random products query returned', {
        count: result.rows.length
      } as any);
      
      return result.rows;
    } catch (error) {
      this.logger.error('[SHOPS FEATURED] Error fetching random products', error);
      return [];
    }
  }
}
