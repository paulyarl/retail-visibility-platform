import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import { resolveDirectoryEntryOptions } from '../services/resolvers/DirectoryEntryOptionsResolver';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { getTierFeatures } from '../services/TierService';
import { generateStorefrontOptionsSettingsId } from '../lib/id-generator';

const router = Router();

// Validation schema for directory entry options
const directoryEntryOptionsSchema = z.object({
  directory_entry_opt_enabled: z.boolean().optional(),
  directory_entry_layout: z.enum(['classic', 'editorial', 'immersive', 'premium']).optional(),
  // Shared toggles that directory entry may use
  hours_display: z.boolean().optional(),
  map_display: z.boolean().optional(),
  location_display: z.boolean().optional(),
  hours_animated: z.boolean().optional(),
  hours_status: z.boolean().optional(),
  storefront_social_media: z.boolean().optional(),
  storefront_contact: z.boolean().optional(),
  interactive_maps: z.boolean().optional(),
  qr_codes_512: z.boolean().optional(),
  qr_codes_1024: z.boolean().optional(),
  qr_codes_2048: z.boolean().optional(),
  qr_product: z.boolean().optional(),
  qr_store: z.boolean().optional(),
  qr_logo: z.boolean().optional(),
  qr_directory: z.boolean().optional(),
  image_gallery_5: z.boolean().optional(),
  image_gallery_10: z.boolean().optional(),
  image_gallery_15: z.boolean().optional(),
  enhanced_seo: z.boolean().optional(),
  storefront_actions: z.boolean().optional(),
  external_link_enabled: z.boolean().optional(),
  default_qr_resolution: z.string().optional(),
  default_gallery_limit: z.number().int().min(5).max(15).optional(),
  gallery_display_mode: z.enum(['carousel', 'magazine']).optional(),
});

// Default settings for directory entry
export const DEFAULT_DIRECTORY_ENTRY_SETTINGS = {
  directory_entry_opt_enabled: true,
  directory_entry_layout: 'classic',
  hours_display: true,
  map_display: true,
  location_display: true,
  hours_animated: true,
  hours_status: true,
  storefront_social_media: true,
  storefront_contact: true,
  interactive_maps: true,
  qr_codes_512: false,
  qr_codes_1024: true,
  qr_codes_2048: false,
  qr_product: true,
  qr_store: true,
  qr_logo: false,
  qr_directory: false,
  image_gallery_5: true,
  image_gallery_10: false,
  image_gallery_15: false,
  enhanced_seo: false,
  storefront_actions: false,
  external_link_enabled: false,
  default_qr_resolution: '1024',
  default_gallery_limit: 5,
  gallery_display_mode: 'carousel',
};

// Get directory entry options settings for a tenant
router.get('/:tenantId/directory-entry-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const settings = await prisma.tenant_storefront_options_settings.findUnique({
      where: { tenant_id_page_type: { tenant_id: tenantId, page_type: 'directory_entry' } },
    });

    // Resolve tier-gated layout options
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { subscription_tier: true },
    });
    const tierKey = tenant?.subscription_tier || 'starter';
    const tierFeatureKeys = await getTierFeatures(tierKey);
    const tierFeatures = Object.fromEntries(tierFeatureKeys.map((k) => [k, true]));

    const tierState = await resolveDirectoryEntryOptions(
      tierFeatures,
      settings || null
    );
    const allowedLayouts = tierState.enabled ? tierState.allowed_layouts : [];
    const rawLayout = (settings?.directory_entry_layout as string) || 'classic';
    const effectiveLayout: 'classic' | 'editorial' | 'immersive' | 'premium' =
      allowedLayouts.includes(rawLayout as any)
        ? rawLayout as any
        : (allowedLayouts[0] || 'classic');

    if (!settings) {
      return res.json({
        success: true,
        settings: {
          ...DEFAULT_DIRECTORY_ENTRY_SETTINGS,
          directory_entry_layout: effectiveLayout,
        },
      });
    }

    res.json({
      success: true,
      settings: {
        directory_entry_opt_enabled: settings.storefront_opt_enabled ?? true,
        directory_entry_layout: effectiveLayout,
        hours_display: settings.hours_display,
        map_display: settings.map_display,
        location_display: settings.location_display,
        hours_animated: settings.hours_animated,
        hours_status: settings.hours_status,
        storefront_social_media: settings.storefront_social_media,
        storefront_contact: settings.storefront_contact,
        interactive_maps: settings.interactive_maps,
        qr_codes_512: settings.qr_codes_512,
        qr_codes_1024: settings.qr_codes_1024,
        qr_codes_2048: settings.qr_codes_2048,
        qr_product: settings.qr_product,
        qr_store: settings.qr_store,
        qr_logo: settings.qr_logo,
        qr_directory: settings.qr_directory,
        image_gallery_5: settings.image_gallery_5,
        image_gallery_10: settings.image_gallery_10,
        image_gallery_15: settings.image_gallery_15,
        enhanced_seo: settings.enhanced_seo,
        storefront_actions: settings.storefront_actions,
        external_link_enabled: settings.external_link_enabled ?? false,
        default_qr_resolution: settings.default_qr_resolution,
        default_gallery_limit: settings.default_gallery_limit,
        gallery_display_mode: settings.gallery_display_mode || 'carousel',
      },
    });
  } catch (error) {
    console.error('Error fetching directory entry options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch directory entry options settings',
    });
  }
});

// Update directory entry options settings for a tenant
router.put('/:tenantId/directory-entry-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = directoryEntryOptionsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid directory entry options settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Enforce tier gate for layout selection
    if (data.directory_entry_layout) {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { subscription_tier: true },
      });
      const tierKey = tenant?.subscription_tier || 'starter';
      const tierFeatureKeys = await getTierFeatures(tierKey);
      const tierFeatures = Object.fromEntries(tierFeatureKeys.map((k) => [k, true]));

      const tierState = await resolveDirectoryEntryOptions(
        tierFeatures,
        { storefront_opt_enabled: true, directory_entry_layout: data.directory_entry_layout } as any
      );
      if (!tierState.enabled || !tierState.allowed_layouts.includes(data.directory_entry_layout)) {
        return res.status(403).json({
          success: false,
          error: 'tier_restricted',
          message: `Layout '${data.directory_entry_layout}' is not available on your current plan`,
        });
      }
    }

    // Check if settings exist
    const existing = await prisma.tenant_storefront_options_settings.findUnique({
      where: { tenant_id_page_type: { tenant_id: tenantId, page_type: 'directory_entry' } },
    });

    let settings;
    if (existing) {
      settings = await prisma.tenant_storefront_options_settings.update({
        where: { tenant_id_page_type: { tenant_id: tenantId, page_type: 'directory_entry' } },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      settings = await prisma.tenant_storefront_options_settings.create({
        data: {
          id: generateStorefrontOptionsSettingsId(tenantId),
          tenant_id: tenantId,
          page_type: 'directory_entry',
          ...data,
        },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        directory_entry_opt_enabled: settings.storefront_opt_enabled ?? true,
        directory_entry_layout: settings.directory_entry_layout || 'classic',
        hours_display: settings.hours_display,
        map_display: settings.map_display,
        location_display: settings.location_display,
        hours_animated: settings.hours_animated,
        hours_status: settings.hours_status,
        storefront_social_media: settings.storefront_social_media,
        storefront_contact: settings.storefront_contact,
        interactive_maps: settings.interactive_maps,
        qr_codes_512: settings.qr_codes_512,
        qr_codes_1024: settings.qr_codes_1024,
        qr_codes_2048: settings.qr_codes_2048,
        qr_product: settings.qr_product,
        qr_store: settings.qr_store,
        qr_logo: settings.qr_logo,
        qr_directory: settings.qr_directory,
        image_gallery_5: settings.image_gallery_5,
        image_gallery_10: settings.image_gallery_10,
        image_gallery_15: settings.image_gallery_15,
        enhanced_seo: settings.enhanced_seo,
        storefront_actions: settings.storefront_actions,
        external_link_enabled: settings.external_link_enabled ?? false,
        default_qr_resolution: settings.default_qr_resolution,
        default_gallery_limit: settings.default_gallery_limit,
        gallery_display_mode: settings.gallery_display_mode || 'carousel',
      },
    });
  } catch (error) {
    console.error('Error updating directory entry options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update directory entry options settings',
    });
  }
});

export default router;
