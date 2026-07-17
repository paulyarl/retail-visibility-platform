/**
 * Barcode Enrichment API Routes - UniversalSingleton Implementation
 * Integrates BarcodeEnrichmentSingletonService with Express API
 */

import { Router } from 'express';
import BarcodeEnrichmentSingletonService from '../services/BarcodeEnrichmentSingletonService';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../logger';

const router = Router();

// Get singleton instance
const barcodeEnrichmentService = BarcodeEnrichmentSingletonService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Enrich a single barcode
 * POST /api/barcode-enrichment-singleton/enrich
 */
router.post('/enrich', async (req, res) => {
  try {
    const { barcode, tenantId, provider } = req.body;
    
    // Validate required fields
    if (!barcode || !tenantId) {
      return res.status(400).json({
        success: false,
        message: 'barcode and tenantId are required'
      });
    }

    // Validate provider
    if (provider && !['upc_database', 'open_food_facts', 'barcodelookup', 'goupc', 'kroger'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'provider must be one of: "upc_database", "open_food_facts", "barcodelookup", "goupc", "kroger"'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const result = await barcodeEnrichmentService.enrichBarcode(
      barcode,
      tenantId,
      provider as any || 'upc_database'
    );
    
    res.json({
      success: true,
      data: {
        barcode,
        result,
        timestamp: new Date().toISOString()
      },
      message: 'Barcode enriched successfully'
    });
  } catch (error) {
    logger.error('[BARCODE ENRICHMENT SINGLETON] Enrich error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      message: 'Failed to enrich barcode',
      error: (error as Error).message
    });
  }
});

/**
 * Enrich multiple barcodes in batch
 * POST /api/barcode-enrichment-singleton/batch
 */
router.post('/batch', async (req, res) => {
  try {
    const { barcodes, tenantId, provider } = req.body;
    
    // Validate required fields
    if (!barcodes || !Array.isArray(barcodes) || !tenantId) {
      return res.status(400).json({
        success: false,
        message: 'barcodes (array) and tenantId are required'
      });
    }

    if (barcodes.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'barcodes array cannot be empty'
      });
    }

    if (barcodes.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 100 barcodes allowed per batch request'
      });
    }

    // Validate provider
    if (provider && !['upc_database', 'open_food_facts', 'barcodelookup', 'goupc', 'kroger'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'provider must be one of: "upc_database", "open_food_facts", "barcodelookup", "goupc", "kroger"'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const results = await barcodeEnrichmentService.enrichBatchBarcodes(
      barcodes,
      tenantId,
      provider as any || 'upc_database'
    );
    
    res.json({
      success: true,
      data: {
        results: Object.fromEntries(results),
        count: results.size,
        timestamp: new Date().toISOString()
      },
      message: 'Batch barcode enrichment completed successfully'
    });
  } catch (error) {
    logger.error('[BARCODE ENRICHMENT SINGLETON] Batch error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      message: 'Failed to enrich barcodes in batch',
      error: (error as Error).message
    });
  }
});

/**
 * Get enrichment statistics
 * GET /api/barcode-enrichment-singleton/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    // Check if user has permission to view stats for this tenant
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId as string)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const stats = await barcodeEnrichmentService.getEnrichmentStats(tenantId as string);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Enrichment statistics retrieved successfully'
    });
  } catch (error) {
    logger.error('[BARCODE ENRICHMENT SINGLETON] Get stats error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch enrichment statistics'
    });
  }
});

/**
 * Get service health status
 * GET /api/barcode-enrichment-singleton/health
 */
router.get('/health', async (req, res) => {
  try {
    const health = await barcodeEnrichmentService.getHealthStatus();
    
    res.json({
      success: true,
      data: {
        health,
        timestamp: new Date().toISOString()
      },
      message: 'Barcode enrichment service health status retrieved successfully'
    });
  } catch (error) {
    logger.error('[BARCODE ENRICHMENT SINGLETON] Health check error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to check service health'
    });
  }
});

/**
 * Clear cache
 * DELETE /api/barcode-enrichment-singleton/cache
 */
router.delete('/cache', async (req, res) => {
  try {
    const { barcode } = req.query;
    
    // Check if user has admin permissions for cache clearing
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required'
      });
    }
    
    await barcodeEnrichmentService.clearCache(barcode as string);
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      message: `Cache cleared${barcode ? ` for barcode ${barcode}` : ' for all barcodes'}`
    });
  } catch (error) {
    logger.error('[BARCODE ENRICHMENT SINGLETON] Clear cache error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

/**
 * Get supported providers
 * GET /api/barcode-enrichment-singleton/providers
 */
router.get('/providers', async (req, res) => {
  try {
    const providers = [
      {
        name: 'barcodelookup',
        displayName: 'BarcodeLookup.com',
        description: 'Commercial barcode database with 1B+ items across all industries',
        rateLimit: '500 requests per hour',
        features: ['product_info', 'images', 'pricing', 'categories', 'store_prices', 'mpn', 'asin']
      },
      {
        name: 'goupc',
        displayName: 'Go-UPC',
        description: 'Commercial barcode lookup with rich specs and ingredients data',
        rateLimit: '500 requests per hour',
        features: ['product_info', 'images', 'specs', 'ingredients', 'categories']
      },
      {
        name: 'kroger',
        displayName: 'Kroger Developer API',
        description: 'Kroger grocery catalog with OAuth2 authentication',
        rateLimit: '500 requests per hour',
        features: ['product_info', 'images', 'pricing', 'categories', 'fulfillment_types']
      },
      {
        name: 'upc_database',
        displayName: 'UPC Database',
        description: 'Comprehensive UPC barcode database with product information',
        rateLimit: '500 requests per hour',
        features: ['product_info', 'images', 'pricing', 'categories']
      },
      {
        name: 'open_food_facts',
        displayName: 'Open Food Facts',
        description: 'Open database of food products with nutritional information',
        rateLimit: '500 requests per hour',
        features: ['product_info', 'nutrition', 'ingredients', 'categories']
      }
    ];
    
    res.json({
      success: true,
      data: {
        providers,
        timestamp: new Date().toISOString()
      },
      message: 'Supported providers retrieved successfully'
    });
  } catch (error) {
    logger.error('[BARCODE ENRICHMENT SINGLETON] Providers error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported providers'
    });
  }
});

/**
 * Test barcode enrichment (for development/testing)
 * POST /api/barcode-enrichment-singleton/test
 */
router.post('/test', async (req, res) => {
  try {
    const { barcode = '0123456789012', tenantId = 'tid-m8ijkrnk', provider = 'upc_database' } = req.body;
    
    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const result = await barcodeEnrichmentService.enrichBarcode(barcode, tenantId, provider);
    
    res.json({
      success: true,
      data: {
        testBarcode: barcode,
        provider,
        result,
        timestamp: new Date().toISOString()
      },
      message: 'Test barcode enrichment completed successfully'
    });
  } catch (error) {
    logger.error('[BARCODE ENRICHMENT SINGLETON] Test error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      message: 'Failed to test barcode enrichment',
      error: (error as Error).message
    });
  }
});

export default router;
