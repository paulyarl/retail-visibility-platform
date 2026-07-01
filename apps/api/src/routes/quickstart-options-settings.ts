import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { z } from 'zod';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { generateQuickstartOptionsSettingsId } from '../lib/id-generator';

const router = Router();

// Validation schema
const quickstartOptionsSettingsSchema = z.object({
  quickstart_enabled: z.boolean().optional(),
  quickstart_wizard: z.boolean().optional(),
  quickstart_wizard_ai: z.boolean().optional(),
  quickstart_category_generator: z.boolean().optional(),
  quickstart_ai_openai: z.boolean().optional(),
  quickstart_ai_gemini: z.boolean().optional(),
  quickstart_image_gen: z.boolean().optional(),
  quickstart_image_hd: z.boolean().optional(),
  default_text_model: z.enum(['openai', 'google']).optional(),
  default_image_model: z.enum(['openai', 'google']).optional(),
  default_image_quality: z.enum(['standard', 'hd']).optional(),
});

// Default settings — all enabled, OpenAI defaults
const DEFAULT_SETTINGS = {
  quickstart_enabled: true,
  quickstart_wizard: true,
  quickstart_wizard_ai: true,
  quickstart_category_generator: true,
  quickstart_ai_openai: true,
  quickstart_ai_gemini: true,
  quickstart_image_gen: true,
  quickstart_image_hd: true,
  default_text_model: 'openai',
  default_image_model: 'openai',
  default_image_quality: 'standard',
};

// Get quickstart options settings for a tenant
router.get('/:tenantId/quickstart-options', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const settings = await prisma.tenant_quickstart_options_settings.findUnique({
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
        quickstart_enabled: settings.quickstart_enabled,
        quickstart_wizard: settings.quickstart_wizard,
        quickstart_wizard_ai: settings.quickstart_wizard_ai,
        quickstart_category_generator: settings.quickstart_category_generator,
        quickstart_ai_openai: settings.quickstart_ai_openai,
        quickstart_ai_gemini: settings.quickstart_ai_gemini,
        quickstart_image_gen: settings.quickstart_image_gen,
        quickstart_image_hd: settings.quickstart_image_hd,
        default_text_model: settings.default_text_model,
        default_image_model: settings.default_image_model,
        default_image_quality: settings.default_image_quality,
      },
    });
  } catch (error) {
    console.error('Error fetching quickstart options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch quickstart options settings',
    });
  }
});

// Update quickstart options settings for a tenant
router.put('/:tenantId/quickstart-options', authenticateToken, requireTenantAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = quickstartOptionsSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid quickstart options settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Check if settings exist
    const existing = await prisma.tenant_quickstart_options_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      // Update existing settings
      settings = await prisma.tenant_quickstart_options_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new settings
      settings = await prisma.tenant_quickstart_options_settings.create({
        data: {
          id: generateQuickstartOptionsSettingsId(tenantId),
          tenant_id: tenantId,
          ...data,
        },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        quickstart_enabled: settings.quickstart_enabled,
        quickstart_wizard: settings.quickstart_wizard,
        quickstart_wizard_ai: settings.quickstart_wizard_ai,
        quickstart_category_generator: settings.quickstart_category_generator,
        quickstart_ai_openai: settings.quickstart_ai_openai,
        quickstart_ai_gemini: settings.quickstart_ai_gemini,
        quickstart_image_gen: settings.quickstart_image_gen,
        quickstart_image_hd: settings.quickstart_image_hd,
        default_text_model: settings.default_text_model,
        default_image_model: settings.default_image_model,
        default_image_quality: settings.default_image_quality,
      },
    });
  } catch (error) {
    console.error('Error updating quickstart options settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update quickstart options settings',
    });
  }
});

export default router;
