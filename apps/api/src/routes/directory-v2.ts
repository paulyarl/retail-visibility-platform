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
 * GET /api/directory/search
 * Search directory listings with filters
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, category, city, state, sort = 'relevance', page = '1', limit = '12' } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build WHERE clause
    const conditions: string[] = ['is_published = true'];
    const params: any[] = [];
    let paramIndex = 1;

    if (q && typeof q === 'string') {
      conditions.push(`(LOWER(business_name) LIKE LOWER($${paramIndex}) OR LOWER(city) LIKE LOWER($${paramIndex}) OR LOWER(primary_category) LIKE LOWER($${paramIndex}))`);
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (category && typeof category === 'string') {
      conditions.push(`(LOWER(primary_category) LIKE LOWER($${paramIndex}) OR LOWER(secondary_categories::text) LIKE LOWER($${paramIndex}))`);
      params.push(`%${category}%`);
      paramIndex++;
    }

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

    // Get listings - use direct database query
    // console.log('[Directory Search] Query:', whereClause, params);
    const listingsQuery = `
      SELECT * FROM directory_listings_list
      WHERE ${whereClause}
        AND (business_hours IS NULL OR business_hours::text != 'null')
        AND tenant_id IN (SELECT id FROM tenants WHERE id IS NOT NULL)
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    // console.log('[Directory Search] Full SQL:', listingsQuery);
    const listingsResult = await getDirectPool().query(listingsQuery, [...params, limitNum, skip]);
    // console.log('[Directory Search] Query result rows:', listingsResult.rows.length);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count FROM directory_listings_list
      WHERE ${whereClause}
        AND (business_hours IS NULL OR business_hours::text != 'null')
        AND tenant_id IN (SELECT id FROM tenants WHERE id IS NOT NULL)
    `;
    const countResult = await getDirectPool().query(countQuery, params);

    const total = parseInt(countResult.rows[0]?.count || '0');
    const totalPages = Math.ceil(total / limitNum);

    // Transform snake_case to camelCase for frontend
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
      primaryCategory: row.primary_category,
      secondaryCategories: row.secondary_categories,
      logoUrl: row.logo_url,
      description: row.description,
      ratingAvg: row.rating_avg || 0,
      ratingCount: row.rating_count || 0,
      productCount: row.product_count || 0,
      isFeatured: row.is_featured || false,
      subscription_tier: row.subscriptionTier || 'trial',
      useCustomWebsite: row.use_custom_website || false,
      isPublished: row.is_published || true,
      createdAt: row.created_at,
      updatedAt: row.updatedAt,
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
    
    // Fetch categories from normalized structure
    const categoriesQuery = `
      SELECT 
        pc.id,
        pc.name,
        pc.slug,
        pc.google_category_id,
        pc.icon_emoji,
        dlc.is_primary
      FROM directory_listing_categories dlc
      INNER JOIN platform_categories pc ON pc.id = dlc.category_id
      WHERE dlc.listing_id = $1
      ORDER BY dlc.is_primary DESC, pc.name ASC
    `;
    const categoriesResult = await getDirectPool().query(categoriesQuery, [row.id]);
    
    const categories = categoriesResult.rows.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      googleCategoryId: cat.google_category_id,
      icon: cat.icon_emoji,
      isPrimary: cat.is_primary,
    }));
    
    const listing = {
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
      categories: categories, // New normalized categories array
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
    };

    return res.json({ listing });
  } catch (error) {
    console.error('Get listing error:', error);
    return res.status(500).json({ error: 'get_listing_failed' });
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

    // Find related stores using a scoring algorithm with materialized view
    // Priority: Same category (primary/secondary) > Same city > Similar rating
    // Using directory_category_listings MV for faster queries
    // Note: MV is already filtered by is_published = true at creation time
    const relatedQuery = `
      SELECT DISTINCT ON (dcl.id)
        dcl.*,
        (
          CASE
            WHEN dcl.is_primary = true AND dcl.category_name = $1 THEN 3
            WHEN dcl.is_primary = false AND dcl.category_name = $1 THEN 2
            WHEN dcl.category_name = ANY($7) THEN 2
            ELSE 0
          END +
          CASE
            WHEN dcl.city = $2 AND dcl.state = $3 THEN 2
            WHEN dcl.state = $3 THEN 1
            ELSE 0
          END +
          CASE
            WHEN ABS(dcl.rating_avg - $4) < 0.5 THEN 1
            ELSE 0
          END
        ) as relevance_score
      FROM directory_category_listings dcl
      WHERE dcl.slug != $5
      ORDER BY dcl.id, relevance_score DESC, dcl.rating_avg DESC, dcl.product_count DESC
      LIMIT $6
    `;

    const related = await getDirectPool().query(relatedQuery, [
      current.primary_category,
      current.city,
      current.state,
      current.rating_avg || 0,
      slug,
      limit,
      current.secondary_categories || [], // Add secondary categories for cross-matching
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
      primaryCategory: row.category_name, // From MV
      secondaryCategories: [], // MV has one category per row
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
