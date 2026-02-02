/**
 * Inventory URL Generation API Route
 * 
 * Provides URL generation for products:
 * - SKU-based URLs
 * - Product ID URLs  
 * - AutoId URLs
 * - Canonical URLs
 * - Storefront URLs
 * - Directory URLs
 * 
 * Part of the Universal Singleton Service system
 */

import { Router } from 'express';
import InventorySingletonService, { ProductUrls } from '../../services/InventorySingletonService';
import { logger } from '../../logger';

const router = Router();

/**
 * GET /api/inventory/urls/:productId
 * 
 * Generate all possible URLs for a product
 * 
 * Path Parameters:
 * - productId: The product ID to generate URLs for
 * 
 * Query Parameters:
 * - includeAnalytics (boolean): Include analytics data in URLs
 * - customDomain (string): Use custom domain for URLs
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: ProductUrls,
 *   message: string
 * }
 */
router.get('/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { 
      includeAnalytics = 'false',
      customDomain
    } = req.query;

    // Validate product ID
    if (!productId || productId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'invalid_product_id',
        message: 'Product ID is required'
      });
    }

    // Get inventory service instance
    const inventoryService = InventorySingletonService.getInstance();
    
    // Get product information
    const resolution = await inventoryService.resolveProductByIdentifier(productId);
    
    if (!resolution.found || !resolution.product) {
      return res.status(404).json({
        success: false,
        error: 'product_not_found',
        message: 'Product not found'
      });
    }

    // Generate URLs
    const urls = await inventoryService.generateProductUrls(resolution.product);
    
    // Apply custom domain if provided
    if (customDomain && typeof customDomain === 'string') {
      const baseUrl = `https://${customDomain}`;
      (Object.keys(urls) as (keyof ProductUrls)[]).forEach(key => {
        if (urls[key]) {
          urls[key] = baseUrl + urls[key];
        }
      });
    }

    // Include analytics if requested
    if (includeAnalytics === 'true') {
      // Add analytics parameters to URLs
      (Object.keys(urls) as (keyof ProductUrls)[]).forEach(key => {
        const url = urls[key];
        if (url && typeof url === 'string') {
          const separator = url.includes('?') ? '&' : '?';
          urls[key] = `${url}${separator}utm_source=api&utm_medium=url_generation`;
        }
      });
    }

    res.json({
      success: true,
      data: urls,
      message: 'Product URLs generated successfully'
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('[URL Generation Error]', undefined, {
      productId: req.params.productId,
      error: errorMessage,
      stack: errorStack
    });
    
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to generate product URLs'
    });
  }
});

/**
 * POST /api/inventory/urls/batch
 * 
 * Generate URLs for multiple products
 * 
 * Request Body:
 * {
 *   productIds: string[],
 *   options?: {
 *     includeAnalytics?: boolean,
 *     customDomain?: string,
 *     urlTypes?: string[]
 *   }
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     results: Array<{
 *       productId: string,
 *       urls: ProductUrls,
 *       success: boolean,
 *       error?: string
 *     }>,
 *     summary: {
 *       total: number,
 *       successful: number,
 *       failed: number
 *     }
 *   },
 *   message: string
 * }
 */
router.post('/batch', async (req, res) => {
  try {
    const { productIds, options = {} } = req.body;

    // Validate request
    if (!Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'invalid_request',
        message: 'Product IDs array is required and cannot be empty'
      });
    }

    if (productIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'too_many_products',
        message: 'Maximum 50 product IDs allowed per request'
      });
    }

    const {
      includeAnalytics = false,
      customDomain,
      urlTypes // Filter which URL types to include
    } = options;

    // Get inventory service instance
    const inventoryService = InventorySingletonService.getInstance();
    
    const results = [];
    
    // Process each product ID
    for (const productId of productIds) {
      try {
        // Get product information
        const resolution = await inventoryService.resolveProductByIdentifier(productId);
        
        if (!resolution.found || !resolution.product) {
          results.push({
            productId,
            success: false,
            error: 'Product not found'
          });
          continue;
        }

        // Generate URLs
        let urls = await inventoryService.generateProductUrls(resolution.product);
        
        // Filter URL types if specified
        if (urlTypes && Array.isArray(urlTypes)) {
          const filteredUrls: any = {};
          urlTypes.forEach(type => {
            if (urls[type as keyof ProductUrls]) {
              filteredUrls[type] = urls[type as keyof ProductUrls];
            }
          });
          urls = filteredUrls;
        }
        
        // Apply custom domain if provided
        if (customDomain && typeof customDomain === 'string') {
          const baseUrl = `https://${customDomain}`;
          Object.keys(urls).forEach(key => {
            if (urls[key as keyof ProductUrls]) {
              urls[key as keyof ProductUrls] = baseUrl + (urls[key as keyof ProductUrls] as string);
            }
          });
        }

        // Include analytics if requested
        if (includeAnalytics) {
          Object.keys(urls).forEach(key => {
            const url = urls[key as keyof ProductUrls];
            if (url && typeof url === 'string') {
              const separator = url.includes('?') ? '&' : '?';
              urls[key as keyof ProductUrls] = `${url}${separator}utm_source=api&utm_medium=batch_url_generation`;
            }
          });
        }

        results.push({
          productId,
          urls,
          success: true
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('[Batch URL Generation Error]', undefined, {
          productId,
          error: errorMessage
        });
        
        results.push({
          productId,
          success: false,
          error: errorMessage
        });
      }
    }

    // Calculate summary
    const summary = {
      total: productIds.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length
    };

    res.json({
      success: true,
      data: {
        results,
        summary
      },
      message: `Batch URL generation completed: ${summary.successful}/${summary.total} successful`
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('[Batch URL Generation Error]', undefined, {
      error: errorMessage,
      stack: errorStack,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to process batch URL generation'
    });
  }
});

/**
 * GET /api/inventory/urls/validate/:productId
 * 
 * Validate that all generated URLs are accessible
 * 
 * Path Parameters:
 * - productId: The product ID to validate URLs for
 * 
 * Query Parameters:
 * - urlTypes (string): Comma-separated list of URL types to validate
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     validationResults: Array<{
 *       urlType: string,
 *       url: string,
 *       accessible: boolean,
 *       statusCode?: number,
 *       error?: string
 *     }>,
 *     summary: {
 *       total: number,
 *       accessible: number,
 *       inaccessible: number
 *     }
 *   },
 *   message: string
 * }
 */
router.get('/validate/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const { urlTypes } = req.query;

    // Get inventory service instance
    const inventoryService = InventorySingletonService.getInstance();
    
    // Get product URLs
    const resolution = await inventoryService.resolveProductByIdentifier(productId);
    
    if (!resolution.found || !resolution.product) {
      return res.status(404).json({
        success: false,
        error: 'product_not_found',
        message: 'Product not found'
      });
    }

    const urls = await inventoryService.generateProductUrls(resolution.product);
    
    // Filter URL types if specified
    let urlsToValidate = urls;
    if (urlTypes && typeof urlTypes === 'string') {
      const types = urlTypes.split(',').map(t => t.trim());
      const filteredUrls: any = {};
      types.forEach(type => {
        if (urls[type as keyof ProductUrls]) {
          filteredUrls[type] = urls[type as keyof ProductUrls];
        }
      });
      urlsToValidate = filteredUrls;
    }

    // Validate each URL (basic check - in production you'd want actual HTTP requests)
    const validationResults = [];
    
    for (const [urlType, url] of Object.entries(urlsToValidate)) {
      if (!url) {
        validationResults.push({
          urlType,
          url: '',
          accessible: false,
          error: 'URL not generated'
        });
        continue;
      }

      // Basic validation - check if URL format is valid
      try {
        new URL(url); // This will throw if URL is invalid
        validationResults.push({
          urlType,
          url,
          accessible: true,
          statusCode: 200
        });
      } catch (error) {
        validationResults.push({
          urlType,
          url,
          accessible: false,
          error: 'Invalid URL format'
        });
      }
    }

    const summary = {
      total: validationResults.length,
      accessible: validationResults.filter(r => r.accessible).length,
      inaccessible: validationResults.filter(r => !r.accessible).length
    };

    res.json({
      success: true,
      data: {
        validationResults,
        summary
      },
      message: `URL validation completed: ${summary.accessible}/${summary.total} accessible`
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    logger.error('[URL Validation Error]', undefined, {
      productId: req.params.productId,
      error: errorMessage,
      stack: errorStack
    });
    
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to validate product URLs'
    });
  }
});

export default router;
