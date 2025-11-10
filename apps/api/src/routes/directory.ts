/**
 * Directory API Routes
 * Public endpoints for the merchant directory
 * Leverages existing tenant infrastructure patterns
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';

const router = Router();

interface DirectorySearchParams {
  q?: string;                    // Search query
  category?: string;             // Primary category
  categories?: string[];         // Multiple categories (OR)
  city?: string;                 // Filter by city
  state?: string;                // Filter by state
  lat?: number;                  // User latitude
  lng?: number;                  // User longitude
  radius?: number;               // Radius in miles (default 25)
  minRating?: number;            // Minimum rating (1-5)
  features?: string[];           // delivery, pickup, etc
  openNow?: boolean;             // Filter by business hours
  sort?: 'relevance' | 'distance' | 'rating' | 'newest';
  page?: number;                 // Pagination (default 1)
  limit?: number;                // Results per page (default 24)
}

interface DirectoryListing {
  id: string;
  tenantId: string;
  businessName: string;
  slug: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  latitude?: number;
  longitude?: number;
  primaryCategory?: string;
  secondaryCategories?: string[];
  logoUrl?: string;
  description?: string;
  ratingAvg: number;
  ratingCount: number;
  productCount: number;
  isFeatured: boolean;
  subscriptionTier: string;
  useCustomWebsite: boolean;
  distance?: number;
  isOpen?: boolean;
}

/**
 * GET /api/directory/search
 * Search directory with filters
 * Reuses pagination pattern from /public/tenant/:id/items
 */
router.get('/search', async (req, res) => {
  try {
    const {
      q,
      category,
      categories: categoriesParam,
      city,
      state,
      lat,
      lng,
      radius = 25,
      minRating,
      features: featuresParam,
      openNow,
      sort = 'relevance',
      page = 1,
      limit = 24,
    } = req.query as any;

    // Parse array parameters
    const categories = categoriesParam ? 
      (Array.isArray(categoriesParam) ? categoriesParam : [categoriesParam]) : 
      [];
    const features = featuresParam ? 
      (Array.isArray(featuresParam) ? featuresParam : [featuresParam]) : 
      [];

    // Build query
    let query = sql`
      SELECT 
        id,
        tenant_id as "tenantId",
        business_name as "businessName",
        slug,
        address,
        city,
        state,
        zip_code as "zipCode",
        phone,
        email,
        website,
        latitude,
        longitude,
        primary_category as "primaryCategory",
        secondary_categories as "secondaryCategories",
        logo_url as "logoUrl",
        description,
        rating_avg as "ratingAvg",
        rating_count as "ratingCount",
        product_count as "productCount",
        is_featured as "isFeatured",
        subscription_tier as "subscriptionTier",
        use_custom_website as "useCustomWebsite"
    `;

    // Add distance calculation if lat/lng provided
    if (lat && lng) {
      query = sql`${query},
        calculate_distance_miles(
          ${Number(lat)}, ${Number(lng)}, 
          latitude, longitude
        ) as distance
      `;
    }

    query = sql`${query}
      FROM directory_listings
      WHERE is_published = true
    `;

    // Full-text search
    if (q) {
      query = sql`${query}
        AND to_tsvector('english', 
          COALESCE(business_name, '') || ' ' || 
          COALESCE(description, '') || ' ' || 
          COALESCE(city, '') || ' ' || 
          COALESCE(state, '')
        ) @@ plainto_tsquery('english', ${q})
      `;
    }

    // Category filter
    if (category) {
      query = sql`${query}
        AND (primary_category = ${category} OR ${category} = ANY(secondary_categories))
      `;
    }

    // Multiple categories (OR logic)
    if (categories.length > 0) {
      const categoryList = categories.map((c: string) => `'${c}'`).join(',');
      query = sql`${query}
        AND (primary_category = ANY(ARRAY[${sql.raw(categoryList)}]) 
             OR secondary_categories && ARRAY[${sql.raw(categoryList)}])
      `;
    }

    // Location filters
    if (city) {
      query = sql`${query} AND LOWER(city) = LOWER(${city})`;
    }
    if (state) {
      query = sql`${query} AND LOWER(state) = LOWER(${state})`;
    }

    // Radius filter (requires lat/lng)
    if (lat && lng && radius) {
      query = sql`${query}
        AND ST_DWithin(
          geolocation,
          ST_SetSRID(ST_MakePoint(${Number(lng)}, ${Number(lat)}), 4326)::geography,
          ${Number(radius) * 1609.34}
        )
      `;
    }

    // Rating filter
    if (minRating) {
      query = sql`${query} AND rating_avg >= ${Number(minRating)}`;
    }

    // Features filter
    if (features.length > 0) {
      for (const feature of features) {
        query = sql`${query} AND features->>${feature} = 'true'`;
      }
    }

    // Open now filter (check business hours)
    if (openNow === 'true' || openNow === true) {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM
      
      query = sql`${query}
        AND business_hours IS NOT NULL
        AND business_hours->>${dayOfWeek}->>'isOpen' = 'true'
        AND business_hours->>${dayOfWeek}->>'open' <= ${currentTime}
        AND business_hours->>${dayOfWeek}->>'close' >= ${currentTime}
      `;
    }

    // Sorting
    let orderBy = sql``;
    switch (sort) {
      case 'distance':
        if (lat && lng) {
          orderBy = sql` ORDER BY distance ASC`;
        } else {
          orderBy = sql` ORDER BY business_name ASC`;
        }
        break;
      case 'rating':
        orderBy = sql` ORDER BY rating_avg DESC, rating_count DESC`;
        break;
      case 'newest':
        orderBy = sql` ORDER BY created_at DESC`;
        break;
      case 'relevance':
      default:
        // Featured first, then by rating
        orderBy = sql` ORDER BY is_featured DESC, rating_avg DESC, product_count DESC`;
        break;
    }

    query = sql`${query}${orderBy}`;

    // Pagination
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    query = sql`${query} LIMIT ${limitNum} OFFSET ${offset}`;

    // Execute query
    const listings = await prisma.$queryRawUnsafe(query.sql, ...query.params);

    // Get total count for pagination
    let countQuery = Prisma.sql`
      SELECT COUNT(*) as total
      FROM directory_listings
      WHERE is_published = true
    `;

    // Apply same filters to count
    if (q) {
      countQuery = sql`${countQuery}
        AND to_tsvector('english', 
          COALESCE(business_name, '') || ' ' || 
          COALESCE(description, '') || ' ' || 
          COALESCE(city, '') || ' ' || 
          COALESCE(state, '')
        ) @@ plainto_tsquery('english', ${q})
      `;
    }
    if (category) {
      countQuery = sql`${countQuery}
        AND (primary_category = ${category} OR ${category} = ANY(secondary_categories))
      `;
    }
    if (city) {
      countQuery = sql`${countQuery} AND LOWER(city) = LOWER(${city})`;
    }
    if (state) {
      countQuery = sql`${countQuery} AND LOWER(state) = LOWER(${state})`;
    }

    const countResult = await db.execute(countQuery);
    const totalItems = Number(countResult.rows[0]?.total || 0);
    const totalPages = Math.ceil(totalItems / limitNum);

    // Return response (same format as /public/tenant/:id/items)
    return res.json({
      listings: listings.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalItems,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('[GET /api/directory/search] Error:', error);
    return res.status(500).json({ error: 'failed_to_search_directory' });
  }
});

/**
 * GET /api/directory/categories
 * Get list of categories with counts
 */
router.get('/categories', async (req, res) => {
  try {
    const query = sql`
      SELECT 
        primary_category as category,
        COUNT(*) as count
      FROM directory_listings
      WHERE is_published = true
        AND primary_category IS NOT NULL
      GROUP BY primary_category
      ORDER BY count DESC, primary_category ASC
    `;

    const result = await db.execute(query);

    return res.json({
      categories: result.rows.map((row: any) => ({
        name: row.category,
        slug: row.category.toLowerCase().replace(/\s+/g, '-'),
        count: Number(row.count),
      })),
    });
  } catch (error: any) {
    console.error('[GET /api/directory/categories] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_categories' });
  }
});

/**
 * GET /api/directory/locations
 * Get list of locations with counts
 */
router.get('/locations', async (req, res) => {
  try {
    const query = sql`
      SELECT 
        city,
        state,
        COUNT(*) as count
      FROM directory_listings
      WHERE is_published = true
        AND city IS NOT NULL
        AND state IS NOT NULL
      GROUP BY city, state
      ORDER BY count DESC, city ASC
      LIMIT 100
    `;

    const result = await db.execute(query);

    return res.json({
      locations: result.rows.map((row: any) => ({
        city: row.city,
        state: row.state,
        slug: `${row.city.toLowerCase().replace(/\s+/g, '-')}-${row.state.toLowerCase()}`,
        count: Number(row.count),
      })),
    });
  } catch (error: any) {
    console.error('[GET /api/directory/locations] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_locations' });
  }
});

/**
 * GET /api/directory/:slug
 * Get single directory listing by slug
 */
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    const query = sql`
      SELECT 
        id,
        tenant_id as "tenantId",
        business_name as "businessName",
        slug,
        address,
        city,
        state,
        zip_code as "zipCode",
        phone,
        email,
        website,
        latitude,
        longitude,
        primary_category as "primaryCategory",
        secondary_categories as "secondaryCategories",
        logo_url as "logoUrl",
        description,
        business_hours as "businessHours",
        rating_avg as "ratingAvg",
        rating_count as "ratingCount",
        product_count as "productCount",
        is_featured as "isFeatured",
        subscription_tier as "subscriptionTier",
        use_custom_website as "useCustomWebsite",
        map_privacy_mode as "mapPrivacyMode",
        display_map as "displayMap"
      FROM directory_listings
      WHERE slug = ${slug}
        AND is_published = true
      LIMIT 1
    `;

    const result = await db.execute(query);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'listing_not_found' });
    }

    return res.json(result.rows[0]);
  } catch (error: any) {
    console.error('[GET /api/directory/:slug] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_listing' });
  }
});

export default router;
