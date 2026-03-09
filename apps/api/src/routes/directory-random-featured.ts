import { Router } from 'express';
import { getDirectPool } from '../utils/db-pool';
import CacheService, { CacheKeys, CACHE_TTL } from '../lib/cache-service';

const router = Router();

// GET /api/directory/random-featured
// Returns proximity-weighted random featured products with pagination
router.get('/', async (req, res) => {
  try {
    const { lat, lng, maxDistance = '500', page = '1', limit = '12', _t } = req.query;
    
    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 12));
    const offset = (pageNum - 1) * limitNum;
    
    // Check for cache-busting parameter
    const useCache = !_t; // If _t parameter exists, bypass cache
    
    // Generate cache key based on location, distance, pagination, and cache-busting
    const cacheBustingSuffix = _t ? `_cb_${_t}` : '';
    const cacheKey = lat && lng 
      ? CacheKeys.FEATURED_PRODUCTS(`${lat}:${lng}:${maxDistance}:${page}:${limit}${cacheBustingSuffix}`)
      : CacheKeys.FEATURED_PRODUCTS(`global:${page}:${limit}${cacheBustingSuffix}`);
    
    // Try to get from cache first (unless cache-busting)
    if (useCache) {
      const cached = await CacheService.get(cacheKey);
      if (cached) {
        return res.json({
          ...cached,
          refreshed_at: new Date().toISOString()
        });
      }
    }
    
    const pool = getDirectPool();
    let query;
    let queryParams = [];
    
    if (lat && lng) {
      // Proximity-weighted random query with rich data from mv_global_discovery
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
            mv.inventory_item_id as id,
            mv.tenant_id,
            mv.sku,
            mv.product_name as name,
            mv.product_title as title,
            mv.product_description as description,
            mv.list_price_cents as price_cents,
            mv.sale_price_cents,
            mv.stock,
            mv.image_url,
            mv.brand,
            mv.item_status,
            mv.availability,
            mv.has_variants,
            mv.product_category_name_lower as category_name,
            mv.product_category_slug as category_slug,
            mv.product_google_category_id as google_category_id,
            mv.has_gallery,
            mv.has_description,
            mv.has_brand,
            mv.has_price,
            mv.has_active_payment_gateway,
            mv.default_gateway_type,
            mv.featured_type,
            mv.featured_priority,
            mv.featured_at,
            mv.featured_until as featured_expires_at,
            mv.is_actively_featured as is_featured_active,
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
          FROM mv_global_discovery mv
          JOIN directory_listings_list dsl ON dsl.tenant_id = mv.tenant_id
          JOIN nearby_stores ns ON ns.tenant_id = mv.tenant_id
          WHERE mv.is_actively_featured = true 
            AND dsl.is_published = true
            AND mv.has_image = true
            AND mv.in_stock = true
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
      // Fallback: Simple random without proximity (cached globally) using mv_global_discovery
      query = `
        SELECT 
          mv.inventory_item_id as id,
          mv.tenant_id,
          mv.sku,
          mv.product_name as name,
          mv.product_title as title,
          mv.product_description as description,
          mv.list_price_cents as price_cents,
          mv.sale_price_cents,
          mv.stock,
          mv.image_url,
          mv.brand,
          mv.item_status,
          mv.availability,
          mv.product_category as category_name,
          mv.product_category_slug as category_slug,
          mv.product_google_category_id as google_category_id,
          mv.has_gallery,
          mv.has_description,
          mv.has_brand,
          mv.has_price,
          mv.has_active_payment_gateway,
          mv.default_gateway_type,
          mv.featured_type,
          mv.featured_priority,
          mv.featured_at,
          mv.featured_until as featured_expires_at,
          mv.is_actively_featured as is_featured_active,
          mv.created_at,
          mv.updated_at,
          mv.tenant_slug as store_slug,
          mv.tenant_name as store_name,
          mv.tenant_logo_url as store_logo,
          mv.tenant_city as store_city,
          mv.tenant_state as store_state
        FROM mv_global_discovery mv
        WHERE mv.is_actively_featured = true 
          AND mv.has_image = true
          AND mv.in_stock = true
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
      featuredType: row.featured_type,
      featuredTypes: row.featured_type ? [row.featured_type] : [], // Convert single to array
      featuredPriority: row.featured_priority,
      featuredAt: row.featured_at,
      featuredExpiresAt: row.featured_expires_at,
      isFeaturedActive: row.is_featured_active,
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      googleCategoryId: row.google_category_id,
      hasGallery: row.has_gallery,
      hasDescription: row.has_description,
      hasBrand: row.has_brand,
      hasPrice: row.has_price,
      hasActivePaymentGateway: row.has_active_payment_gateway,
      defaultGatewayType: row.default_gateway_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      storeSlug: row.store_slug,
      storeName: row.store_name,
      storeLogo: row.store_logo,
      storeCity: row.store_city,
      storeState: row.store_state,
      distanceKm: row.distance_km || null,
    }));
    
    // Get total count for pagination
    let totalCountQuery;
    let totalCountParams: any[] = [];
    
    if (lat && lng) {
      totalCountQuery = `
        SELECT COUNT(DISTINCT mv.inventory_item_id) as total
        FROM mv_global_discovery mv
        WHERE mv.is_actively_featured = true 
          AND mv.has_image = true
          AND mv.in_stock = true
          AND mv.tenant_latitude IS NOT NULL 
          AND mv.tenant_longitude IS NOT NULL
          AND (6371 * acos(
            cos(radians($1)) * cos(radians(mv.tenant_latitude)) * 
            cos(radians(mv.tenant_longitude) - radians($2)) + 
            sin(radians($1)) * sin(radians(mv.tenant_latitude))
          )) < $3
      `;
      totalCountParams = [parseFloat(lat as string), parseFloat(lng as string), parseFloat(maxDistance as string)];
    } else {
      totalCountQuery = `
        SELECT COUNT(DISTINCT mv.inventory_item_id) as total
        FROM mv_global_discovery mv
        WHERE mv.is_actively_featured = true 
          AND mv.has_image = true
          AND mv.in_stock = true
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
    
    // Cache the response (unless cache-busting)
    if (useCache) {
      await CacheService.set(cacheKey, responseData, CACHE_TTL.FEATURED_PRODUCTS);
    }
    
    return res.json(responseData);
  } catch (error) {
    console.error('[GET /api/directory/random-featured] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch random featured products',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
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
    
    // Build where conditions for mv_global_discovery
    const whereConditions = [
      'mv.is_actively_featured = true', 
      'mv.has_image = true', 
      'mv.in_stock = true',
      'dsl.is_published = true'
    ];
    let queryParams: (string | number)[] = [limitNum, offset];
    
    if (category) {
      whereConditions.push('mv.product_category_slug = $' + (queryParams.length + 1));
      queryParams.push(category as string);
    }
    
    if (search) {
      whereConditions.push('(mv.product_name ILIKE $' + (queryParams.length + 1) + ' OR mv.brand ILIKE $' + (queryParams.length + 2) + ')');
      queryParams.push('%' + search + '%', '%' + search + '%');
    }
    
    const whereClause = whereConditions.join(' AND ');
    
    // Fallback: Simple random without proximity (cached globally) with rich data from mv_global_discovery
    const query = `
      SELECT 
        mv.inventory_item_id as id,
        mv.tenant_id,
        mv.sku,
        mv.product_name as name,
        mv.product_title as title,
        mv.product_description as description,
        mv.list_price_cents as price_cents,
        mv.sale_price_cents,
        mv.stock,
        mv.image_url,
        mv.brand,
        mv.item_status,
        mv.availability,
        mv.has_variants,
        null as tenant_category_id, -- Not available in mv_global_discovery
        mv.featured_type,
        mv.featured_priority,
        mv.featured_at,
        mv.featured_until as featured_expires_at,
        mv.is_actively_featured as is_featured_active,
        null as days_until_expiration, -- Not available in mv_global_discovery
        null as is_expired, -- Not available in mv_global_discovery
        null as is_expiring_soon, -- Not available in mv_global_discovery
        mv.metadata,
        mv.product_category_name_lower as category_name,
        mv.product_category_slug as category_slug,
        mv.product_google_category_id as google_category_id,
        mv.has_gallery,
        mv.has_description,
        mv.has_brand,
        mv.has_price,
        mv.has_active_payment_gateway,
        mv.default_gateway_type,
        mv.created_at,
        mv.updated_at,
        dsl.slug as store_slug,
        dsl.business_name as store_name,
        dsl.logo_url as store_logo,
        dsl.city as store_city,
        dsl.state as store_state,
        dsl.website_url as store_website,
        dsl.phone as store_phone
      FROM mv_global_discovery mv
      JOIN directory_listings_list dsl ON dsl.tenant_id = mv.tenant_id
      WHERE ${whereClause}
      ORDER BY RANDOM()
      LIMIT $1 OFFSET $2
    `;
    
    const result = await pool.query(query, queryParams);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM mv_global_discovery mv
      JOIN directory_listings_list dsl ON dsl.tenant_id = mv.tenant_id
      WHERE ${whereClause}
    `;
    
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2)); // Remove limit/offset for count
    const totalCount = parseInt(countResult.rows[0].total);
    
    // Transform to match storefront data structure
    const products = result.rows.map((row: any) => {
      // Log payment gateway values from database
      console.log('[API-DEBUG] Payment Gateway DB Values:', {
        tenant_id: row.tenant_id,
        product_id: row.id,
        db_has_active_payment_gateway: row.has_active_payment_gateway,
        db_default_gateway_type: row.default_gateway_type,
        source: 'mv_global_discovery'
      });
      
      const transformedProduct = {
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
        tenantCategoryId: null, // Not available in mv_global_discovery
        featuredType: row.featured_type,
        featuredTypes: row.featured_type ? [row.featured_type] : [], // Convert single to array
        featuredPriority: row.featured_priority,
        featuredAt: row.featured_at,
        featuredExpiresAt: row.featured_expires_at,
        isFeaturedActive: row.is_featured_active,
        daysUntilExpiration: null, // Not available in mv_global_discovery
        isExpired: null, // Not available in mv_global_discovery
        isExpiringSoon: null, // Not available in mv_global_discovery
        metadata: row.metadata,
        categoryName: row.category_name,
        categorySlug: row.category_slug,
        googleCategoryId: row.google_category_id,
        hasGallery: row.has_gallery,
        hasDescription: row.has_description,
        hasBrand: row.has_brand,
        hasPrice: row.has_price,
        hasActivePaymentGateway: row.has_active_payment_gateway,
        defaultGatewayType: row.default_gateway_type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        storeSlug: row.store_slug,
        storeName: row.store_name,
        storeLogo: row.store_logo,
        storeCity: row.store_city,
        storeState: row.store_state,
        storeWebsite: row.store_website,
        storePhone: row.store_phone,
      };
      
      // Log transformed values
      console.log('[API-DEBUG] Payment Gateway Transformed Values:', {
        tenant_id: transformedProduct.tenantId,
        product_id: transformedProduct.id,
        api_hasActivePaymentGateway: transformedProduct.hasActivePaymentGateway,
        api_defaultGatewayType: transformedProduct.defaultGatewayType,
        source: 'transformation'
      });
      
      return transformedProduct;
    });
    
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
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

export default router;
