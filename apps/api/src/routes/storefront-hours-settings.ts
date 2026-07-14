import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { requireWritableSubscription } from '../middleware/subscription';
import { z } from 'zod';
import StorefrontHoursService from '../services/StorefrontHoursService';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { generateStorefrontHoursSettingsId } from '../lib/id-generator';
import { logger } from '../logger';

const router = Router();

// Validation schema
const storefrontHoursSettingsSchema = z.object({
  hours_enabled: z.boolean().optional(),
  hours_display: z.boolean().optional(),
  hours_animated: z.boolean().optional(),
  hours_status: z.boolean().optional(),
});

// Default settings
export const DEFAULT_HOURS_SETTINGS = {
  hours_enabled: true,
  hours_display: true,
  hours_animated: true,
  hours_status: true,
};

// Get storefront hours settings for a tenant
router.get('/:tenantId/storefront-hours', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Resolve tier-gated state
    const tierState = await StorefrontHoursService.getInstance().resolveStorefrontHoursState(tenantId);

    // Hard gate: if storefront hours disabled at tier level, return all-false
    if (!tierState.enabled) {
      return res.json({
        success: true,
        settings: {
          ...DEFAULT_HOURS_SETTINGS,
          hours_enabled: false,
          hours_display: false,
          hours_animated: false,
          hours_status: false,
        },
        tierState,
      });
    }

    const settings = await prisma.tenant_storefront_hours_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = settings || DEFAULT_HOURS_SETTINGS;

    // Tier-filter settings: force off any feature not allowed by tier
    const tierFilteredSettings: Record<string, boolean> = {
      hours_enabled: !!rawSettings.hours_enabled && tierState.enabled,
      hours_display: !!rawSettings.hours_display && tierState.canShowHoursDisplay,
      hours_animated: !!rawSettings.hours_animated && tierState.canUseAnimatedHours,
      hours_status: !!rawSettings.hours_status && tierState.canShowHoursStatus,
    };

    res.json({
      success: true,
      settings: tierFilteredSettings,
      tierState,
    });
  } catch (error) {
    logger.error('Error fetching storefront hours settings', undefined, { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch storefront hours settings',
    });
  }
});

// Update storefront hours settings for a tenant
router.put('/:tenantId/storefront-hours', authenticateToken, requireTenantAdmin, requireWritableSubscription, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = storefrontHoursSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid storefront hours settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Check if settings exist
    const existing = await prisma.tenant_storefront_hours_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      settings = await prisma.tenant_storefront_hours_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      settings = await prisma.tenant_storefront_hours_settings.create({
        data: {
          id: generateStorefrontHoursSettingsId(tenantId),
          tenant_id: tenantId,
          ...data,
        },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        hours_enabled: settings.hours_enabled,
        hours_display: settings.hours_display,
        hours_animated: settings.hours_animated,
        hours_status: settings.hours_status,
      },
    });
  } catch (error) {
    logger.error('Error updating storefront hours settings', undefined, { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update storefront hours settings',
    });
  }
});

export default router;
