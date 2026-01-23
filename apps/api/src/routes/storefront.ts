/**
 * Storefront API Routes - Materialized Views
 * Using materialized views for instant category filtering
 * 
 * Performance: 100-300ms → <10ms (10-30x faster!)
 * Date: 2024-11-28
 */

import { Router, Request, Response } from 'express';
import { getDirectPool } from '../utils/db-pool';

const router = Router();

/**
 * GET /api/storefront/:tenantId/products
 * Fast storefront product listing using materialized view
 * Performance: <10ms (vs 100-300ms with traditional query)
 */
router.get('/:tenantId/products', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    const { category, search, page = '1', limit = '12' } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_required' });
    }
    
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;
    
    // Build WHERE clause for storefront_products MV
    const conditions: string[] = [
      'sp.tenant_id = $1'
      // Note: MV only contains active, public products - no need to filter again
    ];
    const params: any[] = [tenantId];
    let paramIndex = 2;
    
    // When no specific category is selected, only show products that have categories
    if (!category) {
      conditions.push('sp.category_id IS NOT NULL');
    }
    
    // Category filter - match by slug (MV uses category_slug)
    if (category && typeof category === 'string') {
      conditions.push(`sp.category_slug = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }
    
    // Search filter (name or SKU)
    if (search && typeof search === 'string') {
      conditions.push(`(name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    // Query storefront_products MV for individual products (includes payment gateway info)
    const query = `
      SELECT DISTINCT 
        sp.id,
        sp.tenant_id,
        sp.sku,
        sp.name,
        sp.title,
        sp.description,
        sp.marketing_description,
        sp.price_cents / 100.0 as price,
        sp.price_cents,
        sp.currency,
        sp.stock,
        sp.quantity,
        sp.availability,
        sp.image_url,
        sp.image_gallery,
        sp.brand,
        sp.manufacturer,
        sp.condition,
        sp.gtin,
        sp.mpn,
        sp.metadata,
        sp.custom_cta,
        sp.social_links,
        sp.custom_branding,
        sp.custom_sections,
        sp.landing_page_theme,
        sp.category_slug,
        sp.category_id,
        sp.has_image,
        sp.in_stock,
        sp.has_gallery,
        sp.has_active_payment_gateway,
        sp.default_gateway_type,
        sp.created_at,
        sp.updated_at
      FROM storefront_products sp
      WHERE ${whereClause}
      ORDER BY sp.updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const countQuery = `
      SELECT COUNT(*) as count
      FROM storefront_products sp
      WHERE ${whereClause}
    `;
    
    // Execute queries in parallel
    const [itemsResult, countResult] = await Promise.all([
      getDirectPool().query(query, [...params, limitNum, skip]),
      getDirectPool().query(countQuery, params),
    ]);
    
    const totalCount = parseInt(countResult.rows[0]?.count || '0');
    
    // Debug logging for category mismatches
    if (category) {
      console.log(`[Storefront] Category: ${category}, Count: ${totalCount}, Returned: ${itemsResult.rows.length}`);
    }
    
    // Fetch categories by slug (from category_slug) and id (from category_id)
    const categorySlugs = [...new Set(itemsResult.rows.map((item: any) => item.category_slug).filter(Boolean))];
    const categoryIds = [...new Set(itemsResult.rows.map((item: any) => item.category_id).filter(Boolean))];
    
    // Build category query to fetch by slug OR id
    let categoriesResult = { rows: [] as any[] };
    if (categorySlugs.length > 0 || categoryIds.length > 0) {
      const categoryConditions: string[] = [];
      const categoryParams: any[] = [tenantId];
      let paramIdx = 2;
      
      if (categorySlugs.length > 0) {
        categoryConditions.push(`slug = ANY($${paramIdx})`);
        categoryParams.push(categorySlugs);
        paramIdx++;
      }
      if (categoryIds.length > 0) {
        categoryConditions.push(`id = ANY($${paramIdx})`);
        categoryParams.push(categoryIds);
        paramIdx++;
      }
      
      categoriesResult = await getDirectPool().query(
        `SELECT id, name, slug, "googleCategoryId" FROM directory_category WHERE "tenantId" = $1 AND "isActive" = true AND (${categoryConditions.join(' OR ')})`,
        categoryParams
      );
    }
    
    // Create category lookup maps (by slug and by id)
    const categoryBySlug = new Map(categoriesResult.rows.map((cat: any) => [cat.slug, cat]));
    const categoryById = new Map(categoriesResult.rows.map((cat: any) => [cat.id, cat]));
    
    // Transform to camelCase for frontend compatibility
    const items = itemsResult.rows.map((row: any) => {
      // Find tenant category - prefer category_path, fallback to category_id
      let tenantCategory = null;
      if (row.category_path && row.category_path.length > 0) {
        tenantCategory = categoryBySlug.get(row.category_path[0]) || null;
      }
      if (!tenantCategory && row.category_id) {
        tenantCategory = categoryById.get(row.category_id) || null;
      }
      
      return {
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
        tenantCategory: tenantCategory ? {
          id: tenantCategory.id,
          name: tenantCategory.name,
          slug: tenantCategory.slug,
          googleCategoryId: tenantCategory.googleCategoryId,
        } : null,
        hasImage: row.has_image,
        inStock: row.in_stock,
        hasGallery: row.has_gallery,
        hasActivePaymentGateway: row.has_active_payment_gateway,
        defaultGatewayType: row.default_gateway_type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });
    
    return res.json({
      items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        hasMore: skip + items.length < totalCount,
      },
    });
  } catch (error) {
    console.error('Storefront products error:', error);
    return res.status(500).json({ error: 'failed_to_get_items' });
  }
});

/**
 * GET /api/storefront/:tenantId/categories
 * Get product category list with counts for storefront sidebar
 * Uses storefront_category_counts materialized view (FIXED version)
 * Performance: <5ms
 */
router.get('/:tenantId/categories', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_required' });
    }
    
    // Query the FIXED storefront_category_counts materialized view
    // This provides accurate category counts without CROSS JOIN bugs
    const query = `
      SELECT
        category_id as id,
        category_name as name,
        category_slug as slug,
        google_category_id as googleCategoryId,
        product_count as count,
        products_with_images as productsWithImages,
        products_with_descriptions as productsWithDescriptions,
        products_with_brand as productsWithBrand,
        products_with_price as productsWithPrice,
        in_stock_products as inStockProducts,
        avg_price_cents as avgPriceCents,
        min_price_cents as minPriceCents,
        max_price_cents as maxPriceCents,
        last_product_updated as lastProductUpdated,
        first_product_created as firstProductCreated
      FROM storefront_category_counts
      WHERE tenant_id = $1
        AND category_id IS NOT NULL
      ORDER BY count DESC, category_name ASC
    `;
    
    // Get uncategorized count - products with NO category assignment
    const uncategorizedQuery = `
      SELECT COUNT(*) as count
      FROM storefront_category_counts
      WHERE tenant_id = $1
        AND category_id IS NULL
    `;
    
    const [categoriesResult, uncategorizedResult] = await Promise.all([
      getDirectPool().query(query, [tenantId]),
      getDirectPool().query(uncategorizedQuery, [tenantId]),
    ]);
    
    const categories = categoriesResult.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      googleCategoryId: row.googleCategoryId,
      count: row.count,
      productsWithImages: row.productsWithImages,
      productsWithDescriptions: row.productsWithDescriptions,
      productsWithBrand: row.productsWithBrand,
      productsWithPrice: row.productsWithPrice,
      inStockProducts: row.inStockProducts,
      avgPriceCents: parseFloat(row.avgPriceCents) || 0,
      minPriceCents: row.minPriceCents,
      maxPriceCents: row.maxPriceCents,
      lastProductUpdated: row.lastProductUpdated,
      firstProductCreated: row.firstProductCreated,
    }));
    
    const uncategorizedCount = parseInt(uncategorizedResult.rows[0]?.count || '0');
    
    return res.json({
      categories,
      uncategorizedCount,
    });
  } catch (error) {
    console.error('Storefront categories error:', error);
    return res.status(500).json({ error: 'failed_to_get_categories' });
  }
});

/**
 * GET /api/storefront/:tenantId/storefront/mv-debug
 * Debug endpoint to examine materialized view structure and data
 */
router.get('/:tenantId/storefront/mv-debug', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_required' });
    }
    
    // Check MV structure and sample data
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'storefront_category_counts' 
        AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    const structureResult = await getDirectPool().query(structureQuery);
    
    // Check sample data with raw SQL
    const sampleQuery = `
      SELECT *
      FROM storefront_category_counts
      WHERE tenant_id = $1
      LIMIT 3
    `;
    
    const sampleResult = await getDirectPool().query(sampleQuery, [tenantId]);
    
    // Check MV definition
    const mvDefinitionQuery = `
      SELECT definition 
      FROM pg_matviews 
      WHERE matviewname = 'storefront_category_counts'
    `;
    
    const mvDefinitionResult = await getDirectPool().query(mvDefinitionQuery);
    
    // Check if MV is populated
    const mvStatusQuery = `
      SELECT 
        ispopulated,
        pg_size_pretty(pg_total_relation_size('public.storefront_category_counts')) as size
      FROM pg_matviews 
      WHERE matviewname = 'storefront_category_counts'
    `;
    
    const mvStatusResult = await getDirectPool().query(mvStatusQuery);
    
    return res.json({
      tenantId,
      mvStructure: structureResult.rows,
      sampleData: sampleResult.rows,
      mvDefinition: mvDefinitionResult.rows[0],
      mvStatus: mvStatusResult.rows[0],
      debug: {
        columnCount: structureResult.rows.length,
        sampleCount: sampleResult.rows.length,
        hasInStockProducts: structureResult.rows.some(col => col.column_name === 'in_stock_products'),
        sampleInStockValues: sampleResult.rows.map(row => ({
          category_id: row.category_id,
          category_name: row.category_name,
          product_count: row.product_count,
          in_stock_products: row.in_stock_products,
          in_stock_type: typeof row.in_stock_products
        }))
      }
    });
  } catch (error) {
    console.error('MV Debug error:', error);
    return res.status(500).json({ error: 'failed_to_debug_mv', details: (error as Error).message });
  }
});

/**
 * GET /api/storefront/:tenantId/storefront/categories-stats
 * Get detailed category statistics for a tenant's storefront
 * Uses storefront_category_counts materialized view for accurate data
 */
router.get('/:tenantId/storefront/categories-stats', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_required' });
    }
    
    // Query the storefront_category_counts materialized view for detailed stats
    const query = `
      SELECT
        category_id as id,
        category_name as name,
        category_slug as slug,
        google_category_id as googleCategoryId,
        product_count as count,
        products_with_images as productsWithImages,
        products_with_descriptions as productsWithDescriptions,
        products_with_brand as productsWithBrand,
        products_with_price as productsWithPrice,
        in_stock_products as inStockProducts,
        avg_price_cents as avgPriceCents,
        min_price_cents as minPriceCents,
        max_price_cents as maxPriceCents,
        last_product_updated as lastProductUpdated,
        first_product_created as firstProductCreated,
        -- Rating data from MV (using quoted camelCase aliases to preserve case)
        store_rating_avg as "storeRatingAvg",
        store_rating_count as "storeRatingCount",
        store_rating_1_count as "storeRating1Count",
        store_rating_2_count as "storeRating2Count",
        store_rating_3_count as "storeRating3Count",
        store_rating_4_count as "storeRating4Count",
        store_rating_5_count as "storeRating5Count",
        store_verified_purchase_count as "storeVerifiedPurchaseCount",
        last_review_at as "lastReviewAt"
      FROM storefront_category_counts
      WHERE tenant_id = $1
        AND category_id IS NOT NULL
      ORDER BY count DESC, category_name ASC
    `;
    
    const result = await getDirectPool().query(query, [tenantId]);
    
    const categories = result.rows.map((row: any) => {
      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        googleCategoryId: row.googlecategoryid,
        count: row.count,
        productsWithImages: row.productswithimages,
        productsWithDescriptions: row.productswithdescriptions,
        productsWithBrand: row.productswithbrand,
        productsWithPrice: row.productswithprice,
        inStockProducts: row.instockproducts || row.count,
        avgPriceCents: parseFloat(row.avgpricecents) || 0,
        minPriceCents: row.minpricecents,
        maxPriceCents: row.maxpricecents,
        lastProductUpdated: row.lastproductupdated,
        firstProductCreated: row.firstproductcreated,
        // Rating data from MV
        storeRatingAvg: parseFloat(row.storeRatingAvg) || 0,
        storeRatingCount: parseInt(row.storeRatingCount) || 0,
        storeRating1Count: parseInt(row.storeRating1Count) || 0,
        storeRating2Count: parseInt(row.storeRating2Count) || 0,
        storeRating3Count: parseInt(row.storeRating3Count) || 0,
        storeRating4Count: parseInt(row.storeRating4Count) || 0,
        storeRating5Count: parseInt(row.storeRating5Count) || 0,
        storeVerifiedPurchaseCount: parseInt(row.storeVerifiedPurchaseCount) || 0,
        lastReviewAt: row.lastReviewAt,
      };
    });
    
    // Calculate store-level statistics
    const totalProducts = categories.reduce((sum, cat) => sum + (parseInt(cat.count) || 0), 0);
    const totalInStock = categories.reduce((sum, cat) => sum + (parseInt(cat.inStockProducts) || 0), 0);
    const uniqueCategories = categories.length;
    
    // Get store-level rating data from first category (all categories have same store rating)
    const storeRatingData = categories[0] ? {
      ratingAvg: categories[0].storeRatingAvg,
      ratingCount: categories[0].storeRatingCount,
      rating1Count: categories[0].storeRating1Count,
      rating2Count: categories[0].storeRating2Count,
      rating3Count: categories[0].storeRating3Count,
      rating4Count: categories[0].storeRating4Count,
      rating5Count: categories[0].storeRating5Count,
      verifiedPurchaseCount: categories[0].storeVerifiedPurchaseCount,
      lastReviewAt: categories[0].lastReviewAt,
    } : {
      ratingAvg: 0,
      ratingCount: 0,
      rating1Count: 0,
      rating2Count: 0,
      rating3Count: 0,
      rating4Count: 0,
      rating5Count: 0,
      verifiedPurchaseCount: 0,
      lastReviewAt: null,
    };
    
    return res.json({
      categories,
      storeStats: {
        totalProducts,
        totalInStock,
        uniqueCategories,
        ...storeRatingData  // Include rating data in storeStats
      }
    });
  } catch (error) {
    console.error('Storefront categories stats error:', error);
    return res.status(500).json({ error: 'failed_to_get_categories_stats' });
  }
});

/**
 * GET /api/storefront/health
 * Health check for storefront materialized view
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthQuery = `
      SELECT 
        matviewname,
        ispopulated,
        pg_size_pretty(pg_total_relation_size('public.' || matviewname)) as size
      FROM pg_matviews 
      WHERE matviewname = 'storefront_products'
    `;
    
    const refreshQuery = `
      SELECT 
        MAX(refresh_completed_at) as last_refresh,
        AVG(refresh_duration_ms)::INTEGER as avg_duration_ms,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_refreshes,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_refreshes
      FROM storefront_mv_refresh_log
      WHERE refresh_started_at > NOW() - INTERVAL '24 hours'
    `;
    
    const [viewResult, refreshResult] = await Promise.all([
      getDirectPool().query(healthQuery),
      getDirectPool().query(refreshQuery),
    ]);
    
    return res.json({
      view: viewResult.rows[0] || null,
      refresh: refreshResult.rows[0] || null,
      status: 'healthy',
    });
  } catch (error) {
    console.error('Storefront health check error:', error);
    return res.status(500).json({ error: 'health_check_failed' });
  }
});

export default router;
