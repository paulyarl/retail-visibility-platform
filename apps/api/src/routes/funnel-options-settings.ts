import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { logger } from '../logger';

const router = Router();

const funnelOptionsSettingsSchema = z.object({
  funnel_options_enabled: z.boolean().optional(),
  order_bump_enabled: z.boolean().optional(),
  upsell_enabled: z.boolean().optional(),
  downsell_enabled: z.boolean().optional(),
  oto_enabled: z.boolean().optional(),
  coupon_offer_enabled: z.boolean().optional(),
});

const DEFAULT_SETTINGS = {
  funnel_options_enabled: true,
  order_bump_enabled: true,
  upsell_enabled: true,
  downsell_enabled: true,
  oto_enabled: true,
  coupon_offer_enabled: true,
};

const FUNNEL_FEATURE_KEYS = [
  'funnel_options_enabled',
  'order_bump_enabled',
  'upsell_enabled',
  'downsell_enabled',
  'oto_enabled',
  'coupon_offer_enabled',
] as const;

// GET /tenants/:tenantId/funnels/settings
router.get('/tenants/:tenantId/funnels/settings', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const merchantPrefs = await prisma.tenant_funnel_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = merchantPrefs || DEFAULT_SETTINGS;

    const settings: Record<string, boolean> = {};
    for (const key of FUNNEL_FEATURE_KEYS) {
      settings[key] = !!(rawSettings as any)[key];
    }

    res.json({ success: true, settings });
  } catch (error) {
    logger.error('Error fetching funnel options settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to fetch funnel options settings' });
  }
});

// PUT /tenants/:tenantId/funnels/settings
router.put('/tenants/:tenantId/funnels/settings', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const validationResult = funnelOptionsSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid funnel options settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    const existing = await prisma.tenant_funnel_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      settings = await prisma.tenant_funnel_options_settings.update({
        where: { tenant_id: tenantId },
        data: { ...data, updated_at: new Date() },
      });
    } else {
      settings = await prisma.tenant_funnel_options_settings.create({
        data: {
          id: `fos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tenant_id: tenantId,
          ...data,
        },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        funnel_options_enabled: settings.funnel_options_enabled,
        order_bump_enabled: settings.order_bump_enabled,
        upsell_enabled: settings.upsell_enabled,
        downsell_enabled: settings.downsell_enabled,
        oto_enabled: settings.oto_enabled,
        coupon_offer_enabled: settings.coupon_offer_enabled,
      },
    });
  } catch (error) {
    logger.error('Error updating funnel options settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({ success: false, error: 'internal_error', message: 'Failed to update funnel options settings' });
  }
});

export default router;
