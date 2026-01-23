/**
 * Enhanced Directory Categories API
 * Aggregates category data across all stores using storefront_category_counts MV
 * Provides rich insights for directory browsing
 */

import { Router, Request, Response } from 'express';
import { getDirectPool } from '../utils/db-pool';

const router = Router();

/**
 * GET /api/directory/categories-enhanced
 * Get category statistics across all stores for directory browsing
 * Uses storefront_category_counts materialized view for performance
 */
router.get('/categories-enhanced', async (req: Request, res: Response) => {
  try {
    // Aggregate category data across all stores
    const query = `
      SELECT
        dc.name as category_name,
        dc.slug as category_slug,
        dc."googleCategoryId" as google_category_id,
        COUNT(DISTINCT scc.tenant_id) as store_count,
        SUM(scc.product_count) as total_products,
        SUM(scc.in_stock_products) as total_in_stock,
        AVG(scc.avg_price_cents) as avg_price_cents,
        MIN(scc.min_price_cents) as min_price_cents,
        MAX(scc.max_price_cents) as max_price_cents,
        SUM(scc.products_with_images) as total_with_images,
        SUM(scc.products_with_descriptions) as total_with_descriptions,
        SUM(scc.products_with_brand) as total_with_brand,
        SUM(scc.products_with_price) as total_with_price,
        MAX(scc.last_product_updated) as latest_product_update
      FROM storefront_category_counts scc
      JOIN directory_category dc ON dc.id = scc.category_id
      WHERE scc.category_id IS NOT NULL
        AND scc.product_count > 0
      GROUP BY dc.name, dc.slug, dc."googleCategoryId"
      HAVING COUNT(DISTINCT scc.tenant_id) > 0
      ORDER BY store_count DESC, total_products DESC
    `;

    const result = await getDirectPool().query(query);

    const categories = result.rows.map((row: any) => ({
      name: row.category_name,
      slug: row.category_slug,
      googleCategoryId: row.google_category_id,
      storeCount: parseInt(row.store_count),
      totalProducts: parseInt(row.total_products),
      totalInStock: parseInt(row.total_in_stock),
      avgPriceCents: parseFloat(row.avg_price_cents) || 0,
      minPriceCents: row.min_price_cents,
      maxPriceCents: row.max_price_cents,
      totalWithImages: parseInt(row.total_with_images),
      totalWithDescriptions: parseInt(row.total_with_descriptions),
      totalWithBrand: parseInt(row.total_with_brand),
      totalWithPrice: parseInt(row.total_with_price),
      latestProductUpdate: row.latest_product_update,
      // Derived metrics
      avgProductsPerStore: Math.round(parseInt(row.total_products) / parseInt(row.store_count)),
      stockLevel: parseInt(row.total_in_stock) / parseInt(row.total_products), // 0-1 ratio
      imageCoverage: parseInt(row.total_with_images) / parseInt(row.total_products), // 0-1 ratio
      priceRange: {
        min: row.min_price_cents ? row.min_price_cents / 100 : 0,
        max: row.max_price_cents ? row.max_price_cents / 100 : 0,
        avg: (parseFloat(row.avg_price_cents) || 0) / 100
      }
    }));

    // Get overall statistics
    const statsQuery = `
      SELECT
        COUNT(DISTINCT tenant_id) as total_stores,
        SUM(product_count) as total_products,
        SUM(in_stock_products) as total_in_stock,
        COUNT(DISTINCT category_id) as total_categories
      FROM storefront_category_counts
      WHERE category_id IS NOT NULL
    `;

    const statsResult = await getDirectPool().query(statsQuery);
    const stats = statsResult.rows[0];

    return res.json({
      categories,
      stats: {
        totalStores: parseInt(stats.total_stores),
        totalProducts: parseInt(stats.total_products),
        totalInStock: parseInt(stats.total_in_stock),
        totalCategories: parseInt(stats.total_categories),
        overallStockLevel: parseInt(stats.total_in_stock) / parseInt(stats.total_products)
      }
    });
  } catch (error) {
    console.error('Enhanced directory categories error:', error);
    return res.status(500).json({ error: 'failed_to_get_categories' });
  }
});

/**
 * GET /api/directory/categories-enhanced/:slug
 * Get detailed information for a specific category across all stores
 */
router.get('/categories-enhanced/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    
    // Get category details and stores in this category
    const query = `
      SELECT
        dc.name as category_name,
        dc.slug as category_slug,
        dc."googleCategoryId" as google_category_id,
        scc.tenant_id,
        t.name as tenant_name,
        scc.product_count,
        scc.in_stock_products,
        scc.avg_price_cents,
        scc.min_price_cents,
        scc.max_price_cents,
        scc.products_with_images,
        scc.products_with_descriptions,
        scc.last_product_updated
      FROM storefront_category_counts scc
      JOIN directory_category dc ON dc.id = scc.category_id
      JOIN tenants t ON t.id = scc.tenant_id
      WHERE dc.slug = $1
        AND scc.category_id IS NOT NULL
        AND scc.product_count > 0
      ORDER BY scc.product_count DESC, scc.in_stock_products DESC
    `;

    const result = await getDirectPool().query(query, [slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'category_not_found' });
    }

    const categoryInfo = {
      name: result.rows[0].category_name,
      slug: result.rows[0].category_slug,
      googleCategoryId: result.rows[0].google_category_id,
      storeCount: result.rows.length,
      totalProducts: result.rows.reduce((sum, row) => sum + parseInt(row.product_count), 0),
      totalInStock: result.rows.reduce((sum, row) => sum + parseInt(row.in_stock_products), 0),
      avgPriceCents: result.rows.reduce((sum, row) => sum + parseFloat(row.avg_price_cents), 0) / result.rows.length,
      stores: result.rows.map((row: any) => ({
        tenantId: row.tenant_id,
        tenantName: row.tenant_name,
        productCount: parseInt(row.product_count),
        inStockProducts: parseInt(row.in_stock_products),
        avgPriceCents: parseFloat(row.avg_price_cents),
        minPriceCents: row.min_price_cents,
        maxPriceCents: row.max_price_cents,
        productsWithImages: parseInt(row.products_with_images),
        productsWithDescriptions: parseInt(row.products_with_descriptions),
        lastProductUpdated: row.last_product_updated
      }))
    };

    return res.json(categoryInfo);
  } catch (error) {
    console.error('Enhanced category details error:', error);
    return res.status(500).json({ error: 'failed_to_get_category_details' });
  }
});

export default router;
