import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { requireWritableSubscription } from '../middleware/subscription';
import { z } from 'zod';
import StorefrontOptionsService from '../services/StorefrontOptionsService';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { generateStorefrontOptionsSettingsId } from '../lib/id-generator';

const router = Router();

// Validation schema
const storefrontOptionsSettingsSchema = z.object({
  storefront_opt_enabled: z.boolean().optional(),
  // Section Display
  map_display: z.boolean().optional(),
  location_display: z.boolean().optional(),
  // Category Display group
  category_store: z.boolean().optional(),
  category_product: z.boolean().optional(),
  // Recommendation Display group
  recommend_store: z.boolean().optional(),
  recommend_products: z.boolean().optional(),
  // User Behavior group
  recently_viewed: z.boolean().optional(),
  // Store Information group
  storefront_social_media: z.boolean().optional(),
  storefront_contact: z.boolean().optional(),
  interactive_maps: z.boolean().optional(),
  // Advanced group
  enhanced_seo: z.boolean().optional(),
  storefront_actions: z.boolean().optional(),
  // Layout selection
  storefront_layout: z.enum(['classic', 'editorial', 'immersive']).optional(),
});

// Default settings (core only — QR, Gallery, Hours have dedicated settings routes)
export const DEFAULT_SETTINGS = {
  storefront_opt_enabled: true,
  map_display: true,
  location_display: true,
  category_store: true,
  category_product: true,
  recommend_store: true,
  recommend_products: true,
  recently_viewed: true,
  storefront_social_media: true,
  storefront_contact: true,
  interactive_maps: true,
  enhanced_seo: false,
  storefront_actions: false,
  storefront_layout: 'classic',
};

// Get storefront options settings for a tenant
router.get('/:tenantId/storefront-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Resolve tier-gated state
    const tierState = await StorefrontOptionsService.getInstance().resolveStorefrontOptionsState(tenantId);

    // Hard gate: if storefront options disabled at tier level, return all-false
    if (!tierState.enabled) {
      return res.json({
        success: true,
        settings: {
          storefront_opt_enabled: false,
          category_store: false,
          category_product: false,
          recommend_store: false,
          recommend_products: false,
          recently_viewed: false,
          storefront_social_media: false,
          storefront_contact: false,
          interactive_maps: false,
          enhanced_seo: false,
          storefront_actions: false,
          storefront_layout: 'classic',
        },
        tierState,
      });
    }

    const settings = await prisma.tenant_storefront_options_settings.findUnique({
      where: { tenant_id_page_type: { tenant_id: tenantId, page_type: 'storefront' } },
    });

    const rawSettings = settings || DEFAULT_SETTINGS;

    // Tier-filter settings: force off any feature not allowed by tier
    const tierFilteredSettings: Record<string, boolean | string | number> = {
      storefront_opt_enabled: !!rawSettings.storefront_opt_enabled && tierState.enabled,
    };

    // Category group
    tierFilteredSettings.category_store = tierState.allowedCategoryTypes.includes('category_store') ? !!rawSettings.category_store : false;
    tierFilteredSettings.category_product = tierState.allowedCategoryTypes.includes('category_product') ? !!rawSettings.category_product : false;
    // Recommend group
    tierFilteredSettings.recommend_store = tierState.allowedRecommendTypes.includes('recommend_store') ? !!rawSettings.recommend_store : false;
    tierFilteredSettings.recommend_products = tierState.allowedRecommendTypes.includes('recommend_products') ? !!rawSettings.recommend_products : false;
    // User behavior
    tierFilteredSettings.recently_viewed = tierState.recentlyViewedEnabled ? !!rawSettings.recently_viewed : false;
    // Info group
    tierFilteredSettings.storefront_social_media = tierState.allowedInfoTypes.includes('storefront_social_media') ? !!rawSettings.storefront_social_media : false;
    tierFilteredSettings.storefront_contact = tierState.allowedInfoTypes.includes('storefront_contact') ? !!rawSettings.storefront_contact : false;
    tierFilteredSettings.interactive_maps = tierState.allowedInfoTypes.includes('interactive_maps') ? !!rawSettings.interactive_maps : false;
    // Advanced group
    tierFilteredSettings.enhanced_seo = tierState.allowedAdvancedTypes.includes('enhanced_seo') ? !!rawSettings.enhanced_seo : false;
    tierFilteredSettings.storefront_actions = tierState.allowedAdvancedTypes.includes('storefront_actions') ? !!rawSettings.storefront_actions : false;
    // Layout
    const allowedLayouts = tierState.allowedLayouts;
    const effectiveLayout: 'classic' | 'editorial' | 'immersive' =
      allowedLayouts.includes(rawSettings.storefront_layout as 'classic' | 'editorial' | 'immersive')
        ? rawSettings.storefront_layout as 'classic' | 'editorial' | 'immersive'
        : (allowedLayouts[0] || 'classic');
    tierFilteredSettings.storefront_layout = effectiveLayout;

    res.json({
      success: true,
      settings: tierFilteredSettings,
      tierState,
    });
  } catch (error) {
    console.error('Error fetching storefront options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch storefront options settings',
    });
  }
});

// NOTE: Public endpoint moved to routes/public-catalog.ts (mounted at /api/public)
// to match the frontend URL /api/public/tenant/:tenantId/storefront-options

// Update storefront options settings for a tenant
router.put('/:tenantId/storefront-options', authenticateToken, requireTenantAdmin, requireWritableSubscription, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = storefrontOptionsSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid storefront options settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Enforce tier gate for layout selection
    if (data.storefront_layout) {
      const tierState = await StorefrontOptionsService.getInstance().resolveStorefrontOptionsState(tenantId);
      if (!tierState.enabled || !tierState.allowedLayouts.includes(data.storefront_layout)) {
        return res.status(403).json({
          success: false,
          error: 'tier_restricted',
          message: `Layout '${data.storefront_layout}' is not available on your current plan`,
        });
      }
    }

    // Check if settings exist
    const existing = await prisma.tenant_storefront_options_settings.findUnique({
      where: { tenant_id_page_type: { tenant_id: tenantId, page_type: 'storefront' } },
    });

    let settings;
    if (existing) {
      // Update existing settings
      settings = await prisma.tenant_storefront_options_settings.update({
        where: { tenant_id_page_type: { tenant_id: tenantId, page_type: 'storefront' } },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new settings
      settings = await prisma.tenant_storefront_options_settings.create({
        data: {
          id: generateStorefrontOptionsSettingsId(tenantId),
          tenant_id: tenantId,
          page_type: 'storefront',
          ...data,
        },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        storefront_opt_enabled: settings.storefront_opt_enabled,
        category_store: settings.category_store,
        category_product: settings.category_product,
        recommend_store: settings.recommend_store,
        recommend_products: settings.recommend_products,
        recently_viewed: settings.recently_viewed,
        storefront_social_media: settings.storefront_social_media,
        storefront_contact: settings.storefront_contact,
        interactive_maps: settings.interactive_maps,
        enhanced_seo: settings.enhanced_seo,
        storefront_actions: settings.storefront_actions,
        storefront_layout: settings.storefront_layout || 'classic',
      },
    });
  } catch (error) {
    console.error('Error updating storefront options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update storefront options settings',
    });
  }
});

export default router;
