/**
 * Cross-Tenant Product Routes
 * Leverage product_slug for cross-tenant product discovery and analytics
 */

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

/**
 * GET /api/cross-tenant/products/:productSlug
 * Find all stores carrying the same product (by product_slug)
 * Enables "Available Nearby" feature for shoppers
 */
router.get('/products/:productSlug', async (req: Request, res: Response) => {
  try {
    const { productSlug } = req.params;
    const { 
      excludeTenantId, 
      latitude, 
      longitude, 
      radius = 50,
      limit = 20 
    } = req.query;

    // Query mv_storefront_discovery for all instances of this product
    const products = await prisma.$queryRaw`
      SELECT 
        mgd.inventory_item_id,
        mgd.product_slug,
        mgd.product_name,
        mgd.product_title,
        mgd.brand_normalized,
        mgd.category_normalized,
        mgd.list_price_cents,
        mgd.current_price_cents,
        mgd.is_on_sale,
        mgd.discount_percentage,
        mgd.stock,
        mgd.in_stock,
        mgd.image_url,
        mgd.tenant_id,
        mgd.tenant_name,
        mgd.tenant_slug,
        mgd.tenant_city,
        mgd.tenant_state,
        mgd.tenant_latitude,
        mgd.tenant_longitude,
        mgd.store_average_rating,
        mgd.store_review_count,
        mgd.platform_tenant_count,
        mgd.platform_total_stock,
        -- Distance calculation if coordinates provided
        CASE 
          WHEN ${latitude}::float IS NOT NULL AND ${longitude}::float IS NOT NULL
          THEN (
            6371 * acos(
              cos(radians(${latitude}::float)) * cos(radians(mgd.tenant_latitude::float)) *
              cos(radians(mgd.tenant_longitude::float) - radians(${longitude}::float)) +
              sin(radians(${latitude}::float)) * sin(radians(mgd.tenant_latitude::float))
            )
          )
          ELSE NULL
        END as distance_km
      FROM mv_storefront_discovery mgd
      WHERE mgd.product_slug = ${productSlug}
        AND mgd.item_status = 'active'
        AND mgd.visibility = 'public'
        AND (${excludeTenantId}::text IS NULL OR mgd.tenant_id != ${excludeTenantId}::text)
      ORDER BY 
        CASE 
          WHEN ${latitude}::float IS NOT NULL AND ${longitude}::float IS NOT NULL
          THEN (
            6371 * acos(
              cos(radians(${latitude}::float)) * cos(radians(mgd.tenant_latitude::float)) *
              cos(radians(mgd.tenant_longitude::float) - radians(${longitude}::float)) +
              sin(radians(${latitude}::float)) * sin(radians(mgd.tenant_latitude::float))
            )
          )
          ELSE mgd.list_price_cents
        END ASC
      LIMIT ${Number(limit)}
    `;

    // Filter by radius if coordinates provided
    const filteredProducts = radius && latitude && longitude
      ? (products as any[]).filter((p: any) => p.distance_km === null || p.distance_km <= Number(radius))
      : (products as any[]).slice(0, Number(limit));

    res.json({
      success: true,
      data: {
        product_slug: productSlug,
        total_stores: (products as any[]).length,
        nearby_stores: filteredProducts,
        products: filteredProducts
      }
    });
  } catch (error) {
    console.error('[CrossTenant] Error fetching products:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch cross-tenant products' 
    });
  }
});

/**
 * GET /api/cross-tenant/analytics/brands
 * Platform-wide brand performance analytics
 */
router.get('/analytics/brands', async (req: Request, res: Response) => {
  try {
    const { 
      limit = 20, 
      tier, 
      sortBy = 'total_revenue_cents',
      sortOrder = 'desc' 
    } = req.query;

    const brands = await prisma.$queryRaw`
      SELECT 
        brand,
        product_count,
        tenant_count,
        inventory_item_count,
        total_stock,
        avg_price_cents,
        min_price_cents,
        max_price_cents,
        total_views,
        total_purchases,
        total_revenue_cents,
        avg_store_rating,
        brand_tier,
        refreshed_at
      FROM mv_brand_performance
      WHERE (${tier}::text IS NULL OR brand_tier = ${tier}::text)
      ORDER BY ${sortBy} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}
      LIMIT ${Number(limit)}
    `;

    res.json({
      success: true,
      data: brands
    });
  } catch (error) {
    console.error('[CrossTenant] Error fetching brand analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch brand analytics' 
    });
  }
});

/**
 * GET /api/cross-tenant/analytics/categories
 * Platform-wide category performance analytics
 */
router.get('/analytics/categories', async (req: Request, res: Response) => {
  try {
    const { 
      limit = 20, 
      tier, 
      sortBy = 'total_revenue_cents',
      sortOrder = 'desc' 
    } = req.query;

    const categories = await prisma.$queryRaw`
      SELECT 
        category,
        product_count,
        tenant_count,
        inventory_item_count,
        total_stock,
        avg_price_cents,
        total_views,
        total_purchases,
        total_revenue_cents,
        category_tier,
        refreshed_at
      FROM mv_category_trends
      WHERE (${tier}::text IS NULL OR category_tier = ${tier}::text)
        AND category != ''
      ORDER BY ${sortBy} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}
      LIMIT ${Number(limit)}
    `;

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('[CrossTenant] Error fetching category analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch category analytics' 
    });
  }
});

/**
 * GET /api/cross-tenant/analytics/products
 * Platform-wide product performance analytics
 */
router.get('/analytics/products', async (req: Request, res: Response) => {
  try {
    const { 
      limit = 20, 
      demandTier,
      priceTier,
      availabilityTier,
      brand,
      category,
      sortBy = 'tenant_adoption_count',
      sortOrder = 'desc' 
    } = req.query;

    const products = await prisma.$queryRaw`
      SELECT 
        product_slug,
        product_name,
        brand_normalized,
        category_normalized,
        slug_type,
        tenant_adoption_count,
        total_inventory_items,
        total_platform_stock,
        avg_platform_price_cents,
        min_platform_price_cents,
        max_platform_price_cents,
        total_views,
        total_unique_viewers,
        total_purchases,
        total_revenue_cents,
        avg_store_rating,
        total_reviews,
        demand_tier,
        availability_tier,
        price_tier,
        refreshed_at
      FROM mv_platform_product_analytics
      WHERE (${demandTier}::text IS NULL OR demand_tier = ${demandTier}::text)
        AND (${priceTier}::text IS NULL OR price_tier = ${priceTier}::text)
        AND (${availabilityTier}::text IS NULL OR availability_tier = ${availabilityTier}::text)
        AND (${brand}::text IS NULL OR brand_normalized = ${brand}::text)
        AND (${category}::text IS NULL OR category_normalized = ${category}::text)
      ORDER BY ${sortBy} ${sortOrder === 'asc' ? 'ASC' : 'DESC'}
      LIMIT ${Number(limit)}
    `;

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('[CrossTenant] Error fetching product analytics:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch product analytics' 
    });
  }
});

/**
 * GET /api/cross-tenant/trending
 * Platform-wide trending products (by product_slug, not inventory_item_id)
 */
router.get('/trending', async (req: Request, res: Response) => {
  try {
    const { 
      limit = 20,
      category,
      brand 
    } = req.query;

    const trending = await prisma.$queryRaw`
      SELECT 
        product_slug,
        product_name,
        brand_normalized,
        category_normalized,
        tenant_adoption_count,
        total_platform_stock,
        total_purchases,
        total_views,
        demand_tier,
        platform_trending_score,
        image_url,
        list_price_cents,
        current_price_cents
      FROM mv_trending_products
      WHERE item_status = 'active'
        AND visibility = 'public'
        AND (${category}::text IS NULL OR category_normalized = ${category}::text)
        AND (${brand}::text IS NULL OR brand_normalized = ${brand}::text)
      ORDER BY platform_trending_score DESC
      LIMIT ${Number(limit)}
    `;

    res.json({
      success: true,
      data: trending
    });
  } catch (error) {
    console.error('[CrossTenant] Error fetching trending products:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch trending products' 
    });
  }
});

/**
 * GET /api/cross-tenant/search
 * Search products across all tenants by normalized brand/category
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { 
      q,
      brand,
      category,
      limit = 20 
    } = req.query;

    if (!q && !brand && !category) {
      return res.status(400).json({
        success: false,
        error: 'At least one search parameter required (q, brand, or category)'
      });
    }

    const products = await prisma.$queryRaw`
      SELECT DISTINCT ON (product_slug)
        product_slug,
        product_name,
        brand_normalized,
        category_normalized,
        slug_type,
        tenant_adoption_count,
        total_platform_stock,
        avg_platform_price_cents,
        demand_tier,
        price_tier
      FROM mv_platform_product_analytics
      WHERE 
        (${q}::text IS NULL OR 
         product_name ILIKE '%' || ${q}::text || '%' OR
         brand_normalized ILIKE '%' || ${q}::text || '%' OR
         category_normalized ILIKE '%' || ${q}::text || '%')
        AND (${brand}::text IS NULL OR brand_normalized = ${brand}::text)
        AND (${category}::text IS NULL OR category_normalized = ${category}::text)
      ORDER BY product_slug, tenant_adoption_count DESC
      LIMIT ${Number(limit)}
    `;

    res.json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('[CrossTenant] Error searching products:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to search products' 
    });
  }
});

export default router;
