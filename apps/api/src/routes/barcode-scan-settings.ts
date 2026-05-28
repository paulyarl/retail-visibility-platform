import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schema
const barcodeScanSettingsSchema = z.object({
  barcode_enabled: z.boolean().optional(),
  barcode_scan_enabled: z.boolean().optional(),
  barcode_manual_enabled: z.boolean().optional(),
  barcode_usb_enabled: z.boolean().optional(),
  barcode_camera_enabled: z.boolean().optional(),
  default_scan_mode: z.enum(['scan', 'manual', 'usb', 'camera']).optional(),
});

// Default settings
const DEFAULT_SETTINGS = {
  barcode_enabled: true,
  barcode_scan_enabled: true,
  barcode_manual_enabled: true,
  barcode_usb_enabled: false,
  barcode_camera_enabled: false,
  default_scan_mode: 'scan',
};

// Get barcode scan settings for a tenant
router.get('/:tenantId/barcode-scan', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const settings = await prisma.tenant_barcode_scan_settings.findUnique({
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
        barcode_enabled: settings.barcode_enabled,
        barcode_scan_enabled: settings.barcode_scan_enabled,
        barcode_manual_enabled: settings.barcode_manual_enabled,
        barcode_usb_enabled: settings.barcode_usb_enabled,
        barcode_camera_enabled: settings.barcode_camera_enabled,
        default_scan_mode: settings.default_scan_mode,
      },
    });
  } catch (error) {
    console.error('Error fetching barcode scan settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch barcode scan settings',
    });
  }
});

// Update barcode scan settings for a tenant
router.put('/:tenantId/barcode-scan', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = barcodeScanSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid barcode scan settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Check if settings exist
    const existing = await prisma.tenant_barcode_scan_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      // Update existing settings
      settings = await prisma.tenant_barcode_scan_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new settings
      settings = await prisma.tenant_barcode_scan_settings.create({
        data: {
          tenant_id: tenantId,
          ...data,
        },
      });
    }

    res.json({
      success: true,
      settings: {
        barcode_enabled: settings.barcode_enabled,
        barcode_scan_enabled: settings.barcode_scan_enabled,
        barcode_manual_enabled: settings.barcode_manual_enabled,
        barcode_usb_enabled: settings.barcode_usb_enabled,
        barcode_camera_enabled: settings.barcode_camera_enabled,
        default_scan_mode: settings.default_scan_mode,
      },
    });
  } catch (error) {
    console.error('Error updating barcode scan settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update barcode scan settings',
    });
  }
});

export default router;
