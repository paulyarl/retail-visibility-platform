/**
 * Directory API Routes - V2
 * Using direct database queries for RLS compatibility
 */

import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

const router = Router();

// Create a direct database connection pool that bypasses Prisma's retry logic
const directPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Force direct connection without retry wrappers
  min: 1,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
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
      conditions.push(`LOWER(primary_category) LIKE LOWER($${paramIndex})`);
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
    const listingsQuery = `
      SELECT * FROM directory_listings_list
      WHERE ${whereClause}
        AND (business_hours IS NULL OR jsonb_typeof(business_hours) IS NOT NULL)
        AND (secondary_categories IS NULL OR jsonb_typeof(secondary_categories) = 'array')
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const listingsResult = await directPool.query(listingsQuery, [...params, limitNum, skip]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as count FROM directory_listings_list
      WHERE ${whereClause}
        AND (business_hours IS NULL OR jsonb_typeof(business_hours) IS NOT NULL)
        AND (secondary_categories IS NULL OR jsonb_typeof(secondary_categories) = 'array')
    `;
    const countResult = await directPool.query(countQuery, params);

    const total = parseInt(countResult.rows[0]?.count || '0');
    const totalPages = Math.ceil(total / limitNum);

    // Transform snake_case to camelCase for frontend
    const listings = listingsResult.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenantId,
      business_name: row.businessName,
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
    const result = await directPool.query(`
      SELECT city, state, COUNT(*) as count
      FROM directory_listings_list
      WHERE is_published = true AND city IS NOT NULL
        AND (business_hours IS NULL OR jsonb_typeof(business_hours) IS NOT NULL)
        AND (secondary_categories IS NULL OR jsonb_typeof(secondary_categories) = 'array')
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
 * GET /api/directory/:slug
 * Get single listing by slug
 */
router.get('/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const result = await directPool.query(
      `SELECT * FROM directory_listings_list
       WHERE slug = $1 AND is_published = true
         AND (business_hours IS NULL OR jsonb_typeof(business_hours) IS NOT NULL)
        AND (secondary_categories IS NULL OR jsonb_typeof(secondary_categories) = 'array')
       LIMIT 1`,
      [slug]
    );

    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'listing_not_found' });
    }

    const row = result.rows[0];
    const listing = {
      id: row.id,
      tenantId: row.tenantId,
      business_name: row.businessName,
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
    const currentListing = await directPool.query(
      `SELECT * FROM directory_listings_list WHERE slug = $1 AND is_published = true
         AND (business_hours IS NULL OR jsonb_typeof(business_hours) IS NOT NULL)
        AND (secondary_categories IS NULL OR jsonb_typeof(secondary_categories) = 'array') LIMIT 1`,
      [slug]
    );

    if (currentListing.rows.length === 0) {
      return res.status(404).json({ error: 'listing_not_found' });
    }

    const current = currentListing.rows[0];

    // Find related stores using a scoring algorithm
    // Priority: Same category > Same city > Similar rating
    const relatedQuery = `
      SELECT *,
        (
          CASE
            WHEN primary_category = $1 THEN 3
            ELSE 0
          END +
          CASE
            WHEN city = $2 AND state = $3 THEN 2
            WHEN state = $3 THEN 1
            ELSE 0
          END +
          CASE
            WHEN ABS(rating_avg - $4) < 0.5 THEN 1
            ELSE 0
          END
        ) as relevance_score
      FROM directory_listings_list
      WHERE slug != $5
        AND is_published = true
        AND (business_hours IS NULL OR jsonb_typeof(business_hours) IS NOT NULL)
        AND (secondary_categories IS NULL OR jsonb_typeof(secondary_categories) = 'array')
      ORDER BY relevance_score DESC, rating_avg DESC, product_count DESC
      LIMIT $6
    `;

    const related = await directPool.query(relatedQuery, [
      current.primary_category,
      current.city,
      current.state,
      current.rating_avg || 0,
      slug,
      limit,
    ]);

    const relatedListings = related.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenantId,
      business_name: row.businessName,
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
      related: relatedListings,
      count: relatedListings.length,
    });
  } catch (error) {
    console.error('Related stores error:', error);
    return res.status(500).json({ error: 'related_stores_failed' });
  }
});

export default router;
