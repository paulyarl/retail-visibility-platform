import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../prisma';
import { UserRole } from '@prisma/client';
import { canViewAllTenants } from '../utils/platform-admin';

const router = Router();

// GET /api/admin/scan-metrics - Get scan activity metrics
router.get('/api/admin/scan-metrics', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!canViewAllTenants(req.user as any)) {
      return res.status(403).json({ success: false, error: 'platform_access_required' });
    }

    const { timeRange = '24h' } = req.query;
    
    // Calculate time window
    const now = new Date();
    let startDate = new Date();
    
    switch (timeRange) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get session stats
    const sessions = await prisma.scanSessions.findMany({
      where: {
        startedAt: { gte: startDate },
      },
      select: {
        id: true,
        status: true,
        deviceType: true,
        scannedCount: true,
        committedCount: true,
        duplicateCount: true,
        startedAt: true,
        completed_at: true,
      },
    });

    const totalSessions = sessions.length;
    const activeSessions = sessions.filter(s => s.status === 'active').length;
    const completedSessions = sessions.filter(s => s.status === 'completed').length;
    const cancelledSessions = sessions.filter(s => s.status === 'cancelled').length;
    
    const totalScanned = sessions.reduce((sum, s) => sum + s.scannedCount, 0);
    const totalCommitted = sessions.reduce((sum, s) => sum + s.committedCount, 0);
    const totalDuplicates = sessions.reduce((sum, s) => sum + s.duplicateCount, 0);

    // Calculate average session duration for completed sessions
    const completedWithDuration = sessions.filter(s => s.completed_at && s.startedAt);
    const avgDurationMs = completedWithDuration.length > 0
      ? completedWithDuration.reduce((sum, s) => {
          const duration = s.completed_at!.getTime() - s.startedAt.getTime();
          return sum + duration;
        }, 0) / completedWithDuration.length
      : 0;

    // Device type breakdown
    const deviceBreakdown = sessions.reduce((acc, s) => {
      const device = s.deviceType || 'unknown';
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get enrichment stats
    const enrichmentLogs = await prisma.barcodeLookupLog.findMany({
      where: {
        createdAt: { gte: startDate },
      },
      select: {
        provider: true,
        status: true,
        latencyMs: true,
      },
    });

    const enrichmentTotal = enrichmentLogs.length;
    const enrichmentByProvider = enrichmentLogs.reduce((acc, log) => {
      const provider = log.provider || 'unknown';
      if (!acc[provider]) {
        acc[provider] = { total: 0, success: 0, fail: 0, avgLatency: 0 };
      }
      acc[provider].total++;
      if (log.status === 'success') {
        acc[provider].success++;
      } else {
        acc[provider].fail++;
      }
      return acc;
    }, {} as Record<string, { total: number; success: number; fail: number; avgLatency: number }>);

    // Calculate average latency per provider
    Object.keys(enrichmentByProvider).forEach(provider => {
      const logs = enrichmentLogs.filter(l => l.provider === provider && l.latencyMs);
      if (logs.length > 0) {
        enrichmentByProvider[provider].avgLatency = 
          logs.reduce((sum, l) => sum + (l.latencyMs || 0), 0) / logs.length;
      }
    });

    // Calculate rates
    const scanSuccessRate = totalScanned > 0 
      ? ((totalScanned - totalDuplicates) / totalScanned * 100).toFixed(1)
      : '0';
    
    const commitSuccessRate = totalSessions > 0
      ? (completedSessions / totalSessions * 100).toFixed(1)
      : '0';

    const cacheHitRate = enrichmentTotal > 0
      ? ((enrichmentByProvider.cache?.success || 0) / enrichmentTotal * 100).toFixed(1)
      : '0';

    // Recent activity (last 10 sessions)
    const recentSessions = await prisma.scanSessions.findMany({
      where: {
        startedAt: { gte: startDate },
      },
      orderBy: { startedAt: 'desc' },
      take: 10,
      select: {
        id: true,
        status: true,
        deviceType: true,
        scannedCount: true,
        committedCount: true,
        duplicateCount: true,
        startedAt: true,
        completed_at: true,
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return res.json({
      success: true,
      timeRange,
      stats: {
        scanSessions: {
          total: totalSessions,
          active: activeSessions,
          completed: completedSessions,
          cancelled: cancelledSessions,
          avgDurationMs: Math.round(avgDurationMs),
        },
        scanning: {
          totalScanned,
          totalCommitted,
          totalDuplicates,
          scanSuccessRate: parseFloat(scanSuccessRate),
          commitSuccessRate: parseFloat(commitSuccessRate),
        },
        devices: deviceBreakdown,
        enrichment: {
          total: enrichmentTotal,
          cacheHitRate: parseFloat(cacheHitRate),
          byProvider: enrichmentByProvider,
        },
      },
      recentActivity: recentSessions,
    });
  } catch (error: any) {
    console.error('[scan-metrics] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

// GET /api/admin/scan-metrics/timeseries - Get time-series data for charts
router.get('/api/admin/scan-metrics/timeseries', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!canViewAllTenants(req.user as any)) {
      return res.status(403).json({ success: false, error: 'platform_access_required' });
    }

    const { timeRange = '24h', interval = '1h' } = req.query;
    
    // Calculate time window
    const now = new Date();
    let startDate = new Date();
    let bucketSize = 60 * 60 * 1000; // 1 hour in ms
    
    switch (timeRange) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        bucketSize = 60 * 60 * 1000; // 1 hour
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        bucketSize = 6 * 60 * 60 * 1000; // 6 hours
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        bucketSize = 24 * 60 * 60 * 1000; // 1 day
        break;
    }

    // Get all sessions in range
    const sessions = await prisma.scanSessions.findMany({
      where: {
        startedAt: { gte: startDate },
      },
      select: {
        startedAt: true,
        completed_at: true,
        status: true,
        scannedCount: true,
        committedCount: true,
      },
    });

    // Create time buckets
    const buckets: Record<string, any> = {};
    const startTime = startDate.getTime();
    const endTime = now.getTime();
    
    for (let time = startTime; time <= endTime; time += bucketSize) {
      const bucketKey = new Date(time).toISOString();
      buckets[bucketKey] = {
        timestamp: bucketKey,
        sessionsStarted: 0,
        sessionsCompleted: 0,
        itemsScanned: 0,
        itemsCommitted: 0,
      };
    }

    // Fill buckets with data
    sessions.forEach(session => {
      const bucketTime = Math.floor(session.startedAt.getTime() / bucketSize) * bucketSize;
      const bucketKey = new Date(bucketTime).toISOString();
      
      if (buckets[bucketKey]) {
        buckets[bucketKey].sessionsStarted++;
        buckets[bucketKey].itemsScanned += session.scannedCount;
        
        if (session.status === 'completed') {
          buckets[bucketKey].sessionsCompleted++;
          buckets[bucketKey].itemsCommitted += session.committedCount;
        }
      }
    });

    const timeseries = Object.values(buckets);

    return res.json({
      success: true,
      timeRange,
      interval,
      data: timeseries,
    });
  } catch (error: any) {
    console.error('[scan-metrics/timeseries] Error:', error);
    return res.status(500).json({ success: false, error: 'internal_error', message: error.message });
  }
});

export default router;
