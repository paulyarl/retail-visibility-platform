/**
 * Smart Sale Tagging API Routes
 * 
 * Provides endpoints for managing and monitoring smart sale tagging functionality.
 * The MV automatically tags products with 'sale' featured type when they have sale prices.
 */

import { Router, Request, Response } from 'express';
import { getDirectPool } from '../utils/db-pool';
import { requireAuth } from '../middleware/auth';
import { logger } from '../logger';
import refreshSmartSaleMV from '../scripts/refresh-smart-sale-mv';

const router = Router();

/**
 * GET /api/smart-sale-tagging/stats
 * Get statistics about smart sale tagging
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const pool = getDirectPool();
    
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total_products,
        COUNT(CASE WHEN is_on_sale = true THEN 1 END) as sale_products,
        COUNT(CASE WHEN auto_tagged_as_sale = true THEN 1 END) as auto_tagged_sales,
        COUNT(CASE WHEN featured_type = 'sale' THEN 1 END) as sale_featured,
        COUNT(CASE WHEN featured_type = 'sale' AND auto_tagged_as_sale = true THEN 1 END) as auto_sale_featured,
        ROUND(AVG(CASE WHEN discount_percentage > 0 THEN discount_percentage END), 2) as avg_discount,
        MAX(CASE WHEN discount_percentage > 0 THEN discount_percentage END) as max_discount,
        MIN(CASE WHEN discount_percentage > 0 THEN discount_percentage END) as min_discount
      FROM storefront_products_mv
    `);
    
    // Tenant breakdown
    const tenantStats = await pool.query(`
      SELECT 
        tenant_id,
        COUNT(*) as total_products,
        COUNT(CASE WHEN is_on_sale = true THEN 1 END) as sale_products,
        COUNT(CASE WHEN auto_tagged_as_sale = true THEN 1 END) as auto_tagged_sales,
        ROUND(AVG(CASE WHEN discount_percentage > 0 THEN discount_percentage END), 2) as avg_discount
      FROM storefront_products_mv
      GROUP BY tenant_id
      ORDER BY sale_products DESC
      LIMIT 10
    `);
    
    const data = stats.rows[0];
    
    res.json({
      success: true,
      stats: {
        total_products: parseInt(data.total_products),
        sale_products: parseInt(data.sale_products),
        auto_tagged_sales: parseInt(data.auto_tagged_sales),
        sale_featured: parseInt(data.sale_featured),
        auto_sale_featured: parseInt(data.auto_sale_featured),
        avg_discount: parseFloat(data.avg_discount) || 0,
        max_discount: parseInt(data.max_discount) || 0,
        min_discount: parseInt(data.min_discount) || 0,
        sale_percentage: data.total_products > 0 
          ? Math.round((parseInt(data.sale_products) / parseInt(data.total_products)) * 100)
          : 0,
        auto_tag_percentage: parseInt(data.sale_products) > 0
          ? Math.round((parseInt(data.auto_tagged_sales) / parseInt(data.sale_products)) * 100)
          : 0
      },
      tenant_breakdown: tenantStats.rows.map(row => ({
        tenant_id: row.tenant_id,
        total_products: parseInt(row.total_products),
        sale_products: parseInt(row.sale_products),
        auto_tagged_sales: parseInt(row.auto_tagged_sales),
        avg_discount: parseFloat(row.avg_discount) || 0
      }))
    });
    
  } catch (error: any) {
    logger.error('[SMART SALE TAGGING] Stats error:', undefined, { error: { name: 'Error', message: String(error) } });
    res.status(500).json({
      success: false,
      error: 'stats_fetch_failed',
      message: 'Failed to fetch smart sale tagging stats',
      details: error.message
    });
  }
});

/**
 * POST /api/smart-sale-tagging/refresh
 * Manually refresh the smart sale tagging MV
 */
router.post('/refresh', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Only allow platform admins or tenant admins to refresh
    if (user.role !== 'PLATFORM_ADMIN' && user.role !== 'TENANT_ADMIN' && user.role !== 'TENANT_OWNER') {
      return res.status(403).json({
        success: false,
        error: 'insufficient_permissions',
        message: 'Only admins can refresh smart sale tagging'
      });
    }
    
    logger.info('[SMART SALE TAGGING] Manual refresh triggered by user', { 
      userId: user.userId,
      region: user.region || 'unknown'
    }, user);
    
    await refreshSmartSaleMV();
    
    res.json({
      success: true,
      message: 'Smart sale tagging materialized view refreshed successfully'
    });
    
  } catch (error: any) {
    logger.error('[SMART SALE TAGGING] Refresh error:', undefined, { error: { name: 'Error', message: String(error) } });
    res.status(500).json({
      success: false,
      error: 'refresh_failed',
      message: 'Failed to refresh smart sale tagging',
      details: error.message
    });
  }
});

/**
 * GET /api/smart-sale-tagging/products
 * Get products with smart sale tagging information
 */
router.get('/products', requireAuth, async (req: Request, res: Response) => {
  try {
    const { 
      tenant_id, 
      auto_tagged_only = 'false',
      limit = '50',
      offset = '0'
    } = req.query;
    
    const pool = getDirectPool();
    
    let whereClause = 'WHERE is_on_sale = true';
    const params: any[] = [];
    let paramIndex = 1;
    
    if (tenant_id) {
      whereClause += ` AND tenant_id = $${paramIndex++}`;
      params.push(tenant_id);
    }
    
    if (auto_tagged_only === 'true') {
      whereClause += ` AND auto_tagged_as_sale = true`;
    }
    
    const query = `
      SELECT 
        id,
        tenant_id,
        sku,
        name,
        price_cents,
        sale_price_cents,
        discount_percentage,
        featured_type,
        auto_tagged_as_sale,
        is_featured_active,
        featured_at,
        stock,
        image_url
      FROM storefront_products_mv
      ${whereClause}
      ORDER BY discount_percentage DESC, featured_priority DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    params.push(parseInt(limit as string), parseInt(offset as string));
    
    const result = await pool.query(query, params);
    
    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total
      FROM storefront_products_mv
      ${whereClause}
    `;
    
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    
    res.json({
      success: true,
      products: result.rows.map(row => ({
        id: row.id,
        tenant_id: row.tenant_id,
        sku: row.sku,
        name: row.name,
        price_cents: row.price_cents,
        sale_price_cents: row.sale_price_cents,
        discount_percentage: parseFloat(row.discount_percentage),
        featured_type: row.featured_type,
        auto_tagged_as_sale: row.auto_tagged_as_sale,
        is_featured_active: row.is_featured_active,
        featured_at: row.featured_at,
        stock: row.stock,
        image_url: row.image_url
      })),
      pagination: {
        total: parseInt(countResult.rows[0].total),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        has_more: parseInt(offset as string) + parseInt(limit as string) < parseInt(countResult.rows[0].total)
      }
    });
    
  } catch (error: any) {
    logger.error('[SMART SALE TAGGING] Products error:', undefined, { error: { name: 'Error', message: String(error) } });
    res.status(500).json({
      success: false,
      error: 'products_fetch_failed',
      message: 'Failed to fetch smart sale tagged products',
      details: error.message
    });
  }
});

/**
 * GET /api/smart-sale-tagging/health
 * Health check for smart sale tagging system
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const pool = getDirectPool();
    
    // Check if MV exists and is accessible
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM storefront_products_mv
      LIMIT 1
    `);
    
    const lastRefresh = await pool.query(`
      SELECT schemaname, matviewname, last_refresh
      FROM pg_stat_user_mviews
      WHERE matviewname = 'storefront_products_mv'
    `);
    
    const isHealthy = result.rows.length > 0;
    const lastRefreshTime = lastRefresh.rows[0]?.last_refresh;
    
    res.json({
      success: true,
      healthy: isHealthy,
      last_refresh: lastRefreshTime,
      message: isHealthy 
        ? 'Smart sale tagging system is healthy' 
        : 'Smart sale tagging system is unhealthy'
    });
    
  } catch (error: any) {
    logger.error('[SMART SALE TAGGING] Health check error:', undefined, { error: { name: 'Error', message: String(error) } });
    res.status(500).json({
      success: false,
      healthy: false,
      error: 'health_check_failed',
      message: 'Smart sale tagging health check failed'
    });
  }
});

export default router;
