import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import { generateTenantCommerceSettingsId } from '../lib/id-generator';

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
});

// Get commerce settings for a tenant
router.get('/:tenantId/commerce-settings', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const settings = await prisma.tenant_commerce_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    // If no settings exist, return defaults
    if (!settings) {
      return res.json({
        success: true,
        settings: {
          deposit_enabled: true,
          deposit_percentage: 15,
          deposit_min_cents: 500,
          deposit_max_cents: 5000,
          full_payment_enabled: true,
          auto_confirm_orders: true,
          order_confirmation_minutes: 15,
          show_payment_options: true,
          require_payment_upfront: false,
          allow_payment_on_pickup: true,
          notify_on_payment: true,
          notify_on_deposit: true,
          notify_on_fulfillment: true,
        },
      });
    }

    res.json({
      success: true,
      settings: {
        deposit_enabled: settings.deposit_enabled,
        deposit_percentage: settings.deposit_percentage,
        deposit_min_cents: settings.deposit_min_cents,
        deposit_max_cents: settings.deposit_max_cents,
        full_payment_enabled: settings.full_payment_enabled,
        auto_confirm_orders: settings.auto_confirm_orders,
        order_confirmation_minutes: settings.order_confirmation_minutes,
        show_payment_options: settings.show_payment_options,
        require_payment_upfront: settings.require_payment_upfront,
        allow_payment_on_pickup: settings.allow_payment_on_pickup,
        notify_on_payment: settings.notify_on_payment,
        notify_on_deposit: settings.notify_on_deposit,
        notify_on_fulfillment: settings.notify_on_fulfillment,
      },
    });
  } catch (error) {
    console.error('Error fetching commerce settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch commerce settings',
    });
  }
});

// Public endpoint - Get commerce settings for storefront/checkout
router.get('/public/tenant/:tenantId/commerce-settings', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const settings = await prisma.tenant_commerce_settings.findUnique({
      where: { tenant_id: tenantId },
      select: {
        deposit_enabled: true,
        deposit_percentage: true,
        deposit_min_cents: true,
        deposit_max_cents: true,
        full_payment_enabled: true,
        show_payment_options: true,
        require_payment_upfront: true,
        allow_payment_on_pickup: true,
      },
    });

    // Return defaults if no settings exist
    const defaultSettings = {
      deposit_enabled: true,
      deposit_percentage: 15,
      deposit_min_cents: 500,
      deposit_max_cents: 5000,
      full_payment_enabled: true,
      show_payment_options: true,
      require_payment_upfront: false,
      allow_payment_on_pickup: true,
    };

    res.json({
      success: true,
      settings: settings || defaultSettings,
    });
  } catch (error) {
    console.error('Error fetching public commerce settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch commerce settings',
    });
  }
});

// Update commerce settings
router.put('/:tenantId/commerce-settings', authenticateToken, async (req, res) => {
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
      },
    });
  } catch (error) {
    console.error('Error updating commerce settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update commerce settings',
    });
  }
});

export default router;
