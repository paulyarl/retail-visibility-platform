import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { requireWritableSubscription } from '../middleware/subscription';
import { z } from 'zod';
import StorefrontQrService from '../services/StorefrontQrService';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { generateStorefrontQrSettingsId } from '../lib/id-generator';
import { logger } from '../logger';

const router = Router();

// Validation schema
const storefrontQrSettingsSchema = z.object({
  qr_enabled: z.boolean().optional(),
  qr_classic_enabled: z.boolean().optional(),
  qr_styled_enabled: z.boolean().optional(),
  qr_analytics_enabled: z.boolean().optional(),
  // QR Code Display group
  qr_codes_512: z.boolean().optional(),
  qr_codes_1024: z.boolean().optional(),
  qr_codes_2048: z.boolean().optional(),
  qr_product: z.boolean().optional(),
  qr_store: z.boolean().optional(),
  qr_logo: z.boolean().optional(),
  qr_directory: z.boolean().optional(),
  // QR Code Style group
  qr_dot_type: z.string().optional(),
  qr_corner_type: z.string().optional(),
  qr_corner_dot_type: z.string().optional(),
  qr_corner_dot_color: z.string().optional(),
  qr_logo_shape: z.string().optional(),
  qr_dot_color: z.string().optional(),
  qr_corner_color: z.string().optional(),
  qr_bg_color: z.string().optional(),
  qr_custom_colors_enabled: z.boolean().optional(),
  qr_gradient_enabled: z.boolean().optional(),
  qr_gradient_start: z.string().optional(),
  qr_gradient_end: z.string().optional(),
  // Defaults
  default_qr_resolution: z.string().optional(),
});

// Default settings
export const DEFAULT_QR_SETTINGS = {
  qr_enabled: true,
  qr_classic_enabled: true,
  qr_styled_enabled: false,
  qr_analytics_enabled: false,
  qr_codes_512: false,
  qr_codes_1024: true,
  qr_codes_2048: false,
  qr_product: true,
  qr_store: true,
  qr_logo: false,
  qr_directory: false,
  qr_dot_type: 'rounded',
  qr_corner_type: 'extra-rounded',
  qr_corner_dot_type: 'dot',
  qr_corner_dot_color: '#ffffff',
  qr_logo_shape: 'square',
  qr_dot_color: '#1a56db',
  qr_corner_color: '#1a56db',
  qr_bg_color: '#ffffff',
  qr_custom_colors_enabled: false,
  qr_gradient_enabled: false,
  qr_gradient_start: '#1a56db',
  qr_gradient_end: '#7c3aed',
  default_qr_resolution: '1024',
};

// Get storefront QR settings for a tenant
router.get('/:tenantId/storefront-qr', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Resolve tier-gated state
    const tierState = await StorefrontQrService.getInstance().resolveStorefrontQrState(tenantId);

    // Hard gate: if storefront QR disabled at tier level, return all-false
    if (!tierState.enabled) {
      return res.json({
        success: true,
        settings: {
          ...DEFAULT_QR_SETTINGS,
          qr_enabled: false,
          qr_classic_enabled: false,
          qr_styled_enabled: false,
          qr_analytics_enabled: false,
          qr_codes_512: false,
          qr_codes_1024: false,
          qr_codes_2048: false,
          qr_product: false,
          qr_store: false,
          qr_logo: false,
          qr_directory: false,
          qr_gradient_enabled: false,
          qr_custom_colors_enabled: false,
        },
        tierState,
      });
    }

    const settings = await prisma.tenant_storefront_qr_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const rawSettings = settings || DEFAULT_QR_SETTINGS;

    // Tier-filter settings: force off any feature not allowed by tier
    const tierFilteredSettings: Record<string, boolean | string> = {
      qr_enabled: !!rawSettings.qr_enabled && tierState.enabled,
      qr_classic_enabled: tierState.qrClassicEnabled ? !!rawSettings.qr_classic_enabled : false,
      qr_styled_enabled: tierState.qrStyledEnabled ? !!rawSettings.qr_styled_enabled : false,
      qr_analytics_enabled: tierState.canUseQrAnalytics ? !!rawSettings.qr_analytics_enabled : false,
    };

    // QR resolutions
    tierFilteredSettings.qr_codes_512 = tierState.allowedQRResolutions.includes('qr_codes_512') ? !!rawSettings.qr_codes_512 : false;
    tierFilteredSettings.qr_codes_1024 = tierState.allowedQRResolutions.includes('qr_codes_1024') ? !!rawSettings.qr_codes_1024 : false;
    tierFilteredSettings.qr_codes_2048 = tierState.allowedQRResolutions.includes('qr_codes_2048') ? !!rawSettings.qr_codes_2048 : false;
    // QR content types
    tierFilteredSettings.qr_product = tierState.allowedQRContentTypes.includes('qr_product') ? !!rawSettings.qr_product : false;
    tierFilteredSettings.qr_store = tierState.allowedQRContentTypes.includes('qr_store') ? !!rawSettings.qr_store : false;
    tierFilteredSettings.qr_logo = tierState.allowedQRContentTypes.includes('qr_logo') ? !!rawSettings.qr_logo : false;
    tierFilteredSettings.qr_directory = tierState.allowedQRContentTypes.includes('qr_directory') ? !!rawSettings.qr_directory : false;

    // QR Style group (pass through merchant prefs, but reset to defaults if tier doesn't allow styled QR)
    if (tierState.qrStyledEnabled) {
      tierFilteredSettings.qr_dot_type = rawSettings.qr_dot_type || 'rounded';
      tierFilteredSettings.qr_corner_type = rawSettings.qr_corner_type || 'extra-rounded';
      tierFilteredSettings.qr_corner_dot_type = rawSettings.qr_corner_dot_type || 'dot';
      tierFilteredSettings.qr_corner_dot_color = rawSettings.qr_corner_dot_color || '#ffffff';
      tierFilteredSettings.qr_logo_shape = rawSettings.qr_logo_shape || 'square';
      tierFilteredSettings.qr_dot_color = rawSettings.qr_dot_color || '#1a56db';
      tierFilteredSettings.qr_corner_color = rawSettings.qr_corner_color || '#1a56db';
      tierFilteredSettings.qr_bg_color = rawSettings.qr_bg_color || '#ffffff';
      tierFilteredSettings.qr_custom_colors_enabled = tierState.qrCustomColors ? !!rawSettings.qr_custom_colors_enabled : false;
      tierFilteredSettings.qr_gradient_enabled = tierState.qrGradients ? !!rawSettings.qr_gradient_enabled : false;
      tierFilteredSettings.qr_gradient_start = rawSettings.qr_gradient_start || '#1a56db';
      tierFilteredSettings.qr_gradient_end = rawSettings.qr_gradient_end || '#7c3aed';
    } else {
      tierFilteredSettings.qr_dot_type = 'rounded';
      tierFilteredSettings.qr_corner_type = 'extra-rounded';
      tierFilteredSettings.qr_corner_dot_type = 'dot';
      tierFilteredSettings.qr_corner_dot_color = '#ffffff';
      tierFilteredSettings.qr_logo_shape = 'square';
      tierFilteredSettings.qr_dot_color = '#1a56db';
      tierFilteredSettings.qr_corner_color = '#1a56db';
      tierFilteredSettings.qr_bg_color = '#ffffff';
      tierFilteredSettings.qr_custom_colors_enabled = false;
      tierFilteredSettings.qr_gradient_enabled = false;
      tierFilteredSettings.qr_gradient_start = '#1a56db';
      tierFilteredSettings.qr_gradient_end = '#7c3aed';
    }

    // Defaults (not tier-gated)
    tierFilteredSettings.default_qr_resolution = rawSettings.default_qr_resolution ?? '1024';

    res.json({
      success: true,
      settings: tierFilteredSettings,
      tierState,
    });
  } catch (error) {
    logger.error('Error fetching storefront QR settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch storefront QR settings',
    });
  }
});

// Update storefront QR settings for a tenant
router.put('/:tenantId/storefront-qr', authenticateToken, requireTenantAdmin, requireWritableSubscription, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = storefrontQrSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid storefront QR settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Check if settings exist
    const existing = await prisma.tenant_storefront_qr_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      settings = await prisma.tenant_storefront_qr_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      settings = await prisma.tenant_storefront_qr_settings.create({
        data: {
          id: generateStorefrontQrSettingsId(tenantId),
          tenant_id: tenantId,
          ...data,
        },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        qr_enabled: settings.qr_enabled,
        qr_classic_enabled: settings.qr_classic_enabled,
        qr_styled_enabled: settings.qr_styled_enabled,
        qr_analytics_enabled: settings.qr_analytics_enabled,
        qr_codes_512: settings.qr_codes_512,
        qr_codes_1024: settings.qr_codes_1024,
        qr_codes_2048: settings.qr_codes_2048,
        qr_product: settings.qr_product,
        qr_store: settings.qr_store,
        qr_logo: settings.qr_logo,
        qr_directory: settings.qr_directory,
        qr_dot_type: settings.qr_dot_type,
        qr_corner_type: settings.qr_corner_type,
        qr_corner_dot_type: settings.qr_corner_dot_type,
        qr_corner_dot_color: settings.qr_corner_dot_color,
        qr_logo_shape: settings.qr_logo_shape,
        qr_dot_color: settings.qr_dot_color,
        qr_corner_color: settings.qr_corner_color,
        qr_bg_color: settings.qr_bg_color,
        qr_custom_colors_enabled: settings.qr_custom_colors_enabled,
        qr_gradient_enabled: settings.qr_gradient_enabled,
        qr_gradient_start: settings.qr_gradient_start,
        qr_gradient_end: settings.qr_gradient_end,
        default_qr_resolution: settings.default_qr_resolution,
      },
    });
  } catch (error) {
    logger.error('Error updating storefront QR settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update storefront QR settings',
    });
  }
});

export default router;
