/**
 * Inventory Resolution API Route
 * 
 * Provides product resolution by any identifier:
 * - Product ID
 * - SKU
 * - Variant ID
 * - AutoId
 * 
 * Part of the Universal Singleton Service system
 */

import { Router } from 'express';
import InventorySingletonService from '../../services/InventorySingletonService';
import { logger } from '../../logger';

const router = Router();

/**
 * GET /api/inventory/resolve/:identifier
 * 
 * Resolve a product by any identifier (ID, SKU, variant ID, autoId)
 * 
 * Query Parameters:
 * - includeVariants (boolean): Include variant information
 * - includeAnalytics (boolean): Include analytics data
 * - includeUrls (boolean): Include URL generation (default: true)
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: ProductResolution,
 *   message: string
 * }
 */
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const { 
      includeVariants = 'false',
      includeAnalytics = 'false',
      includeUrls = 'true'
    } = req.query;

    // Validate identifier
    if (!identifier || identifier.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'invalid_identifier',
        message: 'Identifier is required'
      });
    }

    // Get inventory service instance
    const inventoryService = InventorySingletonService.getInstance();
    
    // Resolve product
    const resolution = await inventoryService.resolveProductByIdentifier(identifier);
    
    // Enhance response based on query parameters
    if (resolution.found && resolution.product) {
      // Include URLs if requested
      if (includeUrls === 'true') {
        resolution.product.urls = await inventoryService.generateProductUrls(resolution.product);
      }
      
      // Filter variants if not requested
      if (includeVariants !== 'true') {
        delete resolution.product.variants;
      }
      
      // Filter analytics if not requested
      if (includeAnalytics !== 'true') {
        delete resolution.product.viewCount;
        delete resolution.product.orderCount;
        delete resolution.product.revenue;
      }
    }

    res.json({
      success: resolution.found,
      data: resolution,
      message: resolution.found 
        ? 'Product resolved successfully' 
        : 'Product not found'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('[Product Resolution Error]', undefined, {
      identifier: req.params.identifier,
      error: errorMessage,
      stack: errorStack
    });
    
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve product'
    });
  }
});

/**
 * GET /api/inventory/resolve/:identifier/metrics
 * 
 * Get resolution metrics for monitoring
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     cacheHits: number,
 *     cacheMisses: number,
 *     cacheHitRate: number,
 *     lastUpdated: string
 *   }
 * }
 */
router.get('/:identifier/metrics', async (req, res) => {
  try {
    const inventoryService = InventorySingletonService.getInstance();
    const metrics = inventoryService.getMetrics();
    
    res.json({
      success: true,
      data: metrics,
      message: 'Metrics retrieved successfully'
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Metrics Error]', undefined, { error: errorMessage });
    
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to retrieve metrics'
    });
  }
});

export default router;
