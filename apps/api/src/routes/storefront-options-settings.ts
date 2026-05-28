import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schema
const storefrontOptionsSettingsSchema = z.object({
  storefront_opt_enabled: z.boolean().optional(),
  // Section Display
  hours_display: z.boolean().optional(),
  map_display: z.boolean().optional(),
  location_display: z.boolean().optional(),
  // Store Hours group
  hours_animated: z.boolean().optional(),
  hours_status: z.boolean().optional(),
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
  // QR Code Display group
  qr_codes_512: z.boolean().optional(),
  qr_codes_1024: z.boolean().optional(),
  qr_codes_2048: z.boolean().optional(),
  qr_product: z.boolean().optional(),
  qr_store: z.boolean().optional(),
  qr_logo: z.boolean().optional(),
  qr_directory: z.boolean().optional(),
  // Gallery Display group
  image_gallery_5: z.boolean().optional(),
  image_gallery_10: z.boolean().optional(),
  image_gallery_15: z.boolean().optional(),
  // Advanced group
  enhanced_seo: z.boolean().optional(),
  storefront_actions: z.boolean().optional(),
  // Defaults
  default_qr_resolution: z.string().optional(),
  default_gallery_limit: z.number().int().min(5).max(15).optional(),
});

// Default settings
export const DEFAULT_SETTINGS = {
  storefront_opt_enabled: true,
  hours_display: true,
  hours_animated: true,
  hours_status: true,
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
  default_qr_resolution: '1024',
  default_gallery_limit: 5,
};

// Get storefront options settings for a tenant
router.get('/:tenantId/storefront-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const settings = await prisma.tenant_storefront_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!settings) {
      return res.json({
        success: true,
        settings: DEFAULT_SETTINGS,
      });
    }

    res.json({
      success: true,
      settings: {
        storefront_opt_enabled: settings.storefront_opt_enabled,
        hours_animated: settings.hours_animated,
        hours_status: settings.hours_status,
        category_store: settings.category_store,
        category_product: settings.category_product,
        recommend_store: settings.recommend_store,
        recommend_products: settings.recommend_products,
        recently_viewed: settings.recently_viewed,
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
        default_qr_resolution: settings.default_qr_resolution,
        default_gallery_limit: settings.default_gallery_limit,
      },
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

// NOTE: Public endpoint moved to routes/public-api.ts (mounted at /api/public)
// to match the frontend URL /api/public/tenant/:tenantId/storefront-options

// Update storefront options settings for a tenant
router.put('/:tenantId/storefront-options', authenticateToken, async (req, res) => {
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

    // Enforce radio logic for gallery: only one of image_gallery_5/10/15 can be true
    if (data.image_gallery_5 || data.image_gallery_10 || data.image_gallery_15) {
      const galleryKeys = ['image_gallery_5', 'image_gallery_10', 'image_gallery_15'] as const;
      const trueKeys = galleryKeys.filter(k => data[k] === true);
      if (trueKeys.length > 1) {
        // Keep only the highest-value true key
        const winner = trueKeys[trueKeys.length - 1];
        for (const k of galleryKeys) {
          if (k !== winner) data[k] = false;
        }
      }
    }

    // Check if settings exist
    const existing = await prisma.tenant_storefront_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      // Update existing settings
      settings = await prisma.tenant_storefront_options_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new settings
      settings = await prisma.tenant_storefront_options_settings.create({
        data: {
          id: `sos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tenant_id: tenantId,
          ...data,
        },
      });
    }

    res.json({
      success: true,
      settings: {
        storefront_opt_enabled: settings.storefront_opt_enabled,
        hours_animated: settings.hours_animated,
        hours_status: settings.hours_status,
        category_store: settings.category_store,
        category_product: settings.category_product,
        recommend_store: settings.recommend_store,
        recommend_products: settings.recommend_products,
        recently_viewed: settings.recently_viewed,
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
        default_qr_resolution: settings.default_qr_resolution,
        default_gallery_limit: settings.default_gallery_limit,
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
