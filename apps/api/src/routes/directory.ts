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
      FROM directory_listings_list dll
      INNER JOIN tenants t ON dll.tenant_id = t.id
      WHERE dll.is_published = true
        AND (business_hours IS NULL OR business_hours::text != 'null')
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
      FROM directory_listings_list dll
      INNER JOIN tenants t ON dll.tenant_id = t.id
      WHERE dll.is_published = true
        AND (business_hours IS NULL OR business_hours::text != 'null')
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
    console.error('[GET /api/directory/categories] Error:', error);
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
    console.error('[GET /api/directory/locations] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_locations' });
  }
});

/**
 * GET /api/directory/tenant/:tenantId
 * Get directory slug by tenant ID
 */
router.get('/tenant/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const result = await prisma.$queryRaw<Array<{ slug: string }>>`
      SELECT slug
      FROM directory_listings_list dll
      WHERE dll.tenant_id = ${tenantId}
        AND dll.is_published = true
      LIMIT 1
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'directory_listing_not_found' });
    }

    return res.json({ slug: result[0].slug });
  } catch (error: any) {
    console.error('[GET /api/directory/tenant/:tenantId] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_directory_slug' });
  }
});
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    console.log('[DIRECTORY] /:slug route hit with identifier:', slug);

    // Use a direct database connection instead of Prisma raw query
    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();
    
    // Try both tenant_id and slug lookups - database will determine which matches
    // This future-proofs against tenant ID format changes
    const query = `
      SELECT * FROM directory_listings_list 
      WHERE (tenant_id = $1 OR slug = $1) AND is_published = true 
      LIMIT 1
    `;
    
    console.log('[DIRECTORY] Querying by tenant_id OR slug:', slug);
    const result = await pool.query(query, [slug]);
    console.log('[DIRECTORY] Query result rows:', result.rows.length);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'listing_not_found' });
    }

    const listing = result.rows[0];
    
    // Transform primary_category and secondary_categories into categories array
    const categories = [];
    
    if (listing.primary_category) {
      try {
        // Handle both string and object formats
        let primary;
        if (typeof listing.primary_category === 'string') {
          try {
            // Try to parse as JSON first
            primary = JSON.parse(listing.primary_category);
          } catch {
            // If not JSON, treat as plain string (category name)
            primary = { name: listing.primary_category };
          }
        } else {
          primary = listing.primary_category;
        }
        
        if (primary && primary.name) {
          // Generate slug from name if id not present
          const slug = primary.id 
            ? primary.id.replace('gcid:', '').replace(/_/g, '-')
            : primary.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
          
          categories.push({
            id: primary.id || `gcid:${slug}`,
            name: primary.name,
            slug: slug,
            isPrimary: true
          });
        }
      } catch (e) {
        console.error('[Directory] Error parsing primary category:', e);
      }
    }
    
    if (listing.secondary_categories) {
      try {
        let secondary;
        if (typeof listing.secondary_categories === 'string') {
          try {
            // Try to parse as JSON
            secondary = JSON.parse(listing.secondary_categories);
          } catch {
            // If not JSON, wrap in array
            secondary = [listing.secondary_categories];
          }
        } else {
          secondary = listing.secondary_categories;
        }
        
        if (Array.isArray(secondary)) {
          secondary.forEach((cat: any) => {
            // Handle both string and object formats
            const categoryData = typeof cat === 'string' ? { name: cat } : cat;
            
            if (categoryData && categoryData.name) {
              const slug = categoryData.id 
                ? categoryData.id.replace('gcid:', '').replace(/_/g, '-')
                : categoryData.name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
              
              categories.push({
                id: categoryData.id || `gcid:${slug}`,
                name: categoryData.name,
                slug: slug,
                isPrimary: false
              });
            }
          });
        }
      } catch (e) {
        console.error('[Directory] Error parsing secondary categories:', e);
      }
    }
    
    // Add categories array to the response
    listing.categories = categories;

    // Transform the listing to match the expected response format
    const transformedListing = {
      id: listing.id,
      tenantId: listing.tenant_id,
      businessName: listing.business_name,
      slug: listing.slug,
      address: listing.address,
      city: listing.city,
      state: listing.state,
      zipCode: listing.zip_code,
      phone: listing.phone,
      email: listing.email,
      website: listing.website,
      latitude: listing.latitude,
      longitude: listing.longitude,
      primaryCategory: listing.primary_category,
      secondaryCategories: listing.secondary_categories,
      logoUrl: listing.logo_url,
      description: listing.description,
      businessHours: listing.business_hours,
      ratingAvg: listing.rating_avg,
      ratingCount: listing.rating_count,
      productCount: listing.product_count,
      isFeatured: listing.is_featured,
      subscriptionTier: listing.subscription_tier,
      useCustomWebsite: listing.use_custom_website,
      isPublished: listing.is_published,
      createdAt: listing.created_at,
      updatedAt: listing.updated_at,
      keywords: listing.keywords,
      categories: categories // Add the transformed categories array
    };

    return res.json(transformedListing);
  } catch (error: any) {
    console.error('[GET /api/directory/:slug] Error:', error);
    return res.status(500).json({ error: 'failed_to_get_listing' });
  }
});

export default router;
