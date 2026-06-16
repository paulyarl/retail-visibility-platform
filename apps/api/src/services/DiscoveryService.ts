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
      //console.log(`[DiscoveryService] Cache hit for ${bucketType} discovery`);
      return {
        ...cached,
        metrics: {
          ...cached.metrics,
          responseTime: Date.now() - startTime
        }
      };
    }

    //console.log(`[DiscoveryService] Cache miss, routing ${bucketType} discovery with query:`, query);

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
    const conditions: string[] = ['item_status = $1'];
    const params: any[] = ['active'];

    // Add scope-based conditions
    this.addScopeConditions(conditions, params, query);

    const whereClause = conditions.join(' AND ');

    const querySQL = `
      SELECT
        inventory_item_id as id,
        product_name as name,
        product_title as title,
        product_description as description,
        marketing_description,
        sku,
        brand,
        manufacturer,
        condition,
        gtin,
        mpn,
        stock,
        quantity,
        availability,
        item_status,
        visibility,
        custom_cta,
        social_links,
        custom_branding,
        custom_sections,
        landing_page_theme,
        image_url,
        image_urls,
        video_url,
        gallery_urls,
        thumbnail_url,
        featured_image_url,
        list_price_cents as price_cents,
        sale_price_cents,
        current_price_cents,
        price,
        is_on_sale,
        discount_percentage,
        currency,
        product_metadata as metadata,
        variant_id,
        variant_name,
        variant_sku,
        variant_color,
        variant_size,
        variant_material,
        variant_style,
        variant_price_cents,
        variant_inventory_quantity,
        product_type,
        product_category,
        product_category_slug,
        product_google_category_id,
        product_parent_category_id,
        is_digital_product,
        is_physical_product,
        is_service,
        is_variant,
        is_bundle,
        is_customizable,
        is_trackable,
        is_taxable,
        is_shipping_required,
        specifications,
        attributes,
        custom_fields,
        search_keywords,
        seo_title,
        seo_description,
        seo_keywords,
        tags,
        weight,
        dimensions,
        inventory_quantity,
        inventory_policy,
        inventory_tracking,
        inventory_quantity_tracked,
        allow_backorder,
        backorder_quantity,
        low_stock_threshold,
        requires_shipping,
        weight_unit,
        length,
        width,
        height,
        dimension_unit,
        featured_type,
        featured_type_array,
        featured_priority,
        featured_at,
        featured_until,
        featured_is_active,
        is_actively_featured,
        featured_metadata,
        product_category_name_lower,
        gbp_secondary_category_count,
        gbp_total_category_count,
        tenant_id,
        tenant_name,
        tenant_slug,
        subscription_tier,
        shop_category as category_slug,
        shop_category_id,
        shop_google_category_id,
        tenant_city as city,
        tenant_state as state,
        tenant_country,
        tenant_zip as zip_code,
        tenant_address as address,
        tenant_latitude as latitude,
        tenant_longitude as longitude,
        timezone,
        tenant_logo_url as tenantLogoUrl,
        business_type,
        business_category,
        business_size,
        established_year,
        -- NEW: Slug registry fields for cross-tenant matching
        product_slug,
        brand_normalized,
        category_normalized,
        slug_type,
        platform_tenant_count,
        platform_purchase_count,
        platform_revenue_cents,
        platform_total_stock,
        view_count,
        unique_viewers,
        engagement_count,
        conversion_count,
        revenue_cents,
        units_sold,
        product_average_rating,
        product_review_count,
        store_average_rating,
        store_review_count,
        average_rating,
        review_count,
        wishlist_count,
        share_count,
        bucket_priority,
        trending_score,
        price_status,
        stock_status,
        has_image,
        has_gallery,
        has_description,
        has_brand,
        has_price,
        in_stock,
        has_active_payment_gateway,
        default_gateway_type,
        created_at,
        updated_at,
        published_at,
        archived_at,
        mv_refreshed_at
      FROM mv_storefront_discovery
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
    const conditions: string[] = ['item_status = $1'];
    const params: any[] = ['active'];

    // Add scope-based conditions
    this.addScopeConditions(conditions, params, query);

    const whereClause = conditions.join(' AND ');

    const querySQL = `
      SELECT DISTINCT
        inventory_item_id as id,
        product_name as name,
        product_title as title,
        product_description as description,
        marketing_description,
        sku,
        brand,
        manufacturer,
        condition,
        gtin,
        mpn,
        stock,
        quantity,
        availability,
        item_status,
        visibility,
        custom_cta,
        social_links,
        custom_branding,
        custom_sections,
        landing_page_theme,
        image_url,
        image_urls,
        video_url,
        gallery_urls,
        thumbnail_url,
        featured_image_url,
        list_price_cents as price_cents,
        sale_price_cents,
        current_price_cents,
        price,
        is_on_sale,
        discount_percentage,
        currency,
        product_metadata as metadata,
        variant_id,
        variant_name,
        variant_sku,
        variant_color,
        variant_size,
        variant_material,
        variant_style,
        variant_price_cents,
        variant_inventory_quantity,
        product_type,
        product_category,
        product_category_slug,
        product_google_category_id,
        product_parent_category_id,
        is_digital_product,
        is_physical_product,
        is_service,
        is_variant,
        is_bundle,
        is_customizable,
        is_trackable,
        is_taxable,
        is_shipping_required,
        specifications,
        attributes,
        custom_fields,
        search_keywords,
        seo_title,
        seo_description,
        seo_keywords,
        tags,
        weight,
        dimensions,
        inventory_quantity,
        inventory_policy,
        inventory_tracking,
        inventory_quantity_tracked,
        allow_backorder,
        backorder_quantity,
        low_stock_threshold,
        requires_shipping,
        weight_unit,
        length,
        width,
        height,
        dimension_unit,
        featured_type,
        featured_type_array,
        featured_priority,
        featured_at,
        featured_until,
        featured_is_active,
        is_actively_featured,
        featured_metadata,
        product_category_name_lower,
        gbp_secondary_category_count,
        gbp_total_category_count,
        tenant_id,
        tenant_name,
        tenant_slug,
        subscription_tier,
        shop_category as category_slug,
        shop_category_id,
        shop_google_category_id,
        tenant_city as city,
        tenant_state as state,
        tenant_country,
        tenant_zip as zip_code,
        tenant_address as address,
        tenant_latitude as latitude,
        tenant_longitude as longitude,
        timezone,
        tenant_logo_url as tenantLogoUrl,
        business_type,
        business_category,
        business_size,
        established_year,
        -- NEW: Slug registry fields for cross-tenant matching
        product_slug,
        brand_normalized,
        category_normalized,
        slug_type,
        platform_tenant_count,
        platform_purchase_count,
        platform_revenue_cents,
        platform_total_stock,
        view_count,
        unique_viewers,
        engagement_count,
        conversion_count,
        revenue_cents,
        units_sold,
        product_average_rating,
        product_review_count,
        store_average_rating,
        store_review_count,
        average_rating,
        review_count,
        wishlist_count,
        share_count,
        bucket_priority,
        trending_score,
        price_status,
        stock_status,
        has_image,
        has_gallery,
        has_description,
        has_brand,
        has_price,
        in_stock,
        has_active_payment_gateway,
        default_gateway_type,
        created_at,
        updated_at,
        published_at,
        archived_at,
        mv_refreshed_at
      FROM mv_storefront_discovery
      WHERE ${whereClause}
      ORDER BY average_rating DESC NULLS LAST, review_count DESC, created_at DESC
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
    const conditions: string[] = ['item_status = $1'];
    const params: any[] = ['active'];

    // Add scope-based conditions
    this.addScopeConditions(conditions, params, query);

    const whereClause = conditions.join(' AND ');

    const querySQL = `
      SELECT DISTINCT
        inventory_item_id as id,
        product_name as name,
        product_title as title,
        product_description as description,
        marketing_description,
        sku,
        brand,
        manufacturer,
        condition,
        gtin,
        mpn,
        stock,
        quantity,
        availability,
        item_status,
        visibility,
        custom_cta,
        social_links,
        custom_branding,
        custom_sections,
        landing_page_theme,
        image_url,
        image_urls,
        video_url,
        gallery_urls,
        thumbnail_url,
        featured_image_url,
        list_price_cents as price_cents,
        sale_price_cents,
        current_price_cents,
        price,
        is_on_sale,
        discount_percentage,
        currency,
        product_metadata as metadata,
        variant_id,
        variant_name,
        variant_sku,
        variant_color,
        variant_size,
        variant_material,
        variant_style,
        variant_price_cents,
        variant_inventory_quantity,
        product_type,
        product_category,
        product_category_slug,
        product_google_category_id,
        product_parent_category_id,
        is_digital_product,
        is_physical_product,
        is_service,
        is_variant,
        is_bundle,
        is_customizable,
        is_trackable,
        is_taxable,
        is_shipping_required,
        specifications,
        attributes,
        custom_fields,
        search_keywords,
        seo_title,
        seo_description,
        seo_keywords,
        tags,
        weight,
        dimensions,
        inventory_quantity,
        inventory_policy,
        inventory_tracking,
        inventory_quantity_tracked,
        allow_backorder,
        backorder_quantity,
        low_stock_threshold,
        requires_shipping,
        weight_unit,
        length,
        width,
        height,
        dimension_unit,
        featured_type,
        featured_type_array,
        featured_priority,
        featured_at,
        featured_until,
        featured_is_active,
        is_actively_featured,
        featured_metadata,
        product_category_name_lower,
        gbp_secondary_category_count,
        gbp_total_category_count,
        tenant_id,
        tenant_name,
        tenant_slug,
        subscription_tier,
        shop_category as category_slug,
        shop_category_id,
        shop_google_category_id,
        tenant_city as city,
        tenant_state as state,
        tenant_country,
        tenant_zip as zip_code,
        tenant_address as address,
        tenant_latitude as latitude,
        tenant_longitude as longitude,
        timezone,
        tenant_logo_url as tenantLogoUrl,
        business_type,
        business_category,
        business_size,
        established_year,
        -- NEW: Slug registry fields for cross-tenant matching
        product_slug,
        brand_normalized,
        category_normalized,
        slug_type,
        platform_tenant_count,
        platform_purchase_count,
        platform_revenue_cents,
        platform_total_stock,
        view_count,
        unique_viewers,
        engagement_count,
        conversion_count,
        revenue_cents,
        units_sold,
        product_average_rating,
        product_review_count,
        store_average_rating,
        store_review_count,
        average_rating,
        review_count,
        wishlist_count,
        share_count,
        bucket_priority,
        trending_score,
        price_status,
        stock_status,
        has_image,
        has_gallery,
        has_description,
        has_brand,
        has_price,
        in_stock,
        has_active_payment_gateway,
        default_gateway_type,
        created_at,
        updated_at,
        published_at,
        archived_at,
        mv_refreshed_at
      FROM mv_storefront_discovery
      WHERE ${whereClause}
      ORDER BY created_at DESC
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
    const conditions: string[] = ['item_status = $1', 'visibility = $2', 'current_price_cents > 0'];
    const params: any[] = ['active', 'public'];

    // Add scope-based conditions
    this.addScopeConditions(conditions, params, query);

    const whereClause = conditions.join(' AND ');

    const querySQL = `
      SELECT DISTINCT
        inventory_item_id as id,
        product_name as name,
        product_title as title,
        product_description as description,
        marketing_description,
        sku,
        brand,
        manufacturer,
        condition,
        gtin,
        mpn,
        stock,
        quantity,
        availability,
        item_status,
        visibility,
        custom_cta,
        social_links,
        custom_branding,
        custom_sections,
        landing_page_theme,
        image_url,
        image_urls,
        video_url,
        gallery_urls,
        thumbnail_url,
        featured_image_url,
        list_price_cents as price_cents,
        sale_price_cents,
        current_price_cents,
        price,
        is_on_sale,
        discount_percentage,
        currency,
        product_metadata as metadata,
        variant_id,
        variant_name,
        variant_sku,
        variant_color,
        variant_size,
        variant_material,
        variant_style,
        variant_price_cents,
        variant_inventory_quantity,
        product_type,
        product_category,
        product_category_slug,
        product_google_category_id,
        product_parent_category_id,
        is_digital_product,
        is_physical_product,
        is_service,
        is_variant,
        is_bundle,
        is_customizable,
        is_trackable,
        is_taxable,
        is_shipping_required,
        specifications,
        attributes,
        custom_fields,
        search_keywords,
        seo_title,
        seo_description,
        seo_keywords,
        tags,
        weight,
        dimensions,
        inventory_quantity,
        inventory_policy,
        inventory_tracking,
        inventory_quantity_tracked,
        allow_backorder,
        backorder_quantity,
        low_stock_threshold,
        requires_shipping,
        weight_unit,
        length,
        width,
        height,
        dimension_unit,
        featured_type,
        featured_type_array,
        featured_priority,
        featured_at,
        featured_until,
        featured_is_active,
        is_actively_featured,
        featured_metadata,
        product_category_name_lower,
        gbp_secondary_category_count,
        gbp_total_category_count,
        tenant_id,
        tenant_name,
        tenant_slug,
        subscription_tier,
        shop_category as category_slug,
        shop_category_id,
        shop_google_category_id,
        tenant_city as city,
        tenant_state as state,
        tenant_country,
        tenant_zip as zip_code,
        tenant_address as address,
        tenant_latitude as latitude,
        tenant_longitude as longitude,
        timezone,
        tenant_logo_url as tenantLogoUrl,
        business_type,
        business_category,
        business_size,
        established_year,
        -- NEW: Slug registry fields for cross-tenant matching
        product_slug,
        brand_normalized,
        category_normalized,
        slug_type,
        platform_tenant_count,
        platform_purchase_count,
        platform_revenue_cents,
        platform_total_stock,
        view_count,
        unique_viewers,
        engagement_count,
        conversion_count,
        revenue_cents,
        units_sold,
        product_average_rating,
        product_review_count,
        store_average_rating,
        store_review_count,
        average_rating,
        review_count,
        wishlist_count,
        share_count,
        bucket_priority,
        trending_score,
        price_status,
        stock_status,
        has_image,
        has_gallery,
        has_description,
        has_brand,
        has_price,
        in_stock,
        has_active_payment_gateway,
        default_gateway_type,
        created_at,
        updated_at,
        published_at,
        archived_at,
        mv_refreshed_at,
        discount_percentage
      FROM mv_storefront_discovery
      WHERE ${whereClause}
        AND (sale_price_cents IS NOT NULL AND sale_price_cents < list_price_cents)
      ORDER BY discount_percentage DESC, created_at DESC
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
    const conditions: string[] = ['item_status = $1'];
    const params: any[] = ['active'];

    // Add scope-based conditions
    this.addScopeConditions(conditions, params, query);

    // Add seasonal conditions (simplified - could be enhanced with actual seasonal logic)
    conditions.push("product_metadata->>'seasonal' = 'true'");
    conditions.push("product_metadata->>'current_season' = 'true'");

    const whereClause = conditions.join(' AND ');

    const querySQL = `
      SELECT DISTINCT
        inventory_item_id as id,
        product_name as name,
        product_title as title,
        product_description as description,
        marketing_description,
        sku,
        brand,
        manufacturer,
        condition,
        gtin,
        mpn,
        stock,
        quantity,
        availability,
        item_status,
        visibility,
        custom_cta,
        social_links,
        custom_branding,
        custom_sections,
        landing_page_theme,
        image_url,
        image_urls,
        video_url,
        gallery_urls,
        thumbnail_url,
        featured_image_url,
        list_price_cents as price_cents,
        sale_price_cents,
        current_price_cents,
        price,
        is_on_sale,
        discount_percentage,
        currency,
        product_metadata as metadata,
        variant_id,
        variant_name,
        variant_sku,
        variant_color,
        variant_size,
        variant_material,
        variant_style,
        variant_price_cents,
        variant_inventory_quantity,
        product_type,
        product_category,
        product_category_slug,
        product_google_category_id,
        product_parent_category_id,
        is_digital_product,
        is_physical_product,
        is_service,
        is_variant,
        is_bundle,
        is_customizable,
        is_trackable,
        is_taxable,
        is_shipping_required,
        specifications,
        attributes,
        custom_fields,
        search_keywords,
        seo_title,
        seo_description,
        seo_keywords,
        tags,
        weight,
        dimensions,
        inventory_quantity,
        inventory_policy,
        inventory_tracking,
        inventory_quantity_tracked,
        allow_backorder,
        backorder_quantity,
        low_stock_threshold,
        requires_shipping,
        weight_unit,
        length,
        width,
        height,
        dimension_unit,
        featured_type,
        featured_type_array,
        featured_priority,
        featured_at,
        featured_until,
        featured_is_active,
        is_actively_featured,
        featured_metadata,
        product_category_name_lower,
        gbp_secondary_category_count,
        gbp_total_category_count,
        tenant_id,
        tenant_name,
        tenant_slug,
        subscription_tier,
        shop_category as category_slug,
        shop_category_id,
        shop_google_category_id,
        tenant_city as city,
        tenant_state as state,
        tenant_country,
        tenant_zip as zip_code,
        tenant_address as address,
        tenant_latitude as latitude,
        tenant_longitude as longitude,
        timezone,
        tenant_logo_url as tenantLogoUrl,
        business_type,
        business_category,
        business_size,
        established_year,
        -- NEW: Slug registry fields for cross-tenant matching
        product_slug,
        brand_normalized,
        category_normalized,
        slug_type,
        platform_tenant_count,
        platform_purchase_count,
        platform_revenue_cents,
        platform_total_stock,
        view_count,
        unique_viewers,
        engagement_count,
        conversion_count,
        revenue_cents,
        units_sold,
        product_average_rating,
        product_review_count,
        store_average_rating,
        store_review_count,
        average_rating,
        review_count,
        wishlist_count,
        share_count,
        bucket_priority,
        trending_score,
        price_status,
        stock_status,
        has_image,
        has_gallery,
        has_description,
        has_brand,
        has_price,
        in_stock,
        has_active_payment_gateway,
        default_gateway_type,
        created_at,
        updated_at,
        published_at,
        archived_at,
        mv_refreshed_at
      FROM mv_storefront_discovery
      WHERE ${whereClause}
      ORDER BY featured_priority DESC, created_at DESC
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
    const conditions: string[] = ['item_status = $1'];
    const params: any[] = ['active'];

    // Add scope-based conditions
    this.addScopeConditions(conditions, params, query);

    const whereClause = conditions.join(' AND ');

    const querySQL = `
      SELECT DISTINCT
        inventory_item_id as id,
        product_name as name,
        product_title as title,
        product_description as description,
        marketing_description,
        sku,
        brand,
        manufacturer,
        condition,
        gtin,
        mpn,
        stock,
        quantity,
        availability,
        item_status,
        visibility,
        custom_cta,
        social_links,
        custom_branding,
        custom_sections,
        landing_page_theme,
        image_url,
        image_urls,
        video_url,
        gallery_urls,
        thumbnail_url,
        featured_image_url,
        list_price_cents as price_cents,
        sale_price_cents,
        current_price_cents,
        price,
        is_on_sale,
        discount_percentage,
        currency,
        product_metadata as metadata,
        variant_id,
        variant_name,
        variant_sku,
        variant_color,
        variant_size,
        variant_material,
        variant_style,
        variant_price_cents,
        variant_inventory_quantity,
        product_type,
        product_category,
        product_category_slug,
        product_google_category_id,
        product_parent_category_id,
        is_digital_product,
        is_physical_product,
        is_service,
        is_variant,
        is_bundle,
        is_customizable,
        is_trackable,
        is_taxable,
        is_shipping_required,
        specifications,
        attributes,
        custom_fields,
        search_keywords,
        seo_title,
        seo_description,
        seo_keywords,
        tags,
        weight,
        dimensions,
        inventory_quantity,
        inventory_policy,
        inventory_tracking,
        inventory_quantity_tracked,
        allow_backorder,
        backorder_quantity,
        low_stock_threshold,
        requires_shipping,
        weight_unit,
        length,
        width,
        height,
        dimension_unit,
        featured_type,
        featured_type_array,
        featured_priority,
        featured_at,
        featured_until,
        featured_is_active,
        is_actively_featured,
        featured_metadata,
        product_category_name_lower,
        gbp_secondary_category_count,
        gbp_total_category_count,
        tenant_id,
        tenant_name,
        tenant_slug,
        subscription_tier,
        shop_category as category_slug,
        shop_category_id,
        shop_google_category_id,
        tenant_city as city,
        tenant_state as state,
        tenant_country,
        tenant_zip as zip_code,
        tenant_address as address,
        tenant_latitude as latitude,
        tenant_longitude as longitude,
        timezone,
        tenant_logo_url as tenantLogoUrl,
        business_type,
        business_category,
        business_size,
        established_year,
        -- NEW: Slug registry fields for cross-tenant matching
        product_slug,
        brand_normalized,
        category_normalized,
        slug_type,
        platform_tenant_count,
        platform_purchase_count,
        platform_revenue_cents,
        platform_total_stock,
        view_count,
        unique_viewers,
        engagement_count,
        conversion_count,
        revenue_cents,
        units_sold,
        product_average_rating,
        product_review_count,
        store_average_rating,
        store_review_count,
        average_rating,
        review_count,
        wishlist_count,
        share_count,
        bucket_priority,
        trending_score,
        price_status,
        stock_status,
        has_image,
        has_gallery,
        has_description,
        has_brand,
        has_price,
        in_stock,
        has_active_payment_gateway,
        default_gateway_type,
        created_at,
        updated_at,
        published_at,
        archived_at,
        mv_refreshed_at
      FROM mv_storefront_discovery
      WHERE ${whereClause}
        AND featured_type = 'staff_pick'
        AND featured_is_active = true
      ORDER BY featured_priority DESC, created_at DESC
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
    const conditions: string[] = ['item_status = $1'];
    const params: any[] = ['active'];

    // Add scope-based conditions
    this.addScopeConditions(conditions, params, query);

    const whereClause = conditions.join(' AND ');

    const querySQL = `
      SELECT DISTINCT
        inventory_item_id as id,
        product_name as name,
        product_title as title,
        product_description as description,
        marketing_description,
        sku,
        brand,
        manufacturer,
        condition,
        gtin,
        mpn,
        stock,
        quantity,
        availability,
        item_status,
        visibility,
        custom_cta,
        social_links,
        custom_branding,
        custom_sections,
        landing_page_theme,
        image_url,
        image_urls,
        video_url,
        gallery_urls,
        thumbnail_url,
        featured_image_url,
        list_price_cents as price_cents,
        sale_price_cents,
        current_price_cents,
        price,
        is_on_sale,
        discount_percentage,
        currency,
        product_metadata as metadata,
        variant_id,
        variant_name,
        variant_sku,
        variant_color,
        variant_size,
        variant_material,
        variant_style,
        variant_price_cents,
        variant_inventory_quantity,
        product_type,
        product_category,
        product_category_slug,
        product_google_category_id,
        product_parent_category_id,
        is_digital_product,
        is_physical_product,
        is_service,
        is_variant,
        is_bundle,
        is_customizable,
        is_trackable,
        is_taxable,
        is_shipping_required,
        specifications,
        attributes,
        custom_fields,
        search_keywords,
        seo_title,
        seo_description,
        seo_keywords,
        tags,
        weight,
        dimensions,
        inventory_quantity,
        inventory_policy,
        inventory_tracking,
        inventory_quantity_tracked,
        allow_backorder,
        backorder_quantity,
        low_stock_threshold,
        requires_shipping,
        weight_unit,
        length,
        width,
        height,
        dimension_unit,
        featured_type,
        featured_type_array,
        featured_priority,
        featured_at,
        featured_until,
        featured_is_active,
        is_actively_featured,
        featured_metadata,
        product_category_name_lower,
        gbp_secondary_category_count,
        gbp_total_category_count,
        tenant_id,
        tenant_name,
        tenant_slug,
        subscription_tier,
        shop_category as category_slug,
        shop_category_id,
        shop_google_category_id,
        tenant_city as city,
        tenant_state as state,
        tenant_country,
        tenant_zip as zip_code,
        tenant_address as address,
        tenant_latitude as latitude,
        tenant_longitude as longitude,
        timezone,
        tenant_logo_url as tenantLogoUrl,
        business_type,
        business_category,
        business_size,
        established_year,
        -- NEW: Slug registry fields for cross-tenant matching
        product_slug,
        brand_normalized,
        category_normalized,
        slug_type,
        platform_tenant_count,
        platform_purchase_count,
        platform_revenue_cents,
        platform_total_stock,
        view_count,
        unique_viewers,
        engagement_count,
        conversion_count,
        revenue_cents,
        units_sold,
        product_average_rating,
        product_review_count,
        store_average_rating,
        store_review_count,
        average_rating,
        review_count,
        wishlist_count,
        share_count,
        bucket_priority,
        trending_score,
        price_status,
        stock_status,
        has_image,
        has_gallery,
        has_description,
        has_brand,
        has_price,
        in_stock,
        has_active_payment_gateway,
        default_gateway_type,
        created_at,
        updated_at,
        published_at,
        archived_at,
        mv_refreshed_at
      FROM mv_storefront_discovery
      WHERE ${whereClause}
        AND featured_type = 'store_selection'
        AND featured_is_active = true
      ORDER BY featured_priority DESC, created_at DESC
      LIMIT $${params.length + 1}
    `;

    params.push(limit);
    const result = await pool.query(querySQL, params);

    return result.rows.map(row => this.transformDiscoveryProduct(row));
  }

  private addScopeConditions(conditions: string[], params: any[], query: DiscoveryQuery): void {
    let paramIndex = params.length;

    switch (query.scope) {
      case 'shop':
        if (query.tenantId) {
          conditions.push(`tenant_id = $${paramIndex + 1}`);
          params.push(query.tenantId);
          paramIndex++;
        }
        break;

      case 'location':
        if (query.location) {
          if (query.location.city) {
            conditions.push(`tenant_city = $${paramIndex + 1}`);
            params.push(query.location.city);
            paramIndex++;
          }
          if (query.location.state) {
            conditions.push(`tenant_state = $${paramIndex + 1}`);
            params.push(query.location.state);
            paramIndex++;
          }
          if (query.location.zip) {
            conditions.push(`tenant_zip = $${paramIndex + 1}`);
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
            conditions.push(`product_category = $${paramIndex + 1}`);
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
      tenantLogoUrl: row.tenantlogourl,
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
      // Add product-specific rating and category
      productRating: row.product_average_rating,
      productReviewCount: row.product_review_count,
      categoryName: row.product_category,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      featuredType: row.featured_type,
      featuredPriority: row.featured_priority,
      featuredAt: row.featured_at,
      isActivelyFeatured: row.is_actively_featured,
      metadata: row.metadata,
      // NEW: Slug registry fields for cross-tenant matching
      productSlug: row.product_slug,
      brandNormalized: row.brand_normalized,
      categoryNormalized: row.category_normalized,
      slugType: row.slug_type,
      platformTenantCount: row.platform_tenant_count,
      platformPurchaseCount: row.platform_purchase_count,
      platformRevenueCents: row.platform_revenue_cents,
      platformTotalStock: row.platform_total_stock
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
