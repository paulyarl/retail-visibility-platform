/**
 * Admin Enrichment API
 * 
 * Endpoints for managing product enrichment analytics and data
 */

import { Router, Request, Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';
import { canViewAllTenants } from '../utils/platform-admin';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/admin/enrichment/analytics
 * 
 * Returns enrichment analytics for the admin dashboard
 */
router.get('/analytics', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!canViewAllTenants(req.user as any)) {
      return res.status(403).json({ success: false, error: 'platform_access_required' });
    }

    const totalProducts = await prisma.inventoryItem.count();

    // Get products with nutrition data
    const productsWithNutrition = await prisma.inventoryItem.count({
      where: {
        metadata: {
          path: ['nutritionData'],
          not: Prisma.JsonNull
        }
      }
    });

    // Get products with images
    const productsWithImages = await prisma.inventoryItem.count({
      where: {
        imageUrl: {
          not: null
        }
      }
    });

    // Get products with environmental data (if applicable)
    const productsWithEnvironmental = await prisma.inventoryItem.count({
      where: {
        // Assuming environmental data might be stored in metadata
        metadata: {
          path: ['environmental'],
          not: Prisma.JsonNull
        }
      }
    });

    // Calculate percentages
    const nutritionPercentage = totalProducts > 0 
      ? ((productsWithNutrition / totalProducts) * 100).toFixed(1)
      : '0.0';
    
    const imagesPercentage = totalProducts > 0 
      ? ((productsWithImages / totalProducts) * 100).toFixed(1)
      : '0.0';
    
    const environmentalPercentage = totalProducts > 0 
      ? ((productsWithEnvironmental / totalProducts) * 100).toFixed(1)
      : '0.0';

    // Get source breakdown (if products have source info in metadata)
    const sourceBreakdown = await prisma.inventoryItem.groupBy({
      by: ['tenantId'],
      _count: {
        id: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 5
    });

    // Get tenant names for source breakdown
    const tenantIds = sourceBreakdown.map(item => item.tenantId);
    const tenants = await prisma.tenant.findMany({
      where: {
        id: {
          in: tenantIds
        }
      },
      select: {
        id: true,
        name: true
      }
    });

    const sourceData = sourceBreakdown.map(item => {
      const tenant = tenants.find(t => t.id === item.tenantId);
      return {
        source: tenant?.name || 'Unknown',
        count: item._count.id,
        percentage: totalProducts > 0 
          ? ((item._count.id / totalProducts) * 100).toFixed(1)
          : '0.0'
      };
    });

    // Get recent additions (products created in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentAdditions = await prisma.inventoryItem.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    });

    // Get popular products with enrichment data
    const popularProducts = await prisma.inventoryItem.findMany({
      take: 5,
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        name: true,
        sku: true,
        tenantId: true,
        imageUrl: true,
        createdAt: true,
        brand: true,
        source: true
      }
    });

    // Transform to expected format
    const transformedPopularProducts = popularProducts.map(product => ({
      barcode: product.sku || 'N/A',
      name: product.name,
      brand: product.brand || 'Unknown',
      fetchCount: Math.floor(Math.random() * 100) + 1, // Mock fetch count
      source: product.source || 'Manual'
    }));

    // Calculate estimated savings (mock calculation)
    const estimatedCostSavings = `$${(totalProducts * 0.25).toFixed(2)}`;
    const apiCallsSaved = totalProducts * 10; // Assume 10 API calls per product saved

    const analytics = {
      totalProducts: totalProducts,
      popularProducts: transformedPopularProducts,
      dataQuality: {
        withNutrition: productsWithNutrition,
        withImages: productsWithImages,
        withEnvironmental: productsWithEnvironmental,
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
router.get('/search', authenticateToken, async (req: Request, res: Response) => {
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

    // Build where clause
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
          sku: {
            contains: query,
            mode: 'insensitive'
          }
        },
        {
          description: {
            contains: query,
            mode: 'insensitive'
          }
        }
      ];
    }

    if (source && typeof source === 'string') {
      // Filter by tenant name
      const tenants = await prisma.tenant.findMany({
        where: {
          name: {
            contains: source,
            mode: 'insensitive'
          }
        },
        select: {
          id: true
        }
      });
      
      if (tenants.length > 0) {
        where.tenantId = {
          in: tenants.map(t => t.id)
        };
      }
    }

    // Get total count
    const total = await prisma.inventoryItem.count({ where });

    // Get products
    const products = await prisma.inventoryItem.findMany({
      where,
      select: {
        id: true,
        name: true,
        sku: true,
        brand: true,
        source: true,
        description: true,
        priceCents: true,
        imageUrl: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
        tenant: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: limitNum
    });

    // Transform data to match frontend expectations
    const transformedProducts = products.map(product => ({
      id: product.id,
      barcode: product.sku || 'N/A',
      name: product.name,
      brand: product.brand || 'Unknown',
      source: product.source || 'Manual',
      fetchCount: Math.floor(Math.random() * 100) + 1, // Mock fetch count
      imageThumbnailUrl: product.imageUrl,
      description: product.description,
      price: product.priceCents ? product.priceCents / 100 : null,
      tenant: product.tenant.name,
      tenantId: product.tenantId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      hasNutrition: product.metadata && typeof product.metadata === 'object' ? !!(product.metadata as any).nutritionData : false,
      hasImage: !!product.imageUrl,
      hasEnvironmental: product.metadata && typeof product.metadata === 'object' ? !!(product.metadata as any).environmental : false,
      enrichmentScore: calculateEnrichmentScore(product)
    }));

    const totalPages = Math.ceil(total / limitNum);

    console.log(`[Admin Enrichment] Found ${total} products, returning ${transformedProducts.length}`);

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
 * Get detailed information for a specific product by barcode/SKU
 */
router.get('/:barcode', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!canViewAllTenants(req.user as any)) {
      return res.status(403).json({ success: false, error: 'platform_access_required' });
    }

    const { barcode } = req.params;

    const product = await prisma.inventoryItem.findFirst({
      where: {
        sku: barcode
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true
          }
        }
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
      barcode: product.sku || 'N/A',
      name: product.name,
      brand: product.brand || 'Unknown',
      source: product.source || 'Manual',
      description: product.description,
      price: product.priceCents ? product.priceCents / 100 : null,
      imageUrl: product.imageUrl,
      tenant: product.tenant.name,
      tenantId: product.tenantId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      metadata: product.metadata,
      hasNutrition: product.metadata && typeof product.metadata === 'object' ? !!(product.metadata as any).nutritionData : false,
      hasImage: !!product.imageUrl,
      hasEnvironmental: product.metadata && typeof product.metadata === 'object' ? !!(product.metadata as any).environmental : false,
      enrichmentScore: calculateEnrichmentScore(product)
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

/**
 * Helper function to calculate enrichment score
 */
function calculateEnrichmentScore(product: any): number {
  let score = 0;
  
  // Base fields
  if (product.name) score += 10;
  if (product.description) score += 10;
  if (product.priceCents) score += 10;
  if (product.imageUrl) score += 20;
  if (product.metadata && typeof product.metadata === 'object' && (product.metadata as any).nutritionData) score += 25;
  if (product.metadata && typeof product.metadata === 'object' && (product.metadata as any).environmental) score += 15;
  if (product.sku) score += 10;
  
  return Math.min(score, 100);
}

export default router;
