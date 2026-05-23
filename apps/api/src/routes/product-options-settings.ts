import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

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
};

// Get product options settings for a tenant
router.get('/:tenantId/product-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const settings = await prisma.tenant_product_options_settings.findUnique({
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
        product_physical_enabled: settings.product_physical_enabled,
        product_digital_enabled: settings.product_digital_enabled,
        product_hybrid_enabled: settings.product_hybrid_enabled,
        product_service_enabled: settings.product_service_enabled,
        product_variant_enabled: settings.product_variant_enabled,
        product_gallery_enabled: settings.product_gallery_enabled,
        product_video_enabled: settings.product_video_enabled,
      },
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
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new settings
      settings = await prisma.tenant_product_options_settings.create({
        data: {
          id: `pos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tenant_id: tenantId,
          ...data,
        },
      });
    }

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

export default router;
