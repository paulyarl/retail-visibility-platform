import { Router, Request, Response } from 'express';
import { authenticateToken, authorize } from '../middleware/auth';
import { platformDashboardSingleton } from '../services/PlatformDashboardSingletonService';
import { SingletonMetrics } from '../lib/UniversalSingleton';
import { user_role } from '@prisma/client';
import { logger } from '../logger';

const router = Router();

/**
 * GET /api/platform/dashboard
 * Get complete platform dashboard data for any authenticated user
 */
router.get('/dashboard', authenticateToken, async (req: Request, res: Response) => {
  try {
    console.log('[PLATFORM DASHBOARD] Fetching complete dashboard data');
    
    const dashboardData = await platformDashboardSingleton.getPlatformDashboardData();
    
    res.json({
      success: true,
      data: dashboardData,
      _timestamp: new Date().toISOString(),
      _cache: {
        metrics: platformDashboardSingleton.getMetrics()
      }
    });

  } catch (error: any) {
    logger.error('[PLATFORM DASHBOARD] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_fetch_platform_dashboard',
      message: (error as any)?.message || 'Unknown error'
    });
  }
});

/**
 * GET /api/platform/stats
 * Get platform-wide statistics for any authenticated user
 */
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    console.log('[PLATFORM STATS] Fetching platform statistics');
    
    const stats = await platformDashboardSingleton.getPlatformStats();
    
    res.json({
      success: true,
      data: stats,
      _timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('[PLATFORM STATS] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_fetch_platform_stats',
      message: (error as any)?.message || 'Unknown error'
    });
  }
});

/**
 * GET /api/platform/tenants/top
 * Get top performing tenants for any authenticated user
 */
router.get('/tenants/top', authenticateToken, async (req: Request, res: Response) => {
  try {
    console.log('[PLATFORM TENANTS] Fetching top tenants');
    
    const topTenants = await platformDashboardSingleton.getTopTenants();
    
    res.json({
      success: true,
      data: topTenants,
      _timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('[PLATFORM TENANTS] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_fetch_top_tenants',
      message: (error as any)?.message || 'Unknown error'
    });
  }
});

/**
 * GET /api/platform/activity
 * Get recent platform activity for any authenticated user
 */
router.get('/activity', authenticateToken, async (req: Request, res: Response) => {
  try {
    console.log('[PLATFORM ACTIVITY] Fetching recent activity');
    
    const activity = await platformDashboardSingleton.getRecentActivity();
    
    res.json({
      success: true,
      data: activity,
      _timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('[PLATFORM ACTIVITY] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_fetch_recent_activity',
      message: (error as any)?.message || 'Unknown error'
    });
  }
});

/**
 * DELETE /api/platform/cache
 * Clear platform dashboard cache
 * Requires platform admin role
 */
router.delete('/cache', authenticateToken, authorize(user_role.PLATFORM_ADMIN, user_role.ADMIN), async (req: Request, res: Response) => {
  try {
    console.log('[PLATFORM CACHE] Clearing dashboard cache');
    
    await platformDashboardSingleton.clearPlatformCache();
    
    res.json({
      success: true,
      message: 'Platform dashboard cache cleared',
      _timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('[PLATFORM CACHE] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_clear_cache',
      message: (error as any)?.message || 'Unknown error'
    });
  }
});

/**
 * GET /api/platform/metrics
 * Get singleton performance metrics
 * Requires platform admin role
 */
router.get('/metrics', authenticateToken, authorize(user_role.PLATFORM_ADMIN, user_role.ADMIN), async (req: Request, res: Response) => {
  try {
    const metrics = platformDashboardSingleton.getMetrics();
    
    res.json({
      success: true,
      data: metrics,
      _timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    logger.error('[PLATFORM METRICS] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'failed_to_fetch_metrics',
      message: (error as any)?.message || 'Unknown error'
    });
  }
});

export default router;
