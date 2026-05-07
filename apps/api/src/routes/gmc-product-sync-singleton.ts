/**
 * GMC Product Sync API Routes - UniversalSingleton Implementation
 * Integrates GMCProductSyncSingletonService with Express API
 */

import { Router } from 'express';
import GMCProductSyncSingletonService from '../services/GMCProductSyncSingletonService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get singleton instance
const gmcProductSyncService = GMCProductSyncSingletonService.getInstance();

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
    
    const result = await gmcProductSyncService.syncSingleProduct(tenantId, product);
    
    res.json({
      success: true,
      data: {
        result,
        timestamp: new Date().toISOString()
      },
      message: 'Product synced to GMC successfully'
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
    
    const result = await gmcProductSyncService.syncBatchProducts(tenantId, products);
    
    res.json({
      success: true,
      data: {
        result,
        timestamp: new Date().toISOString()
      },
      message: 'Batch sync completed successfully'
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
    
    const result = await gmcProductSyncService.updateProductInventory(tenantId, productId, availability, quantity);
    
    res.json({
      success: true,
      data: {
        result,
        timestamp: new Date().toISOString()
      },
      message: 'Product inventory updated successfully'
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
    
    const stats = await gmcProductSyncService.getSyncStats(tenantId as string);
    
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
    
    const health = await gmcProductSyncService.getHealthStatus();
    
    res.json({
      success: true,
      data: {
        health,
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
    
    await gmcProductSyncService.clearCache();
    
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
 * Test GMC sync operations (for development/testing)
 * POST /api/gmc-product-sync-singleton/test
 */
router.post('/test', async (req, res) => {
  try {
    const { operation, tenantId } = req.body;
    
    // Check if user has admin permissions for testing
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for testing'
      });
    }

    // Validate operation
    if (!operation || !['single_sync', 'batch_sync', 'inventory_update'].includes(operation)) {
      return res.status(400).json({
        success: false,
        message: 'operation must be one of: single_sync, batch_sync, inventory_update'
      });
    }

    // Validate tenantId if provided
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const testTenantId = tenantId || 'tid-m8ijkrnk';
    let result;
    
    switch (operation) {
      case 'single_sync':
        const testProduct = {
          id: 'test-product-123',
          offerId: 'test-offer-123',
          title: 'Test Product',
          description: 'Test product description',
          link: 'https://example.com/test-product',
          imageLink: 'https://example.com/test-image.jpg',
          price: { value: '29.99', currency: 'USD' },
          availability: 'in_stock' as const,
          condition: 'new' as const,
          brand: 'Test Brand',
          googleProductCategory: 'Electronics > Computers'
        };
        result = await gmcProductSyncService.syncSingleProduct(testTenantId, testProduct);
        break;
      case 'batch_sync':
        const testProducts = [
          {
            id: 'test-product-1',
            offerId: 'test-offer-1',
            title: 'Test Product 1',
            description: 'Test product 1 description',
            link: 'https://example.com/test-product-1',
            imageLink: 'https://example.com/test-image-1.jpg',
            price: { value: '29.99', currency: 'USD' },
            availability: 'in_stock' as const,
            condition: 'new' as const
          },
          {
            id: 'test-product-2',
            offerId: 'test-offer-2',
            title: 'Test Product 2',
            description: 'Test product 2 description',
            link: 'https://example.com/test-product-2',
            imageLink: 'https://example.com/test-image-2.jpg',
            price: { value: '39.99', currency: 'USD' },
            availability: 'in_stock' as const,
            condition: 'new' as const
          }
        ];
        result = await gmcProductSyncService.syncBatchProducts(testTenantId, testProducts);
        break;
      case 'inventory_update':
        result = await gmcProductSyncService.updateProductInventory(testTenantId, 'test-product-123', 'out_of_stock', 0);
        break;
    }
    
    res.json({
      success: true,
      data: {
        operation,
        result,
        timestamp: new Date().toISOString()
      },
      message: `GMC Product Sync test (${operation}) completed successfully`
    });
  } catch (error) {
    console.error('[GMC PRODUCT SYNC SINGLETON] Test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test GMC Product Sync operation',
      error: (error as Error).message
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
