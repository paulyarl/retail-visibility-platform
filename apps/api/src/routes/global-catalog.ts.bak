/**
 * Global Catalog API Routes
 * 
 * Provides REST API endpoints for global product catalog operations:
 * - Browse catalog with pagination and filters
 * - Search products by query
 * - Get product by slug or UPC
 * - Get popular and recent products
 * - Get catalog statistics
 */

import { Router, Request, Response } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth';
import { prisma } from '../prisma';
import { z } from 'zod';

const router = Router();

// Validation schemas
const browseSchema = z.object({
  category: z.string().optional(),
  brand: z.string().optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
  sortBy: z.enum(['name', 'brand', 'created_at', 'popularity']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional()
});

const searchSchema = z.object({
  q: z.string().min(1).max(200),
  category: z.string().optional(),
  brand: z.string().optional(),
  source: z.enum(['platform', 'merchant', 'partner']).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional()
});

/**
 * GET /api/catalog/browse
 * Browse the global catalog with pagination and filters
 * 
 * Query params:
 * - category: Filter by category
 * - brand: Filter by brand
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - sortBy: Sort field (name, brand, created_at, popularity)
 * - sortOrder: Sort order (asc, desc)
 */
router.get('/browse', optionalAuth, async (req: Request, res: Response) => {
  try {
    const parsed = browseSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_query',
        details: parsed.error.flatten()
      });
    }

    const {
      category,
      brand,
      page = '1',
      limit = '20',
      sortBy = 'name',
      sortOrder = 'asc'
    } = parsed.data;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {
      status: 'active'
    };

    if (category) {
      where.category_path = { has: category };
    }

    if (brand) {
      where.brand = { ilike: brand };
    }

    // Build orderBy
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // Get total count
    const total = await prisma.global_product_catalog.count({ where });

    // Get products
    const products = await prisma.global_product_catalog.findMany({
      where,
      orderBy,
      skip: offset,
      take: limitNum
    });

    // Get unique categories and brands for filters
    const categories = await prisma.global_product_catalog.findMany({
      where: { status: 'active' },
      select: { category_path: true },
      distinct: ['category_path']
    });

    const brands = await prisma.global_product_catalog.findMany({
      where: { status: 'active', brand: { not: null } },
      select: { brand: true },
      distinct: ['brand']
    });

    const uniqueCategories = [...new Set(categories.flatMap((c: { category_path: string[] | null }) => c.category_path || []))];
    const uniqueBrands = [...new Set(brands.map((b: { brand: string | null }) => b.brand).filter(Boolean))] as string[];

    res.json({
      products,
      total,
      page: pageNum,
      limit: limitNum,
      hasMore: offset + limitNum < total,
      categories: uniqueCategories,
      brands: uniqueBrands
    });
  } catch (error) {
    console.error('[GlobalCatalog] Error browsing catalog:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to browse catalog' });
  }
});

/**
 * GET /api/catalog/search
 * Search the global catalog
 * 
 * Query params:
 * - q: Search query (required)
 * - category: Filter by category
 * - brand: Filter by brand
 * - source: Filter by source (platform, merchant, partner)
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 */
router.get('/search', optionalAuth, async (req: Request, res: Response) => {
  try {
    const parsed = searchSchema.safeParse(req.query);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'invalid_query',
        details: parsed.error.flatten()
      });
    }

    const {
      q,
      category,
      brand,
      source,
      page = '1',
      limit = '20'
    } = parsed.data;

    const pageNum = parseInt(page, 10);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause with full-text search
    const where: any = {
      status: 'active',
      OR: [
        { name: { ilike: `%${q}%` } },
        { brand: { ilike: `%${q}%` } },
        { description: { ilike: `%${q}%` } },
        { gtin_upc: { ilike: `%${q}%` } }
      ]
    };

    if (category) {
      where.category_path = { has: category };
    }

    if (brand) {
      where.brand = { ilike: brand };
    }

    if (source) {
      where.source = source;
    }

    // Get total count
    const total = await prisma.global_product_catalog.count({ where });

    // Get products
    const products = await prisma.global_product_catalog.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limitNum
    });

    res.json({
      products,
      total,
      query: q,
      filters: { category, brand, source },
      page: pageNum,
      limit: limitNum,
      hasMore: offset + limitNum < total
    });
  } catch (error) {
    console.error('[GlobalCatalog] Error searching catalog:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to search catalog' });
  }
});

/**
 * GET /api/catalog/products/:slug
 * Get a product by its slug
 */
router.get('/products/:slug', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    const product = await prisma.global_product_catalog.findFirst({
      where: {
        product_slug: slug,
        status: 'active'
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'not_found', message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('[GlobalCatalog] Error fetching product by slug:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch product' });
  }
});

/**
 * GET /api/catalog/products/upc/:upc
 * Get a product by UPC/GTIN
 */
router.get('/products/upc/:upc', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { upc } = req.params;

    const product = await prisma.global_product_catalog.findFirst({
      where: {
        gtin_upc: upc,
        status: 'active'
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'not_found', message: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    console.error('[GlobalCatalog] Error fetching product by UPC:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch product' });
  }
});

/**
 * GET /api/catalog/popular
 * Get popular products (most adopted by merchants)
 */
router.get('/popular', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10), 50);

    // For now, return recent products
    // TODO: Implement popularity scoring based on adoption count
    const products = await prisma.global_product_catalog.findMany({
      where: { status: 'active' },
      orderBy: { created_at: 'desc' },
      take: limitNum
    });

    res.json(products);
  } catch (error) {
    console.error('[GlobalCatalog] Error fetching popular products:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch popular products' });
  }
});

/**
 * GET /api/catalog/recent
 * Get recently added products
 */
router.get('/recent', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { limit = '10' } = req.query;
    const limitNum = Math.min(parseInt(limit as string, 10), 50);

    const products = await prisma.global_product_catalog.findMany({
      where: { status: 'active' },
      orderBy: { created_at: 'desc' },
      take: limitNum
    });

    res.json(products);
  } catch (error) {
    console.error('[GlobalCatalog] Error fetching recent products:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch recent products' });
  }
});

/**
 * GET /api/catalog/stats
 * Get catalog statistics
 */
router.get('/stats', optionalAuth, async (req: Request, res: Response) => {
  try {
    const [totalProducts, totalBrands, totalCategories] = await Promise.all([
      prisma.global_product_catalog.count({ where: { status: 'active' } }),
      prisma.global_product_catalog.findMany({
        where: { status: 'active', brand: { not: null } },
        select: { brand: true },
        distinct: ['brand']
      }),
      prisma.global_product_catalog.findMany({
        where: { status: 'active' },
        select: { category_path: true }
      })
    ]);

    const uniqueCategories = [...new Set(totalCategories.flatMap((c: { category_path: string[] | null }) => c.category_path || []))];

    const lastUpdated = await prisma.global_product_catalog.findFirst({
      where: { status: 'active' },
      orderBy: { updated_at: 'desc' },
      select: { updated_at: true }
    });

    res.json({
      totalProducts,
      totalBrands: totalBrands.length,
      totalCategories: uniqueCategories.length,
      lastUpdated: lastUpdated?.updated_at || new Date().toISOString()
    });
  } catch (error) {
    console.error('[GlobalCatalog] Error fetching catalog stats:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch catalog stats' });
  }
});

/**
 * GET /api/catalog/categories/:categorySlug
 * Get products by category
 */
router.get('/categories/:categorySlug', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { categorySlug } = req.params;
    const { page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    const where = {
      status: 'active',
      category_path: { has: categorySlug }
    };

    const total = await prisma.global_product_catalog.count({ where });

    const products = await prisma.global_product_catalog.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: offset,
      take: limitNum
    });

    res.json({
      products,
      total,
      page: pageNum,
      limit: limitNum,
      hasMore: offset + limitNum < total,
      category: categorySlug
    });
  } catch (error) {
    console.error('[GlobalCatalog] Error fetching products by category:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to fetch products' });
  }
});

export default router;
