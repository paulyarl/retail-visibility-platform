import { Router, Request, Response } from 'express';
import { authenticateToken, authorize } from '../middleware/auth';
import { platformDashboardSingleton } from '../services/PlatformDashboardSingletonService';
import { SingletonMetrics } from '../lib/UniversalSingleton';
import { user_role } from '@prisma/client';

const router = Router();

/**
 * GET /api/platform/dashboard
 * Get complete platform dashboard data
 * Requires platform admin or support role
 */
router.get('/dashboard', authenticateToken, authorize(user_role.PLATFORM_ADMIN, user_role.ADMIN, user_role.PLATFORM_SUPPORT), async (req: Request, res: Response) => {
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
    console.error('[PLATFORM DASHBOARD] Error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_fetch_platform_dashboard',
      message: error?.message || 'Unknown error'
    });
  }
});

/**
 * GET /api/platform/stats
 * Get platform-wide statistics only
 */
router.get('/stats', authenticateToken, authorize(user_role.PLATFORM_ADMIN, user_role.ADMIN, user_role.PLATFORM_SUPPORT, user_role.PLATFORM_VIEWER), async (req: Request, res: Response) => {
  try {
    console.log('[PLATFORM STATS] Fetching platform statistics');
    
    const stats = await platformDashboardSingleton.getPlatformStats();
    
    res.json({
      success: true,
      data: stats,
      _timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[PLATFORM STATS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_fetch_platform_stats',
      message: error?.message || 'Unknown error'
    });
  }
});

/**
 * GET /api/platform/tenants/top
 * Get top performing tenants
 */
router.get('/tenants/top', authenticateToken, authorize(user_role.PLATFORM_ADMIN, user_role.ADMIN, user_role.PLATFORM_SUPPORT, user_role.PLATFORM_VIEWER), async (req: Request, res: Response) => {
  try {
    console.log('[PLATFORM TENANTS] Fetching top tenants');
    
    const topTenants = await platformDashboardSingleton.getTopTenants();
    
    res.json({
      success: true,
      data: topTenants,
      _timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[PLATFORM TENANTS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_fetch_top_tenants',
      message: error?.message || 'Unknown error'
    });
  }
});

/**
 * GET /api/platform/activity
 * Get recent platform activity
 */
router.get('/activity', authenticateToken, authorize(user_role.PLATFORM_ADMIN, user_role.ADMIN, user_role.PLATFORM_SUPPORT, user_role.PLATFORM_VIEWER), async (req: Request, res: Response) => {
  try {
    console.log('[PLATFORM ACTIVITY] Fetching recent activity');
    
    const activity = await platformDashboardSingleton.getRecentActivity();
    
    res.json({
      success: true,
      data: activity,
      _timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[PLATFORM ACTIVITY] Error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_fetch_recent_activity',
      message: error?.message || 'Unknown error'
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
    console.error('[PLATFORM CACHE] Error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_clear_cache',
      message: error?.message || 'Unknown error'
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
    console.error('[PLATFORM METRICS] Error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_fetch_metrics',
      message: error?.message || 'Unknown error'
    });
  }
});

export default router;
