import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { requireWritableSubscription } from '../middleware/subscription';
import { z } from 'zod';
import StorefrontGalleryService from '../services/StorefrontGalleryService';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { generateStorefrontGallerySettingsId } from '../lib/id-generator';
import { logger } from '../logger';

const router = Router();

// Validation schema
const storefrontGallerySettingsSchema = z.object({
  gallery_enabled: z.boolean().optional(),
  gallery_display_mode: z.string().optional(),
  image_gallery_5: z.boolean().optional(),
  image_gallery_10: z.boolean().optional(),
  image_gallery_15: z.boolean().optional(),
  default_gallery_limit: z.number().optional(),
});

// Default settings
export const DEFAULT_GALLERY_SETTINGS = {
  gallery_enabled: true,
  gallery_display_mode: 'carousel',
  image_gallery_5: true,
  image_gallery_10: false,
  image_gallery_15: false,
  default_gallery_limit: 5,
};

// Get storefront gallery settings for a tenant
router.get('/:tenantId/storefront-gallery', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Resolve tier-gated state
    const tierState = await StorefrontGalleryService.getInstance().resolveStorefrontGalleryState(tenantId);

    // Hard gate: if storefront gallery disabled at tier level, return all-false
    if (!tierState.enabled) {
      return res.json({
        success: true,
        settings: {
          ...DEFAULT_GALLERY_SETTINGS,
          gallery_enabled: false,
          image_gallery_5: false,
          image_gallery_10: false,
          image_gallery_15: false,
        },
        tierState,
      });
    }

    const settings = await prisma.tenant_storefront_gallery_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = settings || DEFAULT_GALLERY_SETTINGS;

    // Tier-filter settings: force off any feature not allowed by tier
    const tierFilteredSettings: Record<string, boolean | string | number> = {
      gallery_enabled: !!rawSettings.gallery_enabled && tierState.enabled,
      gallery_display_mode: tierState.canUseMagazineGallery
        ? (rawSettings.gallery_display_mode || 'carousel')
        : 'carousel',
    };

    // Image limits
    tierFilteredSettings.image_gallery_5 = tierState.allowedGalleryTypes.includes('image_gallery_5') ? !!rawSettings.image_gallery_5 : false;
    tierFilteredSettings.image_gallery_10 = tierState.allowedGalleryTypes.includes('image_gallery_10') ? !!rawSettings.image_gallery_10 : false;
    tierFilteredSettings.image_gallery_15 = tierState.allowedGalleryTypes.includes('image_gallery_15') ? !!rawSettings.image_gallery_15 : false;

    // Default limit (not tier-gated beyond the allowed types)
    tierFilteredSettings.default_gallery_limit = rawSettings.default_gallery_limit ?? 5;

    res.json({
      success: true,
      settings: tierFilteredSettings,
      tierState,
    });
  } catch (error) {
    logger.error('Error fetching storefront gallery settings', undefined, { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch storefront gallery settings',
    });
  }
});

// Update storefront gallery settings for a tenant
router.put('/:tenantId/storefront-gallery', authenticateToken, requireTenantAdmin, requireWritableSubscription, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = storefrontGallerySettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid storefront gallery settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Check if settings exist
    const existing = await prisma.tenant_storefront_gallery_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      settings = await prisma.tenant_storefront_gallery_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      settings = await prisma.tenant_storefront_gallery_settings.create({
        data: {
          id: generateStorefrontGallerySettingsId(tenantId),
          tenant_id: tenantId,
          ...data,
        },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        gallery_enabled: settings.gallery_enabled,
        gallery_display_mode: settings.gallery_display_mode,
        image_gallery_5: settings.image_gallery_5,
        image_gallery_10: settings.image_gallery_10,
        image_gallery_15: settings.image_gallery_15,
        default_gallery_limit: settings.default_gallery_limit,
      },
    });
  } catch (error) {
    logger.error('Error updating storefront gallery settings', undefined, { error: (error as Error).message });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update storefront gallery settings',
    });
  }
});

export default router;
