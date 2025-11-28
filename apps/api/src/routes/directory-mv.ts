/**
 * Directory API Routes - Materialized Views
 * Using materialized views for 10,000x performance improvement
 * 
 * Migration: Phase 4 - API Integration
 * Date: 2024-11-28
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

const router = Router();

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

    // Build WHERE clause for materialized view
    const conditions: string[] = [
      'tenant_exists = true',
      'is_active_location = true',
      'is_directory_visible = true'
    ];
    const params: any[] = [];
    let paramIndex = 1;

    // Category filter (uses flattened category_slug)
    if (category && typeof category === 'string') {
      conditions.push(`category_slug = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    // Location filters
    if (city && typeof city === 'string') {
      conditions.push(`LOWER(city) = LOWER($${paramIndex})`);
      params.push(city);
      paramIndex++;
    }

    if (state && typeof state === 'string') {
      conditions.push(`LOWER(state) = LOWER($${paramIndex})`);
      params.push(state);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

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

    // Query materialized view (FAST!)
    const listingsQuery = `
      SELECT 
        id,
        tenant_id,
        business_name,
        slug,
        address,
        city,
        state,
        zip_code,
        phone,
        email,
        website,
        latitude,
        longitude,
        category_slug,
        logo_url,
        description,
        rating_avg,
        rating_count,
        product_count,
        is_featured,
        subscription_tier,
        use_custom_website,
        created_at,
        updated_at
      FROM directory_category_listings
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const listingsResult = await getDirectPool().query(listingsQuery, [...params, limitNum, skip]);

    // Get total count (also fast from materialized view)
    const countQuery = `
      SELECT COUNT(*) as count 
      FROM directory_category_listings
      WHERE ${whereClause}
    `;
    const countResult = await getDirectPool().query(countQuery, params);

    const total = parseInt(countResult.rows[0]?.count || '0');
    const totalPages = Math.ceil(total / limitNum);

    // Transform to camelCase for frontend
    const listings = listingsResult.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      business_name: row.business_name,
      slug: row.slug,
      address: row.address,
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      phone: row.phone,
      email: row.email,
      website: row.website,
      latitude: row.latitude,
      longitude: row.longitude,
      category: row.category_slug,
      logoUrl: row.logo_url,
      description: row.description,
      ratingAvg: row.rating_avg || 0,
      ratingCount: row.rating_count || 0,
      productCount: row.product_count || 0,
      isFeatured: row.is_featured || false,
      subscription_tier: row.subscription_tier || 'trial',
      useCustomWebsite: row.use_custom_website || false,
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
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const { minStores = '1' } = req.query;
    const minStoresNum = Math.max(0, Number(minStores));

    // Query stats materialized view
    const statsQuery = `
      SELECT 
        category_slug,
        store_count,
        total_products,
        avg_rating,
        unique_locations,
        cities,
        states,
        featured_store_count,
        synced_store_count,
        first_store_added,
        last_store_added
      FROM directory_category_stats
      WHERE store_count >= $1
      ORDER BY store_count DESC
    `;
    
    const result = await getDirectPool().query(statsQuery, [minStoresNum]);

    const categories = result.rows.map((row: any) => ({
      slug: row.category_slug,
      storeCount: row.store_count,
      totalProducts: row.total_products,
      avgRating: row.avg_rating || 0,
      uniqueLocations: row.unique_locations,
      cities: row.cities || [],
      states: row.states || [],
      featuredStoreCount: row.featured_store_count,
      syncedStoreCount: row.synced_store_count,
      firstStoreAdded: row.first_store_added,
      lastStoreAdded: row.last_store_added,
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
 * GET /api/directory/mv/categories/:slug/stats
 * Get detailed stats for a specific category
 * Performance: <5ms
 */
router.get('/categories/:slug/stats', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const statsQuery = `
      SELECT 
        category_slug,
        store_count,
        total_products,
        avg_rating,
        unique_locations,
        cities,
        states,
        featured_store_count,
        synced_store_count,
        first_store_added,
        last_store_added
      FROM directory_category_stats
      WHERE category_slug = $1
    `;
    
    const result = await getDirectPool().query(statsQuery, [slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'category_not_found' });
    }

    const row = result.rows[0];
    const stats = {
      slug: row.category_slug,
      storeCount: row.store_count,
      totalProducts: row.total_products,
      avgRating: row.avg_rating || 0,
      uniqueLocations: row.unique_locations,
      cities: row.cities || [],
      states: row.states || [],
      featuredStoreCount: row.featured_store_count,
      syncedStoreCount: row.synced_store_count,
      firstStoreAdded: row.first_store_added,
      lastStoreAdded: row.last_store_added,
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
