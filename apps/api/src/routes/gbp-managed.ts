/**
 * GBP Managed view — the merchant-facing surface for DFY tenants.
 *
 * Spec: docs/LocalBiz/GBP_DFY_MANAGEMENT_SPEC.md §5
 * Sprint: docs/LocalBiz/GBP_DFY_SPRINT_PLAN.md D5
 *
 *   GET  /:tenantId/gbp-managed             — managed-state summary:
 *        managed{by,grantedVia,delegatedSurfaces}, location, settings,
 *        scheduled posts, pending approvals, merchant-visible activity feed
 *   POST /:tenantId/gbp-managed/request-change — merchant requests a change
 *        to a delegated surface → activity event + ops CRM alert
 *
 * Tenant members read their own tenant; platform users read any (the same
 * checkTenantAccess semantics the rest of the GBP surface now uses).
 */
import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { authenticateToken, checkTenantAccess } from '../middleware/auth';
import { resolveGbpLocation } from '../lib/google/gbp-target';
import { emitGbpActivity } from '../lib/google/gbp-activity';
import { CrmAlertService } from '../services/CrmAlertService';
import { generateQuickStart } from '../lib/id-generator';

const router = Router();

router.use(authenticateToken);
router.use(checkTenantAccess);

// ── Managed-state summary ─────────────────────────────────────────────────

router.get('/:tenantId/gbp-managed', async (req: any, res: Response) => {
  try {
    const tenantId = req.params.tenantId;

    const location = await resolveGbpLocation({ tenantId });

    const [settings, scheduledPosts, pendingApprovals, activity] = await Promise.all([
      (prisma as any).tenant_gbp_options_settings.findUnique({
        where: { tenant_id: tenantId },
        select: { gbp_approval_mode: true, gbp_autopilot_enabled: true },
      }),
      prisma.gbp_posts.findMany({
        where: {
          tenant_id: tenantId,
          status: 'SCHEDULED',
          scheduled_for: { gte: new Date() },
        },
        select: {
          id: true,
          summary: true,
          scheduled_for: true,
          topic_type: true,
          approved_at: true,
          created_by: true,
        },
        orderBy: { scheduled_for: 'asc' },
        take: 50,
      }),
      prisma.gbp_posts.count({
        where: { tenant_id: tenantId, status: 'SCHEDULED', approved_at: null },
      }),
      prisma.gbp_activity_events.findMany({
        where: { tenant_id: tenantId, visible_to_merchant: true },
        orderBy: { created_at: 'desc' },
        take: 50,
        select: {
          id: true,
          action: true,
          actor: true,
          detail: true,
          created_at: true,
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        managed: location
          ? {
              by: location.managed_by,
              grantedVia: location.granted_via,
              delegatedSurfaces: location.delegated_surfaces,
            }
          : { by: 'self', grantedVia: null, delegatedSurfaces: null },
        location: location
          ? {
              id: location.id,
              name: location.location_name,
              verificationState: (location as any).verification_state ?? null,
            }
          : null,
        settings: {
          approvalMode: settings?.gbp_approval_mode ?? 'auto_publish',
          autopilotEnabled: settings?.gbp_autopilot_enabled ?? false,
        },
        scheduledPosts,
        pendingApprovals,
        activity,
      },
    });
  } catch (error: any) {
    logger.error('[gbp-managed] summary error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to fetch managed view' });
  }
});

// ── Request-change → ops queue ────────────────────────────────────────────

const requestChangeSchema = z.object({
  surface: z.enum(['info', 'hours', 'posts', 'media', 'reviews', 'attributes']),
  note: z.string().min(1).max(2000),
  payload: z.record(z.unknown()).optional(),
});

router.post('/:tenantId/gbp-managed/request-change', async (req: any, res: Response) => {
  try {
    const tenantId = req.params.tenantId;
    const parsed = requestChangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, error: 'validation_error', details: parsed.error.issues });
    }
    const { surface, note, payload } = parsed.data;

    const location = await resolveGbpLocation({ tenantId });

    // Merchant-visible feed entry (requested_by in detail distinguishes it
    // from platform-executed actions on the same feed).
    await emitGbpActivity({
      tenantId,
      gbpLocationId: location?.id ?? null,
      action: 'change_requested',
      actor: 'system',
      actorUserId: req.user?.userId ?? null,
      detail: { surface, note, payload: payload ?? null, requested_by: 'merchant' },
    });

    // Ops alert — the request surfaces in the CRM feed the ops team watches.
    try {
      await CrmAlertService.getInstance().create({
        id: generateQuickStart('cra'),
        tenant_id: tenantId,
        type: 'gbp_change_requested',
        severity: 'info',
        title: `GBP change requested — ${surface}`,
        message: note,
        dedupe_key: `gbp-change-${tenantId}-${surface}-${Date.now()}`,
      } as any);
    } catch (alertErr) {
      logger.warn('[gbp-managed] ops alert failed (non-fatal)', undefined, { error: (alertErr as Error).message });
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[gbp-managed] request-change error', undefined, { error: error.message });
    res.status(500).json({ success: false, error: 'Failed to submit change request' });
  }
});

export default router;
