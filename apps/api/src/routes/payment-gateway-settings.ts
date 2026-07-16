import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import { z } from 'zod';
import { invalidateEffectiveCapabilities } from '../services/EffectiveCapabilityResolver';
import { generatePaymentGatewaySettingsId } from '../lib/id-generator';
import { logger } from '../logger';

const router = Router();

// Validation schema
const paymentGatewaySettingsSchema = z.object({
  gateway_enabled: z.boolean().optional(),
  stripe_enabled: z.boolean().optional(),
  paypal_enabled: z.boolean().optional(),
  square_enabled: z.boolean().optional(),
  clover_enabled: z.boolean().optional(),
});

// Default settings — all gateways enabled by default (tier capability is the hard gate)
const DEFAULT_SETTINGS = {
  gateway_enabled: true,
  stripe_enabled: true,
  paypal_enabled: true,
  square_enabled: true,
  clover_enabled: true,
};

// Get payment gateway settings for a tenant
router.get('/:tenantId/payment-gateway-settings', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    const settings = await prisma.tenant_payment_gateway_settings.findUnique({
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
        gateway_enabled: settings.gateway_enabled,
        stripe_enabled: settings.stripe_enabled,
        paypal_enabled: settings.paypal_enabled,
        square_enabled: settings.square_enabled,
        clover_enabled: settings.clover_enabled,
      },
    });
  } catch (error) {
    logger.error('Error fetching payment gateway settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch payment gateway settings',
    });
  }
});

// Update payment gateway settings for a tenant
router.put('/:tenantId/payment-gateway-settings', authenticateToken, async (req, res) => {
  try {
    const { tenantId } = req.params;

    // Validate request body
    const validationResult = paymentGatewaySettingsSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'validation_error',
        message: 'Invalid payment gateway settings data',
        details: validationResult.error.issues,
      });
    }

    const data = validationResult.data;

    // Resolve tier capabilities to determine which toggles are allowed
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { subscription_tier: true },
    });
    const tierKey = tenant?.subscription_tier || 'starter';

    const tier = await prisma.subscription_tiers_list.findUnique({
      where: { tier_key: tierKey },
      include: {
        tier_features_list: {
          where: {
            is_enabled: true,
            feature_key: { startsWith: 'payment_gateway_' },
          },
          select: { feature_key: true },
        },
      },
    });

    const featureKeys = new Set((tier?.tier_features_list || []).map(f => f.feature_key));

    // Tier capability gates: which gateway types are allowed
    const tierAllowsStripe = featureKeys.has('payment_gateway_stripe');
    const tierAllowsPaypal = featureKeys.has('payment_gateway_paypal');
    const tierAllowsSquare = featureKeys.has('payment_gateway_square');
    const tierAllowsClover = featureKeys.has('payment_gateway_clover');

    // Reject attempts to enable gateways not allowed by tier
    if (data.stripe_enabled === true && !tierAllowsStripe) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        message: 'Stripe is not available on your current plan',
        feature_key: 'payment_gateway_stripe',
      });
    }
    if (data.paypal_enabled === true && !tierAllowsPaypal) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        message: 'PayPal is not available on your current plan',
        feature_key: 'payment_gateway_paypal',
      });
    }
    if (data.square_enabled === true && !tierAllowsSquare) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        message: 'Square is not available on your current plan',
        feature_key: 'payment_gateway_square',
      });
    }
    if (data.clover_enabled === true && !tierAllowsClover) {
      return res.status(403).json({
        success: false,
        error: 'tier_restricted',
        message: 'Clover is not available on your current plan',
        feature_key: 'payment_gateway_clover',
      });
    }

    // Check if settings exist
    const existing = await prisma.tenant_payment_gateway_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    let settings;
    if (existing) {
      settings = await prisma.tenant_payment_gateway_settings.update({
        where: { tenant_id: tenantId },
        data: {
          ...data,
          updated_at: new Date(),
        },
      });
    } else {
      settings = await prisma.tenant_payment_gateway_settings.create({
        data: {
          id: generatePaymentGatewaySettingsId(tenantId),
          tenant_id: tenantId,
          ...data,
        },
      });
    }

    invalidateEffectiveCapabilities(tenantId);

    res.json({
      success: true,
      settings: {
        gateway_enabled: settings.gateway_enabled,
        stripe_enabled: settings.stripe_enabled,
        paypal_enabled: settings.paypal_enabled,
        square_enabled: settings.square_enabled,
        clover_enabled: settings.clover_enabled,
      },
    });
  } catch (error) {
    logger.error('Error updating payment gateway settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to update payment gateway settings',
    });
  }
});

// Public endpoint - Get payment gateway settings for storefront/checkout
// DEPRECATED: Use GET /api/tenants/:tenantId/effective-capabilities instead
router.get('/public/tenant/:tenantId/payment-gateway-settings', async (req, res) => {
  try {
    const { tenantId } = req.params;
    console.warn(`[DEPRECATION] GET /public/tenant/${tenantId}/payment-gateway-settings is deprecated. Use /api/tenants/${tenantId}/effective-capabilities instead.`);
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString());

    const settings = await prisma.tenant_payment_gateway_settings.findUnique({
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
        gateway_enabled: settings.gateway_enabled,
        stripe_enabled: settings.stripe_enabled,
        paypal_enabled: settings.paypal_enabled,
        square_enabled: settings.square_enabled,
        clover_enabled: settings.clover_enabled,
      },
    });
  } catch (error) {
    logger.error('Error fetching public payment gateway settings:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      success: false,
      error: 'internal_error',
      message: 'Failed to fetch payment gateway settings',
    });
  }
});

export default router;
