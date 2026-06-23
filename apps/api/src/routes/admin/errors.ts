/**
 * Admin Application Error Log API Routes
 *
 * Provides endpoints for platform admins to browse and manage
 * persisted application errors from the application_error_log table.
 *
 * Routes:
 *   GET    /api/admin/errors          — paginated list with filters
 *   GET    /api/admin/errors/stats    — aggregate stats
 *   GET    /api/admin/errors/:id      — full error detail
 *   POST   /api/admin/errors/:id/resolve — mark error as resolved
 *
 * All routes require platform admin authentication.
 */

import { Router, Request, Response } from 'express';
import { requirePlatformAdmin } from '../../middleware/auth';
import { prisma } from '../../prisma';
import { logger } from '../../logger';

const router = Router();

/**
 * GET /api/admin/errors
 * Paginated error list with filters: tenant_id, level, service, resolved, date range
 */
router.get('/', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (req.query.tenant_id) where.tenant_id = req.query.tenant_id;
    if (req.query.level) where.level = req.query.level;
    if (req.query.service) where.service = req.query.service;
    if (req.query.resolved === 'true') where.resolved = true;
    if (req.query.resolved === 'false') where.resolved = false;
    if (req.query.correlation_id) where.correlation_id = req.query.correlation_id;

    if (req.query.from || req.query.to) {
      where.occurred_at = {};
      if (req.query.from) where.occurred_at.gte = new Date(req.query.from as string);
      if (req.query.to) where.occurred_at.lte = new Date(req.query.to as string);
    }

    const [errors, total] = await Promise.all([
      prisma.application_error_log.findMany({
        where,
        orderBy: { occurred_at: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          occurred_at: true,
          level: true,
          message: true,
          error_name: true,
          tenant_id: true,
          user_id: true,
          request_method: true,
          request_path: true,
          status_code: true,
          correlation_id: true,
          service: true,
          resolved: true,
          resolved_at: true,
          resolved_by: true,
        },
      }),
      prisma.application_error_log.count({ where }),
    ]);

    res.json({
      errors,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    logger.error('[Admin Errors] List failed', undefined, {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
    res.status(500).json({ error: 'failed_to_fetch_errors', message: error.message });
  }
});

/**
 * GET /api/admin/errors/stats
 * Aggregate error counts by level, service, and tenant over a date range
 */
router.get('/stats', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [byLevel, byService, byTenant, total, unresolved] = await Promise.all([
      prisma.application_error_log.groupBy({
        by: ['level'],
        where: { occurred_at: { gte: since } },
        _count: true,
        orderBy: { _count: { level: 'desc' } },
      }),
      prisma.application_error_log.groupBy({
        by: ['service'],
        where: { occurred_at: { gte: since }, service: { not: null } },
        _count: true,
        orderBy: { _count: { service: 'desc' } },
        take: 10,
      }),
      prisma.application_error_log.groupBy({
        by: ['tenant_id'],
        where: { occurred_at: { gte: since }, tenant_id: { not: null } },
        _count: true,
        orderBy: { _count: { tenant_id: 'desc' } },
        take: 10,
      }),
      prisma.application_error_log.count({ where: { occurred_at: { gte: since } } }),
      prisma.application_error_log.count({ where: { occurred_at: { gte: since }, resolved: false } }),
    ]);

    res.json({
      period: { days, since: since.toISOString() },
      total,
      unresolved,
      byLevel: byLevel.map((r: any) => ({ level: r.level, count: r._count })),
      byService: byService.map((r: any) => ({ service: r.service, count: r._count })),
      byTenant: byTenant.map((r: any) => ({ tenantId: r.tenant_id, count: r._count })),
    });
  } catch (error: any) {
    logger.error('[Admin Errors] Stats failed', undefined, {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
    res.status(500).json({ error: 'failed_to_fetch_stats', message: error.message });
  }
});

/**
 * GET /api/admin/errors/:id
 * Full error detail including stack trace and context
 */
router.get('/:id', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const error = await prisma.application_error_log.findUnique({
      where: { id: req.params.id },
    });

    if (!error) {
      return res.status(404).json({ error: 'not_found', message: 'Error log entry not found' });
    }

    res.json(error);
  } catch (error: any) {
    logger.error('[Admin Errors] Detail failed', undefined, {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
    res.status(500).json({ error: 'failed_to_fetch_error', message: error.message });
  }
});

/**
 * POST /api/admin/errors/:id/resolve
 * Mark an error as resolved
 */
router.post('/:id/resolve', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const existing = await prisma.application_error_log.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'not_found', message: 'Error log entry not found' });
    }

    const updated = await prisma.application_error_log.update({
      where: { id: req.params.id },
      data: {
        resolved: true,
        resolved_at: new Date(),
        resolved_by: (req as any).user?.id || null,
      },
    });

    logger.info('[Admin Errors] Error resolved', undefined, {
      errorId: req.params.id,
      resolvedBy: (req as any).user?.id,
    });

    res.json(updated);
  } catch (error: any) {
    logger.error('[Admin Errors] Resolve failed', undefined, {
      error: { name: error.name, message: error.message, stack: error.stack },
    });
    res.status(500).json({ error: 'failed_to_resolve_error', message: error.message });
  }
});

export default router;
