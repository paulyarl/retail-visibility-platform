import { Router } from 'express';
import { getDirectPool } from '../utils/db-pool';
import CacheService, { CacheKeys, CACHE_TTL } from '../lib/cache-service';

const router = Router();

// GET /api/directory/random-featured
// Returns proximity-weighted random featured products with pagination
router.get('/', async (req, res) => {
  try {
    const { lat, lng, maxDistance = '500', page = '1', limit = '12' } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 12));
    const offset = (pageNum - 1) * limitNum;
    
    // Generate cache key based on location, distance, and pagination
    const cacheKey = lat && lng 
      ? CacheKeys.FEATURED_PRODUCTS(`${lat}:${lng}:${maxDistance}:${page}:${limit}`)
      : CacheKeys.FEATURED_PRODUCTS(`global:${page}:${limit}`);
    
    // Try to get from cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return res.json({
        ...cached,
        refreshed_at: new Date().toISOString()
      });
    }
    
    const pool = getDirectPool();
    let query;
    let queryParams = [];
    
    if (lat && lng) {
      // Proximity-weighted random query with rich data matching storefront
      query = `
        WITH nearby_stores AS (
          SELECT 
            tenant_id,
            (6371 * acos(
              cos(radians($1)) * cos(radians(lat)) * 
              cos(radians(lng) - radians($2)) + 
              sin(radians($1)) * sin(radians(lat))
            )) AS distance_km
          FROM directory_listings_list
          WHERE is_published = true
            AND lat IS NOT NULL 
            AND lng IS NOT NULL
          HAVING distance_km < $3
        ),
        weighted_products AS (
          SELECT 
            mv.id,
            mv.tenant_id,
            mv.sku,
            mv.name,
            mv.title,
            mv.description,
            mv.price_cents,
            mv.sale_price_cents,
            mv.stock,
            mv.image_url,
            mv.brand,
            mv.item_status,
            mv.availability,
            mv.has_variants,
            mv.tenant_category_id,
            mv.featured_type,
            mv.featured_priority,
            mv.featured_at,
            mv.featured_expires_at,
            mv.is_featured_active,
            mv.days_until_expiration,
            mv.is_expired,
            mv.is_expiring_soon,
            mv.metadata,
            sp.category_name,
            sp.category_slug,
            sp.google_category_id,
            sp.has_gallery,
            sp.has_description,
            sp.has_brand,
            sp.has_price,
            mv.created_at,
            mv.updated_at,
            dsl.slug as store_slug,
            dsl.business_name as store_name,
            dsl.logo_url as store_logo,
            dsl.city as store_city,
            dsl.state as store_state,
            dsl.website_url as store_website,
            dsl.phone as store_phone,
            ns.distance_km,
            CASE 
              WHEN ns.distance_km < 50 THEN 0.1   -- Very nearby (50km) - 10x weight
              WHEN ns.distance_km < 100 THEN 0.3  -- Nearby (100km) - 3x weight  
              WHEN ns.distance_km < 200 THEN 0.5  -- Medium distance - 2x weight
              ELSE 1.0  -- Far away - normal weight
            END * RANDOM() as weighted_random
          FROM storefront_products_mv mv
          JOIN directory_listings_list dsl ON dsl.tenant_id = mv.tenant_id
          JOIN nearby_stores ns ON ns.tenant_id = mv.tenant_id
          WHERE mv.is_featured_active = true 
            AND dsl.is_published = true
            AND mv.has_image = true
            AND mv.stock > 0
        )
        SELECT * FROM weighted_products
        ORDER BY weighted_random
        LIMIT $4 OFFSET $5
      `;
      queryParams = [
        parseFloat(lat as string), 
        parseFloat(lng as string), 
        parseFloat(maxDistance as string),
        limitNum,
        offset
      ];
    } else {
      // Fallback: Simple random without proximity (cached globally) with rich data
      query = `
        SELECT 
          mv.id,
          mv.tenant_id,
          mv.sku,
          mv.name,
          mv.title,
          mv.description,
          mv.price_cents,
          mv.sale_price_cents,
          mv.stock,
          mv.image_url,
          mv.brand,
          mv.item_status,
          mv.availability,
          mv.has_variants,
          mv.tenant_category_id,
          mv.featured_type,
          mv.featured_priority,
          mv.featured_at,
          mv.featured_expires_at,
          mv.is_featured_active,
          mv.days_until_expiration,
          mv.is_expired,
          mv.is_expiring_soon,
          mv.metadata,
          sp.category_name,
          sp.category_slug,
          sp.google_category_id,
          sp.has_gallery,
          sp.has_description,
          sp.has_brand,
          sp.has_price,
          mv.created_at,
          mv.updated_at,
          dsl.slug as store_slug,
          dsl.business_name as store_name,
          dsl.logo_url as store_logo,
          dsl.city as store_city,
          dsl.state as store_state,
          dsl.website_url as store_website,
          dsl.phone as store_phone
        FROM storefront_products_mv mv
        JOIN directory_listings_list dsl ON dsl.tenant_id = mv.tenant_id
        LEFT JOIN storefront_products sp ON mv.id = sp.id AND mv.tenant_id = sp.tenant_id
        WHERE mv.is_featured_active = true 
          AND dsl.is_published = true
          AND mv.has_image = true
          AND mv.stock > 0
        ORDER BY RANDOM() 
        LIMIT $1 OFFSET $2
      `;
      queryParams = [limitNum, offset];
    }
    
    const result = await pool.query(query, queryParams);
    
    // Transform to match storefront data structure
    const products = result.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      sku: row.sku,
      name: row.name,
      title: row.title,
      description: row.description,
      priceCents: row.price_cents,
      salePriceCents: row.sale_price_cents,
      stock: row.stock,
      imageUrl: row.image_url,
      brand: row.brand,
      itemStatus: row.item_status,
      availability: row.availability,
      hasVariants: row.has_variants,
      tenantCategoryId: row.tenant_category_id,
      featuredType: row.featured_type,
      featuredTypes: row.featured_type ? [row.featured_type] : [], // Convert single to array
      featuredPriority: row.featured_priority,
      featuredAt: row.featured_at,
      featuredExpiresAt: row.featured_expires_at,
      isFeaturedActive: row.is_featured_active,
      daysUntilExpiration: row.days_until_expiration,
      isExpired: row.is_expired,
      isExpiringSoon: row.is_expiring_soon,
      metadata: row.metadata,
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      googleCategoryId: row.google_category_id,
      hasGallery: row.has_gallery,
      hasDescription: row.has_description,
      hasBrand: row.has_brand,
      hasPrice: row.has_price,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      storeSlug: row.store_slug,
      storeName: row.store_name,
      storeLogo: row.store_logo,
      storeCity: row.store_city,
      storeState: row.store_state,
      storeWebsite: row.store_website,
      storePhone: row.store_phone,
      distanceKm: row.distance_km || null,
    }));
    
    // Get total count for pagination
    let totalCountQuery;
    let totalCountParams = [];
    
    if (lat && lng) {
      totalCountQuery = `
        SELECT COUNT(*) as total
        FROM (
          SELECT DISTINCT mv.id
          FROM storefront_products_mv mv
          JOIN directory_listings_list dsl ON dsl.tenant_id = mv.tenant_id
          JOIN (
            SELECT tenant_id
            FROM directory_listings_list
            WHERE is_published = true
              AND lat IS NOT NULL 
              AND lng IS NOT NULL
              AND (6371 * acos(
                cos(radians($1)) * cos(radians(lat)) * 
                cos(radians(lng) - radians($2)) + 
                sin(radians($1)) * sin(radians(lat))
              )) < $3
          ) ns ON ns.tenant_id = mv.tenant_id
          WHERE mv.is_featured_active = true 
            AND dsl.is_published = true
            AND mv.has_image = true
            AND mv.stock > 0
        ) as filtered_products
      `;
      totalCountParams = [parseFloat(lat as string), parseFloat(lng as string), parseFloat(maxDistance as string)];
    } else {
      totalCountQuery = `
        SELECT COUNT(*) as total
        FROM storefront_products_mv mv
        JOIN directory_listings_list dsl ON dsl.tenant_id = mv.tenant_id
        WHERE mv.is_featured_active = true 
          AND dsl.is_published = true
          AND mv.has_image = true
          AND mv.stock > 0
      `;
      totalCountParams = [];
    }
    
    const totalCountResult = await pool.query(totalCountQuery, totalCountParams);
    const totalCount = parseInt(totalCountResult.rows[0].total);
    
    const responseData = {
      products,
      pagination: {
        currentPage: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        hasNext: pageNum * limitNum < totalCount,
        hasPrev: pageNum > 1
      },
      location: lat && lng ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string), maxDistance: parseFloat(maxDistance as string) } : null,
      refreshed_at: new Date().toISOString()
    };
    
    // Cache the response
    await CacheService.set(cacheKey, responseData, CACHE_TTL.FEATURED_PRODUCTS);
    
    return res.json(responseData);
  } catch (error) {
    console.error('[GET /api/directory/random-featured] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch random featured products',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/directory/random-featured/available
// Returns available products for directory featuring (not currently featured)
router.get('/available', async (req, res) => {
  try {
    const { page = '1', limit = '50', category, search } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;
    
    const pool = getDirectPool();
    
    // Build query with optional filters
    let whereConditions = [
      'mv.is_featured_active = true',
      'mv.has_image = true', 
      'mv.stock > 0',
      'dsl.is_published = true'
    ];
    let queryParams = [limitNum, offset];
    
    if (category) {
      whereConditions.push('sp.category_slug = $' + (queryParams.length + 1));
      queryParams.push(category as string);
    }
    
    if (search) {
      whereConditions.push('(mv.name ILIKE $' + (queryParams.length + 1) + ' OR mv.brand ILIKE $' + (queryParams.length + 2) + ')');
      queryParams.push('%' + search + '%', '%' + search + '%');
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Query for available products with rich data
    const query = `
      SELECT 
        mv.id,
        mv.tenant_id,
        mv.sku,
        mv.name,
        mv.title,
        mv.description,
        mv.price_cents,
        mv.sale_price_cents,
        mv.stock,
        mv.image_url,
        mv.brand,
        mv.item_status,
        mv.availability,
        mv.has_variants,
        mv.tenant_category_id,
        sp.category_name,
        sp.category_slug,
        sp.google_category_id,
        sp.has_gallery,
        sp.has_description,
        sp.has_brand,
        sp.has_price,
        mv.metadata,
        mv.created_at,
        mv.updated_at,
        dsl.slug as store_slug,
        dsl.business_name as store_name,
        dsl.logo_url as store_logo,
        dsl.city as store_city,
        dsl.state as store_state,
        dsl.website_url as store_website,
        dsl.phone as store_phone
      FROM storefront_products_mv mv
      JOIN directory_listings_list dsl ON dsl.tenant_id = mv.tenant_id
      LEFT JOIN storefront_products sp ON mv.id = sp.id AND mv.tenant_id = sp.tenant_id
      WHERE ${whereClause}
      ORDER BY mv.updated_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, queryParams);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM storefront_products_mv mv
      JOIN directory_listings_list dsl ON dsl.tenant_id = mv.tenant_id
      WHERE ${whereClause}
    `;
    
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2)); // Remove limit/offset for count
    const totalCount = parseInt(countResult.rows[0].total);
    
    // Transform to match storefront data structure
    const products = result.rows.map((row: any) => ({
      id: row.id,
      tenantId: row.tenant_id,
      sku: row.sku,
      name: row.name,
      title: row.title,
      description: row.description,
      priceCents: row.price_cents,
      salePriceCents: row.sale_price_cents,
      stock: row.stock,
      imageUrl: row.image_url,
      brand: row.brand,
      itemStatus: row.item_status,
      availability: row.availability,
      hasVariants: row.has_variants,
      tenantCategoryId: row.tenant_category_id,
      featuredType: row.featured_type,
      featuredTypes: row.featured_type ? [row.featured_type] : [], // Convert single to array
      featuredPriority: row.featured_priority,
      featuredAt: row.featured_at,
      featuredExpiresAt: row.featured_expires_at,
      isFeaturedActive: row.is_featured_active,
      daysUntilExpiration: row.days_until_expiration,
      isExpired: row.is_expired,
      isExpiringSoon: row.is_expiring_soon,
      metadata: row.metadata,
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      googleCategoryId: row.google_category_id,
      hasGallery: row.has_gallery,
      hasDescription: row.has_description,
      hasBrand: row.has_brand,
      hasPrice: row.has_price,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      storeSlug: row.store_slug,
      storeName: row.store_name,
      storeLogo: row.store_logo,
      storeCity: row.store_city,
      storeState: row.store_state,
      storeWebsite: row.store_website,
      storePhone: row.store_phone,
    }));
    
    const responseData = {
      products,
      pagination: {
        currentPage: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        hasNext: pageNum * limitNum < totalCount,
        hasPrev: pageNum > 1
      },
      filters: {
        category: category || null,
        search: search || null
      },
      refreshed_at: new Date().toISOString()
    };
    
    return res.json(responseData);
  } catch (error) {
    console.error('[GET /api/directory/random-featured/available] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch available products',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;
