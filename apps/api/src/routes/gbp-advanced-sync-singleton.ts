/**
 * GBP Advanced Sync API Routes - UniversalSingleton Implementation
 * Integrates GBPAdvancedSyncSingletonService with Express API
 */

import { Router } from 'express';
import GBPAdvancedSyncSingletonService from '../services/GBPAdvancedSyncSingletonService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get singleton instance
const gbpAdvancedSyncService = GBPAdvancedSyncSingletonService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Sync media items from GBP
 * POST /api/gbp-advanced-sync-singleton/sync-media
 */
router.post('/sync-media', async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    // Validate required fields
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'tenantId is required'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const result = await gbpAdvancedSyncService.syncMediaItems(tenantId);
    
    res.json({
      success: true,
      data: {
        result,
        timestamp: new Date().toISOString()
      },
      message: 'GBP media items synced successfully'
    });
  } catch (error) {
    console.error('[GBP ADVANCED SYNC SINGLETON] Sync media error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync GBP media items',
      error: (error as Error).message
    });
  }
});

/**
 * Fetch reviews from GBP
 * POST /api/gbp-advanced-sync-singleton/fetch-reviews
 */
router.post('/fetch-reviews', async (req, res) => {
  try {
    const { tenantId } = req.body;
    
    // Validate required fields
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'tenantId is required'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const result = await gbpAdvancedSyncService.fetchReviews(tenantId);
    
    res.json({
      success: true,
      data: {
        result,
        timestamp: new Date().toISOString()
      },
      message: 'GBP reviews fetched successfully'
    });
  } catch (error) {
    console.error('[GBP ADVANCED SYNC SINGLETON] Fetch reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch GBP reviews',
      error: (error as Error).message
    });
  }
});

/**
 * Create a GBP post
 * POST /api/gbp-advanced-sync-singleton/create-post
 */
router.post('/create-post', async (req, res) => {
  try {
    const { tenantId, postData } = req.body;
    
    // Validate required fields
    if (!tenantId || !postData) {
      return res.status(400).json({
        success: false,
        message: 'tenantId and postData are required'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const result = await gbpAdvancedSyncService.createPost(tenantId, postData);
    
    res.json({
      success: true,
      data: {
        result,
        timestamp: new Date().toISOString()
      },
      message: 'GBP post created successfully'
    });
  } catch (error) {
    console.error('[GBP ADVANCED SYNC SINGLETON] Create post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create GBP post',
      error: (error as Error).message
    });
  }
});

/**
 * Get sync statistics
 * GET /api/gbp-advanced-sync-singleton/stats
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
    
    const stats = await gbpAdvancedSyncService.getSyncStats(tenantId as string);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'GBP Advanced sync statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[GBP ADVANCED SYNC SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sync statistics'
    });
  }
});

/**
 * Get service health status
 * GET /api/gbp-advanced-sync-singleton/health
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
    
    const health = await gbpAdvancedSyncService.getHealthStatus();
    
    res.json({
      success: true,
      data: {
        health,
        timestamp: new Date().toISOString()
      },
      message: 'GBP Advanced Sync service health status retrieved successfully'
    });
  } catch (error) {
    console.error('[GBP ADVANCED SYNC SINGLETON] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check service health'
    });
  }
});

/**
 * Clear cache and reset state
 * DELETE /api/gbp-advanced-sync-singleton/cache
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
    
    await gbpAdvancedSyncService.clearCache();
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      message: 'GBP Advanced Sync service cache cleared successfully'
    });
  } catch (error) {
    console.error('[GBP ADVANCED SYNC SINGLETON] Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

/**
 * Test GBP Advanced sync operations (for development/testing)
 * POST /api/gbp-advanced-sync-singleton/test
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
    if (!operation || !['media_sync', 'reviews_fetch', 'post_create'].includes(operation)) {
      return res.status(400).json({
        success: false,
        message: 'operation must be one of: media_sync, reviews_fetch, post_create'
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
      case 'media_sync':
        result = await gbpAdvancedSyncService.syncMediaItems(testTenantId);
        break;
      case 'reviews_fetch':
        result = await gbpAdvancedSyncService.fetchReviews(testTenantId);
        break;
      case 'post_create':
        const postData = {
          summary: 'Test post created from API',
          state: 'PUBLISHED',
          languageCode: 'en'
        };
        result = await gbpAdvancedSyncService.createPost(testTenantId, postData);
        break;
    }
    
    res.json({
      success: true,
      data: {
        operation,
        result,
        timestamp: new Date().toISOString()
      },
      message: `GBP Advanced Sync test (${operation}) completed successfully`
    });
  } catch (error) {
    console.error('[GBP ADVANCED SYNC SINGLETON] Test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test GBP Advanced Sync operation',
      error: (error as Error).message
    });
  }
});

/**
 * Get supported GBP features
 * GET /api/gbp-advanced-sync-singleton/features
 */
router.get('/features', async (req, res) => {
  try {
    const features = [
      {
        name: 'media_sync',
        displayName: 'Media Sync',
        description: 'Sync photos, logos, and other media items from GBP',
        category: 'media',
        features: ['photo_upload', 'logo_management', 'thumbnail_generation', 'media_organization'],
        performance: 'fast'
      },
      {
        name: 'reviews_fetch',
        displayName: 'Reviews Fetch',
        description: 'Fetch customer reviews and ratings from GBP',
        category: 'engagement',
        features: ['review_import', 'rating_analysis', 'customer_feedback', 'review_tracking'],
        performance: 'medium'
      },
      {
        name: 'post_create',
        displayName: 'Post Creation',
        description: 'Create and publish posts and updates on GBP',
        category: 'content',
        features: ['post_creation', 'media_attachments', 'call_to_action', 'scheduling'],
        performance: 'medium'
      },
      {
        name: 'attributes_sync',
        displayName: 'Attributes Sync',
        description: 'Sync business attributes and profile information',
        category: 'profile',
        features: ['business_info', 'contact_details', 'hours_update', 'category_selection'],
        performance: 'fast'
      }
    ];
    
    res.json({
      success: true,
      data: {
        features,
        timestamp: new Date().toISOString()
      },
      message: 'Supported GBP Advanced Sync features retrieved successfully'
    });
  } catch (error) {
    console.error('[GBP ADVANCED SYNC SINGLETON] Features error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported features'
    });
  }
});

export default router;
