import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { requireTenantAdmin } from '../middleware/permissions';
import { z } from 'zod';
import { generateTenantCommerceSettingsId } from '../lib/id-generator';
import { getTenantCommerceCapabilities } from '../utils/commerce-capabilities';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { logger } from '../logger';

const router = Router();

// Validation schema
const commerceSettingsSchema = z.object({
  // Payment Options
  deposit_enabled: z.boolean().optional(),
  deposit_percentage: z.number().int().min(5).max(50).optional(),
  deposit_min_cents: z.number().int().min(0).optional(),
  deposit_max_cents: z.number().int().min(0).optional(),
  full_payment_enabled: z.boolean().optional(),
  
  // Order Management
  auto_confirm_orders: z.boolean().optional(),
  order_confirmation_minutes: z.number().int().min(5).max(1440).optional(),
  
  // Customer Experience
  show_payment_options: z.boolean().optional(),
  require_payment_upfront: z.boolean().optional(),
  allow_payment_on_pickup: z.boolean().optional(),
  
  // Notifications
  notify_on_payment: z.boolean().optional(),
  notify_on_deposit: z.boolean().optional(),
  notify_on_fulfillment: z.boolean().optional(),

  // Tax
  tax_enabled: z.boolean().optional(),
  tax_provider: z.enum(['stripe_tax', 'manual']).nullable().optional(),
  manual_tax_rate_percent: z.number().min(0).max(1).nullable().optional(),
  tax_shipping: z.boolean().optional(),
});

// Get commerce settings for a tenant
router.get('/:tenantId/commerce-settings', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Get tenant commerce capabilities (respects tier features)
    const capabilities = await getTenantCommerceCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        deposit_enabled: capabilities.deposit_enabled,
        deposit_percentage: capabilities.deposit_percentage,
        deposit_min_cents: capabilities.deposit_min_cents,
        deposit_max_cents: capabilities.deposit_max_cents,
        full_payment_enabled: capabilities.full_payment_enabled,
        auto_confirm_orders: capabilities.auto_confirm_orders,
        order_confirmation_minutes: capabilities.order_confirmation_minutes,
        show_payment_options: capabilities.show_payment_options,
        require_payment_upfront: capabilities.require_payment_upfront,
        allow_payment_on_pickup: capabilities.allow_payment_on_pickup,
        notify_on_payment: capabilities.notify_on_payment,
        notify_on_deposit: capabilities.notify_on_deposit,
        notify_on_fulfillment: capabilities.notify_on_fulfillment,
        tax_enabled: (capabilities as any).tax_enabled ?? false,
        tax_provider: (capabilities as any).tax_provider ?? null,
        manual_tax_rate_percent: (capabilities as any).manual_tax_rate_percent ?? null,
        tax_shipping: (capabilities as any).tax_shipping ?? false,
      },
    });
  } catch (error) {
    logger.error('Error fetching commerce settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch commerce settings',
    });
  }
});

// Public endpoint - Get commerce settings for storefront/checkout
// DEPRECATED: Use GET /api/tenants/:tenantId/effective-capabilities instead
router.get('/public/tenant/:tenantId/commerce-settings', async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.warn(`[DEPRECATION] GET /public/tenant/${tenantId}/commerce-settings is deprecated. Use /api/tenants/${tenantId}/effective-capabilities instead.`);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString());

    // Get tenant commerce capabilities (respects tier features)
    const capabilities = await getTenantCommerceCapabilities(tenantId);

    // Return public capabilities
    res.json({
      success: true,
      settings: {
        deposit_enabled: capabilities.deposit_enabled,
        deposit_percentage: capabilities.deposit_percentage,
        deposit_min_cents: capabilities.deposit_min_cents,
        deposit_max_cents: capabilities.deposit_max_cents,
        full_payment_enabled: capabilities.full_payment_enabled,
        show_payment_options: capabilities.show_payment_options,
        require_payment_upfront: capabilities.require_payment_upfront,
        allow_payment_on_pickup: capabilities.allow_payment_on_pickup,
      },
    });
  } catch (error) {
    logger.error('Error fetching public commerce settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch commerce settings',
    });
  }
});

// Update commerce settings
router.put('/:tenantId/commerce-settings', authenticateToken, requireTenantAdmin, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = commerceSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid settings data',
        details: validationResult.error.issues,
      });
    }

    const settings = validationResult.data;

    // Upsert commerce settings
    const result = await prisma.tenant_commerce_settings.upsert({
      where: { tenant_id: tenantId },
      update: settings,
      create: {
        id: generateTenantCommerceSettingsId(tenantId),
        tenant_id: tenantId,
        ...settings,
      },
    });

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        deposit_enabled: result.deposit_enabled,
        deposit_percentage: result.deposit_percentage,
        deposit_min_cents: result.deposit_min_cents,
        deposit_max_cents: result.deposit_max_cents,
        full_payment_enabled: result.full_payment_enabled,
        auto_confirm_orders: result.auto_confirm_orders,
        order_confirmation_minutes: result.order_confirmation_minutes,
        show_payment_options: result.show_payment_options,
        require_payment_upfront: result.require_payment_upfront,
        allow_payment_on_pickup: result.allow_payment_on_pickup,
        notify_on_payment: result.notify_on_payment,
        notify_on_deposit: result.notify_on_deposit,
        notify_on_fulfillment: result.notify_on_fulfillment,
        tax_enabled: result.tax_enabled,
        tax_provider: result.tax_provider,
        manual_tax_rate_percent: result.manual_tax_rate_percent
          ? parseFloat(result.manual_tax_rate_percent.toString())
          : null,
        tax_shipping: result.tax_shipping,
      },
    });
  } catch (error) {
    logger.error('Error updating commerce settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update commerce settings',
    });
  }
});

export default router;
