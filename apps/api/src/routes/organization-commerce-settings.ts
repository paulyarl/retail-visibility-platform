import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import { generateOrganizationCommerceSettingsId } from '../lib/id-generator';
import { getOrganizationCommerceCapabilities } from '../utils/commerce-capabilities';

const router = Router();

// Validation schema
const organizationCommerceSettingsSchema = z.object({
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

/**
 * GET /api/organizations/:organizationId/commerce-settings
 * Get organization commerce settings
 */
router.get('/organizations/:organizationId/commerce-settings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;

    // Get organization commerce capabilities (respects tier features from all tenants)
    const capabilities = await getOrganizationCommerceCapabilities(organizationId);

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
      },
      source: capabilities.source,
    });
  } catch (error) {
    console.error('Error fetching organization commerce settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch organization commerce settings',
    });
  }
});

/**
 * PUT /api/organizations/:organizationId/commerce-settings
 * Update organization commerce settings
 */
router.put('/organizations/:organizationId/commerce-settings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;

    // Validate request body
    const validationResult = organizationCommerceSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid settings data',
        details: validationResult.error.issues,
      });
    }

    const settings = validationResult.data;

    // Upsert organization commerce settings
    const result = await prisma.organization_commerce_settings.upsert({
      where: { organization_id: organizationId },
      update: settings,
      create: {
        id: generateOrganizationCommerceSettingsId(organizationId),
        organization_id: organizationId,
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
      message: 'Organization commerce settings updated successfully'
    });

  } catch (error) {
    console.error('[Organization Commerce Settings PUT] Error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_update_settings',
      message: 'Failed to update organization commerce settings'
    });
  }
});

/**
 * GET /api/public/organization/:organizationId/commerce-settings
 * Public endpoint for organization commerce settings (read-only)
 */
router.get('/public/organization/:organizationId/commerce-settings', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.params;

    // Get organization commerce capabilities (respects tier features from all tenants)
    const capabilities = await getOrganizationCommerceCapabilities(organizationId);

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
      source: capabilities.source,
    });

  } catch (error) {
    console.error('[Public Organization Commerce Settings GET] Error:', error);
    res.status(500).json({
      success: false,
      error: 'failed_to_fetch_settings',
      message: 'Failed to fetch organization commerce settings'
    });
  }
});

export default router;
