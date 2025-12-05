/**
 * Cache Statistics API
 * Provides insights into the product cache
 */

import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';

const router = Router();

/**
 * GET /api/v1/cache/stats
 * Get cache statistics
 */
router.get('/cache/stats', authenticateToken, async (req, res) => {
  try {
    // Get total count
    const totalProducts = await prisma.quick_start_product_caches.count();
    
    // Get count by business type
    const byBusinessType = await prisma.quick_start_product_caches.groupBy({
      by: ['business_type'],
      _count: {
        _all: true
      }
    });
    
    // Convert to object format
    const byBusinessTypeObj: Record<string, number> = {};
    byBusinessType.forEach(item => {
      byBusinessTypeObj[item.business_type] = item._count._all;
    });
    
    // Get top products
    const topProducts = await prisma.quick_start_product_caches.findMany({
      select: {
        product_name: true,
        business_type: true,
        usage_count: true,
        quality_score: true
      },
      orderBy: {
        usage_count: 'desc'
      },
      take: 10
    });
    
    res.json({
      totalProducts,
      byBusinessType: byBusinessTypeObj,
      topProducts: topProducts.map(p => ({
        name: p.product_name,
        businessType: p.business_type,
        usageCount: p.usage_count,
        qualityScore: p.quality_score
      }))
    });
  } catch (error: any) {
    console.error('[Cache Stats] Error:', error);
    res.status(500).json({ error: 'Failed to get cache stats' });
  }
});

export default router;
