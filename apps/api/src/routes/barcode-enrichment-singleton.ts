/**
 * Barcode Enrichment API Routes - UniversalSingleton Implementation
 * Integrates BarcodeEnrichmentSingletonService with Express API
 */

import { Router } from 'express';
import BarcodeEnrichmentSingletonService from '../services/BarcodeEnrichmentSingletonService';
import { authenticateToken } from '../middleware/auth';

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
    if (provider && !['upc_database', 'open_food_facts'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'provider must be either "upc_database" or "open_food_facts"'
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
      provider || 'upc_database'
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
    console.error('[BARCODE ENRICHMENT SINGLETON] Enrich error:', error);
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
    if (provider && !['upc_database', 'open_food_facts'].includes(provider)) {
      return res.status(400).json({
        success: false,
        message: 'provider must be either "upc_database" or "open_food_facts"'
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
      provider || 'upc_database'
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
    console.error('[BARCODE ENRICHMENT SINGLETON] Batch error:', error);
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
    console.error('[BARCODE ENRICHMENT SINGLETON] Get stats error:', error);
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
    console.error('[BARCODE ENRICHMENT SINGLETON] Health check error:', error);
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
    console.error('[BARCODE ENRICHMENT SINGLETON] Clear cache error:', error);
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
    console.error('[BARCODE ENRICHMENT SINGLETON] Providers error:', error);
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
    console.error('[BARCODE ENRICHMENT SINGLETON] Test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test barcode enrichment',
      error: (error as Error).message
    });
  }
});

export default router;
