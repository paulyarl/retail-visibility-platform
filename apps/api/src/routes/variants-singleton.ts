/**
 * Variants API Routes - UniversalSingleton Implementation
 * Integrates VariantService with Express API
 */

import { Router, Request, Response } from 'express';
import { VariantService } from '../services/VariantService';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

// Get singleton instance
const variantService = VariantService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * GET /api/variants-singleton/items/:itemId/variants
 * Get all variants for a parent item
 */
router.get('/items/:itemId/variants', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const user = (req as any).user;

    // Verify user has access to the tenant
    const variants = await variantService.getVariants(itemId);
    
    // Additional tenant check
    if (variants.length > 0 && variants[0].tenant_id !== user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ variants });
  } catch (error: unknown) {
    logger.error('[VARIANTS SINGLETON] Get variants error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to fetch variants',
      message: errorMessage
    });
  }
});

/**
 * POST /api/variants-singleton/items/:itemId/variants
 * Create a new variant for an item
 */
router.post('/items/:itemId/variants', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const user = (req as any).user;

    const variant = await variantService.createVariant(itemId, req.body);
    
    res.status(201).json({
      success: true,
      variant,
      message: 'Variant created successfully'
    });
  } catch (error: unknown) {
    logger.error('[VARIANTS SINGLETON] Create variant error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to create variant',
      message: errorMessage
    });
  }
});

/**
 * POST /api/variants-singleton/items/:itemId/variants/bulk
 * Create multiple variants at once
 */
router.post('/items/:itemId/variants/bulk', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const { variants } = req.body;

    if (!Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Variants array is required'
      });
    }

    const result = await variantService.createVariantsBulk(itemId, variants);
    
    res.status(201).json({
      success: true,
      ...result,
      message: `Created ${result.count} variants successfully`
    });
  } catch (error: unknown) {
    logger.error('[VARIANTS SINGLETON] Bulk create error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to create variants in bulk',
      message: errorMessage
    });
  }
});

/**
 * PUT /api/variants-singleton/variants/:variantId
 * Update a variant
 */
router.put('/variants/:variantId', async (req: Request, res: Response) => {
  try {
    const { variantId } = req.params;
    const user = (req as any).user;

    // Get variant first to check tenant access
    const existingVariant = await variantService.getVariantById(variantId);
    
    if (!existingVariant) {
      return res.status(404).json({
        success: false,
        error: 'Variant not found'
      });
    }

    if (existingVariant.tenant_id !== user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updated = await variantService.updateVariant(variantId, req.body);
    
    res.json({
      success: true,
      variant: updated,
      message: 'Variant updated successfully'
    });
  } catch (error: unknown) {
    logger.error('[VARIANTS SINGLETON] Update variant error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to update variant',
      message: errorMessage
    });
  }
});

/**
 * DELETE /api/variants-singleton/variants/:variantId
 * Delete a variant
 */
router.delete('/variants/:variantId', async (req: Request, res: Response) => {
  try {
    const { variantId } = req.params;
    const user = (req as any).user;

    // Get variant first to check tenant access
    const existingVariant = await variantService.getVariantById(variantId);
    
    if (!existingVariant) {
      return res.status(404).json({
        success: false,
        error: 'Variant not found'
      });
    }

    if (existingVariant.tenant_id !== user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await variantService.deleteVariant(variantId);
    
    res.json({
      success: true,
      message: 'Variant deleted successfully'
    });
  } catch (error: unknown) {
    logger.error('[VARIANTS SINGLETON] Delete variant error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to delete variant',
      message: errorMessage
    });
  }
});

/**
 * DELETE /api/variants-singleton/items/:itemId/variants
 * Delete all variants for an item
 */
router.delete('/items/:itemId/variants', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    const user = (req as any).user;

    const result = await variantService.deleteAllVariants(itemId);
    
    res.json({
      success: true,
      ...result,
      message: `Deleted ${result.count} variants successfully`
    });
  } catch (error: unknown) {
    logger.error('[VARIANTS SINGLETON] Delete all variants error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to delete variants',
      message: errorMessage
    });
  }
});

/**
 * GET /api/variants-singleton/variants/:variantId
 * Get a single variant by ID
 */
router.get('/variants/:variantId', async (req: Request, res: Response) => {
  try {
    const { variantId } = req.params;
    const user = (req as any).user;

    const variant = await variantService.getVariantById(variantId);
    
    if (!variant) {
      return res.status(404).json({
        success: false,
        error: 'Variant not found'
      });
    }

    if (variant.tenant_id !== user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      variant
    });
  } catch (error: unknown) {
    logger.error('[VARIANTS SINGLETON] Get variant error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to fetch variant',
      message: errorMessage
    });
  }
});

/**
 * GET /api/variants-singleton/stats
 * Get variant statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const stats = await variantService.getVariantStats(user.tenantId);
    
    res.json({
      success: true,
      stats,
      message: 'Variant statistics retrieved successfully'
    });
  } catch (error: unknown) {
    logger.error('[VARIANTS SINGLETON] Get stats error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to fetch variant statistics',
      message: errorMessage
    });
  }
});

/**
 * GET /api/variants-singleton/search
 * Search variants by SKU or name
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { q: query, limit = '50' } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const variants = await variantService.searchVariants(
      user.tenantId, 
      query, 
      parseInt(limit as string)
    );
    
    res.json({
      success: true,
      variants,
      query,
      count: variants.length,
      message: 'Search completed successfully'
    });
  } catch (error: unknown) {
    logger.error('[VARIANTS SINGLETON] Search error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Failed to search variants',
      message: errorMessage
    });
  }
});

/**
 * PUT /api/variants-singleton/bulk/operations
 * Enhanced bulk operations with explicit actions (update, delete, create)
 */
router.put('/bulk/operations', async (req: Request, res: Response) => {
  try {
    const { operations, parentItemId } = req.body;
    const user = (req as any).user;

    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid request body', 
        message: 'operations array is required' 
      });
    }

    if (operations.length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Invalid request body', 
        message: 'operations array cannot be empty' 
      });
    }

    // Validate each operation object
    for (const operation of operations) {
      if (!operation.action || !['update', 'delete', 'create'].includes(operation.action)) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid operation format', 
          message: 'Each operation must have a valid action (update, delete, create)' 
        });
      }

      if (operation.action === 'update' && (!operation.variantId || !operation.data)) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid update operation', 
          message: 'Update operations require variantId and data fields' 
        });
      }

      if (operation.action === 'delete' && !operation.variantId) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid delete operation', 
          message: 'Delete operations require variantId field' 
        });
      }

      if (operation.action === 'create' && (!operation.data || !parentItemId)) {
        return res.status(400).json({ 
          success: false,
          error: 'Invalid create operation', 
          message: 'Create operations require data field and parentItemId in request' 
        });
      }
    }

    // Import the bulk operations service
    const { VariantBulkOperationsService } = await import('../services/VariantBulkOperationsService');
    const variantBulkOperationsService = VariantBulkOperationsService.getInstance();

    const result = await variantBulkOperationsService.bulkVariantOperations(operations, parentItemId);
    
    res.json({
      success: true,
      ...result,
      message: `Bulk variant operations completed: ${result.success_count} successful, ${result.error_count} failed`
    });
  } catch (error: unknown) {
    logger.error('[PUT /bulk/operations] Error: ' + (error instanceof Error ? error.message : 'Unknown error'), undefined, { error });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({
      success: false,
      error: 'Bulk operations failed',
      message: errorMessage
    });
  }
});

export default router;
