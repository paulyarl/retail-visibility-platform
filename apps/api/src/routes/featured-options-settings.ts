import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schema
const featuredOptionsSettingsSchema = z.object({
  featured_enabled: z.boolean().optional(),
  featured_store_selection: z.boolean().optional(),
  featured_new_arrival: z.boolean().optional(),
  featured_seasonal: z.boolean().optional(),
  featured_sale: z.boolean().optional(),
  featured_staff_pick: z.boolean().optional(),
  featured_clearance: z.boolean().optional(),
  featured_featured: z.boolean().optional(),
  featured_bestseller: z.boolean().optional(),
  featured_trending: z.boolean().optional(),
  featured_recommended: z.boolean().optional(),
  featured_random_featured: z.boolean().optional(),
});

// Default settings — tenant types on, platform types off by default
const DEFAULT_SETTINGS = {
  featured_enabled: true,
  featured_store_selection: true,
  featured_new_arrival: true,
  featured_seasonal: true,
  featured_sale: true,
  featured_staff_pick: true,
  featured_clearance: true,
  featured_featured: true,
  featured_bestseller: false,
  featured_trending: false,
  featured_recommended: false,
  featured_random_featured: false,
};

// Get featured options settings for a tenant
router.get('/:tenantId/featured-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const settings = await prisma.tenant_featured_options_settings.findUnique({
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
        featured_enabled: settings.featured_enabled,
        featured_store_selection: settings.featured_store_selection,
        featured_new_arrival: settings.featured_new_arrival,
        featured_seasonal: settings.featured_seasonal,
        featured_sale: settings.featured_sale,
        featured_staff_pick: settings.featured_staff_pick,
        featured_clearance: settings.featured_clearance,
        featured_featured: settings.featured_featured,
        featured_bestseller: settings.featured_bestseller,
        featured_trending: settings.featured_trending,
        featured_recommended: settings.featured_recommended,
        featured_random_featured: settings.featured_random_featured,
      },
    });
  } catch (error) {
    console.error('Error fetching featured options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch featured options settings',
    });
  }
});

// Update featured options settings for a tenant
router.put('/:tenantId/featured-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = featuredOptionsSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid featured options settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Check if settings exist
    const existing = await prisma.tenant_featured_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      // Update existing settings
      settings = await prisma.tenant_featured_options_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new settings
      settings = await prisma.tenant_featured_options_settings.create({
        data: {
          id: `fos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tenant_id: tenantId,
          ...data,
        },
      });
    }

    res.json({
      success: true,
      settings: {
        featured_enabled: settings.featured_enabled,
        featured_store_selection: settings.featured_store_selection,
        featured_new_arrival: settings.featured_new_arrival,
        featured_seasonal: settings.featured_seasonal,
        featured_sale: settings.featured_sale,
        featured_staff_pick: settings.featured_staff_pick,
        featured_clearance: settings.featured_clearance,
        featured_featured: settings.featured_featured,
        featured_bestseller: settings.featured_bestseller,
        featured_trending: settings.featured_trending,
        featured_recommended: settings.featured_recommended,
        featured_random_featured: settings.featured_random_featured,
      },
    });
  } catch (error) {
    console.error('Error updating featured options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update featured options settings',
    });
  }
});

export default router;
