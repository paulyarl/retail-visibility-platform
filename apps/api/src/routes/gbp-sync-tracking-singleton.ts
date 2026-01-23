/**
 * GBP Sync Tracking API Routes - UniversalSingleton Implementation
 * Integrates GBPSyncTrackingSingletonService with Express API
 */

import { Router } from 'express';
import GBPSyncTrackingSingletonService from '../services/GBPSyncTrackingSingletonService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get singleton instance
const gbpSyncTrackingService = GBPSyncTrackingSingletonService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Get sync tracking records
 * GET /api/gbp-sync-tracking-singleton/tracking
 */
router.get('/tracking', async (req, res) => {
  try {
    const { tenantId, category } = req.query;
    
    // Validate required fields
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'tenantId is required'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId as string)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const records = await gbpSyncTrackingService.getSyncTracking(
      tenantId as string,
      category as string
    );
    
    res.json({
      success: true,
      data: {
        records,
        count: records.length,
        timestamp: new Date().toISOString()
      },
      message: 'Sync tracking records retrieved successfully'
    });
  } catch (error) {
    console.error('[GBP SYNC TRACKING SINGLETON] Get tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sync tracking records'
    });
  }
});

/**
 * Get sync status summary
 * GET /api/gbp-sync-tracking-singleton/status-summary
 */
router.get('/status-summary', async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    // Validate required fields
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'tenantId is required'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId as string)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const summary = await gbpSyncTrackingService.getSyncStatusSummary(tenantId as string);
    
    res.json({
      success: true,
      data: {
        summary,
        timestamp: new Date().toISOString()
      },
      message: 'Sync status summary retrieved successfully'
    });
  } catch (error) {
    console.error('[GBP SYNC TRACKING SINGLETON] Status summary error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve sync status summary'
    });
  }
});

/**
 * Track a new sync operation
 * POST /api/gbp-sync-tracking-singleton/track-operation
 */
router.post('/track-operation', async (req, res) => {
  try {
    const { tenantId, category, operation, fields } = req.body;
    
    // Validate required fields
    if (!tenantId || !category || !operation || !fields) {
      return res.status(400).json({
        success: false,
        message: 'tenantId, category, operation, and fields are required'
      });
    }

    // Validate operation type
    if (!['push', 'pull', 'compare'].includes(operation)) {
      return res.status(400).json({
        success: false,
        message: 'operation must be one of: push, pull, compare'
      });
    }

    // Validate fields array
    if (!Array.isArray(fields) || fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'fields must be a non-empty array'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const operationId = await gbpSyncTrackingService.trackSyncOperation(
      tenantId,
      category,
      operation,
      fields
    );
    
    res.json({
      success: true,
      data: {
        operationId,
        timestamp: new Date().toISOString()
      },
      message: 'Sync operation tracking started successfully'
    });
  } catch (error) {
    console.error('[GBP SYNC TRACKING SINGLETON] Track operation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track sync operation',
      error: (error as Error).message
    });
  }
});

/**
 * Complete a sync operation
 * POST /api/gbp-sync-tracking-singleton/complete-operation
 */
router.post('/complete-operation', async (req, res) => {
  try {
    const { operationId, result, errors } = req.body;
    
    // Validate required fields
    if (!operationId || !result) {
      return res.status(400).json({
        success: false,
        message: 'operationId and result are required'
      });
    }

    // Validate result type
    if (!['success', 'failed', 'partial', 'skipped'].includes(result)) {
      return res.status(400).json({
        success: false,
        message: 'result must be one of: success, failed, partial, skipped'
      });
    }
    
    await gbpSyncTrackingService.completeSyncOperation(
      operationId,
      result,
      errors
    );
    
    res.json({
      success: true,
      data: {
        operationId,
        result,
        timestamp: new Date().toISOString()
      },
      message: 'Sync operation completed successfully'
    });
  } catch (error) {
    console.error('[GBP SYNC TRACKING SINGLETON] Complete operation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete sync operation',
      error: (error as Error).message
    });
  }
});

/**
 * Update sync tracking records
 * POST /api/gbp-sync-tracking-singleton/update-tracking
 */
router.post('/update-tracking', async (req, res) => {
  try {
    const { tenantId, category, fieldName, updates } = req.body;
    
    // Validate required fields
    if (!tenantId || !category || !fieldName) {
      return res.status(400).json({
        success: false,
        message: 'tenantId, category, and fieldName are required'
      });
    }

    // Validate category
    if (!['business_info', 'hours', 'status', 'categories', 'attributes', 'media'].includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'category must be one of: business_info, hours, status, categories, attributes, media'
      });
    }

    // Check if user has permission to access this tenant
    if (req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    await gbpSyncTrackingService.updateSyncTracking(
      tenantId,
      category,
      fieldName,
      updates
    );
    
    res.json({
      success: true,
      data: {
        tenantId,
        category,
        fieldName,
        timestamp: new Date().toISOString()
      },
      message: 'Sync tracking updated successfully'
    });
  } catch (error) {
    console.error('[GBP SYNC TRACKING SINGLETON] Update tracking error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sync tracking',
      error: (error as Error).message
    });
  }
});

/**
 * Get sync statistics
 * GET /api/gbp-sync-tracking-singleton/stats
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
    
    const stats = await gbpSyncTrackingService.getSyncStats(tenantId as string);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Sync statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[GBP SYNC TRACKING SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sync statistics'
    });
  }
});

/**
 * Get service health status
 * GET /api/gbp-sync-tracking-singleton/health
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
    
    const health = await gbpSyncTrackingService.getHealthStatus();
    
    res.json({
      success: true,
      data: {
        health,
        timestamp: new Date().toISOString()
      },
      message: 'GBP sync tracking service health status retrieved successfully'
    });
  } catch (error) {
    console.error('[GBP SYNC TRACKING SINGLETON] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check service health'
    });
  }
});

/**
 * Clear tracking data
 * DELETE /api/gbp-sync-tracking-singleton/tracking
 */
router.delete('/tracking', async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    // Check if user has admin permissions for clearing data
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for clearing tracking data'
      });
    }
    
    await gbpSyncTrackingService.clearTracking(tenantId as string);
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      message: `Tracking data cleared${tenantId ? ` for tenant ${tenantId}` : ' for all tenants'}`
    });
  } catch (error) {
    console.error('[GBP SYNC TRACKING SINGLETON] Clear tracking error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear tracking data'
    });
  }
});

/**
 * Get supported sync categories
 * GET /api/gbp-sync-tracking-singleton/categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      {
        name: 'business_info',
        displayName: 'Business Information',
        description: 'Basic business details like name, phone, website',
        fields: ['business_name', 'phone_number', 'website', 'address', 'description']
      },
      {
        name: 'hours',
        displayName: 'Business Hours',
        description: 'Operating hours and special hours',
        fields: ['regular_hours', 'special_hours', 'timezone']
      },
      {
        name: 'status',
        displayName: 'Location Status',
        description: 'Open/closed status and reopening information',
        fields: ['location_status', 'reopening_date']
      },
      {
        name: 'categories',
        displayName: 'Business Categories',
        description: 'Primary and secondary business categories',
        fields: ['primary_category', 'secondary_categories']
      },
      {
        name: 'attributes',
        displayName: 'Business Attributes',
        description: 'Additional business attributes and features',
        fields: ['attributes']
      },
      {
        name: 'media',
        displayName: 'Media Assets',
        description: 'Logo, cover photo, and other images',
        fields: ['logo', 'cover_photo', 'photos']
      }
    ];
    
    res.json({
      success: true,
      data: {
        categories,
        timestamp: new Date().toISOString()
      },
      message: 'Supported sync categories retrieved successfully'
    });
  } catch (error) {
    console.error('[GBP SYNC TRACKING SINGLETON] Categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported categories'
    });
  }
});

export default router;
