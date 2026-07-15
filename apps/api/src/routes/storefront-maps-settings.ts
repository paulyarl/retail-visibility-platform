import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { requireWritableSubscription } from '../middleware/subscription';
import { z } from 'zod';
import StorefrontMapsService from '../services/StorefrontMapsService';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { generateStorefrontMapsSettingsId } from '../lib/id-generator';
import { logger } from '../logger';

const router = Router();

const storefrontMapsSettingsSchema = z.object({
  maps_enabled: z.boolean().optional(),
  interactive_maps: z.boolean().optional(),
  map_display: z.boolean().optional(),
  location_display: z.boolean().optional(),
});

const DEFAULT_MAPS_SETTINGS = {
  maps_enabled: true,
  interactive_maps: true,
  map_display: true,
  location_display: true,
};

router.get('/:tenantId/storefront-maps', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const tierState = await StorefrontMapsService.getInstance().resolveStorefrontMapsState(tenantId);

    if (!tierState.enabled) {
      return res.json({
        success: true,
        settings: {
          ...DEFAULT_MAPS_SETTINGS,
          maps_enabled: false,
          interactive_maps: false,
          map_display: false,
          location_display: false,
        },
        tierState,
      });
    }

    const settings = await prisma.tenant_storefront_maps_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = settings || DEFAULT_MAPS_SETTINGS;

    const tierFilteredSettings = {
      maps_enabled: !!rawSettings.maps_enabled && tierState.enabled,
      interactive_maps: !!rawSettings.interactive_maps && tierState.canUseInteractiveMaps,
      map_display: !!rawSettings.map_display && tierState.canShowMapDisplay,
      location_display: !!rawSettings.location_display && tierState.canShowLocationDisplay,
    };

    res.json({
      success: true,
      settings: tierFilteredSettings,
      tierState,
    });
  } catch (error) {
    logger.error('Error fetching storefront maps settings', undefined, { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch storefront maps settings',
    });
  }
});

router.put('/:tenantId/storefront-maps', authenticateToken, requireTenantAdmin, requireWritableSubscription, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const validationResult = storefrontMapsSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid storefront maps settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    const tierState = await StorefrontMapsService.getInstance().resolveStorefrontMapsState(tenantId);

    if (data.interactive_maps && !tierState.canUseInteractiveMaps) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        message: 'Interactive maps is not available on your current plan',
      });
    }
    if (data.map_display && !tierState.canShowMapDisplay) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        message: 'Map display is not available on your current plan',
      });
    }
    if (data.location_display && !tierState.canShowLocationDisplay) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        message: 'Location display is not available on your current plan',
      });
    }

    const existing = await prisma.tenant_storefront_maps_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      settings = await prisma.tenant_storefront_maps_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      settings = await prisma.tenant_storefront_maps_settings.create({
        data: {
          id: generateStorefrontMapsSettingsId(tenantId),
          tenant_id: tenantId,
          ...data,
        },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        maps_enabled: settings.maps_enabled,
        interactive_maps: settings.interactive_maps,
        map_display: settings.map_display,
        location_display: settings.location_display,
      },
    });
  } catch (error) {
    logger.error('Error updating storefront maps settings', undefined, { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update storefront maps settings',
    });
  }
});

export default router;
