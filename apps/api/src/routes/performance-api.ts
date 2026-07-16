/**
 * Performance Management API Endpoints
 * 
 * Provides endpoints for performance monitoring, optimization,
 * testing, and analytics for the multi-bucket shops system.
 */

import { Router } from 'express';
import ShopsPerformanceMonitor from '../services/ShopsPerformanceMonitor';
import ShopsPerformanceTester from '../services/ShopsPerformanceTester';
import ShopsFeaturedService from '../services/ShopsFeaturedService';
import { logger } from '../logger';

const router = Router();

// ==========================
// PERFORMANCE MONITORING ENDPOINTS
// ==========================

/**
 * GET /api/admin/performance/dashboard
 * Get real-time performance dashboard data
 */
router.get('/dashboard', async (req, res) => {
  try {
    const { tenantId } = req.query;
    
    const monitor = ShopsPerformanceMonitor.getInstance();
    const dashboardData = await monitor.getDashboardData(tenantId as string);
    
    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[PERFORMANCE API] Dashboard error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

/**
 * GET /api/admin/performance/report/:tenantId
 * Generate comprehensive performance report for a shop
 */
router.get('/report/:tenantId', async (req, res) => {
  try {
    const tenantId = (req.params as any).tenantId;
    const { shopScope = 'shop' } = req.query;
    
    const monitor = ShopsPerformanceMonitor.getInstance();
    const report = await monitor.generateShopReport(tenantId, shopScope as 'global' | 'shop');
    
    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[PERFORMANCE API] Report error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to generate performance report'
    });
  }
});

/**
 * POST /api/admin/performance/optimize/:tenantId
 * Optimize cache performance for a shop
 */
router.post('/optimize/:tenantId', async (req, res) => {
  try {
    const tenantId = (req.params as any).tenantId;
    const { shopScope = 'shop' } = req.body;
    
    const monitor = ShopsPerformanceMonitor.getInstance();
    const optimization = await monitor.optimizeCache(tenantId, shopScope);
    
    res.json({
      success: true,
      data: optimization,
      message: `Cache optimization completed for ${tenantId}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[PERFORMANCE API] Optimization error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to optimize cache'
    });
  }
});

/**
 * GET /api/admin/performance/export
 * Export performance data for analysis
 */
router.get('/export', async (req, res) => {
  try {
    const { tenantId, startDate, endDate } = req.query;
    
    const monitor = ShopsPerformanceMonitor.getInstance();
    const exportData = monitor.exportPerformanceData(
      tenantId as string,
      startDate ? new Date(startDate as string) : undefined,
      endDate ? new Date(endDate as string) : undefined
    );
    
    res.json({
      success: true,
      data: exportData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[PERFORMANCE API] Export error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to export performance data'
    });
  }
});

/**
 * DELETE /api/admin/performance/clear/:tenantId?
 * Clear performance history (for maintenance)
 */
router.delete('/clear/:tenantId', async (req, res) => {
  try {
    const tenantId = (req.params as any).tenantId;
    const { shopScope = 'shop' } = req.body;
    
    const monitor = ShopsPerformanceMonitor.getInstance();
    monitor.clearHistory(tenantId);
    
    res.json({
      success: true,
      message: tenantId 
        ? `Performance history cleared for ${tenantId}`
        : 'All performance history cleared',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[PERFORMANCE API] Clear error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to clear performance history'
    });
  }
});

// ==========================
// PERFORMANCE TESTING ENDPOINTS
// ==========================

/**
 * POST /api/admin/performance/load-test
 * Run load test for multi-bucket shops
 */
router.post('/load-test', async (req, res) => {
  try {
    const config = req.body;
    
    // Validate config
    const requiredFields = ['concurrentUsers', 'requestsPerUser', 'durationSeconds', 'bucketTypes', 'tenantIds'];
    for (const field of requiredFields) {
      if (!config[field]) {
        return res.status(400).json({
          success: false,
          error: `Missing required field: ${field}`
        });
      }
    }
    
    const tester = ShopsPerformanceTester.getInstance();
    const result = await tester.runLoadTest(config);
    
    res.json({
      success: true,
      data: result,
      message: `Load test ${result.testId} completed successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[PERFORMANCE API] Load test error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to run load test'
    });
  }
});

/**
 * POST /api/admin/performance/cache-test
 * Test cache effectiveness
 */
router.post('/cache-test', async (req, res) => {
  try {
    const { tenantId, shopScope = 'shop', iterations = 100 } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'tenantId is required'
      });
    }
    
    const tester = ShopsPerformanceTester.getInstance();
    const results = await tester.testCacheEffectiveness(tenantId, shopScope, iterations);
    
    res.json({
      success: true,
      data: results,
      message: `Cache effectiveness test completed for ${tenantId}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[PERFORMANCE API] Cache test error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to test cache effectiveness'
    });
  }
});

/**
 * GET /api/admin/performance/benchmarks
 * Run performance benchmarks
 */
router.get('/benchmarks', async (req, res) => {
  try {
    const tester = ShopsPerformanceTester.getInstance();
    const benchmarks = await tester.runBenchmarks();
    
    res.json({
      success: true,
      data: benchmarks,
      message: 'Performance benchmarks completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[PERFORMANCE API] Benchmarks error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to run benchmarks'
    });
  }
});

/**
 * GET /api/admin/performance/full-report/:tenantId?
 * Generate comprehensive performance report
 */
router.get('/full-report/:tenantId', async (req, res) => {
  try {
    const tenantId = (req.params as any).tenantId;
    
    const tester = ShopsPerformanceTester.getInstance();
    const report = await tester.generatePerformanceReport(tenantId || undefined);
    
    res.json({
      success: true,
      data: report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[PERFORMANCE API] Full report error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to generate performance report'
    });
  }
});

// ==========================
// HEALTH & STATUS ENDPOINTS
// ==========================

/**
 * GET /api/admin/performance/health
 * Check performance system health
 */
router.get('/health', async (req, res) => {
  try {
    const monitor = ShopsPerformanceMonitor.getInstance();
    const dashboardData = await monitor.getDashboardData();
    
    // Calculate health score based on metrics
    let healthScore = 100;
    const issues: string[] = [];
    
    if (dashboardData.summary.overallCacheHitRate < 70) {
      healthScore -= 20;
      issues.push('Low cache hit rate');
    }
    
    if (dashboardData.summary.avgResponseTime > 1000) {
      healthScore -= 30;
      issues.push('High response times');
    }
    
    if (dashboardData.slowBuckets.length > 3) {
      healthScore -= 15;
      issues.push('Multiple slow buckets');
    }
    
    const health = {
      status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical',
      score: healthScore,
      issues,
      metrics: dashboardData.summary,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('[PERFORMANCE API] Health check error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to check system health'
    });
  }
});

/**
 * GET /api/admin/performance/stats
 * Get system statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const monitor = ShopsPerformanceMonitor.getInstance();
    const dashboardData = await monitor.getDashboardData();
    
    // Get service instance info
    const service = ShopsFeaturedService.getInstance();
    
    const stats = {
      system: {
        activeBuckets: dashboardData.summary.activeBuckets,
        totalRequests: dashboardData.summary.totalRequests,
        avgResponseTime: dashboardData.summary.avgResponseTime,
        cacheHitRate: dashboardData.summary.overallCacheHitRate
      },
      buckets: {
        total: 7, // random, trending, new, sale, seasonal, staff, selection
        withData: dashboardData.topPerformers.length + dashboardData.slowBuckets.length,
        topPerformers: dashboardData.topPerformers.length,
        slowBuckets: dashboardData.slowBuckets.length
      },
      service: {
        instanceType: 'ShopsFeaturedService',
        cacheEnabled: true,
        encryptionEnabled: true,
        metricsEnabled: true
      },
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('[PERFORMANCE API] Stats error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system statistics'
    });
  }
});

// ==========================
// CACHE MANAGEMENT ENDPOINTS
// ==========================

/**
 * POST /api/admin/performance/cache/warm/:tenantId
 * Warm up cache for a shop
 */
router.post('/cache/warm/:tenantId', async (req, res) => {
  try {
    const tenantId = (req.params as any).tenantId;
    const { shopScope = 'shop' } = req.body;
    
    const service = ShopsFeaturedService.getInstance();
    const bucketTypes = ['random', 'trending', 'new', 'sale', 'seasonal', 'staff', 'selection'];
    
    const results: { bucketType: string; success: boolean; responseTime: number }[] = [];
    
    for (const bucketType of bucketTypes) {
      try {
        const startTime = Date.now();
        
        switch (bucketType) {
          case 'random':
            await service.getShopRandomProducts({ tenantId, limit: 12, shopScope });
            break;
          case 'trending':
            await service.getShopTrendingProducts({ tenantId, limit: 12, shopScope });
            break;
          case 'new':
            await service.getShopNewProducts({ tenantId, limit: 12, shopScope });
            break;
          case 'sale':
            await service.getShopSaleProducts({ tenantId, limit: 12, shopScope });
            break;
          case 'seasonal':
            await service.getShopSeasonalProducts({ tenantId, limit: 12, shopScope });
            break;
          case 'staff':
            await service.getShopStaffPicks({ tenantId, limit: 12, shopScope });
            break;
          case 'selection':
            await service.getShopStoreSelections({ tenantId, limit: 12, shopScope });
            break;
        }
        
        results.push({
          bucketType,
          success: true,
          responseTime: Date.now() - startTime
        });
      } catch (error) {
        results.push({
          bucketType,
          success: false,
          responseTime: 0
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const avgResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
    
    res.json({
      success: true,
      data: {
        tenantId,
        shopScope,
        results,
        summary: {
          totalBuckets: bucketTypes.length,
          successful: successCount,
          failed: bucketTypes.length - successCount,
          avgResponseTime
        }
      },
      message: `Cache warming completed for ${tenantId}`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[PERFORMANCE API] Cache warm error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to warm cache'
    });
  }
});

/**
 * DELETE /api/admin/performance/cache/clear/:tenantId?
 * Clear cache for a shop or all shops
 */
router.delete('/cache/clear/:tenantId', async (req, res) => {
  try {
    const tenantId = (req.params as any).tenantId;
    const { shopScope = 'shop' } = req.body;
    
    const monitor = ShopsPerformanceMonitor.getInstance();
    const optimization = await monitor.optimizeCache(tenantId || 'all', shopScope);
    
    res.json({
      success: true,
      data: optimization,
      message: tenantId 
        ? `Cache cleared for ${tenantId}`
        : 'Cache cleared for all shops',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('[PERFORMANCE API] Cache clear error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

export default router;
