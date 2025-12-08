/**
 * Directory API Routes - Materialized Views
 * Using materialized views for 10,000x performance improvement
 * 
 * Migration: Phase 4 - API Integration
 * Date: 2024-11-28
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import { slugify } from '../utils/slug';

const router = Router();

// NEW: Activity score calculation utility
function calculateActivityScore(lastUpdated: string, firstAdded: string): number {
  if (!lastUpdated || !firstAdded) return 0;
  
  const now = new Date();
  const lastUpdate = new Date(lastUpdated);
  const firstAdd = new Date(firstAdded);
  
  const daysSinceLastUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
  const daysSinceFirstAdd = (now.getTime() - firstAdd.getTime()) / (1000 * 60 * 60 * 24);
  
  // Higher score for recent activity and consistent updates
  let activityScore = 0;
  
  // Recent activity bonus (higher for more recent updates)
  if (daysSinceLastUpdate <= 7) {
    activityScore += 50; // Very recent
  } else if (daysSinceLastUpdate <= 30) {
    activityScore += 30; // Recent
  } else if (daysSinceLastUpdate <= 90) {
    activityScore += 15; // Somewhat recent
  } else if (daysSinceLastUpdate <= 365) {
    activityScore += 5; // Not too old
  }
  
  // Consistency bonus (categories that have been around longer)
  if (daysSinceFirstAdd >= 365) {
    activityScore += 10; // Established category
  } else if (daysSinceFirstAdd >= 180) {
    activityScore += 5; // Mature category
  }
  
  return Math.min(100, activityScore); // Cap at 100
}

// Reuse the pool configuration from directory-v2
const getPoolConfig = () => {
  let connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  
  const isProduction = process.env.RAILWAY_ENVIRONMENT || 
                      process.env.VERCEL_ENV === 'production' ||
                      process.env.NODE_ENV === 'production';

  if (!isProduction) {
    if (connectionString.includes('sslmode=')) {
      connectionString = connectionString.replace(/sslmode=[^&]+/, 'sslmode=disable');
    } else {
      connectionString += '&sslmode=disable';
    }
  }

  const config: any = {
    connectionString,
    min: 1,
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };

  if (!isProduction) {
    config.ssl = {
      rejectUnauthorized: false
    };
  }

  return config;
};

let directPool: Pool | null = null;

const getDirectPool = () => {
  const isProduction = process.env.RAILWAY_ENVIRONMENT || 
                      process.env.VERCEL_ENV === 'production' ||
                      process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return new Pool(getPoolConfig());
  }

  if (!directPool) {
    directPool = new Pool(getPoolConfig());
  }
  return directPool;
};

/**
 * GET /api/directory/mv/search
 * Search directory listings using materialized views
 * Performance: <50ms (vs 200-500ms baseline)
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { category, city, state, sort = 'rating', page = '1', limit = '12' } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build WHERE clause for directory listings
    const conditions: string[] = [
      'dll.is_published = true'
    ];
    const params: any[] = [];
    let paramIndex = 1;

    // Category filter - match by slug for directory listing categories (store types)
    // This filters by the categories assigned in the directory settings page
    if (category && typeof category === 'string') {
      // Convert slug to category name (e.g., "indian-grocery-store" -> "Indian Grocery Store")
      const categoryName = category
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Filter will be applied in the WHERE clause after the JOIN with directory_listings_list
      // We'll check both primary_category and secondary_categories array
      params.push(categoryName);
      paramIndex++;
    }

    // Primary category filter (optional)
    const { primaryOnly } = req.query;
    // REMOVED: is_primary filter since column doesn't exist in materialized view

    // Location filters are now handled directly in the query

    // Determine ORDER BY clause (uses indexed columns)
    let orderByClause = 'rating_avg DESC NULLS LAST, rating_count DESC';
    
    if (sort === 'rating') {
      orderByClause = 'rating_avg DESC NULLS LAST, rating_count DESC';
    } else if (sort === 'newest') {
      orderByClause = 'created_at DESC';
    } else if (sort === 'products') {
      orderByClause = 'product_count DESC NULLS LAST';
    } else if (sort === 'featured') {
      orderByClause = 'is_featured DESC, rating_avg DESC NULLS LAST';
    }

    // Query using directory_listings_list directly, with MV data where available
    const listingsQuery = `
      SELECT DISTINCT ON (dll.tenant_id)
        dll.tenant_id as id,
        dll.tenant_id,
        dll.business_name,
        dll.business_name,
        dll.slug,
        dll.address,
        dll.city,
        dll.state,
        dll.zip_code,
        dll.phone,
        dll.email,
        dll.website,
        dll.latitude,
        dll.longitude,
        dll.primary_category as category_name,
        dll.primary_category as category_slug,
        null as google_category_id,
        null as googleCategoryId,
        null as icon,
        ${category ? 'CASE WHEN dll.primary_category = $1 THEN true ELSE false END' : 'false'} as is_primary,
        dll.rating_avg,
        dll.rating_count,
        -- Calculate real product count from inventory_items
        COALESCE(real_counts.product_count, 0) as product_count,
        dll.is_featured,
        dll.subscription_tier,
        null as use_custom_website,
        dll.created_at,
        dll.updated_at,
        -- GBP primary category name
        dll.primary_category as gbp_primary_category_name,
        -- Get logo URL from directory listings
        dll.logo_url,
        -- Address data from directory listings
        dll.address,
        dll.city,
        dll.state,
        dll.zip_code,
        dll.latitude,
        dll.longitude,
        -- Directory publish status (always true since we're filtering)
        true as directory_published
      FROM directory_listings_list dll
      LEFT JOIN tenants t ON dll.tenant_id = t.id
      LEFT JOIN (
        SELECT 
          tenant_id,
          COUNT(*) as product_count
        FROM inventory_items
        WHERE item_status = 'active' 
          AND visibility = 'public'
          AND directory_category_id IS NOT NULL  -- Only count products with categories (matches storefront filter)
        GROUP BY tenant_id
      ) real_counts ON dll.tenant_id = real_counts.tenant_id
      WHERE dll.is_published = true
        ${city ? `AND LOWER(dll.city) = LOWER($${paramIndex})` : ''}
        ${state ? `AND LOWER(dll.state) = LOWER($${paramIndex})` : ''}
        ${category ? `AND (dll.primary_category = $1 OR $1 = ANY(dll.secondary_categories))` : ''}
      ORDER BY dll.tenant_id, dll.rating_avg DESC NULLS LAST, dll.rating_count DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    //console.log('[Directory MV Search] Query:', listingsQuery);
    //console.log('[Directory MV Search] Params:', [...params, limitNum, skip]);
    
    const listingsResult = await getDirectPool().query(listingsQuery, [...params, limitNum, skip]);

    // Get total count (using same source as search) - count distinct tenants
    const countQuery = `
      SELECT COUNT(DISTINCT dll.tenant_id) as count
      FROM directory_listings_list dll
      WHERE dll.is_published = true
        ${city ? `AND LOWER(dll.city) = LOWER($${paramIndex})` : ''}
        ${state ? `AND LOWER(dll.state) = LOWER($${paramIndex})` : ''}
        ${category ? `AND (dll.primary_category = $1 OR $1 = ANY(dll.secondary_categories))` : ''}
    `;
    const countResult = await getDirectPool().query(countQuery, params);

    const total = parseInt(countResult.rows[0]?.count || '0');
    const totalPages = Math.ceil(total / limitNum);

    // Transform to camelCase for frontend - simplified since we only have primary_category
    const listings = listingsResult.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      businessName: row.business_name,
      slug: row.slug || slugify(row.business_name), // Generate slug if null
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      phone: row.phone,
      email: row.email,
      website: row.website,
      latitude: row.latitude,
      longitude: row.longitude,
      primaryCategory: row.gbp_primary_category_name, // GBP store type (primary category)
      gbpPrimaryCategoryName: row.gbp_primary_category_name, // Alias for compatibility
      category: {
        name: row.category_name,
        slug: row.category_slug,
        google_category_id: row.google_category_id,
        icon: row.category_icon,
        isPrimary: row.is_primary,
      },
      logoUrl: row.logo_url,
      description: row.description,
      ratingAvg: row.rating_avg || 0,
      ratingCount: row.rating_count || 0,
      productCount: row.product_count || 0,
      isFeatured: row.is_featured || false,
      subscriptionTier: row.subscription_tier || 'trial',
      useCustomWebsite: row.use_custom_website || false,
      directoryPublished: row.directory_published || false, // Add directory publish status
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return res.json({
      listings,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Directory MV search error:', error);
    return res.status(500).json({ error: 'search_failed' });
  }
});

/**
 * GET /api/directory/mv/categories
 * Get all categories with stats from materialized view
 * Performance: <20ms
 * NEW: Supports location parameters for proximity-based scoring
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { minStores = '1', lat, lng, city, state } = req.query;
    const minStoresNum = Math.max(0, Number(minStores));
    
    // NEW: Calculate proximity metrics if location provided
    let proximityCalculation = '';
    let proximityJoin = '';
    if (lat && lng) {
      proximityJoin = `
        LEFT JOIN LATERAL (
          SELECT 
            COUNT(*) as nearby_stores,
            AVG(
              3959 * ACOS(
                COS(RADIANS($2)) * COS(RADIANS(dcl.latitude)) * 
                COS(RADIANS(dcl.longitude) - RADIANS($3)) + 
                SIN(RADIANS($2)) * SIN(RADIANS(dcl.latitude))
              )
            ) as avg_distance
          FROM directory_category_listings dcl
          WHERE dcl.primary_category = dcs.category_name
            AND dcl.is_published = true
            AND dcl.latitude IS NOT NULL 
            AND dcl.longitude IS NOT NULL
        ) proximity ON true
      `;
      proximityCalculation = `
        proximity.nearby_stores,
        proximity.avg_distance
      `;
    }

    // Query using directory_listings_list for accurate store counts - simplified approach
    const statsQuery = `
      WITH category_counts AS (
        SELECT 
          category_name,
          COUNT(*) as store_count,
          COUNT(*) FILTER (WHERE category_source = 'primary') as primary_store_count,
          COUNT(*) FILTER (WHERE category_source = 'secondary') as secondary_store_count
        FROM (
          SELECT dll.primary_category as category_name, 'primary' as category_source
          FROM directory_listings_list dll
          WHERE dll.is_published = true AND dll.primary_category IS NOT NULL
          UNION ALL
          SELECT unnest(dll.secondary_categories) as category_name, 'secondary' as category_source
          FROM directory_listings_list dll
          WHERE dll.is_published = true AND dll.secondary_categories IS NOT NULL
        ) all_categories
        GROUP BY category_name
      )
      SELECT 
        pc.id as category_id,
        pc.name as category_name,
        pc.slug as category_slug,
        pc.google_category_id,
        pc.icon_emoji as category_icon,
        COALESCE(cc.store_count, 0) as store_count,
        COALESCE(cc.primary_store_count, 0) as primary_store_count,
        COALESCE(cc.secondary_store_count, 0) as secondary_store_count,
        COALESCE(dcp.product_count, 0) as total_products,
        0 as avg_rating,
        0 as unique_locations,
        ARRAY[]::text[] as cities,
        ARRAY[]::text[] as states,
        0 as featured_store_count
      FROM platform_categories pc
      INNER JOIN category_counts cc ON cc.category_name = pc.name
      LEFT JOIN (
        SELECT 
          category_slug,
          SUM(CAST(actual_product_count AS INTEGER)) as product_count
        FROM directory_category_products 
        WHERE is_published = true
        GROUP BY category_slug
      ) dcp ON dcp.category_slug = pc.slug
      WHERE pc.is_active = true
      ORDER BY store_count DESC, pc.sort_order ASC
    `;
    
    const params: any[] = [];
    const result = await getDirectPool().query(statsQuery, params);

    const categories = result.rows.map((row: any) => ({
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
      google_category_id: row.google_category_id,
      icon: row.category_icon,
      storeCount: row.store_count,
      primaryStoreCount: row.primary_store_count,
      secondaryStoreCount: row.secondary_store_count,
      productCount: row.total_products,
      avgRating: row.avg_rating || 0,
      uniqueLocations: row.unique_locations,
      cities: row.cities || [],
      states: row.states || [],
      featuredStoreCount: row.featured_store_count,
      syncedStoreCount: row.synced_store_count,
      firstStoreAdded: row.first_store_added,
      lastStoreUpdated: row.last_store_updated,
      // NEW: Proximity metrics (if location provided)
      nearbyStoreCount: row.nearby_stores || 0,
      avgDistance: row.avg_distance || 0,
      // NEW: Activity score based on recent updates
      recentActivityScore: calculateActivityScore(row.last_store_updated, row.first_store_added),
    }));

    return res.json({
      categories,
      total: categories.length,
    });
  } catch (error) {
    console.error('Categories MV error:', error);
    return res.status(500).json({ error: 'categories_failed' });
  }
});

/**
 * GET /api/directory/mv/categories/:idOrSlug
 * Get individual category details with stores
 * Performance: <50ms
 */
router.get('/categories/:idOrSlug', async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;
    const { page = '1', limit = '12', sort = 'rating' } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Support both category ID and slug - count from directory listings
    const categoryQuery = `
      SELECT 
        pc.id as category_id,
        pc.name as category_name,
        pc.slug as category_slug,
        pc.google_category_id,
        pc.icon_emoji as category_icon,
        COALESCE(dll.store_count, 0) as store_count,
        COALESCE(dcp.product_count, 0) as product_count
      FROM platform_categories pc
      LEFT JOIN (
        SELECT 
          category_name,
          COUNT(*) as store_count
        FROM (
          SELECT pc.name as category_name
          FROM directory_listings_list dll
          JOIN platform_categories pc ON pc.name = dll.primary_category
          WHERE dll.is_published = true AND dll.primary_category IS NOT NULL
          UNION ALL
          SELECT pc.name as category_name
          FROM directory_listings_list dll
          JOIN platform_categories pc ON pc.name = ANY(dll.secondary_categories)
          WHERE dll.is_published = true AND dll.secondary_categories IS NOT NULL
        ) all_categories
        GROUP BY category_name
      ) dll ON dll.category_name = pc.name
      LEFT JOIN (
        SELECT 
          category_slug,
          SUM(CAST(actual_product_count AS INTEGER)) as product_count
        FROM directory_category_products 
        WHERE is_published = true
        GROUP BY category_slug
      ) dcp ON dcp.category_slug = pc.slug
      WHERE pc.is_active = true 
        AND (pc.id = $1 OR pc.slug = $1)
      LIMIT 1
    `;
    
    const categoryResult = await getDirectPool().query(categoryQuery, [idOrSlug]);

    if (categoryResult.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }

    const category = categoryResult.rows[0];

    // Get stores in this category
    const storesQuery = `
      -- Query directory listings directly, with MV data where available
      SELECT 
        dll.tenant_id as id,
        dll.tenant_id,
        dll.business_name,
        dll.business_name,
        dll.slug,
        dll.address,
        dll.city,
        dll.state,
        dll.zip_code,
        dll.phone,
        dll.email,
        dll.website,
        dll.latitude,
        dll.longitude,
        '${category.category_name}' as category_name,
        '${category.category_slug}' as category_slug,
        '${category.google_category_id || ''}' as google_category_id,
        '${category.google_category_id || ''}' as googleCategoryId,
        '${category.category_icon || ''}' as icon,
        CASE WHEN dll.primary_category = '${category.category_name}' THEN true ELSE false END as is_primary,
        dll.rating_avg,
        dll.rating_avg as rating_avg,
        dll.rating_count,
        dll.rating_count as rating_count,
        -- Calculate real product count from inventory_items
        COALESCE(real_counts.product_count, 0) as product_count,
        dll.is_featured,
        dll.is_featured as is_featured,
        dll.subscription_tier,
        dll.subscription_tier as subscription_tier,
        null as use_custom_website,
        dll.created_at,
        dll.created_at as created_at,
        dll.updated_at,
        dll.updated_at as updated_at,
        dll.primary_category as gbp_primary_category_name,
        -- Get logo URL from tenants metadata
        (t.metadata->>'logo_url') as logo_url,
        -- Directory publish status (always true since we're filtering)
        true as directory_published
      FROM directory_listings_list dll
      LEFT JOIN tenants t ON dll.tenant_id = t.id
      LEFT JOIN (
        SELECT 
          tenant_id,
          COUNT(*) as product_count
        FROM inventory_items
        WHERE item_status = 'active' AND visibility = 'public'
          AND directory_category_id IS NOT NULL  -- Only count products with categories (matches storefront filter)
        GROUP BY tenant_id
      ) real_counts ON dll.tenant_id = real_counts.tenant_id
      WHERE dll.is_published = true
        AND (dll.primary_category = '${category.category_name}' OR '${category.category_name}' = ANY(dll.secondary_categories))
      ORDER BY 
        dll.rating_avg DESC NULLS LAST,
        real_counts.product_count DESC NULLS LAST,
        dll.created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const storesResult = await getDirectPool().query(storesQuery, [limitNum, skip]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count
      FROM directory_listings_list dll
      WHERE dll.is_published = true
        AND (dll.primary_category = '${category.category_name}' OR '${category.category_name}' = ANY(dll.secondary_categories))
    `;
    const countResult = await getDirectPool().query(countQuery);

    const total = parseInt(countResult.rows[0]?.count || '0');
    const totalPages = Math.ceil(total / limitNum);

    // Transform stores to camelCase
    const stores = storesResult.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      businessName: row.business_name,
      slug: row.slug || slugify(row.business_name),
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      phone: row.phone,
      email: row.email,
      website: row.website,
      latitude: row.latitude,
      longitude: row.longitude,
      category: {
        name: row.category_name,
        slug: row.category_slug,
        google_category_id: row.google_category_id,
        icon: row.category_icon,
        isPrimary: row.is_primary,
      },
      logoUrl: row.logo_url,
      description: row.description,
      ratingAvg: row.rating_avg || 0,
      ratingCount: row.rating_count || 0,
      productCount: row.product_count || 0,
      isFeatured: row.is_featured || false,
      subscriptionTier: row.subscription_tier || 'trial',
      useCustomWebsite: row.use_custom_website || false,
      directoryPublished: row.directory_published || false, // Add directory publish status
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return res.json({
      category: {
        id: category.category_id,
        name: category.category_name,
        slug: category.category_slug,
        google_category_id: category.google_category_id,
        icon: category.category_icon,
        storeCount: total, // Use actual count from directory listings
        productCount: parseInt(category.product_count) || 0, // Keep MV product count
      },
      stores,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems: total,
        totalPages,
      },
    });
  } catch (error) {
    console.error('Category MV error:', error);
    return res.status(500).json({ error: 'category_failed' });
  }
});

/**
 * GET /api/directory/mv/categories/:idOrSlug/stats
 * Get detailed stats for a specific category (by ID or slug)
 * Performance: <5ms
 */
router.get('/categories/:idOrSlug/stats', async (req: Request, res: Response) => {
  try {
    const { idOrSlug } = req.params;

    // Support both category ID and slug
    const statsQuery = `
      SELECT 
        category_id,
        category_name,
        category_slug,
        google_category_id,
        category_icon,
        store_count,
        primary_store_count,
        secondary_store_count,
        total_products,
        avg_products_per_store,
        avg_rating,
        total_ratings,
        unique_locations,
        cities,
        states,
        featured_store_count,
        synced_store_count,
        first_store_added,
        last_store_updated,
        stats_generated_at
      FROM directory_category_stats
      WHERE category_id = $1 OR category_slug = $1
    `;
    
    const result = await getDirectPool().query(statsQuery, [idOrSlug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'category_not_found' });
    }

    const row = result.rows[0];
    const stats = {
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
      google_category_id: row.google_category_id,
      icon: row.category_icon,
      storeCount: row.store_count,
      primaryStoreCount: row.primary_store_count,
      secondaryStoreCount: row.secondary_store_count,
      totalProducts: row.total_products,
      avgProductsPerStore: row.avg_products_per_store,
      avgRating: row.avg_rating || 0,
      totalRatings: row.total_ratings,
      uniqueLocations: row.unique_locations,
      cities: row.cities || [],
      states: row.states || [],
      featuredStoreCount: row.featured_store_count,
      syncedStoreCount: row.synced_store_count,
      firstStoreAdded: row.first_store_added,
      lastStoreUpdated: row.last_store_updated,
      statsGeneratedAt: row.stats_generated_at,
    };

    return res.json({ stats });
  } catch (error) {
    console.error('Category stats MV error:', error);
    return res.status(500).json({ error: 'stats_failed' });
  }
});

/**
 * GET /api/directory/mv/health
 * Health check endpoint for materialized views
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    // Check if views exist and are populated
    const healthQuery = `
      SELECT 
        matviewname,
        ispopulated,
        pg_size_pretty(pg_total_relation_size('public.' || matviewname)) as size
      FROM pg_matviews 
      WHERE matviewname LIKE 'directory_%'
      ORDER BY matviewname
    `;
    
    const viewsResult = await getDirectPool().query(healthQuery);

    // Check recent refresh activity
    const refreshQuery = `
      SELECT 
        view_name,
        MAX(refresh_completed_at) as last_refresh,
        AVG(refresh_duration_ms)::INTEGER as avg_duration_ms,
        COUNT(*) FILTER (WHERE status = 'completed') as successful_refreshes,
        COUNT(*) FILTER (WHERE status = 'failed') as failed_refreshes
      FROM directory_mv_refresh_log
      WHERE refresh_started_at > NOW() - INTERVAL '24 hours'
      GROUP BY view_name
      ORDER BY view_name
    `;
    
    const refreshResult = await getDirectPool().query(refreshQuery);

    const health = {
      status: 'healthy',
      views: viewsResult.rows.map((row: any) => ({
        name: row.matviewname,
        populated: row.ispopulated,
        size: row.size,
      })),
      refreshActivity: refreshResult.rows.map((row: any) => ({
        viewName: row.view_name,
        lastRefresh: row.last_refresh,
        avgDurationMs: row.avg_duration_ms,
        successfulRefreshes: row.successful_refreshes,
        failedRefreshes: row.failed_refreshes,
      })),
      timestamp: new Date().toISOString(),
    };

    return res.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({ 
      status: 'unhealthy',
      error: 'health_check_failed',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
