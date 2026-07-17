/**
 * Cache Monitoring Routes
 * 
 * Provides endpoints for monitoring the Universal Identifier Cache
 * including metrics, health checks, and analytics.
 */

import { Router } from 'express';
import { UniversalIdentifierCache } from '../services/UniversalIdentifierCache';
import { CacheMonitoringDashboard } from '../monitoring/CacheMetrics';
import { CacheKeyManager } from '../security/CacheEncryption';

const router = Router();
const dashboard = new CacheMonitoringDashboard();

/**
 * GET /api/cache/metrics
 * Get comprehensive cache metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    const cache = UniversalIdentifierCache.getInstance();
    const baseMetrics = cache.getMetrics();
    
    // Get cache entries for analytics
    const cacheEntries = (cache as any).encryptedCache || new Map();
    
    const dashboardData = dashboard.getDashboardData(baseMetrics, cacheEntries);
    
    res.json({
      success: true,
      data: dashboardData,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Cache Monitoring] Error getting metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/cache/health
 * Get cache health status
 */
router.get('/health', async (req, res) => {
  try {
    const cache = UniversalIdentifierCache.getInstance();
    const baseMetrics = cache.getMetrics();
    
    // Get cache entries for analytics
    const cacheEntries = (cache as any).encryptedCache || new Map();
    
    const dashboardData = dashboard.getDashboardData(baseMetrics, cacheEntries);
    
    // Return health status with appropriate HTTP status code
    const statusCode = dashboardData.health.status === 'critical' ? 503 : 
                      dashboardData.health.status === 'warning' ? 200 : 200;
    
    res.status(statusCode).json({
      success: dashboardData.health.status !== 'critical',
      status: dashboardData.health.status,
      score: dashboardData.health.score,
      issues: dashboardData.health.issues,
      recommendations: dashboardData.health.recommendations,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Cache Monitoring] Error getting health:', error);
    res.status(500).json({
      success: false,
      status: 'critical',
      score: 0,
      issues: ['Health check failed'],
      recommendations: ['Restart cache service'],
      timestamp: Date.now()
    });
  }
});

/**
 * GET /api/cache/analytics
 * Get cache analytics and insights
 */
router.get('/analytics', async (req, res) => {
  try {
    const cache = UniversalIdentifierCache.getInstance();
    const baseMetrics = cache.getMetrics();
    
    // Get cache entries for analytics
    const cacheEntries = (cache as any).encryptedCache || new Map();
    
    const analytics = dashboard.getAnalytics(cacheEntries);
    
    res.json({
      success: true,
      data: analytics,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Cache Monitoring] Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get cache analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/cache/warm
 * Warm cache with tenant data
 */
router.post('/warm', async (req, res) => {
  try {
    const { tenantIds } = req.body;
    
    if (!Array.isArray(tenantIds)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'tenantIds must be an array'
      });
    }
    
    const cache = UniversalIdentifierCache.getInstance();
    await cache.warmCache(tenantIds);
    
    res.json({
      success: true,
      message: `Cache warmed for ${tenantIds.length} tenants`,
      tenantIds: tenantIds.length,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Cache Monitoring] Error warming cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to warm cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/cache/invalidate/:tenantId
 * Invalidate specific tenant from cache
 */
router.post('/invalidate/:tenantId', async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    const cache = UniversalIdentifierCache.getInstance();
    await cache.invalidateTenant(tenantId);
    
    res.json({
      success: true,
      message: `Cache invalidated for tenant ${tenantId}`,
      tenantId,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Cache Monitoring] Error invalidating cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/cache/clear
 * Clear all cache entries
 */
router.post('/clear', async (req, res) => {
  try {
    const cache = UniversalIdentifierCache.getInstance();
    await cache.clearAllCache();
    
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Cache Monitoring] Error clearing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/cache/keys
 * Get encryption key information
 */
router.get('/keys', async (req, res) => {
  try {
    const keyInfo = CacheKeyManager.getKeyInfo();
    const cache = UniversalIdentifierCache.getInstance();
    
    // Get encryption info from cache
    const encryptionInfo = (cache as any).getEncryptionInfo?.() || {
      algorithm: 'aes-256-gcm',
      keyLength: 32,
      ivLength: 16,
      authTagLength: 16,
      additionalDataLength: 25
    };
    
    res.json({
      success: true,
      data: {
        keyManager: keyInfo,
        encryption: encryptionInfo
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Cache Monitoring] Error getting key info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get key information',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/cache/keys/rotate
 * Force encryption key rotation
 */
router.post('/keys/rotate', async (req, res) => {
  try {
    CacheKeyManager.forceRotation();
    
    res.json({
      success: true,
      message: 'Encryption key rotated successfully',
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Cache Monitoring] Error rotating key:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to rotate encryption key',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/cache/export
 * Export cache metrics for external monitoring
 */
router.get('/export', async (req, res) => {
  try {
    const cache = UniversalIdentifierCache.getInstance();
    const baseMetrics = cache.getMetrics();
    
    // Get cache entries for analytics
    const cacheEntries = (cache as any).encryptedCache || new Map();
    
    const exportData = dashboard.exportMetrics(baseMetrics, cacheEntries);
    
    // Set appropriate headers for download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="cache-metrics-${Date.now()}.json"`);
    
    res.send(exportData);
  } catch (error) {
    console.error('[Cache Monitoring] Error exporting metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/cache/test
 * Test cache performance
 */
router.get('/test', async (req, res) => {
  try {
    const { iterations = 100 } = req.query;
    const cache = UniversalIdentifierCache.getInstance();
    
    // const testIdentifiers = [
    //   'tid-m8ijkrnk',
    //   'baraka-international-market-inc',
    //   'ULCW',
    //   'tid-r6cccpag',
    //   'tid-mrsyk3w6'
    // ];
    const testIdentifiers = [
      ''
    ];
    
    const startTime = Date.now();
    const promises = [];
    
    // Run parallel cache lookups
    for (let i = 0; i < parseInt(iterations as string); i++) {
      const identifier = testIdentifiers[i % testIdentifiers.length];
      promises.push(cache.resolveIdentifier(identifier));
    }
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    const successCount = results.filter(r => r !== null).length;
    const totalTime = endTime - startTime;
    const avgTime = totalTime / parseInt(iterations as string);
    
    res.json({
      success: true,
      data: {
        iterations: parseInt(iterations as string),
        successCount,
        failureCount: parseInt(iterations as string) - successCount,
        totalTime,
        avgTime,
        requestsPerSecond: Math.round((parseInt(iterations as string) / totalTime) * 1000)
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('[Cache Monitoring] Error testing cache:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
