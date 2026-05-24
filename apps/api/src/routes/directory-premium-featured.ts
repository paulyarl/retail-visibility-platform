import { Router } from 'express';
import { getDirectPool } from '../utils/db-pool';
import CacheService, { CacheKeys, CACHE_TTL } from '../lib/cache-service';
import { TIER_FEATURED_ACCESS_CTE, TIER_FEATURED_ACCESS_JOIN, TIER_FEATURED_ACCESS_WHERE, TENANT_PREFS_JOIN, TENANT_PREFS_WHERE } from '../utils/tier-capability-sql';

const router = Router();

/**
 * Advanced merchant diversification using JavaScript utilities
 * Ensures products are distributed across different merchants rather than grouped
 */
function diversifyByMerchant(products: any[], limit: number): any[] {
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
    // Fisher-Yates shuffle for each merchant's products
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
      const productIndex = diversified.length + merchantIndex;
      
      if (productIndex < merchantProducts.length) {
        diversified.push(merchantProducts[productIndex]);
        allMerchantsExhausted = false;
      }
    }
    
    merchantIndex++;
  }
  
  // If we still need more products to reach the limit, fill with remaining products
  if (diversified.length < limit) {
    const remainingProducts = products.filter(p => !diversified.includes(p));
    // Shuffle remaining products
    for (let i = remainingProducts.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [remainingProducts[i], remainingProducts[j]] = [remainingProducts[j], remainingProducts[i]];
    }
    // Add remaining products up to the limit
    diversified.push(...remainingProducts.slice(0, limit - diversified.length));
  }
  
  return diversified.slice(0, limit);
}

// GET /api/directory/premium-featured-products
// Returns premium featured products with merchant diversification
router.get('/', async (req, res) => {
  try {
    const { limit = '20', type, _t } = req.query;
    
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string) || 20));
    
    // Check for cache-busting parameter
    const useCache = !_t;
    
    // Generate cache key
    const cacheBustingSuffix = _t ? `_cb_${_t}` : '';
    const cacheKey = `premium-featured-products:${type || 'all'}:${limit}${cacheBustingSuffix}`;
    
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
    let queryParams: any[] = [limitNum * 3]; // Get more products for diversification
    
    // Build query for premium featured types only
    const premiumTypes = ['trending', 'recommended', 'bestseller', 'random_featured'];
    let whereConditions = [
      'mgd.is_actively_featured = true',
      'mgd.has_image = true',
      'mgd.in_stock = true'
    ];
    
    if (type && typeof type === 'string' && premiumTypes.includes(type)) {
      whereConditions.push(`mgd.featured_type = $${queryParams.length + 1}`);
      queryParams.push(type);
    } else {
      // Get all premium types
      whereConditions.push(`mgd.featured_type IN ('${premiumTypes.join("','")}')`);
    }
    
    // Tier-capability-aware query: only return featured types allowed by each tenant's tier
    query = `
      WITH ${TIER_FEATURED_ACCESS_CTE}
      SELECT 
        mgd.inventory_item_id as id,
        mgd.tenant_id,
        mgd.sku,
        mgd.product_name as name,
        mgd.product_title as title,
        mgd.product_description as description,
        mgd.list_price_cents as price_cents,
        mgd.sale_price_cents,
        mgd.stock,
        mgd.image_url,
        mgd.brand,
        mgd.item_status,
        mgd.availability,
        mgd.product_category as category_name,
        mgd.product_category_slug as category_slug,
        mgd.product_google_category_id as google_category_id,
        mgd.has_gallery,
        mgd.has_description,
        mgd.has_brand,
        mgd.has_price,
        mgd.has_active_payment_gateway,
        mgd.default_gateway_type,
        mgd.featured_type,
        mgd.featured_priority,
        mgd.featured_at,
        mgd.featured_until as featured_expires_at,
        mgd.is_actively_featured as is_featured_active,
        mgd.created_at,
        mgd.updated_at,
        mgd.tenant_slug as store_slug,
        mgd.tenant_name as store_name,
        mgd.tenant_logo_url as store_logo,
        mgd.tenant_city as store_city,
        mgd.tenant_state as store_state,
        -- Type-specific metrics
        CASE 
          WHEN mgd.featured_type = 'trending' THEN mgd.trending_score
          WHEN mgd.featured_type = 'recommended' THEN mgd.product_average_rating
          WHEN mgd.featured_type = 'bestseller' THEN mgd.units_sold::numeric
          ELSE NULL
        END as score,
        mgd.product_average_rating as rating,
        mgd.units_sold as sales,
        -- Dynamic trending score for random_featured
        CASE 
          WHEN mgd.featured_type = 'random_featured' THEN mgd.trending_score
          ELSE NULL
        END as random_score
      FROM mv_global_discovery mgd
      ${TIER_FEATURED_ACCESS_JOIN}
      ${TENANT_PREFS_JOIN}
      WHERE ${whereConditions.join(' AND ')}
        ${TIER_FEATURED_ACCESS_WHERE}
        ${TENANT_PREFS_WHERE}
      ORDER BY 
        CASE 
          WHEN mgd.featured_type = 'trending' THEN mgd.trending_score
          WHEN mgd.featured_type = 'recommended' THEN (mgd.product_average_rating * 100 + mgd.product_reviews_count_live)
          WHEN mgd.featured_type = 'bestseller' THEN mgd.units_sold
          WHEN mgd.featured_type = 'random_featured' THEN RANDOM()
          ELSE 0
        END DESC
      LIMIT $1
    `;
    
    const result = await pool.query(query, queryParams);
    
    // Transform to match expected structure
    let products = result.rows.map((row: any) => ({
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
      featuredTypes: row.featured_type ? [row.featured_type] : [],
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
      // Type-specific metrics
      score: row.score ? parseFloat(row.score) : undefined,
      rating: row.rating ? parseFloat(row.rating) : undefined,
      sales: row.sales ? parseInt(row.sales) : undefined
    }));
    
    // Apply merchant diversification for better randomness
    products = diversifyByMerchant(products, limitNum);
    
    // Get total count
    const countQuery = `
      WITH ${TIER_FEATURED_ACCESS_CTE}
      SELECT COUNT(*) as total
      FROM mv_global_discovery mgd
      ${TIER_FEATURED_ACCESS_JOIN}
      ${TENANT_PREFS_JOIN}
      WHERE ${whereConditions.join(' AND ')}
        ${TIER_FEATURED_ACCESS_WHERE}
        ${TENANT_PREFS_WHERE}
    `;
    
    const countResult = await pool.query(countQuery, queryParams.slice(0, -1));
    const totalCount = parseInt(countResult.rows[0].total);
    
    const responseData = {
      products,
      pagination: {
        currentPage: 1,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
        hasNext: limitNum < totalCount,
        hasPrev: false
      },
      filters: {
        type: type || 'all',
        premiumTypes
      },
      refreshed_at: new Date().toISOString()
    };
    
    // Cache the response (unless cache-busting)
    if (useCache) {
      await CacheService.set(cacheKey, responseData, CACHE_TTL.FEATURED_PRODUCTS);
    }
    
    return res.json(responseData);

  } catch (error) {
    console.error('[GET /api/directory/premium-featured-products] Error:', error);
    return res.status(500).json({
      error: 'Failed to fetch premium featured products',
      details: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

export default router;
