/**
 * Admin Notification Logs API Routes
 * 
 * Provides endpoints for platform admins to view email/notification history.
 * All routes require admin authentication.
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { requirePlatformAdmin } from '../../middleware/auth';
import { logger } from '../../logger';

const router = Router();

/**
 * GET /api/admin/notification-logs
 * List notification logs with filtering and pagination
 * Permission: Platform admin only
 */
router.get('/', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    console.log('[ADMIN NOTIFICATIONS] Request received from platform admin');

    const {
      tenant_id,
      type,
      sent,
      start_date,
      end_date,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    if (tenant_id) {
      where.tenant_id = tenant_id as string;
    }

    if (type) {
      where.type = type as string;
    }

    if (sent !== undefined) {
      where.sent = sent === 'true';
    }

    if (start_date || end_date) {
      where.created_at = {};
      if (start_date) {
        where.created_at.gte = new Date(start_date as string);
      }
      if (end_date) {
        where.created_at.lte = new Date(end_date as string);
      }
    }

    // Get total count
    const total = await prisma.notification_logs.count({ where });

    // Get logs
    const logs = await prisma.notification_logs.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: offset,
      take: limitNum,
    });

    // Get tenant names for the logs
    const tenantIds = [...new Set(logs.map(l => l.tenant_id))];
    const tenants = await prisma.tenants.findMany({
      where: { id: { in: tenantIds } },
      select: { id: true, name: true },
    });
    const tenantMap = new Map(tenants.map(t => [t.id, t.name]));

    // Enrich logs with tenant names
    const enrichedLogs = logs.map(l => ({
      ...l,
      tenant_name: tenantMap.get(l.tenant_id) || 'Unknown',
    }));

    // Get unique types for filter
    const types = await prisma.notification_logs.findMany({
      select: { type: true },
      distinct: ['type'],
      orderBy: { type: 'asc' },
    });

    console.log(`[ADMIN NOTIFICATIONS] Found ${logs.length} logs`);

    res.json({
      logs: enrichedLogs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
      filters: {
        types: types.map(t => t.type),
      },
    });
  } catch (error: any) {
    logger.error('[ADMIN NOTIFICATIONS] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      error: 'failed_to_fetch_logs',
      message: 'Failed to fetch notification logs',
    });
  }
});

/**
 * GET /api/admin/notification-logs/stats
 * Get notification statistics
 * Permission: Platform admin only
 */
router.get('/stats', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { start_date, end_date } = req.query;

    // Default to last 30 days
    const endDate = end_date ? new Date(end_date as string) : new Date();
    const startDate = start_date ? new Date(start_date as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Get stats by type
    const byTypeRaw = await prisma.notification_logs.groupBy({
      by: ['type'],
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: {
        id: true,
      },
    });

    // Get sent counts per type
    const sentByType = await prisma.notification_logs.groupBy({
      by: ['type'],
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
        sent: true,
      },
      _count: {
        id: true,
      },
    });

    const sentMap = new Map(sentByType.map(s => [s.type, s._count.id]));

    // Get total counts
    const total = await prisma.notification_logs.count({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    const sent = await prisma.notification_logs.count({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
        sent: true,
      },
    });

    // Get daily counts using Prisma groupBy (safer than raw query)
    // Note: We'll skip daily for now and just return summary + byType
    // Daily can be added later with a proper date truncation approach

    res.json({
      period: {
        start: startDate,
        end: endDate,
      },
      summary: {
        total,
        sent,
        failed: total - sent,
        successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
      },
      byType: byTypeRaw.map(t => ({
        type: t.type,
        total: t._count.id,
        sent: sentMap.get(t.type) || 0,
        failed: t._count.id - (sentMap.get(t.type) || 0),
      })),
      daily: [], // Placeholder - can implement with date range iteration if needed
    });
  } catch (error: any) {
    logger.error('[ADMIN NOTIFICATIONS STATS] Error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      error: 'failed_to_fetch_stats',
      message: 'Failed to fetch notification statistics',
    });
  }
});

/**
 * GET /api/admin/notification-logs/:id
 * Get single notification log details
 * Permission: Platform admin only
 */
router.get('/:id', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const log = await prisma.notification_logs.findUnique({
      where: { id },
    });

    if (!log) {
      return res.status(404).json({
        error: 'not_found',
        message: 'Notification log not found',
      });
    }

    // Get tenant info
    const tenant = await prisma.tenants.findUnique({
      where: { id: log.tenant_id },
      select: {
        id: true,
        name: true,
        subscription_tier: true,
        subscription_status: true,
      },
    });

    res.json({
      ...log,
      tenant,
    });
  } catch (error: any) {
    logger.error('[ADMIN NOTIFICATIONS] Error fetching log:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      error: 'failed_to_fetch_log',
      message: 'Failed to fetch notification log',
    });
  }
});

export default router;
