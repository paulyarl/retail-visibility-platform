/**
 * Admin Inventory Stats Routes
 * 
 * Platform-wide inventory statistics and analytics
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, requirePlatformAdmin } from '../../middleware/auth';
import { prisma } from '../../prisma';

const router = Router();

// All routes require platform admin authentication
router.use(authenticateToken);
router.use(requirePlatformAdmin);

/**
 * GET /api/admin/inventory/stats
 * Get platform-wide inventory statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Get basic counts
    const [
      totalTenants,
      totalLocations,
      totalSKUs,
      lowStockItems,
      pendingTransfers,
      completedTransfersToday
    ] = await Promise.all([
      prisma.tenants.count(),
      prisma.tenants.count({ where: { location_status: 'active' } }),
      prisma.inventory_items.count({ where: { item_status: 'active' } }),
      prisma.inventory_items.count({
        where: {
          item_status: 'active',
          stock: { lte: 5 }
        }
      }),
      prisma.inventory_transfers.count({ where: { status: 'pending' } }),
      prisma.inventory_transfers.count({
        where: {
          status: 'received',
          updated_at: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);

    // Get total inventory value
    const inventoryValue = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COALESCE(SUM(stock * price), 0) as total
      FROM inventory_items
      WHERE item_status = 'active'
    `;

    // Get in-transit items count
    const inTransitItems = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COALESCE(SUM(in_transit_quantity), 0) as total
      FROM location_inventory_pools
    `;

    // Get top products by stock
    const topProducts = await prisma.$queryRaw<Array<{
      product_slug: string;
      name: string;
      total_stock: bigint;
    }>>`
      SELECT 
        product_slug,
        name,
        SUM(stock) as total_stock
      FROM inventory_items
      WHERE item_status = 'active' AND product_slug IS NOT NULL
      GROUP BY product_slug, name
      ORDER BY total_stock DESC
      LIMIT 10
    `;

    // Get category distribution
    const categoryDistribution = await prisma.$queryRaw<Array<{
      category: string;
      product_count: bigint;
      total_stock: bigint;
    }>>`
      SELECT 
        category_path[1] as category,
        COUNT(DISTINCT product_slug) as product_count,
        SUM(stock) as total_stock
      FROM inventory_items
      WHERE item_status = 'active' AND array_length(category_path, 1) > 0
      GROUP BY category_path[1]
      ORDER BY total_stock DESC
      LIMIT 20
    `;

    res.json({
      totalTenants,
      totalLocations,
      totalSKUs,
      totalInventoryValue: Number(inventoryValue[0]?.total || 0),
      lowStockItems,
      inTransitItems: Number(inTransitItems[0]?.total || 0),
      pendingTransfers,
      completedTransfersToday,
      topProductsByStock: topProducts.map(p => ({
        product_slug: p.product_slug,
        name: p.name,
        total_stock: Number(p.total_stock)
      })),
      categoryDistribution: categoryDistribution.map(c => ({
        category: c.category,
        product_count: Number(c.product_count),
        total_stock: Number(c.total_stock)
      }))
    });
  } catch (error) {
    console.error('[AdminInventoryStats] Error getting stats:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get inventory stats' });
  }
});

/**
 * GET /api/admin/inventory/by-tenant
 * Get inventory breakdown by tenant
 */
router.get('/by-tenant', async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const tenants = await prisma.$queryRaw<Array<{
      tenant_id: string;
      tenant_name: string;
      total_locations: bigint;
      total_skus: bigint;
      total_inventory_value: bigint;
      low_stock_items: bigint;
      pending_transfers: bigint;
    }>>`
      SELECT 
        t.id as tenant_id,
        t.name as tenant_name,
        COUNT(DISTINCT tl.id) as total_locations,
        COUNT(DISTINCT ii.sku) as total_skus,
        COALESCE(SUM(ii.stock * ii.price), 0) as total_inventory_value,
        COUNT(CASE WHEN ii.stock <= 5 THEN 1 END) as low_stock_items,
        COUNT(DISTINCT CASE WHEN it.status = 'pending' THEN it.id END) as pending_transfers
      FROM tenants t
      LEFT JOIN tenant_locations tl ON tl.tenant_id = t.id AND tl.is_active = true
      LEFT JOIN inventory_items ii ON ii.tenant_id = t.id AND ii.item_status = 'active'
      LEFT JOIN inventory_transfers it ON it.tenant_id = t.id AND it.status = 'pending'
      GROUP BY t.id, t.name
      ORDER BY total_inventory_value DESC
      LIMIT ${limitNum}
      OFFSET ${offset}
    `;

    const totalResult = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM tenants
    `;

    res.json({
      data: tenants.map(t => ({
        tenant_id: t.tenant_id,
        tenant_name: t.tenant_name,
        total_locations: Number(t.total_locations),
        total_skus: Number(t.total_skus),
        total_inventory_value: Number(t.total_inventory_value),
        low_stock_items: Number(t.low_stock_items),
        pending_transfers: Number(t.pending_transfers)
      })),
      total: Number(totalResult[0]?.count || 0)
    });
  } catch (error) {
    console.error('[AdminInventoryStats] Error getting tenant breakdown:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get tenant breakdown' });
  }
});

/**
 * GET /api/admin/inventory/by-category
 * Get inventory distribution by category
 */
router.get('/by-category', async (req: Request, res: Response) => {
  try {
    const categories = await prisma.$queryRaw<Array<{
      category: string;
      product_count: bigint;
      total_stock: bigint;
    }>>`
      SELECT 
        category_path[1] as category,
        COUNT(DISTINCT product_slug) as product_count,
        SUM(stock) as total_stock
      FROM inventory_items
      WHERE item_status = 'active' AND array_length(category_path, 1) > 0
      GROUP BY category_path[1]
      ORDER BY total_stock DESC
    `;

    res.json(categories.map(c => ({
      category: c.category,
      product_count: Number(c.product_count),
      total_stock: Number(c.total_stock)
    })));
  } catch (error) {
    console.error('[AdminInventoryStats] Error getting category distribution:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get category distribution' });
  }
});

/**
 * GET /api/admin/inventory/top-products
 * Get top products by adoption count
 */
router.get('/top-products', async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = parseInt(limit as string);

    const products = await prisma.$queryRaw<Array<{
      product_slug: string;
      name: string;
      brand: string | null;
      adoption_count: bigint;
      total_stock: bigint;
    }>>`
      SELECT 
        ii.product_slug,
        ii.name,
        ii.brand,
        COUNT(DISTINCT ii.tenant_id) as adoption_count,
        SUM(ii.stock) as total_stock
      FROM inventory_items ii
      WHERE ii.item_status = 'active' AND ii.product_slug IS NOT NULL
      GROUP BY ii.product_slug, ii.name, ii.brand
      ORDER BY adoption_count DESC
      LIMIT ${limitNum}
    `;

    res.json(products.map(p => ({
      product_slug: p.product_slug,
      name: p.name,
      brand: p.brand,
      adoption_count: Number(p.adoption_count),
      total_stock: Number(p.total_stock)
    })));
  } catch (error) {
    console.error('[AdminInventoryStats] Error getting top products:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get top products' });
  }
});

/**
 * GET /api/admin/inventory/geographic
 * Get inventory by geographic region
 */
router.get('/geographic', async (req: Request, res: Response) => {
  try {
    const locations = await prisma.$queryRaw<Array<{
      state: string;
      location_count: bigint;
      product_count: bigint;
      total_stock: bigint;
    }>>`
      SELECT 
        tbp.state,
        COUNT(DISTINCT tl.id) as location_count,
        COUNT(DISTINCT ii.product_slug) as product_count,
        SUM(ii.stock) as total_stock
      FROM tenant_locations tl
      JOIN tenant_business_profiles_list tbp ON tbp.tenant_id = tl.tenant_id
      LEFT JOIN inventory_items ii ON ii.tenant_id = tl.tenant_id AND ii.location_id = tl.id AND ii.item_status = 'active'
      WHERE tl.is_active = true AND tbp.state IS NOT NULL
      GROUP BY tbp.state
      ORDER BY total_stock DESC
    `;

    res.json(locations.map(l => ({
      state: l.state,
      location_count: Number(l.location_count),
      product_count: Number(l.product_count),
      total_stock: Number(l.total_stock)
    })));
  } catch (error) {
    console.error('[AdminInventoryStats] Error getting geographic distribution:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get geographic distribution' });
  }
});

export default router;
