/**
 * Directory Random Featured Products Global API Route
 * 
 * Returns random featured products from ALL stores in a single query
 * Uses mv_global_discovery for optimal performance
 */

import { Router, Request, Response } from 'express';
import { TIER_FEATURED_ACCESS_CTE, TIER_FEATURED_ACCESS_JOIN, TIER_FEATURED_ACCESS_WHERE, TENANT_PREFS_JOIN, TENANT_PREFS_WHERE } from '../utils/tier-capability-sql';

const router = Router();

interface QueryParams {
  limit?: string;
  lat?: string;
  lng?: string;
  radius?: string;
}

// Get random featured products from ALL stores
router.get('/random-featured-global', async (req: Request, res: Response) => {
  try {
    const params = req.query as QueryParams;
    const limit = Math.min(parseInt(params.limit || '20'), 100); // Cap at 100
    const lat = params.lat ? parseFloat(params.lat) : null;
    const lng = params.lng ? parseFloat(params.lng) : null;
    const radius = params.radius ? parseFloat(params.radius) : 50; // 50km default radius

    const { getDirectPool } = await import('../utils/db-pool');
    const pool = getDirectPool();

    const hasLocation = lat !== null && lng !== null;

    // Build location-dependent SQL fragments only when coordinates are provided
    // This avoids "could not determine data type of parameter $2" when no location
    const locationFilter = hasLocation ? `
        AND (
          tenant_latitude IS NOT NULL 
          AND tenant_longitude IS NOT NULL
          AND (
            6371 * acos(
              least(1.0, cos(radians($2)) * cos(radians(tenant_latitude)) * 
              cos(radians(tenant_longitude) - radians($3)) + 
              sin(radians($2)) * sin(radians(tenant_latitude)))
            ) <= $4
          )
        )
      ` : '';

    const distanceColumn = hasLocation ? `
          6371 * acos(
            least(1.0, cos(radians($2)) * cos(radians(tenant_latitude)) * 
            cos(radians(tenant_longitude) - radians($3)) + 
            sin(radians($2)) * sin(radians(tenant_latitude)))
          ) as distanceKm` : 'NULL::double precision as distanceKm';

    const locationOrder = hasLocation ? ', distanceKm' : '';

    // Tier-capability-aware query: JOIN against tier_features_list to ensure
    // the tenant's tier actually allows the featured_type before showing it.
    const query = `
      WITH ${TIER_FEATURED_ACCESS_CTE}
      SELECT * FROM (
        SELECT DISTINCT ON (inventory_item_id)
          inventory_item_id as id,
          tenant_id,
          sku,
          product_name as name,
          product_title as title,
          product_description as description,
          list_price_cents,
          sale_price_cents,
          stock,
          image_url,
          brand,
          item_status as availability,
          product_category,
          product_category_name_lower as categoryName,
          product_category_slug as categorySlug,
          tenant_name,
          tenant_slug,
          tenant_logo_url,
          featured_type,
          featured_type_array as featuredTypes,
          featured_priority,
          featured_at,
          featured_is_active,
          marketing_description,
          condition,
          gtin,
          mpn,
          currency,
          has_active_payment_gateway,
          default_gateway_type,
          ${distanceColumn}
        FROM mv_global_discovery mgd
        ${TIER_FEATURED_ACCESS_JOIN}
        ${TENANT_PREFS_JOIN}
        WHERE featured_is_active = true
          AND item_status = 'active'
          AND visibility = 'public'
          AND stock > 0
          ${TIER_FEATURED_ACCESS_WHERE}
          ${TENANT_PREFS_WHERE}
          ${locationFilter}
        ORDER BY 
          inventory_item_id,
          featured_priority DESC
      ) deduped
      ORDER BY RANDOM()${locationOrder}
      LIMIT $1
    `;

    const queryParams = hasLocation ? [limit, lat, lng, radius] : [limit];
    const result = await pool.query(query, queryParams);

    // Transform to match frontend expected format (flat structure like old endpoint)
    const products = result.rows.map(row => ({
      id: row.id,
      tenantId: row.tenant_id,
      sku: row.sku,
      name: row.name,
      title: row.title || row.name,
      description: row.description,
      brand: row.brand || '',
      priceCents: row.list_price_cents,
      salePriceCents: row.sale_price_cents,
      stock: row.stock,
      imageUrl: row.image_url,
      availability: row.availability || 'in_stock',
      categoryName: row.categoryName,
      categorySlug: row.categorySlug,
      featuredType: row.featured_type,
      featuredTypes: row.featured_types ? (typeof row.featured_types === 'string' ? JSON.parse(row.featured_types) : row.featured_types) : [],
      featuredPriority: row.featured_priority,
      featuredAt: row.featured_at,
      // Flat structure for store info (matches old endpoint format)
      storeId: row.tenant_id,
      storeName: row.tenant_name,
      storeSlug: row.tenant_slug,
      storeLogo: row.tenant_logo_url,
      storeCity: null, // Not available in MV
      storeState: null, // Not available in MV
      storeCategory: null, // Not available in MV
      distanceKm: row.distancekm,
      hasActivePaymentGateway: row.has_active_payment_gateway,
      defaultGatewayType: row.default_gateway_type,
      hasVariants: false,
      hasGallery: false,
      hasDescription: !!row.description,
      hasBrand: !!row.brand,
      hasPrice: true,
      updatedAt: new Date().toISOString()
    }));

    res.json({
      success: true,
      data: {
        products,
        total: products.length,
        location: lat && lng ? { lat, lng, radius } : null
      }
    });

  } catch (error) {
    console.error('Error in directory-random-featured-global:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch random featured products'
    });
  }
});

export default router;
