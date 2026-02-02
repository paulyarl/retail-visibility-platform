/**
 * Variant Bulk Operations API Routes - UniversalSingleton Implementation
 * Integrates VariantBulkOperationsService with Express API
 */

import { Router, Request, Response } from 'express';
import { VariantBulkOperationsService } from '../services/VariantBulkOperationsService';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

// Get singleton instance
const variantBulkOperationsService = VariantBulkOperationsService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * POST /api/variants-singleton/bulk/pricing
 * Bulk update pricing for multiple variants
 */
router.post('/bulk/pricing', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { variant_ids, price_cents, sale_price_cents, apply_sale_to_all } = req.body;

    if (!Array.isArray(variant_ids) || variant_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Variant IDs array is required and cannot be empty'
      });
    }

    // Validate tenant access for all variants
    // This would be handled in the service layer for efficiency

    const update = {
      variant_ids,
      price_cents,
      sale_price_cents,
      apply_sale_to_all
    };

    const result = await variantBulkOperationsService.bulkUpdatePricing(update);
    
    res.json({
      success: true,
      ...result,
      message: `Bulk pricing update completed: ${result.success_count} success, ${result.error_count} errors`
    });
  } catch (error: unknown) {
    logger.error('[VARIANT BULK OPERATIONS] Bulk pricing error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk pricing update',
      message: errorMessage
    });
  }
});

/**
 * POST /api/variants-singleton/bulk/stock
 * Bulk update stock for multiple variants
 */
router.post('/bulk/stock', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { variant_ids, stock, operation } = req.body;

    if (!Array.isArray(variant_ids) || variant_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Variant IDs array is required and cannot be empty'
      });
    }

    if (typeof stock !== 'number' || stock < 0) {
      return res.status(400).json({
        success: false,
        error: 'Valid stock number is required'
      });
    }

    if (!['set', 'add', 'subtract'].includes(operation)) {
      return res.status(400).json({
        success: false,
        error: 'Operation must be one of: set, add, subtract'
      });
    }

    const update = {
      variant_ids,
      stock,
      operation
    };

    const result = await variantBulkOperationsService.bulkUpdateStock(update);
    
    res.json({
      success: true,
      ...result,
      message: `Bulk stock update completed: ${result.success_count} success, ${result.error_count} errors`
    });
  } catch (error: unknown) {
    logger.error('[VARIANT BULK OPERATIONS] Bulk stock error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk stock update',
      message: errorMessage
    });
  }
});

/**
 * POST /api/variants-singleton/bulk/activation
 * Bulk activation/deactivation for multiple variants
 */
router.post('/bulk/activation', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { variant_ids, is_active } = req.body;

    if (!Array.isArray(variant_ids) || variant_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Variant IDs array is required and cannot be empty'
      });
    }

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'is_active must be a boolean'
      });
    }

    const update = {
      variant_ids,
      is_active
    };

    const result = await variantBulkOperationsService.bulkUpdateActivation(update);
    
    res.json({
      success: true,
      ...result,
      message: `Bulk activation update completed: ${result.success_count} success, ${result.error_count} errors`
    });
  } catch (error: unknown) {
    logger.error('[VARIANT BULK OPERATIONS] Bulk activation error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk activation update',
      message: errorMessage
    });
  }
});

/**
 * POST /api/variants-singleton/bulk/create
 * Bulk create variants for a parent product
 */
router.post('/bulk/create', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { parent_item_id, variants } = req.body;

    if (!parent_item_id) {
      return res.status(400).json({
        success: false,
        error: 'Parent item ID is required'
      });
    }

    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Variants array is required and cannot be empty'
      });
    }

    const result = await variantBulkOperationsService.bulkCreateVariants(parent_item_id, variants);
    
    res.status(201).json({
      success: true,
      ...result,
      message: `Bulk variant creation completed: ${result.success_count} variants created`
    });
  } catch (error: unknown) {
    logger.error('[VARIANT BULK OPERATIONS] Bulk create error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk variant creation',
      message: errorMessage
    });
  }
});

/**
 * DELETE /api/variants-singleton/bulk/delete
 * Bulk delete variants
 */
router.delete('/bulk/delete', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { variant_ids } = req.body;

    if (!Array.isArray(variant_ids) || variant_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Variant IDs array is required and cannot be empty'
      });
    }

    const result = await variantBulkOperationsService.bulkDeleteVariants(variant_ids);
    
    res.json({
      success: true,
      ...result,
      message: `Bulk variant deletion completed: ${result.success_count} success, ${result.error_count} errors`
    });
  } catch (error: unknown) {
    logger.error('[VARIANT BULK OPERATIONS] Bulk delete error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk variant deletion',
      message: errorMessage
    });
  }
});

/**
 * POST /api/variants-singleton/bulk/attributes
 * Bulk update variant attributes
 */
router.post('/bulk/attributes', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { variant_ids, attributes } = req.body;

    if (!Array.isArray(variant_ids) || variant_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Variant IDs array is required and cannot be empty'
      });
    }

    if (!attributes || typeof attributes !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Attributes object is required'
      });
    }

    const result = await variantBulkOperationsService.bulkUpdateAttributes(variant_ids, attributes);
    
    res.json({
      success: true,
      ...result,
      message: `Bulk attribute update completed: ${result.success_count} success, ${result.error_count} errors`
    });
  } catch (error: unknown) {
    logger.error('[VARIANT BULK OPERATIONS] Bulk attributes error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk attribute update',
      message: errorMessage
    });
  }
});

/**
 * POST /api/variants-singleton/bulk/sort-order
 * Bulk update variant sort order
 */
router.post('/bulk/sort-order', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { variant_orders } = req.body;

    if (!Array.isArray(variant_orders) || variant_orders.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Variant orders array is required and cannot be empty'
      });
    }

    // Validate each order entry
    for (const order of variant_orders) {
      if (!order.variant_id || typeof order.sort_order !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Each order entry must have variant_id and sort_order'
        });
      }
    }

    const result = await variantBulkOperationsService.bulkUpdateSortOrder(variant_orders);
    
    res.json({
      success: true,
      ...result,
      message: `Bulk sort order update completed: ${result.success_count} success, ${result.error_count} errors`
    });
  } catch (error: unknown) {
    logger.error('[VARIANT BULK OPERATIONS] Bulk sort order error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk sort order update',
      message: errorMessage
    });
  }
});

/**
 * GET /api/variants-singleton/bulk/stats
 * Get bulk operation statistics
 */
router.get('/bulk/stats', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const stats = await variantBulkOperationsService.getBulkOperationStats(user.tenantId);
    
    res.json({
      success: true,
      stats,
      message: 'Bulk operation statistics retrieved successfully'
    });
  } catch (error: unknown) {
    logger.error('[VARIANT BULK OPERATIONS] Get stats error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve bulk operation statistics',
      message: errorMessage
    });
  }
});

export default router;
