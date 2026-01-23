/**
 * Product Cache API Routes - UniversalSingleton Implementation
 * Integrates ProductCacheSingletonService with Express API
 */

import { Router } from 'express';
import ProductCacheSingletonService from '../services/ProductCacheSingletonService';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Get singleton instance
const productCacheService = ProductCacheSingletonService.getInstance();

// Apply authentication middleware to all routes
router.use(authenticateToken);

/**
 * Get products for a scenario (with intelligent caching)
 * POST /api/product-cache-singleton/get-products
 */
router.post('/get-products', async (req, res) => {
  try {
    const { businessType, categoryName, googleCategoryId, count, requireImages, textModel, tenantId } = req.body;
    
    // Validate required fields
    if (!businessType || !categoryName || !count) {
      return res.status(400).json({
        success: false,
        message: 'businessType, categoryName, and count are required'
      });
    }

    // Check if user has permission to access this tenant's products
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const products = await productCacheService.getProductsForScenario({
      businessType,
      categoryName,
      googleCategoryId,
      count,
      requireImages,
      textModel,
      tenantId
    });
    
    res.json({
      success: true,
      data: {
        products,
        count: products.length,
        timestamp: new Date().toISOString()
      },
      message: 'Products retrieved successfully'
    });
  } catch (error) {
    console.error('[PRODUCT CACHE SINGLETON] Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve products',
      error: (error as Error).message
    });
  }
});

/**
 * Get cache statistics
 * GET /api/product-cache-singleton/stats
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
    
    const stats = await productCacheService.getCacheStats(tenantId as string);
    
    res.json({
      success: true,
      data: {
        stats,
        timestamp: new Date().toISOString()
      },
      message: 'Cache statistics retrieved successfully'
    });
  } catch (error) {
    console.error('[PRODUCT CACHE SINGLETON] Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache statistics'
    });
  }
});

/**
 * Get top cached products
 * GET /api/product-cache-singleton/top-products
 */
router.get('/top-products', async (req, res) => {
  try {
    const { limit = 20, tenantId } = req.query;
    
    // Check if user has permission to access this tenant's products
    if (tenantId && req.user?.tenantIds && !req.user.tenantIds.includes(tenantId as string)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: insufficient permissions for this tenant'
      });
    }
    
    const topProducts = await productCacheService.getTopProducts(
      parseInt(limit as string),
      tenantId as string
    );
    
    res.json({
      success: true,
      data: {
        topProducts,
        count: topProducts.length,
        timestamp: new Date().toISOString()
      },
      message: 'Top products retrieved successfully'
    });
  } catch (error) {
    console.error('[PRODUCT CACHE SINGLETON] Get top products error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top products'
    });
  }
});

/**
 * Clear cache
 * DELETE /api/product-cache-singleton/cache
 */
router.delete('/cache', async (req, res) => {
  try {
    const { businessType, categoryName, tenantId } = req.query;
    
    // Check if user has admin permissions for cache clearing
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required'
      });
    }
    
    await productCacheService.clearCache(
      businessType as string,
      categoryName as string,
      tenantId as string
    );
    
    res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString()
      },
      message: 'Cache cleared successfully'
    });
  } catch (error) {
    console.error('[PRODUCT CACHE SINGLETON] Clear cache error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

/**
 * Cleanup cache (remove low-quality or unused products)
 * POST /api/product-cache-singleton/cleanup
 */
router.post('/cleanup', async (req, res) => {
  try {
    const { minQualityScore, maxAge, minUsageCount } = req.body;
    
    // Check if user has admin permissions for cache cleanup
    if (!['PLATFORM_ADMIN', 'ADMIN'].includes(req.user?.role || '')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: admin permissions required'
      });
    }
    
    const result = await productCacheService.cleanupCache({
      minQualityScore,
      maxAge,
      minUsageCount
    });
    
    res.json({
      success: true,
      data: {
        cleanupResult: result,
        timestamp: new Date().toISOString()
      },
      message: 'Cache cleanup completed successfully'
    });
  } catch (error) {
    console.error('[PRODUCT CACHE SINGLETON] Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup cache'
    });
  }
});

/**
 * Get cache health status
 * GET /api/product-cache-singleton/health
 */
router.get('/health', async (req, res) => {
  try {
    const stats = await productCacheService.getCacheStats();
    
    const health = {
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      totalCachedProducts: stats.totalCachedProducts,
      cacheHitRate: stats.cacheHitRate,
      averageQualityScore: stats.averageQualityScore,
      lastCheck: new Date().toISOString(),
      issues: [] as string[]
    };
    
    // Determine health status
    if (stats.cacheHitRate < 0.3) {
      health.status = 'degraded';
      health.issues.push('Low cache hit rate');
    }
    
    if (stats.averageQualityScore < 0.5) {
      health.status = 'degraded';
      health.issues.push('Low average quality score');
    }
    
    if (stats.totalCachedProducts === 0) {
      health.status = 'unhealthy';
      health.issues.push('No cached products');
    }
    
    res.json({
      success: true,
      data: {
        health,
        timestamp: new Date().toISOString()
      },
      message: 'Product cache health status retrieved successfully'
    });
  } catch (error) {
    console.error('[PRODUCT CACHE SINGLETON] Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check service health'
    });
  }
});

export default router;
