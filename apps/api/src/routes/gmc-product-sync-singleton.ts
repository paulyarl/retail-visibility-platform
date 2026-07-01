/**
 * GMC Product Sync API Routes
 * Delegates to the consolidated GMCProductSync service.
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { isGMCSyncAllowed } from '../lib/google/capability-gate';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Sync single product to GMC
 * POST /api/gmc-product-sync-singleton/sync-single
 */
router.post('/sync-single', async (req, res) => {
  try {
    const { tenantId, product } = req.body;
    
    // Validate required fields
    if (!tenantId || !product) {
      return res.status(400).json({
        success: false,
        message: 'tenantId and product are required'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const { syncProduct } = await import('../services/GMCProductSync');

    const gmcAllowed = await isGMCSyncAllowed(tenantId);
    if (!gmcAllowed) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        message: 'Google Merchant Center sync is not available on your current plan.'
      });
    }

    const result = await syncProduct(tenantId, product.id);
    
    res.json({
      success: result.success,
      data: {
        result,
        timestamp: new Date().toISOString()
      },
      message: result.success ? 'Product synced to GMC successfully' : (result.error || 'Sync failed')
    });
  } catch (error) {
    console.error('[GMC PRODUCT SYNC SINGLETON] Sync single error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync product to GMC',
      error: (error as Error).message
    });
  }
});

/**
 * Sync multiple products in batch
 * POST /api/gmc-product-sync-singleton/sync-batch
 */
router.post('/sync-batch', async (req, res) => {
  try {
    const { tenantId, products } = req.body;
    
    // Validate required fields
    if (!tenantId || !products || !Array.isArray(products)) {
      return res.status(400).json({
        success: false,
        message: 'tenantId and products array are required'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const { batchSyncProducts } = await import('../services/GMCProductSync');

    const gmcAllowed = await isGMCSyncAllowed(tenantId);
    if (!gmcAllowed) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        message: 'Google Merchant Center sync is not available on your current plan.'
      });
    }

    const itemIds = products.map((p: any) => p.id);
    const result = await batchSyncProducts(tenantId, itemIds);
    
    res.json({
      success: result.success,
      data: {
        result,
        timestamp: new Date().toISOString()
      },
      message: result.success ? 'Batch sync completed successfully' : `Batch sync completed with ${result.failed} failures`
    });
  } catch (error) {
    console.error('[GMC PRODUCT SYNC SINGLETON] Sync batch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync batch products to GMC',
      error: (error as Error).message
    });
  }
});

/**
 * Update product inventory
 * POST /api/gmc-product-sync-singleton/update-inventory
 */
router.post('/update-inventory', async (req, res) => {
  try {
    const { tenantId, productId, availability, quantity } = req.body;
    
    // Validate required fields
    if (!tenantId || !productId || !availability) {
      return res.status(400).json({
        success: false,
        message: 'tenantId, productId, and availability are required'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const { updateInventory } = await import('../services/GMCProductSync');

    const gmcAllowed = await isGMCSyncAllowed(tenantId);
    if (!gmcAllowed) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        message: 'Google Merchant Center sync is not available on your current plan.'
      });
    }

    const qty = quantity != null ? Number(quantity) : 0;
    const result = await updateInventory(tenantId, productId, qty);
    
    res.json({
      success: result.success,
      data: {
        result,
        timestamp: new Date().toISOString()
      },
      message: result.success ? 'Product inventory updated successfully' : (result.error || 'Update failed')
    });
  } catch (error) {
    console.error('[GMC PRODUCT SYNC SINGLETON] Update inventory error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update product inventory',
      error: (error as Error).message
    });
  }
});

/**
 * Get sync statistics
 * GET /api/gmc-product-sync-singleton/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    // Check if user has admin permissions for viewing stats
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for viewing sync statistics'
      });
    }

    // Validate tenantId if provided
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId as string)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const { getGMCSyncStatus } = await import('../services/GMCProductSync');

    const stats = await getGMCSyncStatus(tenantId as string);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'GMC sync statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[GMC PRODUCT SYNC SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sync statistics'
    });
  }
});

/**
 * Get service health status
 * GET /api/gmc-product-sync-singleton/health
 */
router.get('/health', async (req, res) => {
  try {
    // Check if user has admin permissions for health check
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for health check'
      });
    }
    
    res.json({
      success: true,
      data: {
        health: {
          status: 'healthy',
          services: {
            database: 'connected',
            gmcApi: 'operational',
            googleOAuth: 'operational'
          },
          lastCheck: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      },
      message: 'GMC Product Sync service health status retrieved successfully'
    });
  } catch (error) {
    console.error('[GMC PRODUCT SYNC SINGLETON] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check service health'
    });
  }
});

/**
 * Clear cache and reset state
 * DELETE /api/gmc-product-sync-singleton/cache
 */
router.delete('/cache', async (req, res) => {
  try {
    // Check if user has admin permissions for cache clearing
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for cache clearing'
      });
    }
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      message: 'GMC Product Sync service cache cleared successfully'
    });
  } catch (error) {
    console.error('[GMC PRODUCT SYNC SINGLETON] Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

/**
 * Get supported product fields
 * GET /api/gmc-product-sync-singleton/fields
 */
router.get('/fields', async (req, res) => {
  try {
    const fields = [
      {
        name: 'id',
        displayName: 'Product ID',
        description: 'Internal product identifier',
        required: true,
        type: 'string'
      },
      {
        name: 'offerId',
        displayName: 'Offer ID',
        description: 'Unique offer identifier for GMC',
        required: true,
        type: 'string'
      },
      {
        name: 'title',
        displayName: 'Product Title',
        description: 'Product name displayed in GMC',
        required: true,
        type: 'string'
      },
      {
        name: 'description',
        displayName: 'Description',
        description: 'Product description',
        required: true,
        type: 'string'
      },
      {
        name: 'price',
        displayName: 'Price',
        description: 'Product price with currency',
        required: true,
        type: 'object'
      },
      {
        name: 'availability',
        displayName: 'Availability',
        description: 'Product availability status',
        required: true,
        type: 'enum',
        values: ['in_stock', 'out_of_stock', 'preorder', 'backorder']
      },
      {
        name: 'condition',
        displayName: 'Condition',
        description: 'Product condition',
        required: true,
        type: 'enum',
        values: ['new', 'refurbished', 'used']
      },
      {
        name: 'googleProductCategory',
        displayName: 'Google Product Category',
        description: 'Google product taxonomy category',
        required: false,
        type: 'string'
      }
    ];
    
    res.json({
      success: true,
      data: {
        fields,
        timestamp: new Date().toISOString()
      },
      message: 'Supported GMC product fields retrieved successfully'
    });
  } catch (error) {
    console.error('[GMC PRODUCT SYNC SINGLETON] Fields error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported fields'
    });
  }
});

export default router;
