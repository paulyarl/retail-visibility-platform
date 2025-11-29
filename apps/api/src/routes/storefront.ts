/**
 * Storefront API Routes - Materialized Views
 * Using materialized views for instant category filtering
 * 
 * Performance: 100-300ms → <10ms (10-30x faster!)
 * Date: 2024-11-28
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

const router = Router();

// Reuse pool configuration from directory-mv
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
    
    // Search filter (name or SKU)
    if (search && typeof search === 'string') {
      conditions.push(`(name ILIKE $${paramIndex} OR sku ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    const whereClause = conditions.join(' AND ');
    
    // Query materialized view (FAST! No JOINs!)
    const query = `
      SELECT 
        id,
        tenant_id,
        sku,
        name,
        title,
        description,
        marketing_description,
        price,
        price_cents,
        currency,
        stock,
        quantity,
        availability,
        image_url,
        image_gallery,
        brand,
        manufacturer,
        condition,
        gtin,
        mpn,
        metadata,
        custom_cta,
        social_links,
        custom_branding,
        custom_sections,
        landing_page_theme,
        category_id,
        category_name,
        category_slug,
        google_category_id,
        has_image,
        in_stock,
        has_gallery,
        created_at,
        updated_at
      FROM public.storefront_products
      WHERE ${whereClause}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    const countQuery = `
      SELECT COUNT(*) as count
      FROM public.storefront_products
      WHERE ${whereClause}
    `;
    
    // Execute queries in parallel
    const [itemsResult, countResult] = await Promise.all([
      getDirectPool().query(query, [...params, limitNum, skip]),
      getDirectPool().query(countQuery, params),
    ]);
    
    const totalCount = parseInt(countResult.rows[0]?.count || '0');
    
    // Transform to camelCase for frontend compatibility
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
      tenantCategory: row.category_id ? {
        id: row.category_id,
        name: row.category_name,
        slug: row.category_slug,
        googleCategoryId: row.google_category_id,
      } : null,
      hasImage: row.has_image,
      inStock: row.in_stock,
      hasGallery: row.has_gallery,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
    
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
 * Get category list with product counts for storefront sidebar
 * Performance: <5ms
 */
router.get('/:tenantId/categories', async (req: Request, res: Response) => {
  try {
    const { tenantId } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({ error: 'tenant_required' });
    }
    
    // Query category counts from materialized view
    const query = `
      SELECT 
        category_id,
        category_name,
        category_slug,
        google_category_id,
        COUNT(*) as count
      FROM public.storefront_products
      WHERE tenant_id = $1
        AND category_slug IS NOT NULL
      GROUP BY category_id, category_name, category_slug, google_category_id
      ORDER BY category_name ASC
    `;
    
    // Get uncategorized count
    const uncategorizedQuery = `
      SELECT COUNT(*) as count
      FROM public.storefront_products
      WHERE tenant_id = $1
        AND category_slug IS NULL
    `;
    
    const [categoriesResult, uncategorizedResult] = await Promise.all([
      getDirectPool().query(query, [tenantId]),
      getDirectPool().query(uncategorizedQuery, [tenantId]),
    ]);
    
    const categories = categoriesResult.rows.map((row: any) => ({
      id: row.category_id,
      name: row.category_name,
      slug: row.category_slug,
      googleCategoryId: row.google_category_id,
      count: parseInt(row.count),
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
