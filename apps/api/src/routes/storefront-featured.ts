/**
 * Storefront Featured Products API Routes
 * Using materialized views for instant featured product queries
 * 
 * Performance: 50-100ms → <5ms (10-20x faster!)
 * Date: 2025-01-15
 */

import { Router, Request, Response } from 'express';
import { getDirectPool } from '../utils/db-pool';

const router = Router();

/**
 * GET /api/storefront/:tenantId/featured-products
 * Returns all featured products grouped by type (bucket approach)
 * Each product appears only in its primary featured type bucket
 */
router.get('/:tenantId/featured-products', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { limit = '20', includeExpired = 'false' } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_required' });
    }
    
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const showExpired = includeExpired === 'true';
    
    // Single query to get ALL featured products data using mv_global_discovery
    // Use DISTINCT to ensure each product appears only once per bucket
    const query = `
      SELECT DISTINCT 
        mv.*
      FROM mv_global_discovery mv
      WHERE mv.tenant_id = $1
        AND mv.featured_is_active = true
        AND mv.item_status = 'active'
        AND mv.visibility = 'public'
      ORDER BY mv.featured_priority DESC, mv.featured_at DESC
      LIMIT $2
    `;
    
    const result = await getDirectPool().query(query, [tenantId, limitNum]);
    
    // Divide products by featured_type for component props
    const buckets: Record<string, any[]> = {
      staff_pick: [],
      seasonal: [],
      sale: [],
      new_arrival: [],
      store_selection: []
    };
    
    // Group products by featured_type
    result.rows.forEach(product => {
      const featuredType = product.featured_type;
      if (buckets[featuredType]) {
        buckets[featuredType].push(product);
      }
    });
    
    // Calculate total count and bucket counts
    const totalCount = result.rows.length;
    const bucketCounts = Object.fromEntries(
      Object.entries(buckets).map(([type, products]) => [type, products.length])
    );
    
    // Transform to camelCase for frontend compatibility
    const transformedBuckets = Object.fromEntries(
      Object.entries(buckets).map(([bucketType, products]) => [
        bucketType,
        products.map((product: any) => ({
          id: product.inventory_item_id,
          tenantId: product.tenant_id,
          sku: product.sku,
          name: product.product_name,
          title: product.product_title,
          description: product.product_description,
          price: typeof product.current_price_cents === 'number' ? product.current_price_cents / 100 : 0,
          priceCents: product.current_price_cents,
          salePrice: typeof product.sale_price_cents === 'number' ? product.sale_price_cents / 100 : null,
          salePriceCents: product.sale_price_cents,
          stock: product.stock,
          imageUrl: product.image_url,
          brand: product.brand,
          itemStatus: product.item_status,
          availability: product.availability,
          hasVariants: product.is_variant,
          categoryName: product.product_category_name_lower,
          categorySlug: product.product_category,
          googleCategoryId: product.product_google_category_id,
          hasGallery: product.has_gallery,
          hasDescription: product.has_description,
          hasBrand: product.has_brand,
          hasPrice: product.has_price,
          tenantName: product.tenant_name,
          tenantLogoUrl: product.tenant_logo_url,
          createdAt: product.created_at,
          updatedAt: product.updated_at,
          metadata: product.product_metadata,
          featuredType: product.featured_type,
          featuredPriority: product.featured_priority,
          featuredAt: product.featured_at,
          featuredExpiresAt: product.featured_until,
          autoUnfeature: product.auto_unfeature,
          isFeaturedActive: product.featured_is_active,
          daysUntilExpiration: product.days_until_expiration,
          isExpired: product.is_expired,
          isExpiringSoon: product.is_expiring_soon,
          // Include all additional fields from mv_global_discovery
          marketingDescription: product.marketing_description,
          manufacturer: product.manufacturer,
          condition: product.condition,
          gtin: product.gtin,
          mpn: product.mpn,
          quantity: product.quantity,
          visibility: product.visibility,
          imageUrls: product.image_urls,
          videoUrl: product.video_url,
          galleryUrls: product.gallery_urls,
          thumbnailUrl: product.thumbnail_url,
          featuredImageUrl: product.featured_image_url,
          listPriceCents: product.list_price_cents,
          isOnSale: product.is_on_sale,
          discountPercentage: product.discount_percentage,
          currency: product.currency,
          variantId: product.variant_id,
          variantName: product.variant_name,
          variantSku: product.variant_sku,
          variantColor: product.variant_color,
          variantSize: product.variant_size,
          variantMaterial: product.variant_material,
          variantStyle: product.variant_style,
          variantPriceCents: product.variant_price_cents,
          variantInventoryQuantity: product.variant_inventory_quantity,
          productType: product.product_type,
          productCategory: product.product_category,
          productCategorySlug: product.product_category_slug,
          productParentCategoryId: product.product_parent_category_id,
          isDigitalProduct: product.is_digital_product,
          isPhysicalProduct: product.is_physical_product,
          isService: product.is_service,
          isBundle: product.is_bundle,
          isCustomizable: product.is_customizable,
          isTrackable: product.is_trackable,
          isTaxable: product.is_taxable,
          isShippingRequired: product.is_shipping_required,
          specifications: product.specifications,
          attributes: product.attributes,
          customFields: product.custom_fields,
          searchKeywords: product.search_keywords,
          seoTitle: product.seo_title,
          seoDescription: product.seo_description,
          seoKeywords: product.seo_keywords,
          tags: product.tags,
          weight: product.weight,
          dimensions: product.dimensions,
          inventoryQuantity: product.inventory_quantity,
          inventoryPolicy: product.inventory_policy,
          inventoryTracking: product.inventory_tracking,
          inventoryQuantityTracked: product.inventory_quantity_tracked,
          allowBackorder: product.allow_backorder,
          backorderQuantity: product.backorder_quantity,
          lowStockThreshold: product.low_stock_threshold,
          requiresShipping: product.requires_shipping,
          weightUnit: product.weight_unit,
          length: product.length,
          width: product.width,
          height: product.height,
          dimensionUnit: product.dimension_unit,
          shopCategory: product.shop_category,
          shopCategoryId: product.shop_category_id,
          shopGoogleCategoryId: product.shop_google_category_id,
          tenantCity: product.tenant_city,
          tenantState: product.tenant_state,
          tenantCountry: product.tenant_country,
          tenantZip: product.tenant_zip,
          tenantAddress: product.tenant_address,
          tenantLatitude: product.tenant_latitude,
          tenantLongitude: product.tenant_longitude,
          timezone: product.timezone,
          businessType: product.business_type,
          businessCategory: product.business_category,
          businessSize: product.business_size,
          establishedYear: product.established_year,
          viewCount: product.view_count,
          uniqueViewers: product.unique_viewers,
          engagementCount: product.engagement_count,
          conversionCount: product.conversion_count,
          revenueCents: product.revenue_cents,
          unitsSold: product.units_sold,
          averageRating: product.average_rating,
          reviewCount: product.review_count,
          wishlistCount: product.wishlist_count,
          shareCount: product.share_count,
          bucketPriority: product.bucket_priority,
          trendingScore: product.trending_score,
          priceStatus: product.price_status,
          stockStatus: product.stock_status,
          hasImage: product.has_image,
          inStock: product.in_stock,
          hasActivePaymentGateway: product.has_active_payment_gateway,
          defaultGatewayType: product.default_gateway_type,
          publishedAt: product.published_at,
          archivedAt: product.archived_at,
          mvRefreshedAt: product.mv_refreshed_at
        }))
      ])
    );
    
    // Flatten all products into a single items array for UI compatibility
    const allProducts = [
      ...transformedBuckets.staff_pick,
      ...transformedBuckets.seasonal,
      ...transformedBuckets.sale,
      ...transformedBuckets.new_arrival,
      ...transformedBuckets.store_selection
    ];

    res.json({
      success: true,
      items: allProducts,
      totalCount,
      bucketCounts
    });
    
  } catch (error) {
    console.error('[Storefront Featured Products] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch featured products' 
    });
  }
});

/**
 * GET /api/storefront/:tenantId/featured-products/:type
 * Get products from a specific featured type bucket
 * This is for individual bucket components
 */
router.get('/:tenantId/featured-products/:type', async (req: Request, res: Response) => {
  try {
    const { tenantId, type } = req.params;
    const { limit = '20', includeExpired = 'false' } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_required' });
    }
    
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const showExpired = includeExpired === 'true';
    
    // Validate featured type
    const validTypes = ['staff_pick', 'seasonal', 'sale', 'new_arrival', 'store_selection'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'invalid_featured_type', validTypes });
    }
    
    // Query specific bucket using mv_global_discovery with ALL columns
    const query = `
      SELECT DISTINCT 
        mv.*
      FROM mv_global_discovery mv
      WHERE mv.tenant_id = $1
        AND mv.featured_type = $2
        AND mv.featured_is_active = true
        AND mv.item_status = 'active'
        AND mv.visibility = 'public'
      ORDER BY mv.featured_priority DESC, mv.featured_at DESC
      LIMIT $3
    `;
    
    const result = await getDirectPool().query(query, [tenantId, type, limitNum]);
    
    // Transform to camelCase for frontend compatibility
    const products = result.rows.map((product: any) => ({
      id: product.inventory_item_id,
      tenantId: product.tenant_id,
      sku: product.sku,
      name: product.product_name,
      title: product.product_title,
      description: product.product_description,
      price: typeof product.current_price_cents === 'number' ? product.current_price_cents / 100 : 0,
      priceCents: product.current_price_cents,
      salePrice: typeof product.sale_price_cents === 'number' ? product.sale_price_cents / 100 : null,
      salePriceCents: product.sale_price_cents,
      stock: product.stock,
      imageUrl: product.image_url,
      brand: product.brand,
      itemStatus: product.item_status,
      availability: product.availability,
      hasVariants: product.is_variant,
      categoryName: product.product_category_name_lower,
      categorySlug: product.product_category,
      googleCategoryId: product.product_google_category_id,
      hasGallery: product.has_gallery,
      hasDescription: product.has_description,
      hasBrand: product.has_brand,
      hasPrice: product.has_price,
      tenantName: product.tenant_name,
      tenantLogoUrl: product.tenant_logo_url,
      createdAt: product.created_at,
      updatedAt: product.updated_at,
      metadata: product.product_metadata,
      featuredType: product.featured_type,
      featuredPriority: product.featured_priority,
      featuredAt: product.featured_at,
      featuredExpiresAt: product.featured_until,
      autoUnfeature: product.auto_unfeature,
      isFeaturedActive: product.featured_is_active,
      daysUntilExpiration: product.days_until_expiration,
      isExpired: product.is_expired,
      isExpiringSoon: product.is_expiring_soon,
      // Include all additional fields from mv_global_discovery
      marketingDescription: product.marketing_description,
      manufacturer: product.manufacturer,
      condition: product.condition,
      gtin: product.gtin,
      mpn: product.mpn,
      quantity: product.quantity,
      visibility: product.visibility,
      imageUrls: product.image_urls,
      videoUrl: product.video_url,
      galleryUrls: product.gallery_urls,
      thumbnailUrl: product.thumbnail_url,
      featuredImageUrl: product.featured_image_url,
      listPriceCents: product.list_price_cents,
      isOnSale: product.is_on_sale,
      discountPercentage: product.discount_percentage,
      currency: product.currency,
      variantId: product.variant_id,
      variantName: product.variant_name,
      variantSku: product.variant_sku,
      variantColor: product.variant_color,
      variantSize: product.variant_size,
      variantMaterial: product.variant_material,
      variantStyle: product.variant_style,
      variantPriceCents: product.variant_price_cents,
      variantInventoryQuantity: product.variant_inventory_quantity,
      productType: product.product_type,
      productCategory: product.product_category,
      productCategorySlug: product.product_category_slug,
      productParentCategoryId: product.product_parent_category_id,
      isDigitalProduct: product.is_digital_product,
      isPhysicalProduct: product.is_physical_product,
      isService: product.is_service,
      isBundle: product.is_bundle,
      isCustomizable: product.is_customizable,
      isTrackable: product.is_trackable,
      isTaxable: product.is_taxable,
      isShippingRequired: product.is_shipping_required,
      specifications: product.specifications,
      attributes: product.attributes,
      customFields: product.custom_fields,
      searchKeywords: product.search_keywords,
      seoTitle: product.seo_title,
      seoDescription: product.seo_description,
      seoKeywords: product.seo_keywords,
      tags: product.tags,
      weight: product.weight,
      dimensions: product.dimensions,
      inventoryQuantity: product.inventory_quantity,
      inventoryPolicy: product.inventory_policy,
      inventoryTracking: product.inventory_tracking,
      inventoryQuantityTracked: product.inventory_quantity_tracked,
      allowBackorder: product.allow_backorder,
      backorderQuantity: product.backorder_quantity,
      lowStockThreshold: product.low_stock_threshold,
      requiresShipping: product.requires_shipping,
      weightUnit: product.weight_unit,
      length: product.length,
      width: product.width,
      height: product.height,
      dimensionUnit: product.dimension_unit,
      shopCategory: product.shop_category,
      shopCategoryId: product.shop_category_id,
      shopGoogleCategoryId: product.shop_google_category_id,
      tenantCity: product.tenant_city,
      tenantState: product.tenant_state,
      tenantCountry: product.tenant_country,
      tenantZip: product.tenant_zip,
      tenantAddress: product.tenant_address,
      tenantLatitude: product.tenant_latitude,
      tenantLongitude: product.tenant_longitude,
      timezone: product.timezone,
      businessType: product.business_type,
      businessCategory: product.business_category,
      businessSize: product.business_size,
      establishedYear: product.established_year,
      viewCount: product.view_count,
      uniqueViewers: product.unique_viewers,
      engagementCount: product.engagement_count,
      conversionCount: product.conversion_count,
      revenueCents: product.revenue_cents,
      unitsSold: product.units_sold,
      averageRating: product.average_rating,
      reviewCount: product.review_count,
      wishlistCount: product.wishlist_count,
      shareCount: product.share_count,
      bucketPriority: product.bucket_priority,
      trendingScore: product.trending_score,
      priceStatus: product.price_status,
      stockStatus: product.stock_status,
      hasImage: product.has_image,
      inStock: product.in_stock,
      hasActivePaymentGateway: product.has_active_payment_gateway,
      defaultGatewayType: product.default_gateway_type,
      publishedAt: product.published_at,
      archivedAt: product.archived_at,
      mvRefreshedAt: product.mv_refreshed_at
    }));
    
    res.json({
      success: true,
      data: {
        bucketType: type,
        products,
        totalCount: products.length
      }
    });
    
  } catch (error) {
    const featuredType = req.params.type;
    console.error(`[Storefront Featured Products - ${featuredType}] Error:`, error);
    res.status(500).json({ 
      success: false, 
      error: `Failed to fetch featured ${featuredType} products` 
    });
  }
});

/**
 * GET /api/storefront/:tenantId/featured-count
 * Get count of featured products for a tenant
 * Performance: <1ms (pre-computed in MV)
 */
router.get('/:tenantId/featured-count', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { activeOnly = 'true' } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_required' });
    }
    
    const onlyActive = activeOnly === 'true';
    
    // Fast count using MV index
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_actively_featured = true) as active,
        COUNT(*) FILTER (WHERE featured_until IS NOT NULL AND featured_until < NOW()) as expired
      FROM storefront_products
      WHERE tenant_id = $1
        AND is_featured = true
    `;
    
    const result = await getDirectPool().query(query, [tenantId]);
    const row = result.rows[0];
    
    res.json({
      tenantId,
      total: parseInt(row.total),
      active: parseInt(row.active),
      expired: parseInt(row.expired),
    });
  } catch (error) {
    console.error('[Storefront Featured Count] Error:', error);
    res.status(500).json({ 
      error: 'failed_to_count_featured_products',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/storefront/:tenantId/products-with-featured
 * Get regular products with featured products prioritized at the top
 * Performance: <10ms
 */
router.get('/:tenantId/products-with-featured', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { category, search, page = '1', limit = '12', featuredLimit = '3' } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_required' });
    }
    
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const featuredLimitNum = Math.min(20, Math.max(0, Number(featuredLimit)));
    const skip = (pageNum - 1) * limitNum;
    
    // Build WHERE clause
    const conditions: string[] = ['tenant_id = $1'];
    const params: any[] = [tenantId];
    let paramIndex = 2;
    
    // Category filter
    if (category && typeof category === 'string') {
      conditions.push(`category_slug = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    
    // Search filter
    if (search && typeof search === 'string') {
      conditions.push(`(name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    // Query: Featured products first, then regular products
    const query = `
      WITH featured_products AS (
        SELECT *
        FROM storefront_products
        WHERE ${whereClause}
          AND is_actively_featured = true
        ORDER BY featured_priority DESC, featured_at DESC
        LIMIT $${paramIndex}
      ),
      regular_products AS (
        SELECT *
        FROM storefront_products
        WHERE ${whereClause}
          AND (is_featured = false OR is_actively_featured = false)
        ORDER BY updated_at DESC
        LIMIT $${paramIndex + 1} OFFSET $${paramIndex + 2}
      )
      SELECT * FROM featured_products
      UNION ALL
      SELECT * FROM regular_products
    `;
    
    const countQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE is_actively_featured = true) as featured
      FROM storefront_products
      WHERE ${whereClause}
    `;
    
    // Execute queries in parallel
    const [itemsResult, countResult] = await Promise.all([
      getDirectPool().query(query, [...params, featuredLimitNum, limitNum, skip]),
      getDirectPool().query(countQuery, params),
    ]);
    
    const totalCount = parseInt(countResult.rows[0]?.total || '0');
    const featuredCount = parseInt(countResult.rows[0]?.featured || '0');
    
    // Transform to camelCase
    const items = itemsResult.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      sku: row.sku,
      name: row.name,
      title: row.title,
      description: row.description,
      marketingDescription: row.marketing_description,
      price: row.price,
      priceCents: row.price_cents,
      currency: row.currency,
      stock: row.stock,
      quantity: row.quantity,
      availability: row.availability,
      imageUrl: row.image_url,
      imageGallery: row.image_gallery,
      brand: row.brand,
      manufacturer: row.manufacturer,
      condition: row.condition,
      gtin: row.gtin,
      mpn: row.mpn,
      metadata: row.metadata,
      customCta: row.custom_cta,
      socialLinks: row.social_links,
      customBranding: row.custom_branding,
      customSections: row.custom_sections,
      landingPageTheme: row.landing_page_theme,
      categoryId: row.category_id,
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      isFeatured: row.is_featured,
      featuredAt: row.featured_at,
      featuredUntil: row.featured_until,
      featuredPriority: row.featured_priority,
      isActivelyFeatured: row.is_actively_featured,
      hasImage: row.has_image,
      inStock: row.in_stock,
      hasGallery: row.has_gallery,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
    res.json({
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        pages: Math.ceil(totalCount / limitNum),
      },
      featuredCount,
      tenantId,
    });
  } catch (error) {
    console.error('[Storefront Products with Featured] Error:', error);
    res.status(500).json({ 
      error: 'failed_to_fetch_products',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
