import { Router, Request, Response } from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { prisma } from '../prisma';

const router = Router();

// GET /api/admin/sync-logs - Get category mirror sync logs
router.get('/api/admin/sync-logs', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50')), 100);
    const offset = parseInt(String(req.query.offset || '0'));
    const tenantId = req.query.tenantId ? String(req.query.tenantId) : undefined;
    const strategy = req.query.strategy ? String(req.query.strategy) : undefined;

    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    if (strategy) where.strategy = strategy;

    let logs: any[] = [], total = 0;
    
    try {
      [logs, total] = await Promise.all([
        prisma.category_mirror_runs.findMany({
          where,
          orderBy: { started_at: 'desc' },
          take: limit,
          skip: offset,
          select: {
            id: true,
            tenant_id: true,
            strategy: true,
            dry_run: true,
            created: true,
            updated: true,
            deleted: true,
            skipped: true,
            reason: true,
            error: true,
            job_id: true,
            started_at: true,
            completed_at: true,
          },
        }),
        prisma.category_mirror_runs.count({ where }),
      ]);
    } catch (tableError: any) {
      // Handle case where table doesn't exist yet
      if (tableError.code === 'P2021' && tableError.meta?.table === 'public.category_mirror_runs') {
        console.log('[sync-logs] Category mirror runs table does not exist yet, returning empty results');
        logs = [];
        total = 0;
      } else {
        throw tableError; // Re-throw other errors
      }
    }

    return res.json({
      success: true,
      data: logs.map(log => ({
        id: log.id,
        tenantId: log.tenant_id,
        strategy: log.strategy,
        dryRun: log.dry_run,
        created: log.created,
        updated: log.updated,
        deleted: log.deleted,
        skipped: log.skipped,
        reason: log.reason,
        error: log.error,
        jobId: log.job_id,
        startedAt: log.started_at,
        completedAt: log.completed_at,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (e: any) {
    console.error('[sync-logs] Error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'internal_error' });
  }
});

// GET /api/admin/sync-stats - Get sync statistics for dashboard
router.get('/api/admin/sync-stats', authenticateToken, requireAdmin, async (req: Request, res: Response) => {
  try {
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    let recentRuns: any[] = [];
    
    try {
      // Get recent runs
      recentRuns = await prisma.category_mirror_runs.findMany({
        where: {
          started_at: { gte: last24h },
        },
        select: {
          id: true,
          tenant_id: true,
          error: true,
          skipped: true,
          created: true,
          updated: true,
          deleted: true,
          completed_at: true,
        },
      });
    } catch (tableError: any) {
      // Handle case where table doesn't exist yet
      if (tableError.code === 'P2021' && tableError.meta?.table === 'public.category_mirror_runs') {
        console.log('[sync-stats] Category mirror runs table does not exist yet, returning empty stats');
        recentRuns = [];
      } else {
        throw tableError; // Re-throw other errors
      }
    }

    const totalRuns = recentRuns.length;
    const successfulRuns = recentRuns.filter((r: any) => !r.error && r.completed_at).length;
    const failedRuns = recentRuns.filter((r: any) => r.error).length;
    const outOfSyncCount = recentRuns.filter(
      (r: any) => !r.skipped && (r.created > 0 || r.updated > 0 || r.deleted > 0)
    ).length;

    const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;

    // Get recent errors
    const recentErrors = await prisma.category_mirror_runs.findMany({
      where: {
        error: { not: null },
        started_at: { gte: last24h },
      },
      orderBy: { started_at: 'desc' },
      take: 5,
      select: {
        id: true,
        tenant_id: true,
        error: true,
        started_at: true,
      },
    });

    return res.json({
      success: true,
      stats: {
        totalRuns,
        successfulRuns,
        failedRuns,
        successRate: Math.round(successRate * 10) / 10,
        outOfSyncCount,
        recentErrors: recentErrors.map(error => ({
          id: error.id,
          tenantId: error.tenant_id,
          error: error.error,
          startedAt: error.started_at,
        })),
      },
    });
  } catch (e: any) {
    console.error('[sync-stats] Error:', e);
    return res.status(500).json({ success: false, error: e?.message || 'internal_error' });
  }
});

export default router;
