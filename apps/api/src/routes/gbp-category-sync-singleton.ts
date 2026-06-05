/**
 * GBP Category Sync API Routes - UniversalSingleton Implementation
 * Integrates GBPCategorySyncSingletonService with Express API
 */

import { Router } from 'express';
import GBPCategorySyncSingletonService from '../services/GBPCategorySyncSingletonService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get singleton instance
const gbpCategorySyncService = GBPCategorySyncSingletonService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Sync GBP categories
 * POST /api/gbp-category-sync-singleton/sync
 */
router.post('/sync', async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    // Check if user has admin permissions for sync operations
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for sync operations'
      });
    }

    // Validate tenantId if provided
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const stats = await gbpCategorySyncService.syncGBPCategories(tenantId);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: `GBP category sync completed${tenantId ? ` for tenant ${tenantId}` : ' for all tenants'}`
    });
  } catch (error) {
    console.error('[GBP CATEGORY SYNC SINGLETON] Sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync GBP categories',
      error: (error as Error).message
    });
  }
});

/**
 * Get sync statistics
 * GET /api/gbp-category-sync-singleton/stats
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
    
    const stats = await gbpCategorySyncService.getSyncStats(tenantId as string);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'GBP category sync statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[GBP CATEGORY SYNC SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sync statistics'
    });
  }
});

/**
 * Get available GBP categories
 * GET /api/gbp-category-sync-singleton/categories
 */
router.get('/categories', async (req, res) => {
  try {
    // Check if user has admin permissions for viewing categories
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for viewing GBP categories'
      });
    }
    
    const categories = await gbpCategorySyncService.getAvailableCategories();
    
    res.json({
      success: true,
      data: {
        categories,
        count: categories.length,
        timestamp: new Date().toISOString()
      },
      message: 'GBP categories retrieved successfully'
    });
  } catch (error) {
    console.error('[GBP CATEGORY SYNC SINGLETON] Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve GBP categories'
    });
  }
});

/**
 * Force refresh of GBP categories
 * POST /api/gbp-category-sync-singleton/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    // Check if user has admin permissions for force refresh
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for force refresh'
      });
    }

    // Validate tenantId if provided
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const stats = await gbpCategorySyncService.forceRefresh(tenantId);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: `GBP category force refresh completed${tenantId ? ` for tenant ${tenantId}` : ' for all tenants'}`
    });
  } catch (error) {
    console.error('[GBP CATEGORY SYNC SINGLETON] Refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to force refresh GBP categories',
      error: (error as Error).message
    });
  }
});

/**
 * Get service health status
 * GET /api/gbp-category-sync-singleton/health
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
    
    const health = await gbpCategorySyncService.getHealthStatus();
    
    res.json({
      success: true,
      data: {
        health,
        timestamp: new Date().toISOString()
      },
      message: 'GBP category sync service health status retrieved successfully'
    });
  } catch (error) {
    console.error('[GBP CATEGORY SYNC SINGLETON] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check service health'
    });
  }
});

/**
 * Clear cache
 * DELETE /api/gbp-category-sync-singleton/cache
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
    
    await gbpCategorySyncService.clearCache();
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      message: 'GBP category sync cache cleared successfully'
    });
  } catch (error) {
    console.error('[GBP CATEGORY SYNC SINGLETON] Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

/**
 * Test GBP category sync (for development/testing)
 * POST /api/gbp-category-sync-singleton/test
 */
router.post('/test', async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    // Check if user has admin permissions for testing
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for testing'
      });
    }

    // Validate tenantId if provided
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    // Test with a small subset of categories
    const stats = await gbpCategorySyncService.syncGBPCategories(tenantId);
    
    res.json({
      success: true,
      data: {
        testTenantId: tenantId || 'all',
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'GBP category sync test completed successfully'
    });
  } catch (error) {
    console.error('[GBP CATEGORY SYNC SINGLETON] Test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test GBP category sync',
      error: (error as Error).message
    });
  }
});

/**
 * Get sync status
 * GET /api/gbp-category-sync-singleton/status
 */
router.get('/status', async (req, res) => {
  try {
    // Check if user has admin permissions for status check
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for status check'
      });
    }
    
    const health = await gbpCategorySyncService.getHealthStatus();
    const stats = await gbpCategorySyncService.getSyncStats();
    
    res.json({
      success: true,
      data: {
        health,
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'GBP category sync status retrieved successfully'
    });
  } catch (error) {
    console.error('[GBP CATEGORY SYNC SINGLETON] Status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sync status'
    });
  }
});

export default router;
