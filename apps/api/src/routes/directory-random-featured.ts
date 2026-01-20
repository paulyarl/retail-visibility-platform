import { Router } from 'express';
import { getDirectPool } from '../utils/db-pool';
import CacheService, { CacheKeys, CACHE_TTL } from '../lib/cache-service';

const router = Router();

// GET /api/directory/random-featured
// Returns 12 proximity-weighted random featured products
router.get('/', async (req, res) => {
  try {
    const { lat, lng, maxDistance = '500' } = req.query;
    
    // Generate cache key based on location and distance
    const cacheKey = lat && lng 
      ? CacheKeys.FEATURED_PRODUCTS(`${lat}:${lng}:${maxDistance}`)
      : CacheKeys.FEATURED_PRODUCTS('global');
    
    // Try to get from cache first
    const cached = await CacheService.get(cacheKey);
    if (cached) {
      return res.json({
        ...cached,
        cached: true,
        refreshed_at: new Date().toISOString()
      });
    }
    
    const pool = getDirectPool();
    let query;
    let queryParams = [];
    
    if (lat && lng) {
      // Proximity-weighted random query
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
            sp.id,
            sp.name,
            sp.price_cents,
            sp.currency,
            sp.image_url,
            sp.brand,
            sp.description,
            sp.stock,
            sp.availability,
            sp.tenant_id,
            sp.category_name,
            sp.category_slug,
            sp.has_active_payment_gateway,
            sp.default_gateway_type,
            dsl.slug as store_slug,
            dsl.business_name as store_name,
            dsl.logo_url as store_logo,
            dsl.city as store_city,
            dsl.state as store_state,
            sp.updated_at,
            ns.distance_km,
            CASE 
              WHEN ns.distance_km < 50 THEN 0.1   -- Very nearby (50km) - 10x weight
              WHEN ns.distance_km < 100 THEN 0.3  -- Nearby (100km) - 3x weight  
              WHEN ns.distance_km < 200 THEN 0.5  -- Medium distance - 2x weight
              ELSE 1.0  -- Far away - normal weight
            END * RANDOM() as weighted_random
          FROM storefront_products sp
          JOIN directory_listings_list dsl ON dsl.tenant_id = sp.tenant_id
          JOIN nearby_stores ns ON ns.tenant_id = sp.tenant_id
          WHERE sp.is_actively_featured = true 
            AND dsl.is_published = true
            AND sp.has_image = true
            AND sp.stock > 0
        )
        SELECT * FROM weighted_products
        ORDER BY weighted_random
        LIMIT 12
      `;
      queryParams = [parseFloat(lat as string), parseFloat(lng as string), parseFloat(maxDistance as string)];
    } else {
      // Fallback: Simple random without proximity (cached globally)
      query = `
        SELECT 
          sp.id,
          sp.name,
          sp.price_cents,
          sp.currency,
          sp.image_url,
          sp.brand,
          sp.description,
          sp.stock,
          sp.availability,
          sp.tenant_id,
          sp.category_name,
          sp.category_slug,
          sp.has_active_payment_gateway,
          sp.default_gateway_type,
          dsl.slug as store_slug,
          dsl.business_name as store_name,
          dsl.logo_url as store_logo,
          dsl.city as store_city,
          dsl.state as store_state,
          sp.updated_at
        FROM storefront_products sp
        JOIN directory_listings_list dsl ON dsl.tenant_id = sp.tenant_id
        WHERE sp.is_actively_featured = true 
          AND dsl.is_published = true
          AND sp.has_image = true
          AND sp.stock > 0
        ORDER BY RANDOM() 
        LIMIT 12
      `;
    }
    
    const result = await pool.query(query, queryParams);
    
    // Transform to camelCase for frontend compatibility
    const products = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      priceCents: row.price_cents,
      currency: row.currency,
      imageUrl: row.image_url,
      brand: row.brand,
      description: row.description,
      stock: row.stock,
      availability: row.availability,
      tenantId: row.tenant_id,
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      hasActivePaymentGateway: row.has_active_payment_gateway,
      paymentGatewayType: row.default_gateway_type,
      storeSlug: row.store_slug,
      storeName: row.store_name,
      storeLogo: row.store_logo,
      storeCity: row.store_city,
      storeState: row.store_state,
      updatedAt: row.updated_at,
      distanceKm: row.distance_km || null
    }));
    
    const responseData = {
      products,
      total: products.length,
      location: lat && lng ? { lat: parseFloat(lat as string), lng: parseFloat(lng as string) } : null,
      maxDistance: maxDistance,
      cached: false
    };
    
    // Cache the result for 10 minutes
    await CacheService.set(cacheKey, responseData, CACHE_TTL.MEDIUM);
    
    res.json({
      ...responseData,
      refreshed_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Directory Random Featured] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch random featured products',
      products: [],
      total: 0,
      refreshed_at: new Date().toISOString()
    });
  }
});

export default router;
