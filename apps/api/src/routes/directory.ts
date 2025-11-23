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
  business_name: string;
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
  subscription_tier: string;
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
    let query = Prisma.sql`
      SELECT 
        id,
        tenantId as "tenantId",
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
      query = Prisma.sql`${query},
        calculate_distance_miles(
          ${Number(lat)}, ${Number(lng)}, 
          latitude, longitude
        ) as distance
      `;
    }

    query = Prisma.sql`${query}
      FROM directory_listings_list
      WHERE is_published = true
        AND (business_hours IS NULL OR jsonb_typeof(business_hours) IS NOT NULL)
        AND (secondary_categories IS NULL OR jsonb_typeof(secondary_categories) = 'array')
    `;

    // Full-text search
    if (q) {
      query = Prisma.sql`${query}
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
      query = Prisma.sql`${query}
        AND (primary_category = ${category} OR ${category} = ANY(secondary_categories))
      `;
    }

    // Multiple categories (OR logic)
    if (categories.length > 0) {
      const categoryList = categories.map((c: string) => `'${c.replace(/'/g, "''")}'`).join(',');
      query = Prisma.sql`${query}
        AND (primary_category = ANY(ARRAY[${Prisma.raw(categoryList)}]) 
             OR secondary_categories && ARRAY[${Prisma.raw(categoryList)}])
      `;
    }

    // Location filters
    if (city) {
      query = Prisma.sql`${query} AND LOWER(city) = LOWER(${city})`;
    }
    if (state) {
      query = Prisma.sql`${query} AND LOWER(state) = LOWER(${state})`;
    }

    // Radius filter (requires lat/lng)
    if (lat && lng && radius) {
      query = Prisma.sql`${query}
        AND ST_DWithin(
          geolocation,
          ST_SetSRID(ST_MakePoint(${Number(lng)}, ${Number(lat)}), 4326)::geography,
          ${Number(radius) * 1609.34}
        )
      `;
    }

    // Rating filter
    if (minRating) {
      query = Prisma.sql`${query} AND rating_avg >= ${Number(minRating)}`;
    }

    // Features filter
    if (features.length > 0) {
      for (const feature of features) {
        query = Prisma.sql`${query} AND features->>${feature} = 'true'`;
      }
    }

    // Open now filter (check business hours)
    if (openNow === 'true' || openNow === true) {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM
      
      query = Prisma.sql`${query}
        AND business_hours_list IS NOT NULL
        AND business_hours_list->>${dayOfWeek}->>'isOpen' = 'true'
        AND business_hours_list->>${dayOfWeek}->>'open' <= ${currentTime}
        AND business_hours_list->>${dayOfWeek}->>'close' >= ${currentTime}
      `;
    }

    // Sorting
    let orderBy = Prisma.sql``;
    switch (sort) {
      case 'distance':
        if (lat && lng) {
          orderBy = Prisma.sql` ORDER BY distance ASC`;
        } else {
          orderBy = Prisma.sql` ORDER BY business_name ASC`;
        }
        break;
      case 'rating':
        orderBy = Prisma.sql` ORDER BY rating_avg DESC, rating_count DESC`;
        break;
      case 'newest':
        orderBy = Prisma.sql` ORDER BY created_at DESC`;
        break;
      case 'relevance':
      default:
        // Featured first, then by rating
        orderBy = Prisma.sql` ORDER BY is_featured DESC, rating_avg DESC, product_count DESC`;
        break;
    }

    query = Prisma.sql`${query}${orderBy}`;

    // Pagination
    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    query = Prisma.sql`${query} LIMIT ${limitNum} OFFSET ${offset}`;

    // Execute query
    const listings = await prisma.$queryRaw(query) as any;

    // Get total count for pagination
    let countQuery = Prisma.sql`
      SELECT COUNT(*) as total
      FROM directory_listings_list
      WHERE is_published = true
        AND (business_hours IS NULL OR jsonb_typeof(business_hours) IS NOT NULL)
        AND (secondary_categories IS NULL OR jsonb_typeof(secondary_categories) = 'array')
    `;

    // Apply same filters to count
    if (q) {
      countQuery = Prisma.sql`${countQuery}
        AND to_tsvector('english', 
          COALESCE(business_name, '') || ' ' || 
          COALESCE(description, '') || ' ' || 
          COALESCE(city, '') || ' ' || 
          COALESCE(state, '')
        ) @@ plainto_tsquery('english', ${q})
      `;
    }
    if (category) {
      countQuery = Prisma.sql`${countQuery}
        AND (primary_category = ${category} OR ${category} = ANY(secondary_categories))
      `;
    }
    if (city) {
      countQuery = Prisma.sql`${countQuery} AND LOWER(city) = LOWER(${city})`;
    }
    if (state) {
      countQuery = Prisma.sql`${countQuery} AND LOWER(state) = LOWER(${state})`;
    }

    const countResult = await prisma.$queryRaw<{ total: bigint }[]>(countQuery) as { total: bigint }[];
    const totalItems = Number(countResult[0]?.total || 0);
    const totalPages = Math.ceil(totalItems / limitNum);

    // Return response (same format as /public/tenant/:id/items)
    return res.json({
      listings: listings,
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
 * Get list of available business categories
 */
router.get('/categories', async (req, res) => {
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
    const result = await prisma.$queryRaw<Array<{ city: string; state: string; count: bigint }>>`
      SELECT 
        city,
        state,
        COUNT(*) as count
      FROM directory_listings_list
      WHERE is_published = true
        AND (business_hours IS NULL OR jsonb_typeof(business_hours) IS NOT NULL)
        AND (secondary_categories IS NULL OR jsonb_typeof(secondary_categories) = 'array')
        AND city IS NOT NULL
        AND state IS NOT NULL
      GROUP BY city, state
      ORDER BY count DESC, city ASC
      LIMIT 100
    `;

    return res.json({
      locations: result.map((row: any) => ({
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

    const result = await prisma.$queryRaw<Array<any>>`
      SELECT 
        id,
        tenantId as "tenantId",
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
      FROM directory_listings_list
      WHERE slug = ${slug}
        AND is_published = true
      LIMIT 1
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'listing_not_found' });
    }

    return res.json(result[0]);
  } catch (error: any) {
    console.error('[GET /api/directory/:slug] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_listing' });
  }
});

export default router;
