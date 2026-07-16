import { logger } from '../logger';
import { getDirectPool } from '../utils/db-pool';
import { PrismaClient } from '@prisma/client';
import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';

export interface Shop {
  id: string;
  name: string;
  slug: string;
  business_name?: string;
  imageUrl?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  location?: string;
  phone?: string;
  email?: string;
  website?: string;
  social_links?: any;
  seo_tags?: any;
  default_gateway_type?: string;
  has_active_payment_gateway?: boolean;
  payment_gateways?: Array<{
    id: string;
    gateway_type: string;
    is_active: boolean;
    is_default: boolean;
  }>;
  rating?: number;
  rating_count?: number;
  reviewCount?: number;
  productCount: number;
  is_published: boolean;
  primary_category?: string;
  created_at: Date;
  businessDescription?: string;
  latitude?: number;
  longitude?: number;
  debug?: {
    raw_primary_category?: any;
    raw_shop_category?: any;
    all_fields?: string[];
  };
}

export interface ShopCategory {
  shop_category: string;
  count: number;
}

export interface ShopLocation {
  city: string;
  state: string;
  zip: string;
}

export interface NearbyShop extends Shop {
  distance: number;
}

/**
 * Shop Service - UniversalSingleton Implementation
 * 
 * Centralized service for all shop-related operations:
 * - Extends UniversalSingleton for platform-standard caching
 * - Materialized view optimization
 * - Performance monitoring and logging
 * - Error handling and retry logic
 * 
 * Cache TTL Strategy:
 * - Shop details: 15 minutes (900s)
 * - Shop categories: 30 minutes (1800s) 
 * - Shop locations: 30 minutes (1800s)
 * - Nearby shops: 5 minutes (300s)
 * - Trending shops: 10 minutes (600s)
 */
class ShopService extends UniversalSingleton {
  private static instance: ShopService;
  private prisma: PrismaClient;
  private pool: any;

  private constructor() {
    super('shop-service-singleton', {
      enableCache: true,
      enableEncryption: false, // Shop data is public
      enablePrivateCache: false,
      authenticationLevel: 'public',
      defaultTTL: 900, // 15 minutes default
      maxCacheSize: 500,
      enableMetrics: true,
      enableLogging: true
    });

    this.prisma = new PrismaClient();
    this.pool = getDirectPool();
  }

  static getInstance(): ShopService {
    if (!ShopService.instance) {
      ShopService.instance = new ShopService();
    }
    return ShopService.instance;
  }

  /**
   * Get shop by slug with caching
   * Uses mv_storefront_discovery for optimized performance
   */
  async getShopBySlug(slug: string): Promise<Shop | null> {
    const cacheKey = `shop:slug:v7:${slug}`; // New version to force refresh
    
    this.logInfo(`Fetching shop by slug: ${slug}`);

    try {
      // Use mv_storefront_discovery for optimized shop data retrieval
      const query = `
        SELECT DISTINCT
          d.tenant_id,
          d.tenant_name,
          d.tenant_slug,
          d.tenant_logo_url,
          d.tenant_address,
          d.tenant_city,
          d.tenant_state,
          d.tenant_zip,
          bp.business_description,
          d.shop_category as primary_category,
          d.subscription_tier,
          d.store_average_rating,
          d.store_review_count,
          d.tenant_latitude,
          d.tenant_longitude,
          COUNT(DISTINCT inventory_item_id) FILTER (WHERE item_status = 'active' AND visibility = 'public') as product_count
        FROM mv_storefront_discovery d
        LEFT JOIN tenant_business_profiles_list bp ON d.tenant_id = bp.tenant_id
        WHERE d.tenant_slug = $1
          AND d.shop_category IS NOT NULL
        GROUP BY 
          d.tenant_id, d.tenant_name, d.tenant_slug,
          d.tenant_logo_url, d.tenant_address, d.tenant_city, d.tenant_state,
          d.tenant_zip, bp.business_description, d.shop_category, d.subscription_tier,
          d.store_average_rating, d.store_review_count,
          d.tenant_latitude, d.tenant_longitude
        LIMIT 1
      `;

      const result = await this.pool.query(query, [slug]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const transformedShop: Shop = {
        id: row.tenant_id,
        name: row.tenant_name,
        slug: row.tenant_slug || '',
        business_name: row.tenant_business_name || row.tenant_name,
        imageUrl: row.tenant_logo_url || undefined,
        address: row.tenant_address || undefined,
        city: row.tenant_city || undefined,
        state: row.tenant_state || undefined,
        zip_code: row.tenant_zip || undefined,
        location: `${row.tenant_city || ''}${row.tenant_city && row.tenant_state ? ', ' : ''}${row.tenant_state || ''}`,
        phone: row.tenant_phone || undefined,
        website: row.tenant_website || undefined,
        rating: row.store_average_rating ? parseFloat(row.store_average_rating) : undefined,
        rating_count: row.store_review_count ? parseInt(row.store_review_count) : undefined,
        productCount: parseInt(row.product_count) || 0,
        is_published: true,
        primary_category: row.primary_category || undefined,
        businessDescription: row.business_description || undefined,
        latitude: row.tenant_latitude ? parseFloat(row.tenant_latitude) : undefined,
        longitude: row.tenant_longitude ? parseFloat(row.tenant_longitude) : undefined,
        created_at: new Date()
      };

      // Store in UniversalSingleton cache
    await this.setCache(cacheKey, transformedShop, { ttl: 900 }); // 15 minutes
      
      return transformedShop;
    } catch (error) {
      this.logError(`Error fetching shop by slug ${slug}`, error);
      throw error;
    }
  }

  /**
   * Get shop by tenant ID with caching
   * Uses mv_storefront_discovery for optimized performance
   */
  async getShopByTenantId(tenantId: string): Promise<Shop | null> {
    const cacheKey = `shop:tenantId:${tenantId}`;
    
    // Check UniversalSingleton cache first
    const cached = await this.getFromCache<Shop>(cacheKey);
    if (cached) {
      this.logInfo(`Cache hit for shop tenantId: ${tenantId}`);
      return cached;
    }

    this.logInfo(`Cache miss, fetching shop by tenantId: ${tenantId}`);

    try {
      // Use mv_storefront_discovery for optimized shop data retrieval
      const query = `
        SELECT DISTINCT
          d.tenant_id,
          d.tenant_name,
          d.tenant_slug,
          d.tenant_logo_url,
          d.tenant_address,
          d.tenant_city,
          d.tenant_state,
          d.tenant_zip,
          bp.phone_number,
          bp.email,
          bp.website,
          bp.social_links,
          bp.seo_tags,
          bp.business_description,
          d.shop_category as primary_category,
          d.subscription_tier,
          d.store_average_rating,
          d.store_review_count,
          d.tenant_latitude,
          d.tenant_longitude,
          d.default_gateway_type,
          d.has_active_payment_gateway,
          COUNT(DISTINCT inventory_item_id) FILTER (WHERE item_status = 'active' AND visibility = 'public') as product_count
        FROM mv_storefront_discovery d
        LEFT JOIN tenant_business_profiles_list bp ON d.tenant_id = bp.tenant_id
        WHERE d.tenant_id = $1
        GROUP BY 
          d.tenant_id, d.tenant_name, d.tenant_slug,
          d.tenant_logo_url, d.tenant_address, d.tenant_city, d.tenant_state,
          d.tenant_zip, bp.phone_number, bp.email, bp.website, bp.social_links, bp.seo_tags, bp.business_description,
          d.shop_category, d.subscription_tier,
          d.store_average_rating, d.store_review_count,
          d.tenant_latitude, d.tenant_longitude,
          d.default_gateway_type, d.has_active_payment_gateway
        LIMIT 1
      `;

      const result = await this.pool.query(query, [tenantId]);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      const transformedShop: Shop = {
        id: row.tenant_id,
        name: row.tenant_name,
        slug: row.tenant_slug || '',
        business_name: row.tenant_name,
        imageUrl: row.tenant_logo_url || undefined,
        address: row.tenant_address || undefined,
        city: row.tenant_city || undefined,
        state: row.tenant_state || undefined,
        zip_code: row.tenant_zip || undefined,
        location: `${row.tenant_city || ''}${row.tenant_city && row.tenant_state ? ', ' : ''}${row.tenant_state || ''}`,
        phone: row.phone_number || undefined,
        email: row.email || undefined,
        website: row.website || undefined,
        social_links: row.social_links || undefined,
        seo_tags: row.seo_tags || undefined,
        default_gateway_type: row.default_gateway_type || undefined,
        has_active_payment_gateway: row.has_active_payment_gateway || false,
        rating: row.store_average_rating ? parseFloat(row.store_average_rating) : undefined,
        rating_count: row.store_review_count ? parseInt(row.store_review_count) : undefined,
        productCount: parseInt(row.product_count) || 0,
        is_published: true,
        primary_category: row.primary_category || undefined,
        businessDescription: row.business_description || undefined,
        latitude: row.tenant_latitude ? parseFloat(row.tenant_latitude) : undefined,
        longitude: row.tenant_longitude ? parseFloat(row.tenant_longitude) : undefined,
        created_at: new Date()
      };

      await this.setCache(cacheKey, transformedShop, { ttl: 900 }); // 15 minutes
      return transformedShop;
    } catch (error) {
      this.logError(`Error fetching shop by tenantId ${tenantId}`, error);
      throw error;
    }
  }

  /**
   * Get shop categories with caching
   */
  async getShopCategories(): Promise<ShopCategory[]> {
    const cacheKey = 'shop:categories:all';

    // Check UniversalSingleton cache first
    const cached = await this.getFromCache<ShopCategory[]>(cacheKey);
    if (cached) {
      this.logInfo('Cache hit for shop categories');
      return cached;
    }

    this.logInfo('Cache miss, fetching shop categories from database');

    try {
      const query = `
        SELECT 
          shop_category as primary_category,
          COUNT(DISTINCT tenant_id) as count
        FROM mv_storefront_discovery
        WHERE shop_category IS NOT NULL
          AND shop_category != ''
          AND item_status = 'active'
          AND visibility = 'public'
        GROUP BY shop_category
        ORDER BY count DESC, shop_category ASC
      `;

      const result = await this.pool.query(query);
      const categories = result.rows.map((row: any) => ({
        id: row.primary_category.toLowerCase().replace(/\s+/g, '-'),
        name: row.primary_category,
        count: parseInt(row.count)
      }));

      // Store in UniversalSingleton cache
      await this.setCache(cacheKey, categories, { ttl: 1800 }); // 30 minutes
      return categories;
    } catch (error) {
      this.logError('Error fetching shop categories', error);
      throw error;
    }
  }

  /**
   * Get shop locations with caching
   */
  async getShopLocations(): Promise<ShopLocation[]> {
    const cacheKey = 'shop:locations:all';

    // Check UniversalSingleton cache first
    const cached = await this.getFromCache<ShopLocation[]>(cacheKey);
    if (cached) {
      this.logInfo('Cache hit for shop locations');
      return cached;
    }

    this.logInfo('Cache miss, fetching shop locations from database');

    try {
      const query = `
        SELECT DISTINCT
          tenant_city as city,
          tenant_state as state,
          tenant_zip as zip
        FROM mv_storefront_discovery
        WHERE tenant_city IS NOT NULL
          AND tenant_state IS NOT NULL
          AND item_status = 'active'
          AND visibility = 'public'
        ORDER BY tenant_state, tenant_city
      `;

      const result = await this.pool.query(query);
      const locations = result.rows;

      // Store in UniversalSingleton cache
      await this.setCache(cacheKey, locations, { ttl: 1800 }); // 30 minutes
      return locations;
    } catch (error) {
      this.logError('Error fetching shop locations', error);
      throw error;
    }
  }

  /**
   * Get nearby shops with caching
   */
  async getNearbyShops(options: {
    latitude: number;
    longitude: number;
    radiusMiles?: number;
    limit?: number;
    minProducts?: number;
  }): Promise<NearbyShop[]> {
    const { latitude, longitude, radiusMiles = 25, limit = 20, minProducts = 3 } = options;
    const cacheKey = `shop:nearby:${latitude}:${longitude}:${radiusMiles}:${limit}:${minProducts}`;

    // Check UniversalSingleton cache first
    const cached = await this.getFromCache<NearbyShop[]>(cacheKey);
    if (cached) {
      this.logInfo('Cache hit for nearby shops');
      return cached;
    }

    this.logInfo('Cache miss, fetching nearby shops from database');

    try {
      // Use Earth's radius in miles: 3959
      const query = `
        SELECT 
          id,
          name,
          slug,
          business_name,
          tenant_logo_url as imageUrl,
          address,
          tenant_city as city,
          tenant_state as state,
          tenant_zip as zip_code,
          CONCAT(tenant_city, 
            CASE WHEN tenant_city IS NOT NULL AND tenant_state IS NOT NULL THEN ', ' ELSE '' END,
            tenant_state
          ) as location,
          phone,
          website,
          product_count as productCount,
          tenant_latitude,
          tenant_longitude,
          (3959 * acos(cos(radians(${latitude})) * cos(radians(tenant_latitude)) * 
           cos(radians(tenant_longitude) - radians(${longitude})) + 
           sin(radians(${latitude})) * sin(radians(tenant_latitude)))) as distance
        FROM mv_storefront_discovery
        WHERE tenant_latitude IS NOT NULL
          AND tenant_longitude IS NOT NULL
          AND item_status = 'active'
          AND visibility = 'public'
          AND product_count >= ${minProducts}
          AND (3959 * acos(cos(radians(${latitude})) * cos(radians(tenant_latitude)) * 
           cos(radians(tenant_longitude) - radians(${longitude})) + 
           sin(radians(${latitude})) * sin(radians(tenant_latitude)))) <= ${radiusMiles}
        ORDER BY distance ASC
        LIMIT ${limit}
      `;

      const result = await this.pool.query(query);
      const nearbyShops: NearbyShop[] = result.rows;

      // Store in UniversalSingleton cache
      await this.setCache(cacheKey, nearbyShops, { ttl: 300 }); // 5 minutes
      return nearbyShops;
    } catch (error) {
      this.logError('Error fetching nearby shops', error);
      throw error;
    }
  }

  /**
   * Get trending shops with caching
   */
  async getTrendingShops(options: { limit?: number } = {}): Promise<Shop[]> {
    const { limit = 10 } = options;
    const cacheKey = `shop:trending:${limit}`;

    // Check UniversalSingleton cache first
    const cached = await this.getFromCache<Shop[]>(cacheKey);
    if (cached) {
      this.logInfo('Cache hit for shops directory');
      return cached;
    }

    this.logInfo('Cache miss, fetching trending shops from database');

    try {
      // Import ShopsFeaturedService for trending logic
      const { default: ShopsFeaturedService } = await import('./ShopsFeaturedService');
      const shopsService = ShopsFeaturedService.getInstance();

      const trendingShops = await shopsService.getTrendingShops({
        limit,
        region: undefined
      });

      // Handle the response structure from ShopsFeaturedService
      const shopsArray = Array.isArray(trendingShops) ? trendingShops : [];

      // Transform to match Shop interface
      const shops: Shop[] = shopsArray.map((shop: any) => ({
        id: shop.tenantId,
        name: shop.name,
        slug: shop.slug,
        business_name: shop.name,
        imageUrl: shop.imageUrl,
        address: shop.location,
        city: shop.city,
        state: shop.state,
        zip_code: shop.zip_code,
        location: shop.location,
        phone: undefined,
        website: undefined,
        rating: shop.rating,
        rating_count: shop.rating_count,
        reviewCount: shop.reviewCount,
        primary_category: shop.primary_category,
        productCount: shop.productCount,
        is_published: shop.is_published,
        created_at: shop.created_at || new Date()
      }));

      // Store in UniversalSingleton cache
      await this.setCache(cacheKey, shops, { ttl: 600 }); // 10 minutes
      return shops;
    } catch (error) {
      this.logError('Error fetching trending shops', error);
      throw error;
    }
  }

  /**
   * Get shops directory with filtering and pagination
   */
  async getShopsDirectory(options: {
    limit?: number;
    offset?: number;
    search?: string;
    category?: string;
    location?: string;
  } = {}): Promise<Shop[]> {
    const { limit = 20, offset = 0, search, category, location } = options;
    const cacheKey = `shop:directory:${limit}:${offset}:${search || ''}:${category || ''}:${location || ''}`;

    // Check UniversalSingleton cache first
    const cached = await this.getFromCache<Shop[]>(cacheKey);
    if (cached) {
      this.logInfo('Cache hit for shops directory');
      return cached;
    }

    this.logInfo('Cache miss, fetching shops directory from database');

    try {
      const query = `
        SELECT 
          dsl.tenant_id,
          dsl.tenant_name,
          dsl.tenant_slug,
          dsl.tenant_logo_url as imageUrl,
          dsl.tenant_address,
          dsl.tenant_city,
          dsl.tenant_state,
          dsl.tenant_zip,
          -- Use the same category fallback logic as individual shop endpoint
          COALESCE(dl.primary_category, bp.gbp_category_name, 'grocery') as primary_category,
          dsl.subscription_tier,
          NULLIF(AVG(dsl.average_rating), 0) as rating_avg,
          MAX(CAST(dsl.review_count AS INTEGER)) as rating_count,
          COALESCE(ic.item_count, 0) as productCount,
          (dl.is_promoted AND dl.promotion_expires_at IS NOT NULL AND dl.promotion_expires_at > NOW()) as is_promoted,
          dl.promotion_tier,
          dl.promotion_expires_at
        FROM mv_storefront_discovery dsl
        LEFT JOIN directory_listings_list dl ON dsl.tenant_id = dl.tenant_id
        LEFT JOIN tenant_business_profiles_list bp ON dsl.tenant_id = bp.tenant_id
        LEFT JOIN (
          SELECT tenant_id, COUNT(*) as item_count
          FROM inventory_items
          GROUP BY tenant_id
        ) ic ON ic.tenant_id = dsl.tenant_id
        WHERE dsl.item_status = 'active'
          AND dsl.visibility = 'public'
          ${search ? `AND (dsl.tenant_name ILIKE $${search ? 3 : 0} OR COALESCE(dl.primary_category, bp.gbp_category_name, 'grocery') ILIKE $${search ? 3 : 0})` : ''}
          ${category ? `AND COALESCE(dl.primary_category, bp.gbp_category_name, 'grocery') = $${category ? (search ? 4 : 3) : 0}` : ''}
          ${location ? `AND (dsl.tenant_city ILIKE $${location ? (search && category ? 5 : search || category ? 4 : 3) : 0} OR dsl.tenant_state ILIKE $${location ? (search && category ? 5 : search || category ? 4 : 3) : 0})` : ''}
        GROUP BY 
          dsl.tenant_id, dsl.tenant_name, dsl.tenant_slug,
          dsl.tenant_logo_url, dsl.tenant_address, dsl.tenant_city, dsl.tenant_state,
          dsl.tenant_zip, dl.primary_category, bp.gbp_category_name, dsl.subscription_tier, ic.item_count, dl.is_promoted, dl.promotion_tier, dl.promotion_expires_at
        HAVING COUNT(DISTINCT dsl.inventory_item_id) > 0
        ORDER BY productCount DESC NULLS LAST, dsl.tenant_name ASC
        LIMIT $1 OFFSET $2
      `;

      const params: any[] = [limit, offset];
      if (search) params.push(`%${search}%`);
      if (category) params.push(category);
      if (location) params.push(`%${location}%`);

      const result = await this.pool.query(query, params);

      // Get payment gateways for all shops in parallel
      const tenantIds = result.rows.map((row: any) => row.tenant_id);
      const paymentGatewaysPromise = this.getPaymentGatewaysForTenants(tenantIds);

      const [paymentGatewaysMap] = await Promise.all([paymentGatewaysPromise]);

      const shops: Shop[] = result.rows.map((row: any) => ({
        id: row.tenant_id,
        tenantId: row.tenant_id,
        name: row.tenant_name,
        slug: row.tenant_slug || '',
        autoId: row.tenant_id, // Using tenant_id as autoId for now
        business_name: row.tenant_name,
        imageUrl: row.imageurl || undefined,
        address: row.tenant_address || undefined,
        city: row.tenant_city || undefined,
        state: row.tenant_state || undefined,
        zip_code: row.tenant_zip || undefined,
        location: `${row.tenant_city || ''}${row.tenant_city && row.tenant_state ? ', ' : ''}${row.tenant_state || ''}`,
        phone: undefined,
        website: undefined,
        default_gateway_type: paymentGatewaysMap[row.tenant_id]?.find((pg: any) => pg.is_default)?.gateway_type,
        has_active_payment_gateway: paymentGatewaysMap[row.tenant_id]?.length > 0,
        payment_gateways: paymentGatewaysMap[row.tenant_id] || [],
        rating: row.rating_avg ? parseFloat(row.rating_avg) : null,
        rating_count: row.rating_count ? parseInt(row.rating_count) : null,
        reviewCount: row.rating_count ? parseInt(row.rating_count) : null,
        productCount: row.productcount || 0,
        is_promoted: row.is_promoted || false,
        promotion_tier: row.promotion_tier || null,
        promotion_expires_at: row.promotion_expires_at || null,
        is_published: true,
        primary_category: row.primary_category || 'grocery', // Ensure fallback
        created_at: new Date(),
        urls: {
          slugUrl: `/shops/${row.tenant_slug || row.tenant_id}`,
          tenantIdUrl: `/shops/${row.tenant_id}`,
          autoIdUrl: `/shops/${row.tenant_id}`,
          canonicalUrl: `/shops/${row.tenant_slug || row.tenant_id}`
        }
      }));

      // Store in UniversalSingleton cache
      await this.setCache(cacheKey, shops, { ttl: 600 }); // 10 minutes
      this.logInfo(`Fetched ${shops.length} shops from database`);
      return shops;
    } catch (error) {
      this.logError('Error fetching shops directory:', error);
      throw error;
    }
  }

  /**
   * Get payment gateways for multiple tenants
   */
  private async getPaymentGatewaysForTenants(tenantIds: string[]): Promise<Record<string, any[]>> {
    if (tenantIds.length === 0) {
      return {};
    }

    try {
      const query = `
        SELECT 
          tenant_id,
          id,
          gateway_type,
          is_active,
          is_default
        FROM tenant_payment_gateways
        WHERE tenant_id = ANY($1)
          AND is_active = true
        ORDER BY is_default DESC, created_at DESC
      `;

      const result = await this.pool.query(query, [tenantIds]);

      // Group by tenant_id
      const paymentGatewaysMap: Record<string, any[]> = {};
      result.rows.forEach((row: any) => {
        if (!paymentGatewaysMap[row.tenant_id]) {
          paymentGatewaysMap[row.tenant_id] = [];
        }
        paymentGatewaysMap[row.tenant_id].push({
          id: row.id,
          gateway_type: row.gateway_type,
          is_active: row.is_active,
          is_default: row.is_default
        });
      });

      return paymentGatewaysMap;
    } catch (error) {
      this.logError('Error fetching payment gateways for tenants:', error);
      return {};
    }
  }

  /**
   * Get custom metrics for UniversalSingleton
   */
  protected getCustomMetrics() {
    return {
      totalShops: 0,
      totalCategories: 0,
      totalLocations: 0
    };
  }

  /**
   * Get unified shop data with fallbacks from multiple tables
   * Priority: directory_settings_list (slug lookup) -> directory_listings_list -> tenant_business_profiles_list -> tenants
   */
  async getUnifiedShopByIdentifier(identifier: string): Promise<any | null> {
    this.logInfo(`Getting unified shop data for identifier: ${identifier}`);
    
    try {
      // Query from directory_settings_list first (has slug) and join to directory_listings_list
      const query = `
        SELECT 
          -- Core identifiers from directory_settings_list
          dsl.tenant_id,
          dsl.slug,
          dsl.is_published,
          dsl.is_featured,
          
          -- Directory listings (primary source for business data)
          dl.business_name,
          dl.address,
          dl.city,
          dl.state,
          dl.zip_code,
          dl.phone,
          dl.email,
          dl.website,
          dl.latitude,
          dl.longitude,
          dl.primary_category,
          dl.secondary_categories,
          dl.logo_url,
          dl.description,
          dl.business_hours,
          dl.subscription_tier as dl_subscription_tier,
          dl.is_promoted,
          dl.promotion_tier,
          dl.promotion_started_at,
          dl.promotion_expires_at,
          dl.created_at,
          dl.updated_at,
          
          -- Real-time product count from inventory_items
          COALESCE(ic.item_count, 0) as product_count,
          
          -- Real-time rating from store_reviews (approved reviews only)
          COALESCE(
            (SELECT AVG(sr.rating)::numeric
             FROM store_reviews sr 
             WHERE sr.tenant_id = dsl.tenant_id AND sr.approval_status = 'approved'), 
            0
          ) as rating_avg,
          COALESCE(
            (SELECT COUNT(sr.id)::numeric
             FROM store_reviews sr 
             WHERE sr.tenant_id = dsl.tenant_id AND sr.approval_status = 'approved'), 
            0
          ) as rating_count,
          
          -- Business profile fallbacks
          bp.address_line1 as fallback_address_line1,
          bp.address_line2 as fallback_address_line2,
          bp.postal_code as fallback_postal_code,
          bp.country_code as fallback_country_code,
          bp.phone_number as fallback_phone_number,
          bp.email as fallback_email,
          bp.website as fallback_website,
          bp.contact_person as fallback_contact_person,
          bp.logo_url as fallback_logo_url,
          bp.banner_url as fallback_banner_url,
          bp.business_description as fallback_business_description,
          bp.hours as fallback_hours,
          bp.social_links as fallback_social_links,
          bp.latitude as fallback_latitude,
          bp.longitude as fallback_longitude,
          bp.display_map as fallback_display_map,
          bp.gbp_category_id as fallback_gbp_category_id,
          bp.gbp_category_name as fallback_gbp_category_name,
          
          -- Tenant fallbacks
          t.name as fallback_name,
          t.region as fallback_region,
          t.language as fallback_language,
          t.currency as fallback_currency,
          t.subscription_status as fallback_subscription_status,
          t.subscription_tier as fallback_subscription_tier,
          t.subdomain as fallback_subdomain,
          t.directory_visible as fallback_directory_visible,
          t.metadata as fallback_metadata,
          t.is_demo,
          t.demo_expires_at
          
        FROM directory_settings_list dsl
        LEFT JOIN directory_listings_list dl ON dsl.tenant_id = dl.tenant_id
        LEFT JOIN tenant_business_profiles_list bp ON dsl.tenant_id = bp.tenant_id
        LEFT JOIN tenants t ON dsl.tenant_id = t.id
        LEFT JOIN (
          SELECT tenant_id, COUNT(*) as item_count
          FROM inventory_items
          GROUP BY tenant_id
        ) ic ON ic.tenant_id = dsl.tenant_id
        WHERE (dsl.tenant_id = $1 OR dsl.slug = $1)
          AND dsl.is_published = true
        LIMIT 1
      `;

      const result = await this.pool.query(query, [identifier]);
      
      if (result.rows.length === 0) {
        this.logInfo(`No published shop found for identifier: ${identifier}`);
        return null;
      }

      const rawShop = result.rows[0];
      this.logInfo(`Found shop data for tenant: ${rawShop.tenant_id}`);

      // Apply fallbacks in priority order
      const unifiedShop = {
        tenantId: rawShop.tenant_id,
        name: rawShop.business_name || rawShop.fallback_name || 'Shop Name',
        slug: rawShop.slug || 'shop-slug',
        address: rawShop.address || rawShop.fallback_address_line1 || '123 Main Street',
        city: rawShop.city || 'Pittsburgh',
        state: rawShop.state || 'PA',
        zipCode: rawShop.zip_code || rawShop.fallback_postal_code || '15222',
        phone: rawShop.phone || rawShop.fallback_phone_number,
        email: rawShop.email || rawShop.fallback_email,
        website: rawShop.website || rawShop.fallback_website,
        latitude: rawShop.latitude || rawShop.fallback_latitude,
        longitude: rawShop.longitude || rawShop.fallback_longitude,
        primaryCategory: rawShop.primary_category || rawShop.fallback_gbp_category_name || 'grocery',
        secondaryCategories: rawShop.secondary_categories,
        logoUrl: rawShop.logo_url || rawShop.fallback_logo_url,
        bannerUrl: rawShop.fallback_banner_url,
        description: rawShop.description || rawShop.fallback_business_description || 'Shop description',
        hours: rawShop.business_hours || rawShop.fallback_hours,
        ratingAvg: parseFloat(rawShop.rating_avg) || 0,
        ratingCount: parseInt(rawShop.rating_count) || 0,
        productCount: parseInt(rawShop.product_count) || 0,
        isFeatured: rawShop.is_featured || false,
        isPromoted: (rawShop.is_promoted && rawShop.promotion_expires_at && new Date(rawShop.promotion_expires_at) > new Date()) || false,
        promotionTier: rawShop.promotion_tier || null,
        promotionStartedAt: rawShop.promotion_started_at || null,
        promotionExpiresAt: rawShop.promotion_expires_at || null,
        subscriptionTier: rawShop.dl_subscription_tier || rawShop.fallback_subscription_tier || 'starter',
        isPublished: rawShop.is_published || false,
        createdAt: rawShop.created_at,
        updatedAt: rawShop.updated_at,
        
        // Additional fields from business profile
        contactPerson: rawShop.fallback_contact_person,
        socialLinks: rawShop.fallback_social_links,
        countryCode: rawShop.fallback_country_code,
        displayMap: rawShop.fallback_display_map,
        
        // Additional fields from tenant
        region: rawShop.fallback_region,
        language: rawShop.fallback_language,
        currency: rawShop.fallback_currency,
        subscriptionStatus: rawShop.fallback_subscription_status,
        subdomain: rawShop.fallback_subdomain,
        directoryVisible: rawShop.fallback_directory_visible,
        metadata: rawShop.fallback_metadata,
        isDemo: rawShop.is_demo || false,
        demoExpiresAt: rawShop.demo_expires_at || null,
        
        // URLs for navigation
        urls: {
          slugUrl: rawShop.slug ? `/shops/${rawShop.slug}` : null,
          tenantIdUrl: `/shops/${rawShop.tenant_id}`,
          canonicalUrl: rawShop.slug ? `/shops/${rawShop.slug}` : `/shops/${rawShop.tenant_id}`
        }
      };

      this.logInfo(`Successfully created unified shop data for: ${unifiedShop.name}`);
      return unifiedShop;

    } catch (error) {
      this.logError(`Error getting unified shop data for ${identifier}`, error);
      throw error;
    }
  }

  /**
   * Helper logging methods
   */
  protected logInfo(message: string): void {
    logger.info(`[ShopService] ${message}`);
  }

  protected logError(message: string, error: any): void {
    logger.error(`[ShopService] ${message}:`, undefined, { error: { name: 'Error', message: String(error) } });
  }
}

export default ShopService;
