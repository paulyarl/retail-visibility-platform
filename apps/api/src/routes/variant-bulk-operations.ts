/**
 * Bulk Variant Operations API Routes
 * 
 * Provides endpoints for performing bulk operations on product variants,
 * including featured type assignments, sale pricing, stock updates, and activation.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

// Validation schemas
const bulkFeaturedTypeSchema = z.object({
  variantIds: z.array(z.string()).min(1),
  featuredType: z.enum(['sale', 'new_arrival', 'featured', 'bestseller', 'clearance', 'store_selection']),
  priority: z.number().int().min(1).max(10).default(3),
  expiresAt: z.string().datetime().optional(),
  autoUnfeature: z.boolean().default(true),
});

const bulkSalePriceSchema = z.object({
  variantIds: z.array(z.string()).min(1),
  salePriceCents: z.number().int().min(0),
});

const bulkStockSchema = z.object({
  variantIds: z.array(z.string()).min(1),
  stock: z.number().int().min(0),
});

const bulkActivationSchema = z.object({
  variantIds: z.array(z.string()).min(1),
  isActive: z.boolean(),
});

/**
 * POST /api/variants/bulk/featured-type
 * Apply featured type to multiple variants
 */
router.post('/bulk/featured-type', authenticateToken, async (req: Request, res: Response) => {
  try {
    const validated = bulkFeaturedTypeSchema.parse(req.body);
    const user = (req as any).user;

    // Verify user has access to these variants
    const variants = await prisma.product_variants.findMany({
      where: {
        id: { in: validated.variantIds },
        tenant_id: user.tenantId,
      },
      include: {
        inventory_items: {
          select: { tenant_id: true }
        }
      }
    });

    if (variants.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'no_variants_found',
        message: 'No variants found or access denied'
      });
    }

    if (variants.length !== validated.variantIds.length) {
      return res.status(400).json({
        success: false,
        error: 'some_variants_not_found',
        message: 'Some variants were not found or access denied'
      });
    }

    // Clear existing featured types for these variants
    await prisma.featured_products.deleteMany({
      where: {
        inventory_item_id: { in: validated.variantIds },
        tenant_id: user.tenantId,
      }
    });

    // Apply new featured types
    const featuredProducts = await Promise.all(
      validated.variantIds.map(variantId =>
        prisma.featured_products.create({
          data: {
            inventory_item_id: variantId,
            tenant_id: user.tenantId,
            featured_type: validated.featuredType,
            featured_priority: validated.priority,
            featured_at: new Date().toISOString(),
            featured_expires_at: validated.expiresAt ? new Date(validated.expiresAt).toISOString() : null,
            auto_unfeature: validated.autoUnfeature,
            is_active: true,
          }
        })
      )
    );

    // Refresh the materialized view to update smart tagging
    try {
      await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_products_mv`;
    } catch (error) {
      logger.error('[BULK VARIANT] MV refresh failed: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    }

    logger.info('[BULK VARIANT] Featured type applied', {
      userId: user.userId,
      tenantId: user.tenantId,
      region: user.region || 'unknown'
    });

    res.json({
      success: true,
      message: `Applied "${validated.featuredType}" to ${validated.variantIds.length} variants`,
      featuredProducts,
      refreshedMV: true
    });

  } catch (error: any) {
    logger.error('[BULK VARIANT] Featured type error:', error, undefined);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'validation_failed',
        message: 'Invalid request data',
        details: (error as any).errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'bulk_featured_type_failed',
      message: 'Failed to apply featured type to variants',
      details: error.message
    });
  }
});

/**
 * POST /api/variants/bulk/sale-price
 * Set sale price for multiple variants
 */
router.post('/bulk/sale-price', authenticateToken, async (req: Request, res: Response) => {
  try {
    const validated = bulkSalePriceSchema.parse(req.body);
    const user = (req as any).user;

    // Verify user has access to these variants
    const variants = await prisma.product_variants.findMany({
      where: {
        id: { in: validated.variantIds },
        tenant_id: user.tenantId,
      }
    });

    if (variants.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'no_variants_found',
        message: 'No variants found or access denied'
      });
    }

    // Update sale prices
    const updatedVariants = await prisma.product_variants.updateMany({
      where: {
        id: { in: validated.variantIds },
        tenant_id: user.tenantId,
      },
      data: {
        sale_price_cents: validated.salePriceCents,
        updated_at: new Date().toISOString(),
      }
    });

    // Refresh the materialized view to update smart sale tagging
    try {
      await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_products_mv`;
    } catch (error) {
      logger.error('[BULK VARIANT] MV refresh failed: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    }

    logger.info('[BULK VARIANT] Sale price updated: Set sale price to $' + (validated.salePriceCents / 100).toFixed(2) + ' for ' + validated.variantIds.length + ' variants', {
      userId: user.userId,
      tenantId: user.tenantId,
      region: user.region || 'unknown'
    });

    res.json({
      success: true,
      message: `Set sale price to $${(validated.salePriceCents / 100).toFixed(2)} for ${updatedVariants.count} variants`,
      updatedCount: updatedVariants.count,
      refreshedMV: true
    });

  } catch (error: any) {
    logger.error('[BULK VARIANT] Sale price error:', error, undefined);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'validation_failed',
        message: 'Invalid request data',
        details: (error as any).errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'bulk_sale_price_failed',
      message: 'Failed to update sale prices for variants',
      details: error.message
    });
  }
});

/**
 * POST /api/variants/bulk/stock
 * Set stock for multiple variants
 */
router.post('/bulk/stock', authenticateToken, async (req: Request, res: Response) => {
  try {
    const validated = bulkStockSchema.parse(req.body);
    const user = (req as any).user;

    // Verify user has access to these variants
    const variants = await prisma.product_variants.findMany({
      where: {
        id: { in: validated.variantIds },
        tenant_id: user.tenantId,
      }
    });

    if (variants.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'no_variants_found',
        message: 'No variants found or access denied'
      });
    }

    // Update stock
    const updatedVariants = await prisma.product_variants.updateMany({
      where: {
        id: { in: validated.variantIds },
        tenant_id: user.tenantId,
      },
      data: {
        stock: validated.stock,
        updated_at: new Date().toISOString(),
      }
    });

    // Refresh the materialized view to update stock-based visibility
    try {
      await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_products_mv`;
    } catch (error) {
      logger.error('[BULK VARIANT] MV refresh failed: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    }

    logger.info('[BULK VARIANT] Stock updated: Set stock to ' + validated.stock + ' for ' + validated.variantIds.length + ' variants', {
      userId: user.userId,
      tenantId: user.tenantId,
      region: user.region || 'unknown'
    });

    res.json({
      success: true,
      message: `Set stock to ${validated.stock} for ${updatedVariants.count} variants`,
      updatedCount: updatedVariants.count,
      refreshedMV: true
    });

  } catch (error: any) {
    logger.error('[BULK VARIANT] Stock error:', error, undefined);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'validation_failed',
        message: 'Invalid request data',
        details: (error as any).errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'bulk_stock_failed',
      message: 'Failed to update stock for variants',
      details: error.message
    });
  }
});

/**
 * POST /api/variants/bulk/activation
 * Activate or deactivate multiple variants
 */
router.post('/bulk/activation', authenticateToken, async (req: Request, res: Response) => {
  try {
    const validated = bulkActivationSchema.parse(req.body);
    const user = (req as any).user;

    // Verify user has access to these variants
    const variants = await prisma.product_variants.findMany({
      where: {
        id: { in: validated.variantIds },
        tenant_id: user.tenantId,
      }
    });

    if (variants.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'no_variants_found',
        message: 'No variants found or access denied'
      });
    }

    // Update activation status
    const updatedVariants = await prisma.product_variants.updateMany({
      where: {
        id: { in: validated.variantIds },
        tenant_id: user.tenantId,
      },
      data: {
        is_active: validated.isActive,
        updated_at: new Date().toISOString(),
      }
    });

    // Refresh the materialized view to update visibility
    try {
      await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY storefront_products_mv`;
    } catch (error) {
      logger.error('[BULK VARIANT] MV refresh failed: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    }

    const action = validated.isActive ? 'activated' : 'deactivated';

    logger.info('[BULK VARIANT] Activation updated: ' + (validated.isActive ? 'Activated' : 'Deactivated') + ' ' + validated.variantIds.length + ' variants', {
      userId: user.userId,
      tenantId: user.tenantId,
      region: user.region || 'unknown'
    });

    res.json({
      success: true,
      message: `${action.charAt(0).toUpperCase() + action.slice(1)} ${updatedVariants.count} variants`,
      updatedCount: updatedVariants.count,
      refreshedMV: true
    });

  } catch (error: any) {
    logger.error('[BULK VARIANT] Activation error:', error, undefined);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'validation_failed',
        message: 'Invalid request data',
        details: (error as any).errors
      });
    }

    res.status(500).json({
      success: false,
      error: 'bulk_activation_failed',
      message: 'Failed to update activation status for variants',
      details: error.message
    });
  }
});

/**
 * GET /api/variants/bulk/preview/:operation
 * Preview the effects of a bulk operation without applying it
 */
router.get('/bulk/preview/:operation', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { operation } = req.params;
    const { variantIds } = req.query;

    if (!variantIds || !Array.isArray(variantIds)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_variant_ids',
        message: 'variantIds query parameter is required and must be an array'
      });
    }

    const user = (req as any).user;

    // Get variants for preview
    const variants = await prisma.product_variants.findMany({
      where: {
        id: { in: variantIds as string[] },
        tenant_id: user.tenantId,
      }
    });

    if (variants.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'no_variants_found',
        message: 'No variants found or access denied'
      });
    }

    // Generate preview based on operation type
    let preview: any = {};

    switch (operation) {
      case 'featured_type':
        preview = {
          operation: 'featured_type',
          currentStates: variants.map(v => ({
            variantId: v.id,
            variantName: v.variant_name,
            currentFeaturedType: null, // No featured products relation available
            willBeChanged: true
          }))
        };
        break;

      case 'sale_price':
        preview = {
          operation: 'sale_price',
          currentStates: variants.map(v => ({
            variantId: v.id,
            variantName: v.variant_name,
            currentPrice: v.price_cents,
            currentSalePrice: v.sale_price_cents,
            willBeChanged: true
          }))
        };
        break;

      case 'stock':
        preview = {
          operation: 'stock',
          currentStates: variants.map(v => ({
            variantId: v.id,
            variantName: v.variant_name,
            currentStock: v.stock,
            willBeChanged: true
          }))
        };
        break;

      case 'activation':
        preview = {
          operation: 'activation',
          currentStates: variants.map(v => ({
            variantId: v.id,
            variantName: v.variant_name,
            currentIsActive: v.is_active,
            willBeChanged: true
          }))
        };
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'invalid_operation',
          message: 'Invalid operation type'
        });
    }

    res.json({
      success: true,
      preview,
      variantCount: variants.length
    });

  } catch (error: any) {
    logger.error('[BULK VARIANT] Preview error:', error);
    res.status(500).json({
      success: false,
      error: 'preview_failed',
      message: 'Failed to generate preview',
      details: error.message
    });
  }
});

export default router;
