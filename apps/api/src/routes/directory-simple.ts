/**
 * Directory API Routes - Simplified
 * Public endpoints for the merchant directory
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
    const { q, category, city, state, page = '1', limit = '12' } = req.query;

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {
      is_published: true,
    };

    // Text search
    if (q && typeof q === 'string') {
      where.OR = [
        { business_name: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
        { primary_category: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Category filter
    if (category && typeof category === 'string') {
      where.primary_category = { contains: category, mode: 'insensitive' };
    }

    // Location filters
    if (city && typeof city === 'string') {
      where.city = { equals: city, mode: 'insensitive' };
    }
    if (state && typeof state === 'string') {
      where.state = { equals: state, mode: 'insensitive' };
    }

    // Build SQL query using Prisma.sql template
    let whereParts: Prisma.Sql[] = [Prisma.sql`is_published = true`];

    if (q) {
      const searchPattern = `%${q}%`;
      whereParts.push(Prisma.sql`(LOWER(business_name) LIKE LOWER(${searchPattern}) OR LOWER(city) LIKE LOWER(${searchPattern}) OR LOWER(primary_category) LIKE LOWER(${searchPattern})))`);
    }

    if (category) {
      whereParts.push(Prisma.sql`LOWER(primary_category) LIKE LOWER(${`%${category}%`})`);
    }

    if (city) {
      whereParts.push(Prisma.sql`LOWER(city) = LOWER(${city})`);
    }

    if (state) {
      whereParts.push(Prisma.sql`LOWER(state) = LOWER(${state})`);
    }

    const whereClause = Prisma.join(whereParts, ' AND ');

    // Get listings and total count
    const [listings, totalItems] = await Promise.all([
      prisma.$queryRaw`
        SELECT * FROM directory_listings_list
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT ${limitNum} OFFSET ${skip}
      `,
      prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM directory_listings_list
        WHERE ${whereClause}
      `,
    ]);

    const total = Number(totalItems[0]?.count || 0);
    const totalPages = Math.ceil(total / limitNum);

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
 * Get list of categories with counts
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.$queryRaw<Array<{ primary_category: string; count: bigint }>>`
      SELECT primary_category, COUNT(*) as count
      FROM directory_listings_list
      WHERE is_published = true AND primary_category IS NOT NULL
      GROUP BY primary_category
      ORDER BY count DESC, primary_category ASC
      LIMIT 50
    `;

    return res.json({
      categories: categories.map((cat) => ({
        name: cat.primary_category,
        count: Number(cat.count),
      })),
    });
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
    const locations = await prisma.$queryRaw<Array<{ city: string; state: string; count: bigint }>>`
      SELECT city, state, COUNT(*) as count
      FROM directory_listings_list
      WHERE is_published = true AND city IS NOT NULL
      GROUP BY city, state
      ORDER BY count DESC, city ASC
      LIMIT 100
    `;

    return res.json({
      locations: locations.map((loc) => ({
        city: loc.city,
        state: loc.state,
        count: Number(loc.count),
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

    const listing = await prisma.$queryRaw<Array<any>>`
      SELECT * FROM directory_listings_list
      WHERE slug = ${slug} AND is_published = true
      LIMIT 1
    `;

    if (!listing || listing.length === 0) {
      return res.status(404).json({ error: 'listing_not_found' });
    }

    return res.json({ listing: listing[0] });
  } catch (error) {
    console.error('Get listing error:', error);
    return res.status(500).json({ error: 'get_listing_failed' });
  }
});

export default router;
