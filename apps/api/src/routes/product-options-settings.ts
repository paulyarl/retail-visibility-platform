import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import ProductOptionsService, { ProductType } from '../services/ProductOptionsService';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { generateProductOptionsSettingsId } from '../lib/id-generator';

const router = Router();

// Validation schema
const productOptionsSettingsSchema = z.object({
  product_physical_enabled: z.boolean().optional(),
  product_digital_enabled: z.boolean().optional(),
  product_hybrid_enabled: z.boolean().optional(),
  product_service_enabled: z.boolean().optional(),
  product_variant_enabled: z.boolean().optional(),
  product_gallery_enabled: z.boolean().optional(),
  product_video_enabled: z.boolean().optional(),
  product_layout: z.enum(['classic', 'editorial', 'immersive']).optional(),
  product_opt_recently_viewed: z.boolean().optional(),
  product_opt_qr_codes: z.boolean().optional(),
  product_opt_qr_logo: z.boolean().optional(),
  product_opt_recommended: z.boolean().optional(),
  product_opt_map_display: z.boolean().optional(),
  product_opt_location_display: z.boolean().optional(),
  product_opt_hours_display: z.boolean().optional(),
  product_opt_enhanced_seo: z.boolean().optional(),
  product_opt_reviews: z.boolean().optional(),
  product_opt_fulfillment: z.boolean().optional(),
  product_opt_categories: z.boolean().optional(),
  product_opt_location_availability: z.boolean().optional(),
});

// Default settings
const DEFAULT_SETTINGS = {
  product_physical_enabled: true,
  product_digital_enabled: true,
  product_hybrid_enabled: true,
  product_service_enabled: false,
  product_variant_enabled: true,
  product_gallery_enabled: true,
  product_video_enabled: false,
  product_layout: 'classic' as const,
  product_opt_recently_viewed: true,
  product_opt_qr_codes: true,
  product_opt_qr_logo: true,
  product_opt_recommended: true,
  product_opt_map_display: true,
  product_opt_location_display: true,
  product_opt_hours_display: true,
  product_opt_enhanced_seo: true,
  product_opt_reviews: true,
  product_opt_fulfillment: true,
  product_opt_categories: true,
  product_opt_location_availability: true,
};

// Map feature key (DB column) to ProductType
const FEATURE_KEY_TO_TYPE: Record<string, ProductType> = {
  product_physical_enabled: 'physical',
  product_digital_enabled: 'digital',
  product_hybrid_enabled: 'hybrid',
  product_service_enabled: 'service',
};

// Feature keys that are toggles (not types) — gated by tier showsVariants/showsGallery/showsVideo
const FEATURE_KEY_TO_TIER_FLAG: Record<string, keyof Pick<import('../services/ProductOptionsService').ProductOptionsState, 'showsVariants' | 'showsGallery' | 'showsVideo'>> = {
  product_variant_enabled: 'showsVariants',
  product_gallery_enabled: 'showsGallery',
  product_video_enabled: 'showsVideo',
};

// Section feature keys gated by tier section flags
const SECTION_FEATURE_KEYS: Record<string, keyof import('../services/ProductOptionsService').ProductOptionsState> = {
  product_opt_recently_viewed: 'showsRecentlyViewed',
  product_opt_qr_codes: 'showsQRCodes',
  product_opt_qr_logo: 'showsQRLogo',
  product_opt_recommended: 'showsRecommended',
  product_opt_map_display: 'showsMapDisplay',
  product_opt_location_display: 'showsLocationDisplay',
  product_opt_hours_display: 'showsHoursDisplay',
  product_opt_enhanced_seo: 'showsEnhancedSEO',
  product_opt_reviews: 'showsReviews',
  product_opt_fulfillment: 'showsFulfillment',
  product_opt_categories: 'showsCategories',
  product_opt_location_availability: 'showsLocationAvailability',
};

// Get product options settings for a tenant
router.get('/:tenantId/product-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Resolve tier capabilities for tier-gate-aware merchant gate
    const productService = ProductOptionsService.getInstance();
    const tierState = await productService.resolveProductOptionsState(tenantId);

    // Hard gate: if product options disabled at tier level, return all-false
    if (!tierState.enabled) {
      return res.json({
        success: true,
        settings: {
          product_physical_enabled: false,
          product_digital_enabled: false,
          product_hybrid_enabled: false,
          product_service_enabled: false,
          product_variant_enabled: false,
          product_gallery_enabled: false,
          product_video_enabled: false,
          product_layout: 'classic',
          product_opt_recently_viewed: false,
          product_opt_qr_codes: false,
          product_opt_qr_logo: false,
          product_opt_recommended: false,
          product_opt_map_display: false,
          product_opt_location_display: false,
          product_opt_hours_display: false,
          product_opt_enhanced_seo: false,
          product_opt_reviews: false,
          product_opt_fulfillment: false,
          product_opt_categories: false,
          product_opt_location_availability: false,
        },
        tierState,
      });
    }

    // Fetch merchant preferences from DB
    const merchantPrefs = await prisma.tenant_product_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = merchantPrefs || DEFAULT_SETTINGS;

    // Enforce tier gates: force off any type not in tier's allowedTypes, force off toggles not allowed by tier
    const tierFilteredSettings: Record<string, boolean | string> = {};
    for (const [key, type] of Object.entries(FEATURE_KEY_TO_TYPE)) {
      const isAllowed = tierState.allowedTypes.includes(type);
      tierFilteredSettings[key] = isAllowed ? !!(rawSettings as any)[key] : false;
    }
    for (const [key, tierFlag] of Object.entries(FEATURE_KEY_TO_TIER_FLAG)) {
      const isAllowed = tierState[tierFlag];
      tierFilteredSettings[key] = isAllowed ? !!(rawSettings as any)[key] : false;
    }
    for (const [key, tierFlag] of Object.entries(SECTION_FEATURE_KEYS)) {
      const isAllowed = tierState[tierFlag as keyof typeof tierState];
      tierFilteredSettings[key] = isAllowed ? !!(rawSettings as any)[key] : false;
    }

    // Enforce product page layout tier gate
    const allowedLayouts = tierState.enabled ? tierState.allowedLayouts : [];
    const effectiveLayout = allowedLayouts.includes((rawSettings as any).product_layout)
      ? (rawSettings as any).product_layout
      : (allowedLayouts[0] || 'classic');
    tierFilteredSettings.product_layout = effectiveLayout;

    res.json({
      success: true,
      settings: tierFilteredSettings,
      tierState,
    });
  } catch (error) {
    console.error('Error fetching product options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch product options settings',
    });
  }
});

// Update product options settings for a tenant
router.put('/:tenantId/product-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = productOptionsSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid product options settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Resolve tier capabilities for tier-gate-aware validation
    const productService = ProductOptionsService.getInstance();
    const tierState = await productService.resolveProductOptionsState(tenantId);

    // Hard gate: if product options disabled at tier level, block all updates
    if (!tierState.enabled) {
      return res.status(403).json({
        success: false,
        error: 'capability_disabled',
        message: 'Product options capability is disabled for this tenant\'s tier',
      });
    }

    // Layout gate: validate requested product page layout
    if (data.product_layout) {
      if (!tierState.allowedLayouts.includes(data.product_layout)) {
        return res.status(403).json({
          success: false,
          error: 'tier_restricted',
          message: `Product page layout '${data.product_layout}' is not available on your current plan`,
        });
      }
    }

    // Type gate: validate each feature toggle against tier capabilities
    const filteredData: Record<string, boolean | string> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === 'product_layout') {
        filteredData[key] = value;
        continue;
      }
      // Check product type gates
      const type = FEATURE_KEY_TO_TYPE[key];
      if (type) {
        if (tierState.allowedTypes.includes(type)) {
          filteredData[key] = value;
        } else if (value === true) {
          // Only reject if user is trying to enable a disallowed type
          return res.status(403).json({
            success: false,
            error: 'tier_restricted',
            message: `Product type '${type}' is not available on your current plan`,
            feature_key: key,
          });
        }
        // If value is false, silently skip (disabled UI control may send false)
        continue;
      }
      // Check toggle gates (variant, gallery, video)
      const tierFlag = FEATURE_KEY_TO_TIER_FLAG[key];
      if (tierFlag) {
        if (tierState[tierFlag]) {
          filteredData[key] = value;
        } else if (value === true) {
          // Only reject if user is trying to enable a disallowed toggle
          return res.status(403).json({
            success: false,
            error: 'tier_restricted',
            message: `Product feature '${key}' is not available on your current plan`,
            feature_key: key,
          });
        }
        // If value is false, silently skip
        continue;
      }
      // Check section feature gates
      const sectionFlag = SECTION_FEATURE_KEYS[key];
      if (sectionFlag) {
        if (tierState[sectionFlag]) {
          filteredData[key] = value;
        } else if (value === true) {
          return res.status(403).json({
            success: false,
            error: 'tier_restricted',
            message: `Product section feature '${key}' is not available on your current plan`,
            feature_key: key,
          });
        }
        continue;
      }
      // Other keys pass through
      filteredData[key] = value as boolean;
    }

    // Check if settings exist
    const existing = await prisma.tenant_product_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      // Update existing settings
      settings = await prisma.tenant_product_options_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...filteredData,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new settings
      settings = await prisma.tenant_product_options_settings.create({
        data: {
          id: generateProductOptionsSettingsId(tenantId),
          tenant_id: tenantId,
          ...filteredData,
        },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        product_physical_enabled: settings.product_physical_enabled,
        product_digital_enabled: settings.product_digital_enabled,
        product_hybrid_enabled: settings.product_hybrid_enabled,
        product_service_enabled: settings.product_service_enabled,
        product_variant_enabled: settings.product_variant_enabled,
        product_gallery_enabled: settings.product_gallery_enabled,
        product_video_enabled: settings.product_video_enabled,
        product_layout: settings.product_layout || 'classic',
        product_opt_recently_viewed: settings.product_opt_recently_viewed ?? true,
        product_opt_qr_codes: settings.product_opt_qr_codes ?? true,
        product_opt_qr_logo: settings.product_opt_qr_logo ?? true,
        product_opt_recommended: settings.product_opt_recommended ?? true,
        product_opt_map_display: settings.product_opt_map_display ?? true,
        product_opt_location_display: settings.product_opt_location_display ?? true,
        product_opt_hours_display: settings.product_opt_hours_display ?? true,
        product_opt_enhanced_seo: settings.product_opt_enhanced_seo ?? true,
        product_opt_reviews: settings.product_opt_reviews ?? true,
        product_opt_fulfillment: settings.product_opt_fulfillment ?? true,
        product_opt_categories: settings.product_opt_categories ?? true,
        product_opt_location_availability: settings.product_opt_location_availability ?? true,
      },
    });
  } catch (error) {
    console.error('Error updating product options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update product options settings',
    });
  }
});

// Get product options capability state for a tenant
router.get('/:tenantId/product-options/capability', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    const productService = ProductOptionsService.getInstance();
    const state = await productService.resolveProductOptionsState(tenantId);

    res.json({
      success: true,
      capability: state,
    });
  } catch (error) {
    console.error('Error resolving product options capability:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to resolve product options capability',
    });
  }
});

export default router;
