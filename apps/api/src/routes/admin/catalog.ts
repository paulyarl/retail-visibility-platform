/**
 * Admin Catalog Routes
 * 
 * Platform admin management for global product catalog
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { parseSlugToJSON } from '../../lib/slug-generator';
import { getDirectPool } from '../../utils/db-pool';

const router = Router();

// Auth: authenticateToken + requireAdmin applied at mount level in admin.routes.ts

/**
 * GET /api/admin/catalog/products
 * List all catalog products with filters
 */
router.get('/products', async (req: Request, res: Response) => {
  try {
    const {
      slugType,
      category,
      brand,
      status,
      source,
      search,
      hasUpc,
      page = '1',
      limit = '50',
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }
    if (source) {
      where.source = source;
    }
    if (brand) {
      where.brand = { equals: brand, mode: 'insensitive' };
    }
    if (category) {
      // Category filter - matches any category in the category_path array
      where.category_path = { has: category as string };
    }
    if (hasUpc === 'true') {
      where.gtin_upc = { not: null };
    } else if (hasUpc === 'false') {
      where.OR = [
        { gtin_upc: null },
        { gtin_upc: '' }
      ];
    }
    if (slugType) {
      // Filter by slug prefix (upc/lpc)
      where.product_slug = { startsWith: slugType === 'upc' ? 'upc_' : 'lpc_' };
    }
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { brand: { contains: search as string, mode: 'insensitive' } },
        { gtin_upc: { contains: search as string, mode: 'insensitive' } },
        { product_slug: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    // Build orderBy
    const orderBy: any = {};
    if (sortBy === 'adoption_count') {
      // Special handling for adoption count - would need aggregation
      orderBy.created_at = 'desc';
    } else {
      orderBy[sortBy as string] = sortOrder;
    }

    const [products, total] = await Promise.all([
      prisma.global_product_catalog.findMany({
        where,
        orderBy,
        skip: offset,
        take: limitNum
      }),
      prisma.global_product_catalog.count({ where })
    ]);

    res.json({
      data: products,
      total
    });
  } catch (error) {
    console.error('[AdminCatalog] Error listing products:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list catalog products' });
  }
});

/**
 * GET /api/admin/catalog/stats
 * Get catalog statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [
      totalProducts,
      upcProducts,
      lpcProducts,
      totalBrands,
      activeProducts,
      pendingProducts,
      merchantSourced,
      platformSourced,
      partnerSourced
    ] = await Promise.all([
      prisma.global_product_catalog.count(),
      prisma.global_product_catalog.count({ where: { product_slug: { startsWith: 'upc_' } } }),
      prisma.global_product_catalog.count({ where: { product_slug: { startsWith: 'lpc_' } } }),
      prisma.global_product_catalog.findMany({
        where: { brand: { not: null } },
        select: { brand: true },
        distinct: ['brand']
      }).then(r => r.length),
      prisma.global_product_catalog.count({ where: { status: 'active' } }),
      prisma.global_product_catalog.count({ where: { status: 'pending' } }),
      prisma.global_product_catalog.count({ where: { source: 'merchant' } }),
      prisma.global_product_catalog.count({ where: { source: 'platform' } }),
      prisma.global_product_catalog.count({ where: { source: 'partner' } })
    ]);

    // Get categories
    const productsWithCategories = await prisma.global_product_catalog.findMany({
      where: { category_path: { isEmpty: false } },
      select: { category_path: true }
    });
    const categorySet = new Set<string>();
    productsWithCategories.forEach(p => {
      p.category_path.forEach(c => categorySet.add(c));
    });

    // Get top adopted products via direct pool
    const pool = getDirectPool();
    const topAdoptedResult = await pool.query(`
      SELECT 
        gpc.product_slug,
        gpc.name,
        COUNT(psr.id) as adoption_count
      FROM global_product_catalog gpc
      LEFT JOIN product_slug_registry psr ON psr.product_slug = gpc.product_slug
      WHERE gpc.status = 'active'
      GROUP BY gpc.product_slug, gpc.name
      ORDER BY adoption_count DESC
      LIMIT 10
    `);

    res.json({
      totalProducts,
      upcProducts,
      lpcProducts,
      totalBrands,
      totalCategories: categorySet.size,
      activeProducts,
      pendingProducts,
      merchantSourced,
      platformSourced,
      partnerSourced,
      topAdoptedProducts: topAdoptedResult.rows.map((p: any) => ({
        product_slug: p.product_slug,
        name: p.name,
        adoption_count: Number(p.adoption_count)
      }))
    });
  } catch (error) {
    console.error('[AdminCatalog] Error getting stats:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get catalog stats' });
  }
});

/**
 * GET /api/admin/catalog/brands
 * Get all brands with product counts
 */
router.get('/brands', async (req: Request, res: Response) => {
  try {
    const pool = getDirectPool();
    const brandsResult = await pool.query(`
      SELECT 
        brand,
        COUNT(*) as product_count
      FROM global_product_catalog
      WHERE brand IS NOT NULL AND brand != ''
      GROUP BY brand
      ORDER BY product_count DESC
    `);

    res.json(brandsResult.rows.map((b: any) => ({
      brand: b.brand,
      product_count: Number(b.product_count)
    })));
  } catch (error) {
    console.error('[AdminCatalog] Error getting brands:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get brands' });
  }
});

/**
 * GET /api/admin/catalog/categories
 * Get all categories with product counts
 */
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const products = await prisma.global_product_catalog.findMany({
      where: { category_path: { isEmpty: false } },
      select: { category_path: true }
    });

    const categoryCounts = new Map<string, number>();
    products.forEach(p => {
      p.category_path.forEach(c => {
        categoryCounts.set(c, (categoryCounts.get(c) || 0) + 1);
      });
    });

    const categories = Array.from(categoryCounts.entries())
      .map(([category, product_count]) => ({ category, product_count }))
      .sort((a, b) => b.product_count - a.product_count);

    res.json(categories);
  } catch (error) {
    console.error('[AdminCatalog] Error getting categories:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get categories' });
  }
});

/**
 * GET /api/admin/catalog/products/:slug
 * Get product detail with registry entries
 */
router.get('/products/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const product = await prisma.global_product_catalog.findFirst({
      where: {
        OR: [
          { product_slug: slug },
          { id: slug }
        ]
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'not_found', message: 'Product not found' });
    }

    // Get registry entries with tenant names via raw query
    const registryEntries = await prisma.$queryRaw<Array<{
      id: string;
      tenant_id: string | null;
      original_sku: string | null;
      product_slug: string;
      created_at: Date;
      tenant_name: string | null;
    }>>`
      SELECT 
        psr.id,
        psr.tenant_id,
        psr.original_sku,
        psr.product_slug,
        psr.created_at,
        t.name as tenant_name
      FROM product_slug_registry psr
      LEFT JOIN tenants t ON t.id = psr.tenant_id
      WHERE psr.product_slug = ${product.product_slug}
    `;

    // Parse slug components
    let slugComponents = null;
    if (product.product_slug) {
      slugComponents = parseSlugToJSON(product.product_slug);
    }

    // Get availability count
    const availabilityCount = await prisma.inventory_items.count({
      where: {
        OR: [
          { gtin: product.gtin_upc },
          { product_slug: product.product_slug }
        ],
        item_status: 'active'
      }
    });

    res.json({
      ...product,
      registry_entries: registryEntries.map(e => ({
        tenant_id: e.tenant_id,
        tenant_name: e.tenant_name || 'Unknown',
        original_sku: e.original_sku,
        product_slug: e.product_slug,
        adopted_at: e.created_at
      })),
      adoption_count: registryEntries.length,
      availability_locations: availabilityCount,
      slug_components: slugComponents
    });
  } catch (error) {
    console.error('[AdminCatalog] Error getting product detail:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get product detail' });
  }
});

/**
 * GET /api/admin/catalog/products/upc/:upc
 * Get product by UPC
 */
router.get('/products/upc/:upc', async (req: Request, res: Response) => {
  try {
    const { upc } = req.params;

    const product = await prisma.global_product_catalog.findFirst({
      where: { gtin_upc: upc }
    });

    if (!product) {
      return res.status(404).json({ error: 'not_found', message: 'Product not found by UPC' });
    }

    const slug = product.product_slug;
    if (slug) {
      // Get registry entries with tenant names via raw query
      const registryEntries = await prisma.$queryRaw<Array<{
        id: string;
        tenant_id: string | null;
        original_sku: string | null;
        product_slug: string;
        created_at: Date;
        tenant_name: string | null;
      }>>`
        SELECT 
          psr.id,
          psr.tenant_id,
          psr.original_sku,
          psr.product_slug,
          psr.created_at,
          t.name as tenant_name
        FROM product_slug_registry psr
        LEFT JOIN tenants t ON t.id = psr.tenant_id
        WHERE psr.product_slug = ${slug}
      `;

      const slugComponents = parseSlugToJSON(slug);
      const availabilityCount = await prisma.inventory_items.count({
        where: {
          OR: [
            { gtin: product.gtin_upc },
            { product_slug: slug }
          ],
          item_status: 'active'
        }
      });

      return res.json({
        ...product,
        registry_entries: registryEntries.map(e => ({
          tenant_id: e.tenant_id,
          tenant_name: e.tenant_name || 'Unknown',
          original_sku: e.original_sku,
          product_slug: e.product_slug,
          adopted_at: e.created_at
        })),
        adoption_count: registryEntries.length,
        availability_locations: availabilityCount,
        slug_components: slugComponents
      });
    }

    res.json(product);
  } catch (error) {
    console.error('[AdminCatalog] Error getting product by UPC:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get product by UPC' });
  }
});

/**
 * GET /api/admin/catalog/search
 * Search catalog products
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { q, category, brand, status, page = '1', limit = '50' } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'missing_query', message: 'Search query is required' });
    }

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const where: any = {
      OR: [
        { name: { contains: q as string, mode: 'insensitive' } },
        { brand: { contains: q as string, mode: 'insensitive' } },
        { gtin_upc: { contains: q as string, mode: 'insensitive' } },
        { product_slug: { contains: q as string, mode: 'insensitive' } }
      ]
    };

    if (category) where.category_path = { has: category as string };
    if (brand) where.brand = { equals: brand, mode: 'insensitive' };
    if (status) where.status = status;

    const [products, total] = await Promise.all([
      prisma.global_product_catalog.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: offset,
        take: limitNum
      }),
      prisma.global_product_catalog.count({ where })
    ]);

    res.json({
      data: products,
      total
    });
  } catch (error) {
    console.error('[AdminCatalog] Error searching products:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to search products' });
  }
});

/**
 * PATCH /api/admin/catalog/products/:slug
 * Update a catalog product
 */
router.patch('/products/:slug', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { name, brand, category_path, status, description, images } = req.body;

    const product = await prisma.global_product_catalog.update({
      where: { product_slug: slug },
      data: {
        ...(name && { name }),
        ...(brand !== undefined && { brand }),
        ...(category_path && { category_path }),
        ...(status && { status }),
        ...(description !== undefined && { description }),
        ...(images && { images }),
        updated_at: new Date()
      }
    });

    res.json(product);
  } catch (error) {
    console.error('[AdminCatalog] Error updating product:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update product' });
  }
});

/**
 * POST /api/admin/catalog/products/:slug/approve
 * Approve a pending product
 */
router.post('/products/:slug/approve', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const product = await prisma.global_product_catalog.update({
      where: { product_slug: slug },
      data: { status: 'active', updated_at: new Date() }
    });

    res.json({ success: true, product });
  } catch (error) {
    console.error('[AdminCatalog] Error approving product:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to approve product' });
  }
});

/**
 * POST /api/admin/catalog/products/:slug/reject
 * Reject a pending product
 */
router.post('/products/:slug/reject', async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { reason } = req.body;

    const product = await prisma.global_product_catalog.update({
      where: { product_slug: slug },
      data: {
        status: 'inactive',
        catalog_metadata: {
          rejection_reason: reason,
          rejected_at: new Date().toISOString()
        },
        updated_at: new Date()
      }
    });

    res.json({ success: true, product });
  } catch (error) {
    console.error('[AdminCatalog] Error rejecting product:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to reject product' });
  }
});

/**
 * POST /api/admin/catalog/products/merge
 * Merge duplicate products
 */
router.post('/products/merge', async (req: Request, res: Response) => {
  try {
    const { primarySlug, duplicateSlugs, mergeStrategy } = req.body;

    if (!primarySlug || !Array.isArray(duplicateSlugs) || duplicateSlugs.length === 0) {
      return res.status(400).json({ error: 'invalid_request', message: 'primarySlug and duplicateSlugs array are required' });
    }

    // Get primary product
    const primaryProduct = await prisma.global_product_catalog.findFirst({
      where: { product_slug: primarySlug }
    });

    if (!primaryProduct) {
      return res.status(404).json({ error: 'not_found', message: 'Primary product not found' });
    }

    let mergedCount = 0;

    // Update all registry entries to point to primary slug
    for (const dupSlug of duplicateSlugs) {
      try {
        // Update registry entries
        await prisma.product_slug_registry.updateMany({
          where: { product_slug: dupSlug },
          data: { product_slug: primarySlug }
        });

        // Update inventory items
        await prisma.inventory_items.updateMany({
          where: { product_slug: dupSlug },
          data: { product_slug: primarySlug }
        });

        // Deactivate duplicate catalog entry
        await prisma.global_product_catalog.updateMany({
          where: { product_slug: dupSlug },
          data: {
            status: 'inactive',
            catalog_metadata: {
              merged_into: primarySlug,
              merged_at: new Date().toISOString()
            }
          }
        });

        mergedCount++;
      } catch (err) {
        console.error(`[AdminCatalog] Failed to merge ${dupSlug}:`, err);
      }
    }

    res.json({ success: true, merged_count: mergedCount });
  } catch (error) {
    console.error('[AdminCatalog] Error merging products:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to merge products' });
  }
});

/**
 * POST /api/admin/catalog/products/bulk-category
 * Bulk assign category to products
 */
router.post('/products/bulk-category', async (req: Request, res: Response) => {
  try {
    const { productSlugs, category } = req.body;

    if (!Array.isArray(productSlugs) || productSlugs.length === 0 || !category) {
      return res.status(400).json({ error: 'invalid_request', message: 'productSlugs array and category are required' });
    }

    const result = await prisma.global_product_catalog.updateMany({
      where: {
        product_slug: { in: productSlugs }
      },
      data: {
        category_path: [category],
        updated_at: new Date()
      }
    });

    res.json({
      success: result.count,
      failed: productSlugs.length - result.count
    });
  } catch (error) {
    console.error('[AdminCatalog] Error bulk assigning category:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to bulk assign category' });
  }
});

export default router;
