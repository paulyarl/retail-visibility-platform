import { Router } from 'express'
import { memoryCache } from '../utils/cache'

const router = Router()

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
    console.error('Error getting cache stats:', error)
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
    console.error('Error during cache cleanup:', error)
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
    console.error('Error resetting cache metrics:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to reset cache metrics'
    })
  }
})

export default router
