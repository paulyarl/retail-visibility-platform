/**
 * Admin Flyer Reports API Routes — reactive moderation queue (spec §10).
 *
 * Routes:
 *   GET    /api/admin/flyer-reports                     — report list (?status=open|actioned|dismissed|all)
 *   POST   /api/admin/flyer-reports/:reportId/resolve   — { action: 'suppress'|'dismiss' }
 *   POST   /api/admin/flyer-reports/flyers/:flyerId/restore — suppressed flyer → 'draft' (merchant must republish)
 *
 * All routes require platform admin authentication. Report rows only carry
 * open|actioned|dismissed — resolution metadata lives on the flyer itself
 * (status='suppressed') plus the report's terminal state.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { requirePlatformAdmin } from '../../middleware/auth';
import { prisma } from '../../prisma';
import { logger } from '../../logger';

const router = Router();

const resolveSchema = z.object({
  action: z.enum(['suppress', 'dismiss']),
});

/**
 * GET /api/admin/flyer-reports
 * Reports joined to their flyer + tenant for review.
 */
router.get('/', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const status = (req.query.status as string) || 'open';
    const where: any = {};
    if (status !== 'all') where.status = status;

    const reports = await prisma.tenant_flyer_reports.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: 200,
      include: {
        tenant_flyers: {
          select: {
            id: true, title: true, status: true, share_code: true,
            hero_image_url: true, starts_at: true, ends_at: true,
            impressions: true, clicks: true,
            tenants: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    const counts = await prisma.tenant_flyer_reports.groupBy({
      by: ['status'],
      _count: { _all: true },
    });

    res.json({
      success: true,
      data: {
        reports: reports.map((r) => ({
          id: r.id,
          reason: r.reason,
          detail: r.detail,
          status: r.status,
          createdAt: r.created_at,
          flyer: r.tenant_flyers
            ? {
                id: r.tenant_flyers.id,
                title: r.tenant_flyers.title,
                status: r.tenant_flyers.status,
                shareCode: r.tenant_flyers.share_code,
                heroImageUrl: r.tenant_flyers.hero_image_url,
                startsAt: r.tenant_flyers.starts_at,
                endsAt: r.tenant_flyers.ends_at,
                impressions: r.tenant_flyers.impressions,
                clicks: r.tenant_flyers.clicks,
                tenant: r.tenant_flyers.tenants
                  ? { id: r.tenant_flyers.tenants.id, name: r.tenant_flyers.tenants.name, slug: r.tenant_flyers.tenants.slug }
                  : null,
              }
            : null,
        })),
        counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
      },
    });
  } catch (error) {
    logger.error('[admin/flyer-reports] GET / error', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * POST /api/admin/flyer-reports/:reportId/resolve
 * action 'suppress' → flyer suppressed + report actioned; 'dismiss' → report dismissed.
 */
router.post('/:reportId/resolve', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', details: parsed.error.issues });
    }

    const report = await prisma.tenant_flyer_reports.findUnique({ where: { id: req.params.reportId } });
    if (!report) return res.status(404).json({ success: false, error: 'not_found' });
    if (report.status !== 'open') {
      return res.status(409).json({ success: false, error: 'already_resolved', message: `Report is ${report.status}` });
    }

    await prisma.$transaction(async (tx) => {
      if (parsed.data.action === 'suppress') {
        await tx.tenant_flyers.update({ where: { id: report.flyer_id }, data: { status: 'suppressed' } });
        // Suppression covers the flyer, not just this report — close its open siblings too.
        await tx.tenant_flyer_reports.updateMany({
          where: { flyer_id: report.flyer_id, status: 'open' },
          data: { status: 'actioned' },
        });
      } else {
        await tx.tenant_flyer_reports.update({ where: { id: report.id }, data: { status: 'dismissed' } });
      }
    });

    res.json({ success: true });
  } catch (error) {
    logger.error('[admin/flyer-reports] POST /:reportId/resolve error', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

/**
 * POST /api/admin/flyer-reports/flyers/:flyerId/restore
 * Restores a suppressed flyer to 'draft' — the merchant must republish (the
 * platform never re-activates content itself).
 */
router.post('/flyers/:flyerId/restore', requirePlatformAdmin, async (req: Request, res: Response) => {
  try {
    const flyer = await prisma.tenant_flyers.findUnique({ where: { id: req.params.flyerId }, select: { status: true } });
    if (!flyer) return res.status(404).json({ success: false, error: 'not_found' });
    if (flyer.status !== 'suppressed') {
      return res.status(409).json({ success: false, error: 'not_suppressed', message: `Flyer is ${flyer.status}` });
    }

    await prisma.tenant_flyers.update({ where: { id: req.params.flyerId }, data: { status: 'draft' } });
    res.json({ success: true });
  } catch (error) {
    logger.error('[admin/flyer-reports] POST /flyers/:flyerId/restore error', undefined, {
      error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) },
    });
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

export default router;
