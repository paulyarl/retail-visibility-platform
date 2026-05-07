/**
 * Variant Featured Types API Routes
 * 
 * Provides endpoints for fetching featured types for individual variants
 * to support the enhanced ProductWithVariants component.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
// import { getFeaturedTypeDisplay } from '../utils/featured-types'; // TODO: Create this utility

// Simple implementation for now
const getFeaturedTypeDisplay = (type: string, priority: number) => ({
  type,
  priority,
  displayName: type.charAt(0).toUpperCase() + type.slice(1),
  color: type === 'staff_pick' ? 'blue' : type === 'sale' ? 'red' : 'green'
});

const router = Router();

/**
 * GET /api/featured-products/item/:itemId
 * Get featured types for a specific item (product or variant)
 */
router.get('/item/:itemId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const user = (req as any).user;

    // Verify user has access to this item
    const item = await prisma.$queryRaw`
      SELECT tenant_id FROM (
        SELECT id, tenant_id FROM inventory_items WHERE id = ${itemId}
        UNION ALL
        SELECT id, tenant_id FROM product_variants WHERE id = ${itemId}
      ) combined_items
      WHERE id = ${itemId}
      LIMIT 1
    ` as any[];

    if (item.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'item_not_found',
        message: 'Item not found'
      });
    }

    if (item[0].tenant_id !== user.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'access_denied',
        message: 'Access denied'
      });
    }

    // Get featured types for this item
    const featuredProducts = await prisma.featured_products.findMany({
      where: {
        inventory_item_id: itemId,
        tenant_id: user.tenantId,
        is_active: true,
        AND: [
          {
            OR: [
              { featured_expires_at: null },
              { featured_expires_at: { gt: new Date() } }
            ]
          },
          {
            OR: [
              { featured_at: null },
              { featured_at: { lte: new Date() } }
            ]
          }
        ]
      },
      orderBy: [
        { featured_priority: 'desc' },
        { featured_at: 'desc' }
      ]
    });

    // Transform to display format
    const featuredTypes = featuredProducts.map(fp => 
      getFeaturedTypeDisplay(fp.featured_type, fp.featured_priority || 0)
    );

    res.json({
      success: true,
      featuredTypes,
      itemId,
      count: featuredTypes.length
    });

  } catch (error: any) {
    console.error('[VARIANT FEATURED TYPES] Fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'fetch_failed',
      message: 'Failed to fetch featured types',
      details: error.message
    });
  }
});

/**
 * GET /api/featured-products/variants/:parentItemId
 * Get featured types for all variants of a parent item
 */
router.get('/variants/:parentItemId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { parentItemId } = req.params;
    const user = (req as any).user;

    // Verify user has access to this parent item
    const parentItem = await prisma.inventory_items.findUnique({
      where: { id: parentItemId },
      select: { tenant_id: true, has_variants: true }
    });

    if (!parentItem) {
      return res.status(404).json({
        success: false,
        error: 'parent_item_not_found',
        message: 'Parent item not found'
      });
    }

    if (parentItem.tenant_id !== user.tenantId) {
      return res.status(403).json({
        success: false,
        error: 'access_denied',
        message: 'Access denied'
      });
    }

    if (!parentItem.has_variants) {
      return res.json({
        success: true,
        variants: [],
        message: 'This item does not have variants'
      });
    }

    // Get all variants for this parent item
    const variants = await prisma.product_variants.findMany({
      where: {
        parent_item_id: parentItemId,
        tenant_id: user.tenantId,
        is_active: true
      },
      orderBy: { sort_order: 'asc' }
    });

    // Get featured types for each variant
    const variantFeaturedTypes = await Promise.all(
      variants.map(async (variant) => {
        const featuredProducts = await prisma.featured_products.findMany({
          where: {
            inventory_item_id: variant.id,
            tenant_id: user.tenantId,
            is_active: true,
            AND: [
              {
                OR: [
                  { featured_expires_at: null },
                  { featured_expires_at: { gt: new Date() } }
                ]
              },
              {
                OR: [
                  { featured_at: null },
                  { featured_at: { lte: new Date() } }
                ]
              }
            ]
          },
          orderBy: [
            { featured_priority: 'desc' },
            { featured_at: 'desc' }
          ]
        });

        const featuredTypes = featuredProducts.map(fp => 
          getFeaturedTypeDisplay(fp.featured_type, fp.featured_priority || 0)
        );

        return {
          variantId: variant.id,
          variantName: variant.variant_name,
          sku: variant.sku,
          featuredTypes,
          count: featuredTypes.length
        };
      })
    );

    res.json({
      success: true,
      variants: variantFeaturedTypes,
      parentItemId,
      totalVariants: variants.length
    });

  } catch (error: any) {
    console.error('[VARIANT FEATURED TYPES] Bulk fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'bulk_fetch_failed',
      message: 'Failed to fetch variant featured types',
      details: error.message
    });
  }
});

export default router;
