import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schema
const storefrontTypeSettingsSchema = z.object({
  storefront_type_enabled: z.boolean().optional(),
  selected_storefront_type: z.enum(['online', 'retail', 'service', 'both']).nullable().optional(),
});

// Default settings (selected_storefront_type is null so frontend derives from tier type)
const DEFAULT_SETTINGS = {
  storefront_type_enabled: true,
  selected_storefront_type: null as string | null,
};

// Get storefront type settings for a tenant
router.get('/:tenantId/storefront-type', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const settings = await prisma.tenant_storefront_type_settings.findUnique({
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
        storefront_type_enabled: settings.storefront_type_enabled,
        selected_storefront_type: settings.selected_storefront_type,
      },
    });
  } catch (error) {
    console.error('Error fetching storefront type settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch storefront type settings',
    });
  }
});

// Update storefront type settings for a tenant
router.put('/:tenantId/storefront-type', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = storefrontTypeSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid storefront type settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Check if settings exist
    const existing = await prisma.tenant_storefront_type_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      // Update existing settings
      settings = await prisma.tenant_storefront_type_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new settings
      settings = await prisma.tenant_storefront_type_settings.create({
        data: {
          tenant_id: tenantId,
          ...data,
        },
      });
    }

    res.json({
      success: true,
      settings: {
        storefront_type_enabled: settings.storefront_type_enabled,
        selected_storefront_type: settings.selected_storefront_type,
      },
    });
  } catch (error) {
    console.error('Error updating storefront type settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update storefront type settings',
    });
  }
});

export default router;
