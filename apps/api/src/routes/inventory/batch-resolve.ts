/**
 * Batch Inventory Resolution API Route
 * 
 * Provides bulk product resolution by multiple identifiers:
 * - Product IDs
 * - SKUs
 * - Variant IDs
 * - AutoIds
 * 
 * Optimized for performance with parallel processing
 */

import { Router } from 'express';
import InventorySingletonService from '../../services/InventorySingletonService';
import { logger } from '../../logger';

const router = Router();

/**
 * POST /api/inventory/batch-resolve
 * 
 * Resolve multiple products by any identifiers
 * 
 * Request Body:
 * {
 *   identifiers: string[],
 *   options?: {
 *     includeVariants?: boolean,
 *     includeAnalytics?: boolean,
 *     includeUrls?: boolean,
 *     maxConcurrency?: number
 *   }
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     results: ProductResolution[],
 *     summary: {
 *       total: number,
 *       found: number,
 *       notFound: number,
 *       errors: number
 *     },
 *     processingTime: number
 *   },
 *   message: string
 * }
 */
router.post('/', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { identifiers, options = {} } = req.body;

    // Validate request
    if (!Array.isArray(identifiers) || identifiers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Identifiers array is required and cannot be empty'
      });
    }

    if (identifiers.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'too_many_identifiers',
        message: 'Maximum 100 identifiers allowed per request'
      });
    }

    const {
      includeVariants = false,
      includeAnalytics = false,
      includeUrls = true,
      maxConcurrency = 10
    } = options;

    // Get inventory service instance
    const inventoryService = InventorySingletonService.getInstance();
    
    // Process identifiers in batches for performance
    const results: any[] = [];
    const errors: any[] = [];
    
    // Split into batches
    const batchSize = Math.min(maxConcurrency, 10);
    const batches = [];
    for (let i = 0; i < identifiers.length; i += batchSize) {
      batches.push(identifiers.slice(i, i + batchSize));
    }

    // Process each batch
    for (const batch of batches) {
      const batchPromises = batch.map(async (identifier: string) => {
        try {
          const resolution = await inventoryService.resolveProductByIdentifier(identifier);
          
          // Enhance response based on options
          if (resolution.found && resolution.product) {
            // Include URLs if requested
            if (includeUrls) {
              resolution.product.urls = await inventoryService.generateProductUrls(resolution.product);
            }
            
            // Filter data based on options
            if (!includeVariants) {
              delete resolution.product.variants;
            }
            
            if (!includeAnalytics) {
              delete resolution.product.viewCount;
              delete resolution.product.orderCount;
              delete resolution.product.revenue;
            }
          }
          
          return {
            identifier,
            ...resolution,
            success: true
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.error('[Batch Resolution Error]', undefined, {
            identifier,
            error: errorMessage
          });
          
          return {
            identifier,
            found: false,
            success: false,
            error: errorMessage
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    // Calculate summary
    const summary = {
      total: identifiers.length,
      found: results.filter(r => r.found).length,
      notFound: results.filter(r => !r.found && r.success).length,
      errors: results.filter(r => !r.success).length
    };

    const processingTime = Date.now() - startTime;

    res.json({
      success: true,
      data: {
        results,
        summary,
        processingTime
      },
      message: `Batch resolution completed: ${summary.found}/${summary.total} found`
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('[Batch Resolution Error]', undefined, {
      error: errorMessage,
      stack: errorStack,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to process batch resolution'
    });
  }
});

/**
 * POST /api/inventory/batch-resolve/validate
 * 
 * Validate identifiers before processing
 * 
 * Request Body:
 * {
 *   identifiers: string[]
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     valid: string[],
 *     invalid: string[],
 *     duplicates: string[],
 *     summary: {
 *       total: number,
 *       valid: number,
 *       invalid: number,
 *       duplicates: number
 *     }
 *   }
 * }
 */
router.post('/validate', async (req, res) => {
  try {
    const { identifiers } = req.body;

    if (!Array.isArray(identifiers)) {
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Identifiers must be an array'
      });
    }

    // Validate each identifier
    const valid: string[] = [];
    const invalid: string[] = [];
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const identifier of identifiers) {
      // Check for duplicates
      if (seen.has(identifier)) {
        duplicates.push(identifier);
        continue;
      }
      seen.add(identifier);

      // Validate format
      if (typeof identifier === 'string' && identifier.trim().length > 0) {
        valid.push(identifier.trim());
      } else {
        invalid.push(identifier);
      }
    }

    const summary = {
      total: identifiers.length,
      valid: valid.length,
      invalid: invalid.length,
      duplicates: duplicates.length
    };

    res.json({
      success: true,
      data: {
        valid,
        invalid,
        duplicates,
        summary
      },
      message: 'Validation completed'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('[Validation Error]', undefined, { error: errorMessage });
    
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to validate identifiers'
    });
  }
});

export default router;
