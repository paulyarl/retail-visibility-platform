import { Router } from 'express';
import ShopService from '../services/ShopService';

const router = Router();

/**
 * GET /api/shop-categories
 * Get all shop categories from mv_storefront_discovery
 * 
 * Features:
 * - UniversalSingleton caching (30 minutes)
 * - Materialized view optimization
 * - Category counts
 * - Sorted by popularity
 */
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Use unified ShopService with UniversalSingleton caching
    const shopService = ShopService.getInstance();
    const categories = await shopService.getShopCategories();
    
    const responseTime = Date.now() - startTime;
    
    // Add cache headers for browser caching (shorter than server cache)
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
    res.setHeader('X-Response-Time', responseTime.toString());
    res.setHeader('X-Cache-Source', 'service-cache');

    res.json({
      success: true,
      data: categories,
      total: categories.length,
      metadata: {
        cacheTTL: 30 * 60 * 1000, // 30 minutes
        responseTime,
        source: 'mv_storefront_discovery'
      }
    });

  } catch (error) {
    console.error('[Shop Categories] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch shop categories'
    });
  }
});

/**
 * DELETE /api/shop-categories/cache
 * Clear the shop categories cache
 * 
 * Note: Cache clearing is not directly available in backend UniversalSingleton
 * This endpoint returns a message about cache management
 */
router.delete('/cache', async (req, res) => {
  try {
    // Backend UniversalSingleton doesn't expose direct cache clearing
    // Cache is managed automatically with TTL expiration
    res.json({
      success: true,
      message: 'Cache is managed automatically with TTL expiration. Manual clearing not available.'
    });
  } catch (error) {
    console.error('[Shop Categories] Error handling cache request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to handle cache request'
    });
  }
});

/**
 * GET /api/shop-categories/stats
 * Get cache statistics for shop service
 * 
 * Used for monitoring and debugging cache performance
 */
router.get('/stats', async (req, res) => {
  try {
    const shopService = ShopService.getInstance();
    const stats = shopService.getMetrics();
    
    res.json({
      success: true,
      stats,
      cacheTTL: 30 * 60 * 1000 // 30 minutes
    });
  } catch (error) {
    console.error('[Shop Categories] Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get shop categories stats'
    });
  }
});

export default router;
