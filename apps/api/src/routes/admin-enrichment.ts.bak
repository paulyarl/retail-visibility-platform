/**
 * Admin Enrichment API
 * 
 * Endpoints for managing product enrichment analytics and data
 */

import { Router, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { canViewAllTenants } from '../utils/platform-admin';

const router = Router();

/**
 * GET /api/admin/enrichment/analytics
 * 
 * Returns enrichment analytics for the admin dashboard
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    if (!canViewAllTenants(req.user as any)) {
      return res.status(403).json({ success: false, error: 'platform_access_required' });
    }

    // Get total cached products from barcode_enrichment table
    const totalCached = await prisma.barcode_enrichment.count();
    
    // Get most popular products (top 10 by fetch count)
    const popularProducts = await prisma.barcode_enrichment.findMany({
      orderBy: { fetch_count: 'desc' },
      take: 10,
      select: {
        barcode: true,
        name: true,
        brand: true,
        fetch_count: true,
        source: true,
        last_fetched_at: true,
      },
    });

    // Transform to expected format
    const transformedPopularProducts = popularProducts.map(product => ({
      barcode: product.barcode,
      name: product.name || 'Unknown',
      brand: product.brand || 'Unknown',
      fetchCount: product.fetch_count || 0,
      source: product.source || 'unknown'
    }));

    // Get data quality metrics
    const withNutrition = await prisma.barcode_enrichment.count({
      where: {
        metadata: {
          path: ['nutrition', 'per_100g'],
          not: Prisma.JsonNull,
        },
      },
    });

    const withImages = await prisma.barcode_enrichment.count({
      where: {
        OR: [
          { image_url: { not: null } },
          { image_thumbnail_url: { not: null } },
        ],
      },
    });

    const withEnvironmental = await prisma.barcode_enrichment.count({
      where: {
        metadata: {
          path: ['environmental'],
          not: Prisma.JsonNull,
        },
      },
    });

    // Calculate percentages
    const nutritionPercentage = totalCached > 0 
      ? ((withNutrition / totalCached) * 100).toFixed(1)
      : '0.0';
    
    const imagesPercentage = totalCached > 0 
      ? ((withImages / totalCached) * 100).toFixed(1)
      : '0.0';
    
    const environmentalPercentage = totalCached > 0 
      ? ((withEnvironmental / totalCached) * 100).toFixed(1)
      : '0.0';

    // Get source breakdown
    const sourceBreakdown = await prisma.barcode_enrichment.groupBy({
      by: ['source'],
      _count: true,
    });

    const sourceData = sourceBreakdown.map(item => ({
      source: item.source || 'unknown',
      count: item._count || 0,
      percentage: totalCached > 0 
        ? (((item._count || 0) / totalCached) * 100).toFixed(1)
        : '0.0'
    }));

    // Get recent additions (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentAdditions = await prisma.barcode_enrichment.count({
      where: {
        created_at: { gte: oneDayAgo },
      },
    });

    // Calculate total API calls saved (sum of fetchCount - 1 for each product)
    const totalFetchCount = await prisma.barcode_enrichment.aggregate({
      _sum: { fetch_count: true },
    });
    const apiCallsSaved = Math.max(0, (totalFetchCount._sum.fetch_count || 0) - totalCached);

    // Calculate estimated savings
    const estimatedCostSavings = (apiCallsSaved * 0.01).toFixed(2);

    const analytics = {
      totalProducts: totalCached,
      popularProducts: transformedPopularProducts,
      dataQuality: {
        withNutrition,
        withImages,
        withEnvironmental,
        nutritionPercentage,
        imagesPercentage,
        environmentalPercentage
      },
      sourceBreakdown: sourceData,
      recentAdditions,
      apiCallsSaved,
      estimatedCostSavings
    };

    console.log('[Admin Enrichment] Analytics loaded successfully');
    console.log('[Admin Enrichment] Popular products sample:', transformedPopularProducts[0]);
    
    // Prevent caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');
    
    res.json({
      success: true,
      analytics
    });
  } catch (error: any) {
    console.error('[Admin Enrichment] Error loading analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load enrichment analytics'
    });
  }
});

/**
 * GET /api/admin/enrichment/search
 * 
 * Search for enriched products with pagination and filtering
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    if (!canViewAllTenants(req.user as any)) {
      return res.status(403).json({ success: false, error: 'platform_access_required' });
    }
    const {
      page = '1',
      limit = '20',
      query,
      source
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    console.log(`[Admin Enrichment] Searching products - page: ${pageNum}, limit: ${limitNum}`);

    // Build where clause for barcode_enrichment table
    const where: any = {};

    if (query && typeof query === 'string') {
      where.OR = [
        {
          name: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          barcode: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          brand: {
            contains: query,
            mode: 'insensitive'
          }
        }
      ];
    }

    if (source && typeof source === 'string') {
      where.source = source;
    }

    // Get total count from barcode_enrichment
    const total = await prisma.barcode_enrichment.count({ where });

    // Get products from barcode_enrichment
    const products = await prisma.barcode_enrichment.findMany({
      where,
      select: {
        id: true,
        barcode: true,
        name: true,
        brand: true,
        source: true,
        fetch_count: true,
        image_url: true,
        image_thumbnail_url: true,
        created_at: true,
        last_fetched_at: true,
        metadata: true,
      },
      orderBy: {
        fetch_count: 'desc'
      },
      skip,
      take: limitNum
    });

    // Transform data to match frontend expectations
    const transformedProducts = products.map(product => ({
      id: product.id,
      barcode: product.barcode,
      name: product.name || 'Unknown',
      brand: product.brand || 'Unknown',
      source: product.source || 'unknown',
      fetchCount: product.fetch_count || 0,
      imageThumbnailUrl: product.image_thumbnail_url || product.image_url,
      createdAt: product.created_at,
      lastFetchedAt: product.last_fetched_at,
      hasNutrition: product.metadata && typeof product.metadata === 'object' ? !!(product.metadata as any).nutrition : false,
      hasImage: !!(product.image_url || product.image_thumbnail_url),
      hasEnvironmental: product.metadata && typeof product.metadata === 'object' ? !!(product.metadata as any).environmental : false,
    }));

    const totalPages = Math.ceil(total / limitNum);

    console.log(`[Admin Enrichment] Found ${total} products, returning ${transformedProducts.length}`);
    if (transformedProducts.length > 0) {
      console.log('[Admin Enrichment] First product sample:', transformedProducts[0]);
    }

    // Prevent caching
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.set('Pragma', 'no-cache');

    res.json({
      success: true,
      products: transformedProducts,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (error: any) {
    console.error('[Admin Enrichment] Error searching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search products'
    });
  }
});

/**
 * GET /api/admin/enrichment/:barcode
 * 
 * Get detailed information for a specific product by barcode
 */
router.get('/:barcode', async (req: Request, res: Response) => {
  try {
    if (!canViewAllTenants(req.user as any)) {
      return res.status(403).json({ success: false, error: 'platform_access_required' });
    }

    const { barcode } = req.params;

    const product = await prisma.barcode_enrichment.findUnique({
      where: {
        barcode: barcode
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Transform product data to match frontend expectations
    const transformedProduct = {
      id: product.id,
      barcode: product.barcode,
      name: product.name || 'Unknown',
      brand: product.brand || 'Unknown',
      source: product.source || 'unknown',
      imageUrl: product.image_url,
      imageThumbnailUrl: product.image_thumbnail_url,
      fetchCount: product.fetch_count || 0,
      createdAt: product.created_at,
      lastFetchedAt: product.last_fetched_at,
      metadata: product.metadata,
      hasNutrition: product.metadata && typeof product.metadata === 'object' ? !!(product.metadata as any).nutrition : false,
      hasImage: !!(product.image_url || product.image_thumbnail_url),
      hasEnvironmental: product.metadata && typeof product.metadata === 'object' ? !!(product.metadata as any).environmental : false,
    };

    res.json({
      success: true,
      product: transformedProduct
    });
  } catch (error: any) {
    console.error('[Admin Enrichment] Error loading product details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to load product details'
    });
  }
});

export default router;
