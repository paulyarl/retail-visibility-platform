import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schema
const fulfillmentSettingsSchema = z.object({
  pickup_enabled: z.boolean().optional(),
  pickup_instructions: z.string().optional().nullable(),
  pickup_ready_time_minutes: z.number().int().min(0).optional(),
  
  delivery_enabled: z.boolean().optional(),
  delivery_radius_miles: z.number().optional().nullable(),
  delivery_fee_cents: z.number().int().min(0).optional(),
  delivery_min_free_cents: z.number().int().min(0).optional().nullable(),
  delivery_time_hours: z.number().int().min(1).optional(),
  delivery_instructions: z.string().optional().nullable(),
  
  shipping_enabled: z.boolean().optional(),
  shipping_flat_rate_cents: z.number().int().min(0).optional().nullable(),
  shipping_zones: z.array(z.any()).optional(),
  shipping_handling_days: z.number().int().min(0).optional(),
  shipping_provider: z.string().optional().nullable(),
});

// Get fulfillment settings for a tenant
router.get('/api/tenants/:tenantId/fulfillment-settings', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const settings = await prisma.tenant_fulfillment_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    // If no settings exist, return defaults
    if (!settings) {
      return res.json({
        success: true,
        settings: {
          pickup_enabled: true,
          pickup_instructions: null,
          pickup_ready_time_minutes: 120,
          delivery_enabled: false,
          delivery_radius_miles: null,
          delivery_fee_cents: 0,
          delivery_min_free_cents: null,
          delivery_time_hours: 24,
          delivery_instructions: null,
          shipping_enabled: false,
          shipping_flat_rate_cents: null,
          shipping_zones: [],
          shipping_handling_days: 2,
          shipping_provider: null,
        },
      });
    }

    res.json({
      success: true,
      settings: {
        pickup_enabled: settings.pickup_enabled,
        pickup_instructions: settings.pickup_instructions,
        pickup_ready_time_minutes: settings.pickup_ready_time_minutes,
        delivery_enabled: settings.delivery_enabled,
        delivery_radius_miles: settings.delivery_radius_miles ? parseFloat(settings.delivery_radius_miles.toString()) : null,
        delivery_fee_cents: settings.delivery_fee_cents,
        delivery_min_free_cents: settings.delivery_min_free_cents,
        delivery_time_hours: settings.delivery_time_hours,
        delivery_instructions: settings.delivery_instructions,
        shipping_enabled: settings.shipping_enabled,
        shipping_flat_rate_cents: settings.shipping_flat_rate_cents,
        shipping_zones: settings.shipping_zones,
        shipping_handling_days: settings.shipping_handling_days,
        shipping_provider: settings.shipping_provider,
      },
    });
  } catch (error) {
    console.error('Error fetching fulfillment settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch fulfillment settings',
    });
  }
});

// Public endpoint - Get fulfillment settings for storefront/checkout
router.get('/public/tenant/:tenantId/fulfillment-settings', async (req, res) => {
  try {
    const { tenantId } = req.params;

    const settings = await prisma.tenant_fulfillment_settings.findUnique({
      where: { tenant_id: tenantId },
      select: {
        pickup_enabled: true,
        pickup_instructions: true,
        pickup_ready_time_minutes: true,
        delivery_enabled: true,
        delivery_radius_miles: true,
        delivery_fee_cents: true,
        delivery_min_free_cents: true,
        delivery_time_hours: true,
        shipping_enabled: true,
        shipping_flat_rate_cents: true,
        shipping_handling_days: true,
        shipping_provider: true,
      },
    });

    // If no settings exist, return defaults
    if (!settings) {
      return res.json({
        success: true,
        settings: {
          pickup_enabled: true,
          pickup_ready_time_minutes: 120,
          delivery_enabled: false,
          shipping_enabled: false,
        },
      });
    }

    res.json({
      success: true,
      settings: {
        pickup_enabled: settings.pickup_enabled,
        pickup_instructions: settings.pickup_instructions,
        pickup_ready_time_minutes: settings.pickup_ready_time_minutes,
        delivery_enabled: settings.delivery_enabled,
        delivery_radius_miles: settings.delivery_radius_miles ? parseFloat(settings.delivery_radius_miles.toString()) : null,
        delivery_fee_cents: settings.delivery_fee_cents,
        delivery_min_free_cents: settings.delivery_min_free_cents,
        delivery_time_hours: settings.delivery_time_hours,
        shipping_enabled: settings.shipping_enabled,
        shipping_flat_rate_cents: settings.shipping_flat_rate_cents,
        shipping_handling_days: settings.shipping_handling_days,
        shipping_provider: settings.shipping_provider,
      },
    });
  } catch (error) {
    console.error('Error fetching public fulfillment settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch fulfillment settings',
    });
  }
});

// Update fulfillment settings
router.put('/api/tenants/:tenantId/fulfillment-settings', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;
    
    // Validate request body
    const validationResult = fulfillmentSettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid fulfillment settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Check if settings exist
    const existing = await prisma.tenant_fulfillment_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      // Update existing settings
      settings = await prisma.tenant_fulfillment_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      // Create new settings
      settings = await prisma.tenant_fulfillment_settings.create({
        data: {
          id: `ffs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          tenant_id: tenantId,
          ...data,
        },
      });
    }

    res.json({
      success: true,
      settings: {
        pickup_enabled: settings.pickup_enabled,
        pickup_instructions: settings.pickup_instructions,
        pickup_ready_time_minutes: settings.pickup_ready_time_minutes,
        delivery_enabled: settings.delivery_enabled,
        delivery_radius_miles: settings.delivery_radius_miles ? parseFloat(settings.delivery_radius_miles.toString()) : null,
        delivery_fee_cents: settings.delivery_fee_cents,
        delivery_min_free_cents: settings.delivery_min_free_cents,
        delivery_time_hours: settings.delivery_time_hours,
        delivery_instructions: settings.delivery_instructions,
        shipping_enabled: settings.shipping_enabled,
        shipping_flat_rate_cents: settings.shipping_flat_rate_cents,
        shipping_zones: settings.shipping_zones,
        shipping_handling_days: settings.shipping_handling_days,
        shipping_provider: settings.shipping_provider,
      },
    });
  } catch (error) {
    console.error('Error updating fulfillment settings:', error);
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update fulfillment settings',
    });
  }
});

export default router;
