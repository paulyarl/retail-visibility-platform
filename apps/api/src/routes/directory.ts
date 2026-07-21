/**
 * Directory API Routes
 * Public endpoints for the merchant directory
 * Leverages existing tenant infrastructure patterns
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { Prisma } from '@prisma/client';
import { directoryController } from '../controllers/directory/DirectoryController';
import { asyncErrorWrapper } from '../middleware/errorHandler';
import { logger } from '../logger';

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
  canUseExternalLink?: boolean;
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

    // Build query components separately to avoid SQL template issues
    const selectFields = Prisma.sql`
      SELECT 
        dll.id,
        dll.tenant_id as "tenantId",
        dll.business_name as "businessName",
        dll.slug,
        dll.address,
        dll.city,
        dll.state,
        dll.zip_code as "zipCode",
        dll.phone,
        dll.email,
        dll.website,
        dll.latitude,
        dll.longitude,
        dll.primary_category as "primaryCategory",
        dll.secondary_categories as "secondaryCategories",
        dll.logo_url as "logoUrl",
        dll.description,
        dll.rating_avg as "ratingAvg",
        dll.rating_count as "ratingCount",
        dll.product_count as "productCount",
        dll.is_featured as "isFeatured",
        dll.subscription_tier as "subscriptionTier",
        dll.use_custom_website as "useCustomWebsite",
        COALESCE(mec.is_enabled, false) as "canUseExternalLink"
    `;

    // Add distance calculation if lat/lng provided
    const distanceField = lat && lng ? Prisma.sql`,
        calculate_distance_miles(
          ${Number(lat)}, ${Number(lng)}, 
          dll.latitude, dll.longitude
        ) as distance
    ` : Prisma.sql``;

    const baseQuery = Prisma.sql`
      FROM directory_listings_list dll
      INNER JOIN tenants t ON dll.tenant_id = t.id
      LEFT JOIN mv_tenant_effective_capabilities mec ON mec.tenant_id = dll.tenant_id AND mec.feature_key = 'directory_entry_external_link'
      WHERE dll.is_published = true
        AND (dll.business_hours IS NULL OR dll.business_hours::text != 'null')
    `;

    // Combine query parts
    let query = Prisma.sql`${selectFields}${distanceField} ${baseQuery}`;

    // Full-text search
    if (q) {
      query = Prisma.sql`${query}
        AND to_tsvector('english', 
          COALESCE(dll.business_name, '') || ' ' || 
          COALESCE(dll.description, '') || ' ' || 
          COALESCE(dll.city, '') || ' ' || 
          COALESCE(dll.state, '')
        ) @@ plainto_tsquery('english', ${q})
      `;
    }

    // Category filter
    if (category) {
      query = Prisma.sql`${query}
        AND (dll.primary_category = ${category} OR ${category} = ANY(dll.secondary_categories))
      `;
    }

    // Multiple categories (OR logic)
    if (categories.length > 0) {
      const categoryList = categories.map((c: string) => `'${c.replace(/'/g, "''")}'`).join(',');
      query = Prisma.sql`${query}
        AND (dll.primary_category = ANY(ARRAY[${Prisma.raw(categoryList)}]) 
             OR dll.secondary_categories && ARRAY[${Prisma.raw(categoryList)}])
      `;
    }

    // Location filters
    if (city) {
      query = Prisma.sql`${query} AND LOWER(dll.city) = LOWER(${city})`;
    }
    if (state) {
      query = Prisma.sql`${query} AND LOWER(dll.state) = LOWER(${state})`;
    }

    // Radius filter (requires lat/lng)
    if (lat && lng && radius) {
      query = Prisma.sql`${query}
        AND ST_DWithin(
          dll.geolocation,
          ST_SetSRID(ST_MakePoint(${Number(lng)}, ${Number(lat)}), 4326)::geography,
          ${Number(radius) * 1609.34}
        )
      `;
    }

    // Rating filter
    if (minRating) {
      query = Prisma.sql`${query} AND dll.rating_avg >= ${Number(minRating)}`;
    }

    // Features filter
    if (features.length > 0) {
      for (const feature of features) {
        query = Prisma.sql`${query} AND dll.features->>${feature} = 'true'`;
      }
    }

    // Open now filter (check business hours)
    if (openNow === 'true' || openNow === true) {
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM
      
      query = Prisma.sql`${query}
        AND dll.business_hours_list IS NOT NULL
        AND dll.business_hours_list->>${dayOfWeek}->>'isOpen' = 'true'
        AND dll.business_hours_list->>${dayOfWeek}->>'open' <= ${currentTime}
        AND dll.business_hours_list->>${dayOfWeek}->>'close' >= ${currentTime}
      `;
    }

    // Sorting
    let orderBy = Prisma.sql``;
    switch (sort) {
      case 'distance':
        if (lat && lng) {
          orderBy = Prisma.sql` ORDER BY distance ASC`;
        } else {
          orderBy = Prisma.sql` ORDER BY dll.business_name ASC`;
        }
        break;
      case 'rating':
        orderBy = Prisma.sql` ORDER BY dll.rating_avg DESC, dll.rating_count DESC`;
        break;
      case 'newest':
        orderBy = Prisma.sql` ORDER BY dll.created_at DESC`;
        break;
      case 'relevance':
      default:
        // Featured first, then by rating
        orderBy = Prisma.sql` ORDER BY dll.is_featured DESC, dll.rating_avg DESC, dll.product_count DESC`;
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
    const countBaseQuery = Prisma.sql`
      SELECT COUNT(*) as total
      FROM directory_listings_list dll
      INNER JOIN tenants t ON dll.tenant_id = t.id
      WHERE dll.is_published = true
        AND (dll.business_hours IS NULL OR dll.business_hours::text != 'null')
    `;

    // Apply same filters to count
    let countQuery = countBaseQuery;
    if (q) {
      countQuery = Prisma.sql`${countQuery}
        AND to_tsvector('english', 
          COALESCE(dll.business_name, '') || ' ' || 
          COALESCE(dll.description, '') || ' ' || 
          COALESCE(dll.city, '') || ' ' || 
          COALESCE(dll.state, '')
        ) @@ plainto_tsquery('english', ${q})
      `;
    }
    if (category) {
      countQuery = Prisma.sql`${countQuery}
        AND (dll.primary_category = ${category} OR ${category} = ANY(dll.secondary_categories))
      `;
    }
    if (city) {
      countQuery = Prisma.sql`${countQuery} AND LOWER(dll.city) = LOWER(${city})`;
    }
    if (state) {
      countQuery = Prisma.sql`${countQuery} AND LOWER(dll.state) = LOWER(${state})`;
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
    logger.error('[GET /api/directory/search] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_search_directory' });
  }
});

/**
 * GET /api/directory/categories
 * Get list of available business categories
 */
/*
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
    logger.error('[GET /api/directory/categories] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_get_categories' });
  }
});
*/

/**
 * GET /api/directory/locations
 * Get list of locations with counts
 */
router.get('/locations', async (req, res) => {
  try {
    const result = await prisma.$queryRaw<Array<{ city: string; state: string; count: bigint }>>`
      SELECT 
        dll.city,
        dll.state,
        COUNT(*) as count
      FROM directory_listings_list dll
      INNER JOIN tenants t ON dll.tenant_id = t.id
      WHERE dll.is_published = true
        AND (business_hours IS NULL OR business_hours::text != 'null')
        AND dll.city IS NOT NULL
        AND dll.state IS NOT NULL
      GROUP BY dll.city, dll.state
      ORDER BY count DESC, dll.city ASC
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
    logger.error('[GET /api/directory/locations] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_get_locations' });
  }
});

/**
 * GET /api/directory/tenant/:identifier
 * Get directory slug by tenant identifier (tenant-id, slug, or auto-id)
 */
router.get('/tenant/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    //console.log(`[Directory] Tenant slug request for identifier: ${identifier}`);

    // Use the universal identifier resolver to get tenant ID
    const { UniversalIdentifierCache } = await import('../services/UniversalIdentifierCache');
    const cache = UniversalIdentifierCache.getInstance();
    
    // Add timeout for identifier resolution to prevent hanging
    const identifierPromise = cache.resolveIdentifier(identifier);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Identifier resolution timeout')), 10000); // 10 second timeout
    });
    
    let resolvedTenant: any = null;
    try {
      resolvedTenant = await Promise.race([identifierPromise, timeoutPromise]);
      //console.log(`[Directory] Successfully resolved identifier: ${identifier} -> ${resolvedTenant?.id}`);
    } catch (error) {
      logger.error(`[Directory] Error resolving identifier: ${identifier}`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return res.status(404).json({
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }
    
    if (!resolvedTenant) {
      return res.status(404).json({
        error: 'Tenant not found',
        message: `No tenant found for identifier: ${identifier}`
      });
    }

    // Use direct database connection to avoid Prisma enum validation issues
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();
    
    const query = `
      SELECT slug
      FROM directory_listings_list dll
      WHERE dll.tenant_id = $1
        AND dll.is_published = true
      LIMIT 1
    `;
    
    const result = await pool.query(query, [resolvedTenant.id]);

    if (!result.rows || result.rows.length === 0) {
      return res.status(200).json({
        slug: null,
        tenantId: resolvedTenant.id,
        identifierType: resolvedTenant.type,
        hasDirectoryListing: false
      });
    }

    return res.json({ 
      slug: result.rows[0].slug,
      tenantId: resolvedTenant.id,
      identifierType: resolvedTenant.type,
      hasDirectoryListing: true
    });
  } catch (error: any) {
    logger.error('[GET /api/directory/tenant/:identifier] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    return res.status(500).json({ error: 'failed_to_get_directory_slug' });
  }
});

router.get('/:slug', asyncErrorWrapper((req, res) => directoryController.getListingBySlug(req, res)));

export default router;
