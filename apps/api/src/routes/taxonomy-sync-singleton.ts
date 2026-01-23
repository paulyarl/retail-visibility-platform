/**
 * Taxonomy Sync API Routes - UniversalSingleton Implementation
 * Integrates TaxonomySyncSingletonService with Express API
 */

import { Router } from 'express';
import TaxonomySyncSingletonService from '../services/TaxonomySyncSingletonService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get singleton instance
const taxonomySyncService = TaxonomySyncSingletonService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Check for taxonomy updates
 * GET /api/taxonomy-sync-singleton/check-updates
 */
router.get('/check-updates', async (req, res) => {
  try {
    // Check if user has admin permissions for taxonomy operations
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for taxonomy operations'
      });
    }
    
    const result = await taxonomySyncService.checkForUpdates();
    
    res.json({
      success: true,
      data: {
        result,
        timestamp: new Date().toISOString()
      },
      message: 'Taxonomy update check completed successfully'
    });
  } catch (error) {
    console.error('[TAXONOMY SYNC SINGLETON] Check updates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check for taxonomy updates',
      error: (error as Error).message
    });
  }
});

/**
 * Perform full taxonomy synchronization
 * POST /api/taxonomy-sync-singleton/full-sync
 */
router.post('/full-sync', async (req, res) => {
  try {
    // Check if user has admin permissions for taxonomy operations
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for taxonomy operations'
      });
    }
    
    const operation = await taxonomySyncService.performFullSync();
    
    res.json({
      success: true,
      data: {
        operation,
        timestamp: new Date().toISOString()
      },
      message: 'Full taxonomy sync completed successfully'
    });
  } catch (error) {
    console.error('[TAXONOMY SYNC SINGLETON] Full sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform full taxonomy sync',
      error: (error as Error).message
    });
  }
});

/**
 * Perform incremental taxonomy synchronization
 * POST /api/taxonomy-sync-singleton/incremental-sync
 */
router.post('/incremental-sync', async (req, res) => {
  try {
    // Check if user has admin permissions for taxonomy operations
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for taxonomy operations'
      });
    }
    
    const operation = await taxonomySyncService.performIncrementalSync();
    
    res.json({
      success: true,
      data: {
        operation,
        timestamp: new Date().toISOString()
      },
      message: 'Incremental taxonomy sync completed successfully'
    });
  } catch (error) {
    console.error('[TAXONOMY SYNC SINGLETON] Incremental sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform incremental taxonomy sync',
      error: (error as Error).message
    });
  }
});

/**
 * Get current taxonomy
 * GET /api/taxonomy-sync-singleton/current-taxonomy
 */
router.get('/current-taxonomy', async (req, res) => {
  try {
    // Check if user has admin permissions for viewing taxonomy
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for viewing taxonomy'
      });
    }
    
    const taxonomy = await taxonomySyncService.getCurrentTaxonomy();
    
    res.json({
      success: true,
      data: {
        taxonomy,
        count: taxonomy.length,
        timestamp: new Date().toISOString()
      },
      message: 'Current taxonomy retrieved successfully'
    });
  } catch (error) {
    console.error('[TAXONOMY SYNC SINGLETON] Get current taxonomy error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve current taxonomy'
    });
  }
});

/**
 * Get sync statistics
 * GET /api/taxonomy-sync-singleton/stats
 */
router.get('/stats', async (req, res) => {
  try {
    // Check if user has admin permissions for viewing stats
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for viewing sync statistics'
      });
    }
    
    const stats = await taxonomySyncService.getSyncStats();
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Taxonomy sync statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[TAXONOMY SYNC SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sync statistics'
    });
  }
});

/**
 * Get service health status
 * GET /api/taxonomy-sync-singleton/health
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
    
    const health = await taxonomySyncService.getHealthStatus();
    
    res.json({
      success: true,
      data: {
        health,
        timestamp: new Date().toISOString()
      },
      message: 'Taxonomy sync service health status retrieved successfully'
    });
  } catch (error) {
    console.error('[TAXONOMY SYNC SINGLETON] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check service health'
    });
  }
});

/**
 * Clear cache and reset state
 * DELETE /api/taxonomy-sync-singleton/cache
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
    
    await taxonomySyncService.clearCache();
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      message: 'Taxonomy sync cache cleared successfully'
    });
  } catch (error) {
    console.error('[TAXONOMY SYNC SINGLETON] Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

/**
 * Get sync operation history
 * GET /api/taxonomy-sync-singleton/operations
 */
router.get('/operations', async (req, res) => {
  try {
    // Check if user has admin permissions for viewing operations
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for viewing operations'
      });
    }
    
    // Get recent operations from the service
    const operations = Array.from(taxonomySyncService['syncOperations'].values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, 20); // Last 20 operations
    
    res.json({
      success: true,
      data: {
        operations,
        count: operations.length,
        timestamp: new Date().toISOString()
      },
      message: 'Sync operation history retrieved successfully'
    });
  } catch (error) {
    console.error('[TAXONOMY SYNC SINGLETON] Get operations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve operation history'
    });
  }
});

/**
 * Test taxonomy synchronization (for development/testing)
 * POST /api/taxonomy-sync-singleton/test
 */
router.post('/test', async (req, res) => {
  try {
    const { type } = req.body;
    
    // Check if user has admin permissions for testing
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required for testing'
      });
    }

    // Validate type
    if (!type || !['check-updates', 'full-sync', 'incremental-sync'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'type must be one of: check-updates, full-sync, incremental-sync'
      });
    }
    
    let result;
    
    switch (type) {
      case 'check-updates':
        result = await taxonomySyncService.checkForUpdates();
        break;
      case 'full-sync':
        result = await taxonomySyncService.performFullSync();
        break;
      case 'incremental-sync':
        result = await taxonomySyncService.performIncrementalSync();
        break;
    }
    
    res.json({
      success: true,
      data: {
        testType: type,
        result,
        timestamp: new Date().toISOString()
      },
      message: `Taxonomy sync test (${type}) completed successfully`
    });
  } catch (error) {
    console.error('[TAXONOMY SYNC SINGLETON] Test error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test taxonomy synchronization',
      error: (error as Error).message
    });
  }
});

/**
 * Get supported sync operations
 * GET /api/taxonomy-sync-singleton/operations-info
 */
router.get('/operations-info', async (req, res) => {
  try {
    const operations = [
      {
        name: 'check-updates',
        displayName: 'Check for Updates',
        description: 'Check if Google taxonomy has updates since last sync',
        type: 'read-only',
        features: ['version_comparison', 'change_detection', 'conflict_identification'],
        performance: 'fast'
      },
      {
        name: 'full-sync',
        displayName: 'Full Synchronization',
        description: 'Complete taxonomy synchronization from Google',
        type: 'write',
        features: ['batch_processing', 'conflict_resolution', 'data_validation'],
        performance: 'slow'
      },
      {
        name: 'incremental-sync',
        displayName: 'Incremental Synchronization',
        description: 'Sync only changed categories with conflict resolution',
        type: 'write',
        features: ['change_detection', 'conflict_resolution', 'performance_optimized'],
        performance: 'medium'
      }
    ];
    
    res.json({
      success: true,
      data: {
        operations,
        timestamp: new Date().toISOString()
      },
      message: 'Supported sync operations retrieved successfully'
    });
  } catch (error) {
    console.error('[TAXONOMY SYNC SINGLETON] Operations info error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported operations'
    });
  }
});

export default router;
