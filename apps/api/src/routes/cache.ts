import { Router } from 'express'
import { memoryCache } from '../utils/cache'
import { getDirectPool } from '../utils/db-pool'
import { logger } from '../logger';

const router = Router()

// Materialized views that can be refreshed
const REFRESHABLE_MVS = [
  'mv_global_discovery',
  'mv_storefront_discovery',
  'mv_category_discovery',
  'mv_shop_discovery',
  'mv_trending_scores',
  'directory_category_products',
  'directory_category_listings',
  'directory_category_stats',
  'directory_gbp_listings',
  'directory_gbp_stats',
  'storefront_products_mv',
] as const;

type MaterializedViewName = typeof REFRESHABLE_MVS[number];

// GET /api/cache/stats - Get cache statistics and metrics
router.get('/stats', async (req, res) => {
  try {
    const stats = memoryCache.getStats()
    const hitRate = memoryCache.getHitRate()

    res.json({
      success: true,
      data: {
        ...stats,
        hitRate: `${hitRate.toFixed(2)}%`,
        cacheEnabled: true
      }
    })
  } catch (error) {
    logger.error('Error getting cache stats:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to get cache statistics'
    })
  }
})

// POST /api/cache/cleanup - Force cleanup of expired entries
router.post('/cleanup', async (req, res) => {
  try {
    const beforeStats = memoryCache.getStats()
    memoryCache.cleanup()
    const afterStats = memoryCache.getStats()

    res.json({
      success: true,
      data: {
        cleanedEntries: beforeStats.expiredEntries - afterStats.expiredEntries,
        before: beforeStats,
        after: afterStats
      }
    })
  } catch (error) {
    logger.error('Error during cache cleanup:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup cache'
    })
  }
})

// POST /api/cache/reset-metrics - Reset metrics counters
router.post('/reset-metrics', async (req, res) => {
  try {
    memoryCache.resetMetrics()
    res.json({
      success: true,
      message: 'Cache metrics reset successfully'
    })
  } catch (error) {
    logger.error('Error resetting cache metrics:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to reset cache metrics'
    })
  }
})

// POST /api/cache/refresh-mv - Refresh materialized view(s)
// Body: { views?: string[], all?: boolean }
router.post('/refresh-mv', async (req, res) => {
  try {
    const { views, all } = req.body;
    const pool = getDirectPool();
    
    const viewsToRefresh: MaterializedViewName[] = all 
      ? [...REFRESHABLE_MVS]
      : (views || []).filter((v: string) => REFRESHABLE_MVS.includes(v as MaterializedViewName)) as MaterializedViewName[];
    
    if (viewsToRefresh.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid views specified. Use: ' + REFRESHABLE_MVS.join(', ')
      });
    }
    
    const results: { view: string; status: 'success' | 'error'; error?: string }[] = [];
    
    for (const viewName of viewsToRefresh) {
      try {
        // Try CONCURRENTLY first (doesn't block reads, requires unique index)
        await pool.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`);
        results.push({ view: viewName, status: 'success' });
      } catch (error: any) {
        // If concurrent fails (e.g., no unique index), try blocking refresh
        if (error?.code === '55000') {
          try {
            await pool.query(`REFRESH MATERIALIZED VIEW ${viewName}`);
            results.push({ view: viewName, status: 'success' });
          } catch (blockingError: any) {
            results.push({ view: viewName, status: 'error', error: blockingError.message });
          }
        } else {
          results.push({ view: viewName, status: 'error', error: error.message });
        }
      }
    }
    
    const successCount = results.filter(r => r.status === 'success').length;
    
    res.json({
      success: successCount === viewsToRefresh.length,
      data: {
        refreshed: successCount,
        total: viewsToRefresh.length,
        results
      }
    });
  } catch (error: any) {
    logger.error('Error refreshing MVs:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'Failed to refresh materialized views',
      message: error.message
    });
  }
})

export default router
