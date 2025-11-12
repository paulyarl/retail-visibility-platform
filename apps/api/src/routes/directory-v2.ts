/**
 * Directory API Routes - V2
 * Using Prisma for RLS compatibility
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

const router = Router();

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

    // Build query with Prisma.sql - inject WHERE and ORDER BY as raw SQL
    let listingsQuery = Prisma.sql`SELECT * FROM directory_listings WHERE `;
    listingsQuery = Prisma.sql`${listingsQuery}${Prisma.raw(whereClause)} ORDER BY ${Prisma.raw(orderByClause)} LIMIT ${limitNum} OFFSET ${skip}`;
    const listingsResult = await prisma.$queryRaw<any[]>(listingsQuery);

    // Get total count
    let countQuery = Prisma.sql`SELECT COUNT(*) as count FROM directory_listings WHERE `;
    countQuery = Prisma.sql`${countQuery}${Prisma.raw(whereClause)}`;
    const countResult = await prisma.$queryRaw<any[]>(countQuery);

    const total = parseInt(countResult[0]?.count || '0');
    const totalPages = Math.ceil(total / limitNum);

    return res.json({
      listings: listingsResult,
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
    const result = await prisma.$queryRawUnsafe(`
      SELECT city, state, COUNT(*) as count
      FROM directory_listings
      WHERE is_published = true AND city IS NOT NULL
      GROUP BY city, state
      ORDER BY count DESC, city ASC
      LIMIT 100
    `) as Array<{ city: string; state: string; count: bigint }>;

    return res.json({
      locations: result.map((row: any) => ({
        city: row.city,
        state: row.state,
        count: parseInt(row.count.toString()),
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

    const result = await prisma.$queryRawUnsafe(
      `SELECT * FROM directory_listings
       WHERE slug = $1 AND is_published = true
       LIMIT 1`,
      slug
    ) as any[];

    if (!result || result.length === 0) {
      return res.status(404).json({ error: 'listing_not_found' });
    }

    return res.json({ listing: result[0] });
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
    const currentListing = await prisma.$queryRawUnsafe(
      `SELECT * FROM directory_listings WHERE slug = $1 AND is_published = true LIMIT 1`,
      slug
    ) as any[];

    if (currentListing.length === 0) {
      return res.status(404).json({ error: 'listing_not_found' });
    }

    const current = currentListing[0];

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
      FROM directory_listings
      WHERE slug != $5 
        AND is_published = true
      ORDER BY relevance_score DESC, rating_avg DESC, product_count DESC
      LIMIT $6
    `;

    const related = await prisma.$queryRawUnsafe(relatedQuery,
      current.primary_category,
      current.city,
      current.state,
      current.rating_avg || 0,
      slug,
      limit
    ) as any[];

    return res.json({
      related: related,
      count: related.length,
    });
  } catch (error) {
    console.error('Related stores error:', error);
    return res.status(500).json({ error: 'related_stores_failed' });
  }
});

export default router;
