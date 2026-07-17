import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { requireWritableSubscription } from '../middleware/subscription';
import { z } from 'zod';
import StorefrontLayoutService from '../services/StorefrontLayoutService';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { generateStorefrontLayoutsSettingsId } from '../lib/id-generator';
import { logger } from '../logger';

const router = Router();

const storefrontLayoutsSettingsSchema = z.object({
  layouts_enabled: z.boolean().optional(),
  storefront_layout: z.enum(['classic', 'editorial', 'immersive']).optional(),
});

const DEFAULT_LAYOUTS_SETTINGS = {
  layouts_enabled: true,
  storefront_layout: 'classic',
};

router.get('/:tenantId/storefront-layouts', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tierState = await StorefrontLayoutService.getInstance().resolveStorefrontLayoutState(tenantId);

    if (!tierState.enabled) {
      return res.json({
        success: true,
        settings: {
          ...DEFAULT_LAYOUTS_SETTINGS,
          layouts_enabled: false,
          storefront_layout: 'classic',
        },
        tierState,
      });
    }

    const settings = await prisma.tenant_storefront_layouts_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = settings || DEFAULT_LAYOUTS_SETTINGS;

    const allowedLayouts = tierState.allowedLayouts;
    const effectiveLayout = allowedLayouts.includes(rawSettings.storefront_layout as 'classic' | 'editorial' | 'immersive')
      ? rawSettings.storefront_layout as 'classic' | 'editorial' | 'immersive'
      : (allowedLayouts[0] || 'classic');

    const tierFilteredSettings = {
      layouts_enabled: !!rawSettings.layouts_enabled && tierState.enabled,
      storefront_layout: effectiveLayout,
    };

    res.json({
      success: true,
      settings: tierFilteredSettings,
      tierState,
    });
  } catch (error) {
    logger.error('Error fetching storefront layouts settings', undefined, { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch storefront layouts settings',
    });
  }
});

router.put('/:tenantId/storefront-layouts', authenticateToken, requireTenantAdmin, requireWritableSubscription, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const validationResult = storefrontLayoutsSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid storefront layouts settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    if (data.storefront_layout) {
      const tierState = await StorefrontLayoutService.getInstance().resolveStorefrontLayoutState(tenantId);
      if (!tierState.enabled || !tierState.allowedLayouts.includes(data.storefront_layout)) {
        return res.status(403).json({
          success: false,
          error: 'tier_restricted',
          message: `Layout '${data.storefront_layout}' is not available on your current plan`,
        });
      }
    }

    const existing = await prisma.tenant_storefront_layouts_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      settings = await prisma.tenant_storefront_layouts_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      settings = await prisma.tenant_storefront_layouts_settings.create({
        data: {
          id: generateStorefrontLayoutsSettingsId(tenantId),
          tenant_id: tenantId,
          ...data,
        },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        layouts_enabled: settings.layouts_enabled,
        storefront_layout: settings.storefront_layout,
      },
    });
  } catch (error) {
    logger.error('Error updating storefront layouts settings', undefined, { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update storefront layouts settings',
    });
  }
});

export default router;
