/**
 * GBP Options Settings Route
 *
 * GET  /:tenantId/gbp-options          — returns tier state + merchant settings
 * PUT  /:tenantId/gbp-options          — updates merchant gate toggles
 * GET  /:tenantId/gbp-options/capability — returns resolved capability state
 *
 * Sprint: docs/LocalBiz/GBP_SPRINT_PHASE4.md Task 3
 */
import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { z } from 'zod';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { logger } from '../logger';

const router = Router();

const gbpOptionsSettingsSchema = z.object({
  gbp_reviews_display: z.boolean().optional(),
  gbp_content_display: z.boolean().optional(),
});

const DEFAULT_SETTINGS = {
  gbp_reviews_display: true,
  gbp_content_display: true,
};

// Get GBP options settings for a tenant
router.get('/:tenantId/gbp-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const settings = await (prisma as any).tenant_gbp_options_settings?.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!settings) {
      return res.json({ success: true, settings: DEFAULT_SETTINGS });
    }

    res.json({
      success: true,
      settings: {
        gbp_reviews_display: settings.gbp_reviews_display,
        gbp_content_display: settings.gbp_content_display,
      },
    });
  } catch (error) {
    logger.error('Error fetching GBP options settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch GBP options settings' });
  }
});

// Get resolved GBP capability state for a tenant
router.get('/:tenantId/gbp-options/capability', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { resolveEffectiveCapabilities } = await import('../services/EffectiveCapabilityResolver');
    const caps = await resolveEffectiveCapabilities(tenantId);
    const gbp = (caps?.effective as any)?.gbp_management ?? null;
    res.json({ success: true, capability: gbp });
  } catch (error) {
    logger.error('Error fetching GBP capability state:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error) } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch GBP capability state' });
  }
});

// Update GBP options settings for a tenant
router.put('/:tenantId/gbp-options', authenticateToken, requireTenantAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const validationResult = gbpOptionsSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid GBP options settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    const existing = await (prisma as any).tenant_gbp_options_settings?.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      settings = await (prisma as any).tenant_gbp_options_settings.update({
        where: { tenant_id: tenantId },
        data: { ...data, updated_at: new Date() },
      });
    } else {
      settings = await (prisma as any).tenant_gbp_options_settings.create({
        data: {
          id: `tgos-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          tenant_id: tenantId,
          ...data,
        },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        gbp_reviews_display: settings.gbp_reviews_display,
        gbp_content_display: settings.gbp_content_display,
      },
    });
  } catch (error) {
    logger.error('Error updating GBP options settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to update GBP options settings' });
  }
});

export default router;
