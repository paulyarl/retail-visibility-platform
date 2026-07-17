import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import { resolveDirectoryEntryOptions } from '../services/resolvers/DirectoryEntryOptionsResolver';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { getTierFeatures } from '../services/TierService';
import { generateDirectoryEntrySettingsId } from '../lib/id-generator';
import { logger } from '../logger';

const router = Router();

// Validation schema for directory entry options — only directory-entry-relevant fields
const directoryEntryOptionsSchema = z.object({
  directory_entry_opt_enabled: z.boolean().optional(),
  directory_entry_layout: z.enum(['classic', 'editorial', 'immersive', 'premium']).optional(),
  hours_display: z.boolean().optional(),
  map_display: z.boolean().optional(),
  location_display: z.boolean().optional(),
  storefront_social_media: z.boolean().optional(),
  storefront_contact: z.boolean().optional(),
  interactive_maps: z.boolean().optional(),
  enhanced_seo: z.boolean().optional(),
  external_link_enabled: z.boolean().optional(),
  gallery_display_mode: z.enum(['carousel', 'magazine']).optional(),
});

// Default settings for directory entry — only directory-entry-relevant fields
export const DEFAULT_DIRECTORY_ENTRY_SETTINGS = {
  directory_entry_opt_enabled: true,
  directory_entry_layout: 'classic',
  hours_display: true,
  map_display: true,
  location_display: true,
  storefront_social_media: true,
  storefront_contact: true,
  interactive_maps: true,
  enhanced_seo: false,
  external_link_enabled: false,
  gallery_display_mode: 'carousel',
};

// Get directory entry options settings for a tenant
router.get('/:tenantId/directory-entry-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Query dedicated directory entry settings table
    let settings = await prisma.tenant_directory_entry_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    // Fallback to old table for backward compatibility during transition
    if (!settings) {
      const oldSettings = await prisma.tenant_storefront_options_settings.findUnique({
        where: { tenant_id_page_type: { tenant_id: tenantId, page_type: 'directory_entry' } },
      });
      if (oldSettings) {
        settings = {
          id: oldSettings.id,
          tenant_id: oldSettings.tenant_id,
          directory_entry_opt_enabled: oldSettings.storefront_opt_enabled ?? true,
          directory_entry_layout: oldSettings.directory_entry_layout || 'classic',
          hours_display: oldSettings.hours_display ?? true,
          map_display: oldSettings.map_display ?? true,
          location_display: oldSettings.location_display ?? true,
          storefront_social_media: oldSettings.storefront_social_media ?? true,
          storefront_contact: oldSettings.storefront_contact ?? true,
          interactive_maps: oldSettings.interactive_maps ?? true,
          enhanced_seo: oldSettings.enhanced_seo ?? false,
          external_link_enabled: oldSettings.external_link_enabled ?? false,
          gallery_display_mode: (oldSettings as any).gallery_display_mode || 'carousel',
          created_at: oldSettings.created_at,
          updated_at: oldSettings.updated_at,
        } as any;
      }
    }

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
        directory_entry_opt_enabled: settings.directory_entry_opt_enabled ?? true,
        directory_entry_layout: effectiveLayout,
        hours_display: settings.hours_display,
        map_display: settings.map_display,
        location_display: settings.location_display,
        storefront_social_media: settings.storefront_social_media,
        storefront_contact: settings.storefront_contact,
        interactive_maps: settings.interactive_maps,
        enhanced_seo: settings.enhanced_seo,
        external_link_enabled: settings.external_link_enabled ?? false,
        gallery_display_mode: settings.gallery_display_mode || 'carousel',
      },
    });
  } catch (error) {
    logger.error('Error fetching directory entry options settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
        { directory_entry_opt_enabled: true, directory_entry_layout: data.directory_entry_layout }
      );
      if (!tierState.enabled || !tierState.allowed_layouts.includes(data.directory_entry_layout)) {
        return res.status(403).json({
          success: false,
          error: 'tier_restricted',
          message: `Layout '${data.directory_entry_layout}' is not available on your current plan`,
        });
      }
    }

    // Upsert into dedicated directory entry settings table
    const settings = await prisma.tenant_directory_entry_settings.upsert({
      where: { tenant_id: tenantId },
      update: {
        ...data,
        updated_at: new Date(),
      },
      create: {
        id: generateDirectoryEntrySettingsId(tenantId),
        tenant_id: tenantId,
        ...data,
      },
    });

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        directory_entry_opt_enabled: settings.directory_entry_opt_enabled ?? true,
        directory_entry_layout: settings.directory_entry_layout || 'classic',
        hours_display: settings.hours_display,
        map_display: settings.map_display,
        location_display: settings.location_display,
        storefront_social_media: settings.storefront_social_media,
        storefront_contact: settings.storefront_contact,
        interactive_maps: settings.interactive_maps,
        enhanced_seo: settings.enhanced_seo,
        external_link_enabled: settings.external_link_enabled ?? false,
        gallery_display_mode: settings.gallery_display_mode || 'carousel',
      },
    });
  } catch (error) {
    logger.error('Error updating directory entry options settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update directory entry options settings',
    });
  }
});

export default router;
