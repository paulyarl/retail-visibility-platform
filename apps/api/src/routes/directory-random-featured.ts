import { Router } from 'express';
import { getDirectPool } from '../utils/db-pool';
import CacheService, { CacheKeys, CACHE_TTL } from '../lib/cache-service';

const router = Router();

// GET /api/directory/random-featured
// Returns proximity-weighted random featured products with merchant diversification
router.get('/', async (req, res) => {
  try {
    const pool = getDirectPool();
    
    // Get user location and limit from query params
    const userLat = parseFloat(req.query.lat as string) || 40.7128; // Default: New York
    const userLng = parseFloat(req.query.lng as string) || -74.0060; // Default: New York
    const maxDistance = parseFloat(req.query.maxDistance as string) || 500; // Default: 500km
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 12));
    
    // Query for random featured products with proximity weighting from mv_global_discovery
    const query = `
      WITH featured_products AS (
        SELECT 
          mv.inventory_item_id as id,
          mv.product_name as name,
          mv.list_price_cents as price_cents,
          mv.sale_price_cents,
          'USD' as currency,
          mv.image_url,
          mv.brand,
          mv.product_description as description,
          mv.stock,
          mv.availability,
          mv.is_variant,
          mv.has_gallery,
          mv.tenant_id,
          mv.product_category_name_lower as category_name,
          mv.product_category_slug as category_slug,
          mv.product_google_category_id as google_category_id,
          mv.has_active_payment_gateway,
          mv.default_gateway_type,
          dsl.slug as store_slug,
          dsl.business_name as store_name,
          dsl.logo_url as store_logo,
          dsl.city as store_city,
          dsl.state as store_state,
          dsl.latitude,
          dsl.longitude,
          dsl.primary_category as store_category,
          mv.updated_at,
          -- Calculate distance in kilometers using Haversine formula
          CASE 
            WHEN dsl.latitude IS NOT NULL AND dsl.longitude IS NOT NULL THEN
              6371 * acos(
                cos(radians($1)) * cos(radians(dsl.latitude)) * 
                cos(radians(dsl.longitude) - radians($2)) + 
                sin(radians($1)) * sin(radians(dsl.latitude))
              )
            ELSE NULL
          END as distance_km,
          -- Geographic relevance score based on city/state when lat/lng missing
          CASE 
            WHEN dsl.latitude IS NOT NULL AND dsl.longitude IS NOT NULL THEN 1.0
            WHEN dsl.state = 'NY' THEN 0.8 -- High priority for same state
            WHEN dsl.state IN ('NJ', 'CT', 'PA', 'MA') THEN 0.6 -- Nearby states
            WHEN dsl.city IS NOT NULL THEN 0.4 -- Has city info
            ELSE 0.1 -- No location info
          END as geographic_relevance
        FROM mv_global_discovery mv
        JOIN directory_listings_list dsl ON dsl.tenant_id = mv.tenant_id
        WHERE mv.is_actively_featured = true 
          AND mv.featured_type IN ('store_selection', 'featured')
          AND dsl.is_published = true
          AND mv.has_image = true
          AND mv.in_stock = true
      ),
      weighted_products AS (
        SELECT *,
          -- Weight: combine geographic relevance with distance and randomness
          CASE 
            WHEN distance_km IS NOT NULL AND distance_km <= $3 THEN 
              -- Has precise location and within radius: use distance + geographic relevance
              (1.0 / (1 + distance_km/100)) * geographic_relevance * (0.7 + random() * 0.3)
            WHEN distance_km IS NULL THEN 
              -- No precise location: use geographic relevance + randomness
              geographic_relevance * (0.5 + random() * 0.5)
            ELSE 
              -- Far away: low weight but still some chance
              0.1 * random()
          END as weight
        FROM featured_products
      )
      SELECT * FROM weighted_products
      ORDER BY weight DESC, RANDOM()
      LIMIT $4
    `;
    
    const result = await pool.query(query, [userLat, userLng, maxDistance, Math.min(limit * 5, 100)]);
    
    // Transform to camelCase for frontend compatibility
    const products = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      priceCents: row.price_cents,
      salePriceCents: row.sale_price_cents,
      currency: row.currency,
      imageUrl: row.image_url,
      brand: row.brand,
      description: row.description,
      stock: row.stock,
      availability: row.availability,
      isVariant: row.is_variant,
      hasGallery: row.has_gallery,
      tenantId: row.tenant_id,
      categoryName: row.category_name,
      categorySlug: row.category_slug,
      googleCategoryId: row.google_category_id,
      distanceKm: row.distance_km,
      hasActivePaymentGateway: row.has_active_payment_gateway,
      paymentGatewayType: row.default_gateway_type,
      storeSlug: row.store_slug,
      storeName: row.store_name,
      storeLogo: row.store_logo,
      storeCity: row.store_city,
      storeState: row.store_state,
      storeCategory: row.store_category,
      updatedAt: row.updated_at
    }));
    
    // Apply merchant diversification
    const diversifiedProducts = diversifyByMerchant(products, limit);
    
    res.json({
      products: diversifiedProducts,
      total: diversifiedProducts.length,
      refreshed_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[GET /api/directory/random-featured] Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch random featured products',
      products: [],
      total: 0,
      refreshed_at: new Date().toISOString()
    });
  }
});

// GET /api/directory/random-featured/debug
// Debug endpoint to see all merchants with featured products
router.get('/debug', async (req, res) => {
  try {
    const pool = getDirectPool();
    
    const query = `
      SELECT DISTINCT 
        mv.tenant_id,
        COUNT(*) as product_count,
        dsl.business_name as store_name
      FROM mv_global_discovery mv
      JOIN directory_listings_list dsl ON dsl.tenant_id = mv.tenant_id
      WHERE mv.is_actively_featured = true 
        AND mv.featured_type IN ('store_selection', 'featured')
        AND mv.has_image = true 
        AND mv.in_stock = true
        AND dsl.is_published = true
      GROUP BY mv.tenant_id, dsl.business_name
      ORDER BY product_count DESC
    `;
    
    const result = await pool.query(query);
    
    console.log('[DEBUG] All merchants with featured products:');
    result.rows.forEach(row => {
      console.log(`  ${row.tenant_id} (${row.store_name}): ${row.product_count} products`);
    });
    
    return res.json({
      merchants: result.rows,
      totalMerchants: result.rows.length
    });
  } catch (error) {
    console.error('[DEBUG] Error:', error);
    return res.status(500).json({ error: 'Debug query failed' });
  }
});

// Helper function for merchant diversification (shared across endpoints)
const diversifyByMerchant = (products: any[], limit: number) => {
  if (!products || products.length === 0) return [];
  
  // Group products by merchant
  const merchantGroups = new Map<string, any[]>();
  products.forEach(product => {
    const merchantId = product.tenantId;
    if (!merchantGroups.has(merchantId)) {
      merchantGroups.set(merchantId, []);
    }
    merchantGroups.get(merchantId)!.push(product);
  });
  
  // Shuffle each merchant's products randomly
  merchantGroups.forEach(merchantProducts => {
    for (let i = merchantProducts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [merchantProducts[i], merchantProducts[j]] = [merchantProducts[j], merchantProducts[i]];
    }
  });
  
  // Create diversified result by taking one product from each merchant in rotation
  const diversified: any[] = [];
  const merchantIds = Array.from(merchantGroups.keys());
  
  // Shuffle merchant order for additional randomness
  for (let i = merchantIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [merchantIds[i], merchantIds[j]] = [merchantIds[j], merchantIds[i]];
  }
  
  // Round-robin selection from merchants
  let merchantIndex = 0;
  let allMerchantsExhausted = false;
  
  while (diversified.length < limit && !allMerchantsExhausted) {
    allMerchantsExhausted = true;
    
    for (const merchantId of merchantIds) {
      if (diversified.length >= limit) break;
      
      const merchantProducts = merchantGroups.get(merchantId)!;
      const productIndex = merchantIndex;
      
      if (productIndex < merchantProducts.length) {
        diversified.push(merchantProducts[productIndex]);
        allMerchantsExhausted = false;
      }
    }
    
    merchantIndex++;
  }
  
  return diversified.slice(0, limit);
};

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
      'mv.featured_type IN (\'store_selection\', \'featured\')',
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
    
    // Simple query - let JavaScript handle the randomization
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
        mv.is_variant,
        null as tenant_category_id, -- Not available in mv_global_discovery
        mv.featured_type,
        mv.featured_priority,
        mv.featured_at,
        mv.featured_until as featured_expires_at,
        mv.is_actively_featured as is_featured_active,
        null as days_until_expiration, -- Not available in mv_global_discovery
        null as is_expired, -- Not available in mv_global_discovery
        null as is_expiring_soon, -- Not available in mv_global_discovery
        mv.product_metadata,
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
        dsl.website as store_website,
        dsl.phone as store_phone
      FROM mv_global_discovery mv
      JOIN directory_listings_list dsl ON dsl.tenant_id = mv.tenant_id
      WHERE ${whereClause}
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
        hasVariants: row.is_variant,
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
        metadata: row.product_metadata,
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
    
    // Apply merchant diversification for better randomness
    const diversifiedProducts = diversifyByMerchant(products, limitNum);
    
    const responseData = {
      products: diversifiedProducts,
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
