/**
 * Directory API Routes - V2
 * Using direct database queries for RLS compatibility
 */

import { Router, Request, Response } from 'express';
import { getDirectPool } from '../utils/db-pool';

const router = Router();

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
 * Get related stores based on GBP categories (primary and secondary) with weighted scoring
 */
router.get('/:slug/related', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const limit = Math.min(6, Number(req.query.limit) || 6);

    // First, get the current listing
    const currentListing = await getDirectPool().query(
      `SELECT tenant_id, city, state FROM directory_listings_list WHERE slug = $1 AND is_published = true LIMIT 1`,
      [slug]
    );

    if (currentListing.rows.length === 0) {
      return res.status(404).json({ error: 'listing_not_found' });
    }

    const current = currentListing.rows[0];

    // Find related stores using GBP categories with weighted scoring
    // Primary-to-Primary: 10 pts, Primary-to-Secondary: 7 pts, Secondary-to-Secondary: 5 pts
    const relatedQuery = `
      WITH source_primary_category AS (
        SELECT gbp.gbp_category_id as category_id
        FROM tenant_business_profiles_list gbp
        WHERE gbp.tenant_id = $1
          AND gbp.gbp_category_id IS NOT NULL
      ),
      source_secondary_categories AS (
        SELECT tgc.gbp_category_id as category_id
        FROM tenant_gbp_categories tgc
        WHERE tgc.tenant_id = $1
      ),
      matching_tenants AS (
        -- Primary-to-Primary match (highest score: 10)
        SELECT gbp.tenant_id, 10 as match_score
        FROM tenant_business_profiles_list gbp
        JOIN source_primary_category spc ON gbp.gbp_category_id = spc.category_id
        WHERE gbp.tenant_id != $1
        
        UNION ALL
        
        -- Primary-to-Secondary match (medium score: 7)
        SELECT tgc.tenant_id, 7 as match_score
        FROM tenant_gbp_categories tgc
        JOIN source_primary_category spc ON tgc.gbp_category_id = spc.category_id
        WHERE tgc.tenant_id != $1
        
        UNION ALL
        
        -- Secondary-to-Primary match (medium score: 7)
        SELECT gbp.tenant_id, 7 as match_score
        FROM tenant_business_profiles_list gbp
        JOIN source_secondary_categories ssc ON gbp.gbp_category_id = ssc.category_id
        WHERE gbp.tenant_id != $1
        
        UNION ALL
        
        -- Secondary-to-Secondary match (lower score: 5)
        SELECT tgc.tenant_id, 5 as match_score
        FROM tenant_gbp_categories tgc
        JOIN source_secondary_categories ssc ON tgc.gbp_category_id = ssc.category_id
        WHERE tgc.tenant_id != $1
      ),
      aggregated_scores AS (
        SELECT 
          tenant_id,
          SUM(match_score) as total_category_score,
          MAX(match_score) as best_match_score,
          COUNT(*) as category_overlap_count
        FROM matching_tenants
        GROUP BY tenant_id
      )
      SELECT
        dcl.*,
        agg.total_category_score,
        agg.best_match_score,
        agg.category_overlap_count,
        CASE WHEN dcl.city = $2 AND dcl.state = $3 THEN 5 ELSE 0 END as location_score,
        (agg.total_category_score + CASE WHEN dcl.city = $2 AND dcl.state = $3 THEN 5 ELSE 0 END) as combined_score
      FROM aggregated_scores agg
      JOIN directory_listings_list dcl ON dcl.tenant_id = agg.tenant_id
      WHERE dcl.is_published = true
      ORDER BY 
        combined_score DESC,
        agg.category_overlap_count DESC,
        dcl.rating_avg DESC NULLS LAST,
        dcl.rating_count DESC NULLS LAST
      LIMIT $4
    `;

    const related = await getDirectPool().query(relatedQuery, [
      current.tenant_id,
      current.city,
      current.state,
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
      matchScore: row.combined_score,
      matchType: row.best_match_score >= 10 ? 'primary' : row.best_match_score >= 7 ? 'related' : 'similar',
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
