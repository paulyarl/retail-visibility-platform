/**
 * Directory API Routes - V2
 * Using direct database queries for RLS compatibility
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

const router = Router();

// Create a direct database connection pool that bypasses Prisma's retry logic
// In development, we need to handle self-signed certificates
const getPoolConfig = () => {
  // Modify connection string to use prefer instead of require for local development
  let connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  
  // Always disable SSL certificate verification for local development
  // Check for production indicators (Railway, Vercel, etc.)
  const isProduction = process.env.RAILWAY_ENVIRONMENT || 
                      process.env.VERCEL_ENV === 'production' ||
                      process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Disable SSL for local development
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

// Create pool on-demand to ensure SSL config is applied
let directPool: Pool | null = null;

const getDirectPool = () => {
  // Always create a new pool in development to ensure SSL config is applied
  const isProduction = process.env.RAILWAY_ENVIRONMENT || 
                      process.env.VERCEL_ENV === 'production' ||
                      process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // console.log('[Directory Pool] Creating fresh pool for development');
    return new Pool(getPoolConfig());
  }

  if (!directPool) {
    directPool = new Pool(getPoolConfig());
  }
  return directPool;
};

/**
 * GET /api/directory/stores
 * Get all directory listings (using materialized view for performance)
 */
router.get('/stores', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '12', sort = 'activity' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Get all stores using directory_listings_list materialized view
    const query = `
      SELECT * FROM directory_listings_list
       WHERE is_published = true
         AND (business_hours IS NULL OR business_hours::text != 'null')
       ORDER BY 
         CASE 
           WHEN $3 = 'activity' THEN activity_score
           WHEN $3 = 'name' THEN business_name
           WHEN $3 = 'city' THEN city
           ELSE activity_score
         END DESC,
         business_name ASC
       LIMIT $1 OFFSET $2
    `;
    
    const result = await getDirectPool().query(query, [limitNum, offset, sort]);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total FROM directory_listings_list
       WHERE is_published = true
         AND (business_hours IS NULL OR business_hours::text != 'null')
    `;
    const countResult = await getDirectPool().query(countQuery);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      listings: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      },
      performance: {
        source: 'directory_listings_list (materialized view)',
        optimized: true
      }
    });

  } catch (error) {
    console.error('[GET /api/directory/stores] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch directory stores'
    });
  }
});

/**
 * GET /api/directory/search
 * Search directory listings with filters
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, category, city, state, sort = 'relevance', page = '1', limit = '12' } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build WHERE clause with dl. prefix for joined query
    const conditions: string[] = ['dl.is_published = true'];
    const params: any[] = [];
    let paramIndex = 1;

    if (q && typeof q === 'string') {
      conditions.push(`(LOWER(dl.business_name) LIKE LOWER($${paramIndex}) OR LOWER(dl.city) LIKE LOWER($${paramIndex}) OR LOWER(dl.primary_category) LIKE LOWER($${paramIndex}))`);
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (category && typeof category === 'string') {
      conditions.push(`(LOWER(dl.primary_category) LIKE LOWER($${paramIndex}) OR LOWER(dl.secondary_categories::text) LIKE LOWER($${paramIndex}))`);
      params.push(`%${category}%`);
      paramIndex++;
    }

    if (city && typeof city === 'string') {
      conditions.push(`LOWER(dl.city) = LOWER($${paramIndex})`);
      params.push(city);
      paramIndex++;
    }

    if (state && typeof state === 'string') {
      conditions.push(`LOWER(dl.state) = LOWER($${paramIndex})`);
      params.push(state);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Determine ORDER BY clause based on sort parameter
    let orderByClause = 'created_at DESC'; // default
    
    if (sort === 'rating') {
      orderByClause = 'rating_avg DESC NULLS LAST, rating_count DESC, created_at DESC';
    } else if (sort === 'newest') {
      orderByClause = 'created_at DESC';
    } else if (sort === 'products') {
      orderByClause = 'product_count DESC NULLS LAST, created_at DESC';
    } else if (sort === 'relevance' && q) {
      // For search queries, use relevance scoring
      orderByClause = 'rating_avg DESC NULLS LAST, product_count DESC NULLS LAST, created_at DESC';
    }

    // Get listings - use direct database query with GBP category from tenants.metadata
    // console.log('[Directory Search] Query:', whereClause, params);
    const listingsQuery = `
      SELECT 
        dl.*,
        t.metadata->'gbp_categories'->'primary'->>'name' as gbp_primary_category_name
      FROM directory_listings_list dl
      LEFT JOIN tenants t ON t.id = dl.tenant_id
      WHERE ${whereClause}
        AND (dl.business_hours IS NULL OR dl.business_hours::text != 'null')
        AND dl.tenant_id IN (SELECT id FROM tenants WHERE id IS NOT NULL)
      ORDER BY ${orderByClause.replace('is_featured', 'dl.is_featured').replace('created_at', 'dl.created_at')}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    // console.log('[Directory Search] Full SQL:', listingsQuery);
    const listingsResult = await getDirectPool().query(listingsQuery, [...params, limitNum, skip]);
    // console.log('[Directory Search] Query result rows:', listingsResult.rows.length);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count FROM directory_listings_list dl
      WHERE ${whereClause}
        AND (dl.business_hours IS NULL OR dl.business_hours::text != 'null')
        AND dl.tenant_id IN (SELECT id FROM tenants WHERE id IS NOT NULL)
    `;
    const countResult = await getDirectPool().query(countQuery, params);

    const total = parseInt(countResult.rows[0]?.count || '0');
    const totalPages = Math.ceil(total / limitNum);

    // Transform snake_case to camelCase for frontend
    const listings = listingsResult.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      business_name: row.business_name,
      businessName: row.business_name,
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
      primaryCategory: row.primary_category,
      secondaryCategories: row.secondary_categories,
      gbpPrimaryCategoryName: row.gbp_primary_category_name,
      logoUrl: row.logo_url,
      description: row.description,
      ratingAvg: row.rating_avg || 0,
      ratingCount: row.rating_count || 0,
      productCount: row.product_count || 0,
      isFeatured: row.is_featured || false,
      subscriptionTier: row.subscription_tier || 'trial',
      subscription_tier: row.subscription_tier || 'trial',
      useCustomWebsite: row.use_custom_website || false,
      isPublished: row.is_published || true,
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
    console.error('Directory search error:', error);
    return res.status(500).json({ error: 'search_failed' });
  }
});

/**
 * GET /api/directory/categories
 * Get list of available business categories
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    // Return predefined list of business categories
    const categories = [
      { name: 'Retail Store', slug: 'retail-store' },
      { name: 'Restaurant', slug: 'restaurant' },
      { name: 'Cafe & Coffee Shop', slug: 'cafe-coffee-shop' },
      { name: 'Grocery Store', slug: 'grocery-store' },
      { name: 'Convenience Store', slug: 'convenience-store' },
      { name: 'Pharmacy', slug: 'pharmacy' },
      { name: 'Hardware Store', slug: 'hardware-store' },
      { name: 'Pet Store', slug: 'pet-store' },
      { name: 'Bookstore', slug: 'bookstore' },
      { name: 'Electronics Store', slug: 'electronics-store' },
      { name: 'Clothing Store', slug: 'clothing-store' },
      { name: 'Sporting Goods', slug: 'sporting-goods' },
      { name: 'Home & Garden', slug: 'home-garden' },
      { name: 'Beauty & Cosmetics', slug: 'beauty-cosmetics' },
      { name: 'Jewelry Store', slug: 'jewelry-store' },
      { name: 'Toy Store', slug: 'toy-store' },
      { name: 'Automotive', slug: 'automotive' },
      { name: 'Bakery', slug: 'bakery' },
      { name: 'Florist', slug: 'florist' },
      { name: 'Gift Shop', slug: 'gift-shop' },
      { name: 'Other', slug: 'other' },
    ];

    return res.json({ categories });
  } catch (error) {
    console.error('Categories error:', error);
    return res.status(500).json({ error: 'categories_failed' });
  }
});

/**
 * GET /api/directory/locations
 * Get list of locations (cities) with counts
 */
router.get('/locations', async (req: Request, res: Response) => {
  try {
    const result = await getDirectPool().query(`
      SELECT city, state, COUNT(*) as count
      FROM directory_listings_list
      WHERE is_published = true AND city IS NOT NULL
        AND (business_hours IS NULL OR business_hours::text != 'null')
      GROUP BY city, state
      ORDER BY count DESC, city ASC
      LIMIT 100
    `);

    return res.json({
      locations: result.rows.map((row: any) => ({
        city: row.city,
        state: row.state,
        count: parseInt(row.count),
      })),
    });
  } catch (error) {
    console.error('Locations error:', error);
    return res.status(500).json({ error: 'locations_failed' });
  }
});

/**
 * GET /api/directory/:identifier
 * Get single listing by slug or tenant ID
 */
router.get('/:identifier', async (req: Request, res: Response) => {
  try {
    const { identifier } = req.params;

    // Check if identifier is a tenant ID (starts with 't-')
    const isTenantId = identifier.startsWith('t-');

    let query, params;
    if (isTenantId) {
      // Query by tenant_id
      query = `
        SELECT * FROM directory_listings_list
         WHERE tenant_id = $1 AND is_published = true
           AND (business_hours IS NULL OR business_hours::text != 'null')
         LIMIT 1
      `;
      params = [identifier];
    } else {
      // Query by slug
      query = `
        SELECT * FROM directory_listings_list
         WHERE slug = $1 AND is_published = true
           AND (business_hours IS NULL OR business_hours::text != 'null')
         LIMIT 1
      `;
      params = [identifier];
    }

    const result = await getDirectPool().query(query, params);

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'listing_not_found' });
    }

    const row = result.rows[0];

    // Get Product Categories with counts from storefront_category_counts MV
    // These are PRODUCT categories (what products are in), NOT store type categories
    const categoriesQuery = `
      SELECT 
        category_id as id,
        category_name as name,
        category_slug as slug,
        product_count as count,
        products_with_images,
        products_with_descriptions,
        avg_price_cents,
        min_price_cents,
        max_price_cents
      FROM storefront_category_counts
      WHERE tenant_id = $1
        AND product_count > 0
      ORDER BY category_level ASC, category_name ASC
    `;
    const categoriesResult = await getDirectPool().query(categoriesQuery, [row.tenant_id]);
    const productCategories = categoriesResult.rows.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      count: cat.count,
      productsWithImages: cat.products_with_images,
      productsWithDescriptions: cat.products_with_descriptions,
      avgPriceCents: cat.avg_price_cents,
      minPriceCents: cat.min_price_cents,
      maxPriceCents: cat.max_price_cents,
    }));

    // Build store type categories from primary_category and secondary_categories
    // These are the GBP/store type categories (max 10: 1 primary + 9 secondary)
    const storeCategories: any[] = [];
    if (row.primary_category) {
      const slug = row.primary_category.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
      storeCategories.push({
        id: `store-cat-${slug}`,
        name: row.primary_category,
        slug,
        isPrimary: true
      });
    }
    if (row.secondary_categories && Array.isArray(row.secondary_categories)) {
      row.secondary_categories.forEach((catName: string, index: number) => {
        const slug = catName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
        storeCategories.push({
          id: `store-cat-${slug}-${index}`,
          name: catName,
          slug,
          isPrimary: false
        });
      });
    }

    return res.json({
      listing: {
        ...row,
        categories: storeCategories, // Store type categories (GBP categories, max 10)
        productCategories, // Product categories from MV (what products are categorized under)
      }
    });
  } catch (error) {
    console.error('[GET /api/directory/:identifier] Error:', error);
    return res.status(500).json({ error: 'Failed to fetch directory listing' });
  }
});

/**
 * GET /api/directory/:slug/related
 * Get related stores based on category, location, and rating
 */
router.get('/:slug/related', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const limit = Math.min(6, Number(req.query.limit) || 6);

    // First, get the current listing
    const currentListing = await getDirectPool().query(
      `SELECT * FROM directory_listings_list WHERE slug = $1 AND is_published = true
         AND (business_hours IS NULL OR business_hours::text != 'null') LIMIT 1`,
      [slug]
    );

    if (currentListing.rows.length === 0) {
      return res.status(404).json({ error: 'listing_not_found' });
    }

    const current = currentListing.rows[0];

    // Find related stores using MV categories
    // Get the current store's MV categories
    const currentCategoriesQuery = `
      SELECT DISTINCT category_slug as slug
      FROM directory_category_products
      WHERE tenant_id = $1
        AND is_published = true
    `;
    const currentCategoriesResult = await getDirectPool().query(currentCategoriesQuery, [current.tenant_id]);
    const currentCategorySlugs = currentCategoriesResult.rows.map((row: any) => row.slug);

    // Find related stores using MV categories
    const relatedQuery = `
      SELECT DISTINCT ON (dcl.tenant_id)
        dcl.*,
        COUNT(dcp.category_slug) FILTER (WHERE dcp.category_slug = ANY($1)) as category_matches
      FROM directory_listings_list dcl
      INNER JOIN directory_category_products dcp ON dcp.tenant_id = dcl.tenant_id
      WHERE dcl.slug != $2
        AND dcl.is_published = true
        AND (dcl.business_hours IS NULL OR dcl.business_hours::text != 'null')
        AND dcp.is_published = true
        AND dcp.category_slug = ANY($1)
      GROUP BY dcl.tenant_id, dcl.id, dcl.business_name, dcl.slug, dcl.address, dcl.city, dcl.state, dcl.zip_code, dcl.phone, dcl.email, dcl.website, dcl.latitude, dcl.longitude, dcl.primary_category, dcl.secondary_categories, dcl.logo_url, dcl.description, dcl.rating_avg, dcl.rating_count, dcl.product_count, dcl.is_featured, dcl.subscription_tier, dcl.use_custom_website, dcl.is_published, dcl.business_hours, dcl.created_at, dcl.updated_at
      ORDER BY dcl.tenant_id, category_matches DESC, dcl.rating_avg DESC, dcl.product_count DESC
      LIMIT $3
    `;

    const related = await getDirectPool().query(relatedQuery, [
      currentCategorySlugs,
      slug,
      limit,
    ]);

    const relatedListings = related.rows.map((row: any) => ({
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
      primaryCategory: row.primary_category,
      secondaryCategories: row.secondary_categories || [],
      logoUrl: row.logo_url,
      description: row.description,
      ratingAvg: row.rating_avg || 0,
      ratingCount: row.rating_count || 0,
      productCount: row.product_count || 0,
      isFeatured: row.is_featured || false,
      subscription_tier: row.subscription_tier || 'trial',
      useCustomWebsite: row.use_custom_website || false,
      isPublished: row.is_published || true,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    return res.json({
      related: relatedListings,
      count: relatedListings.length,
    });
  } catch (error) {
    console.error('Related stores error:', error);
    return res.status(500).json({ error: 'related_stores_failed' });
  }
});

export default router;
