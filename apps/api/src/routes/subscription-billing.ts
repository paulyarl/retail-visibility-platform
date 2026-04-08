/**
 * Subscription Billing Routes
 * 
 * API routes for tenant self-service subscription management
 * - Tier pricing
 * - Payment method management
 * - Subscription changes
 */

import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/role-validation';
import { getSubscriptionBillingService } from '../services/subscription/SubscriptionBillingService';
import { prisma } from '../prisma';

const router = Router();

// PayPal config check - no auth required (just checks if PayPal is configured)
router.get('/paypal/config', async (req: Request, res: Response) => {
  try {
    const { payPalService } = await import('../services/subscription/PayPalService');
    
    res.json({
      success: true,
      data: {
        configured: payPalService.isConfigured(),
        mode: process.env.PAYPAL_MODE || 'sandbox',
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to check PayPal config',
    });
  }
});

// All other routes require authentication
router.use(authenticateToken);

/**
 * Helper to get tenant ID from request
 * Checks: X-Tenant-ID header, req.user.tenantId, params, body, query
 */
function getTenantId(req: Request): string | null {
  return (
    req.headers['x-tenant-id'] as string ||
    (req as any).user?.tenantId ||
    req.params.tenantId ||
    req.body?.tenantId ||
    (req.query.tenantId as string) ||
    null
  );
}

// ==================
// TIER PRICING
// ==================

/**
 * GET /api/subscription/tiers
 * Get all available tier pricing
 */
router.get('/tiers', async (req: Request, res: Response) => {
  try {
    const billingService = getSubscriptionBillingService();
    const tiers = await billingService.getTierPricing();
    
    res.json({
      success: true,
      data: tiers,
    });
  } catch (error: any) {
    console.error('[Subscription] Error fetching tiers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tier pricing',
    });
  }
});

/**
 * GET /api/subscription/tiers/:tier
 * Get specific tier pricing
 */
router.get('/tiers/:tier', async (req: Request, res: Response) => {
  try {
    const { tier } = req.params;
    const billingService = getSubscriptionBillingService();
    const pricing = await billingService.getTierPricingByTier(tier);
    
    if (!pricing) {
      return res.status(404).json({
        success: false,
        error: 'Tier not found',
      });
    }
    
    res.json({
      success: true,
      data: pricing,
    });
  } catch (error: any) {
    console.error('[Subscription] Error fetching tier:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch tier pricing',
    });
  }
});

// ==================
// PAYMENT METHODS
// ==================

/**
 * GET /api/subscription/payment-methods
 * Get all payment methods for the current tenant
 * Requires CAN_MANAGE_TENANT_BILLING permission
 */
router.get('/payment-methods', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    const billingService = getSubscriptionBillingService();
    const methods = await billingService.getPaymentMethods(tenantId);
    
    // Mask sensitive data
    const maskedMethods = methods.map(m => ({
      id: m.id,
      gatewayType: m.gatewayType,
      cardLast4: m.cardLast4,
      cardBrand: m.cardBrand,
      expiryMonth: m.expiryMonth,
      expiryYear: m.expiryYear,
      isDefault: m.isDefault,
      createdAt: m.createdAt,
    }));
    
    res.json({
      success: true,
      data: maskedMethods,
    });
  } catch (error: any) {
    console.error('[Subscription] Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment methods',
    });
  }
});

/**
 * POST /api/subscription/payment-methods
 * Add a new payment method
 * Requires CAN_MANAGE_TENANT_BILLING permission
 */
router.post('/payment-methods', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    const { gatewayType, paymentMethodToken, cardLast4, cardBrand, expiryMonth, expiryYear } = req.body;
    
    if (!gatewayType || !paymentMethodToken) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: gatewayType, paymentMethodToken',
      });
    }

    const billingService = getSubscriptionBillingService();
    const method = await billingService.addPaymentMethod(tenantId, gatewayType, paymentMethodToken, {
      cardLast4,
      cardBrand,
      expiryMonth,
      expiryYear,
    });
    
    res.json({
      success: true,
      data: {
        id: method.id,
        gatewayType: method.gatewayType,
        cardLast4: method.cardLast4,
        cardBrand: method.cardBrand,
        expiryMonth: method.expiryMonth,
        expiryYear: method.expiryYear,
        isDefault: method.isDefault,
      },
    });
  } catch (error: any) {
    console.error('[Subscription] Error adding payment method:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to add payment method',
    });
  }
});

/**
 * PUT /api/subscription/payment-methods/:id/default
 * Set a payment method as default
 * Requires CAN_MANAGE_TENANT_BILLING permission
 */
router.put('/payment-methods/:id/default', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    const billingService = getSubscriptionBillingService();
    await billingService.setDefaultPaymentMethod(tenantId, id);
    
    res.json({
      success: true,
      message: 'Default payment method updated',
    });
  } catch (error: any) {
    console.error('[Subscription] Error setting default payment method:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to set default payment method',
    });
  }
});

/**
 * DELETE /api/subscription/payment-methods/:id
 * Remove a payment method
 * Requires CAN_MANAGE_TENANT_BILLING permission
 */
router.delete('/payment-methods/:id', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    const billingService = getSubscriptionBillingService();
    await billingService.removePaymentMethod(tenantId, id);
    
    res.json({
      success: true,
      message: 'Payment method removed',
    });
  } catch (error: any) {
    console.error('[Subscription] Error removing payment method:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to remove payment method',
    });
  }
});

// ==================
// SUBSCRIPTION MANAGEMENT
// ==================

/**
 * GET /api/subscription/preview
 * Preview a subscription change (proration)
 * Requires CAN_MANAGE_TENANT_BILLING permission
 */
router.get('/preview', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { tier, billingCycle = 'monthly' } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    if (!tier) {
      return res.status(400).json({
        success: false,
        error: 'Missing required query param: tier',
      });
    }

    const billingService = getSubscriptionBillingService();
    const preview = await billingService.previewSubscriptionChange(
      tenantId,
      tier as string,
      billingCycle as 'monthly' | 'annual'
    );
    
    res.json({
      success: true,
      data: preview,
    });
  } catch (error: any) {
    console.error('[Subscription] Error previewing subscription:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to preview subscription',
    });
  }
});

/**
 * POST /api/subscription/subscribe
 * Subscribe to a tier (instant activation)
 * Requires CAN_MANAGE_TENANT_BILLING permission
 */
router.post('/subscribe', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { tier, paymentMethodId, billingCycle = 'monthly' } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    if (!tier) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: tier',
      });
    }

    const billingService = getSubscriptionBillingService();
    
    // For free tier, no payment method needed
    const pricing = await billingService.getTierPricingByTier(tier);
    const requiresPayment = pricing && (billingCycle === 'monthly' ? pricing.monthlyPriceCents : pricing.annualPriceCents) > 0;
    
    if (requiresPayment && !paymentMethodId) {
      return res.status(400).json({
        success: false,
        error: 'Payment method required for paid tiers',
      });
    }

    const result = await billingService.subscribe(
      tenantId,
      tier,
      paymentMethodId,
      billingCycle
    );
    
    if (result.success) {
      res.json({
        success: true,
        data: result,
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Subscription failed',
      });
    }
  } catch (error: any) {
    console.error('[Subscription] Error subscribing:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to subscribe',
    });
  }
});

/**
 * GET /api/subscription/status
 * Get current subscription status for the tenant
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    // Get tenant subscription info
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: {
        subscription_tier: true,
        subscription_status: true,
        billing_cycle_start: true,
        billing_cycle_end: true,
        trial_ends_at: true,
        status_changed_at: true,
      },
    });
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
    }

    // Get tier pricing
    const billingService = getSubscriptionBillingService();
    const pricing = tenant.subscription_tier 
      ? await billingService.getTierPricingByTier(tenant.subscription_tier)
      : null;

    // Get default payment method
    const paymentMethod = await billingService.getDefaultPaymentMethod(tenantId);
    
    res.json({
      success: true,
      data: {
        tier: tenant.subscription_tier,
        status: tenant.subscription_status,
        billingCycleStart: tenant.billing_cycle_start,
        billingCycleEnd: tenant.billing_cycle_end,
        trialEndsAt: tenant.trial_ends_at,
        statusChangedAt: tenant.status_changed_at,
        pricing: pricing ? {
          monthly: pricing.monthlyPriceCents,
          annual: pricing.annualPriceCents,
        } : null,
        hasPaymentMethod: !!paymentMethod,
        paymentMethod: paymentMethod ? {
          id: paymentMethod.id,
          brand: paymentMethod.cardBrand,
          last4: paymentMethod.cardLast4,
        } : null,
      },
    });
  } catch (error: any) {
    console.error('[Subscription] Error fetching status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription status',
    });
  }
});

// ==================
// INVOICES
// ==================

/**
 * GET /api/subscription/invoices
 * Get invoice history for the tenant
 * Requires CAN_MANAGE_TENANT_BILLING permission
 */
router.get('/invoices', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { limit = '50', offset = '0', status } = req.query;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    const billingService = getSubscriptionBillingService();
    const invoices = await billingService.getInvoices(tenantId, {
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      status: status as string | undefined,
    });
    
    res.json({
      success: true,
      data: invoices,
    });
  } catch (error: any) {
    console.error('[Subscription] Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoices',
    });
  }
});

/**
 * GET /api/subscription/invoices/:id
 * Get a specific invoice by ID
 * Requires CAN_MANAGE_TENANT_BILLING permission
 */
router.get('/invoices/:id', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    const billingService = getSubscriptionBillingService();
    const invoice = await billingService.getInvoiceById(id, tenantId);
    
    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: 'Invoice not found',
      });
    }
    
    res.json({
      success: true,
      data: invoice,
    });
  } catch (error: any) {
    console.error('[Subscription] Error fetching invoice:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoice',
    });
  }
});

// ==================
// PAYPAL INTEGRATION
// ==================

/**
 * GET /api/subscription/paypal/config
 * Check if PayPal is configured
 */
router.get('/paypal/config', async (req: Request, res: Response) => {
  try {
    const { payPalService } = await import('../services/subscription/PayPalService');
    
    res.json({
      success: true,
      data: {
        configured: payPalService.isConfigured(),
        mode: process.env.PAYPAL_MODE || 'sandbox',
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: 'Failed to check PayPal config',
    });
  }
});

/**
 * POST /api/subscription/paypal/create-order
 * Create a PayPal order for subscription payment
 */
router.post('/paypal/create-order', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    const { tier, billingCycle = 'monthly' } = req.body;
    if (!tier) {
      return res.status(400).json({
        success: false,
        error: 'Tier is required',
      });
    }

    const billingService = getSubscriptionBillingService();
    const pricing = await billingService.getTierPricingByTier(tier);
    
    if (!pricing) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tier',
      });
    }

    const amountCents = billingCycle === 'monthly' 
      ? pricing.monthlyPriceCents 
      : pricing.annualPriceCents;

    if (amountCents === 0) {
      // Free tier - no PayPal needed
      return res.json({
        success: true,
        data: { freeTier: true },
      });
    }

    const { payPalService } = await import('../services/subscription/PayPalService');
    
    const order = await payPalService.createOrder(
      tenantId,
      tier,
      amountCents,
      billingCycle
    );

    res.json({
      success: true,
      data: order,
    });
  } catch (error: any) {
    console.error('[Subscription] PayPal create order error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create PayPal order',
    });
  }
});

/**
 * POST /api/subscription/paypal/capture-order
 * Capture a PayPal order after user approval
 */
router.post('/paypal/capture-order', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    const { orderId } = req.body;
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'Order ID is required',
      });
    }

    const { payPalService } = await import('../services/subscription/PayPalService');
    const billingService = getSubscriptionBillingService();
    
    const capture = await payPalService.captureOrder(orderId);
    
    if (!capture.success) {
      return res.status(400).json({
        success: false,
        error: 'PayPal payment not completed',
      });
    }

    // Extract tier info from customId or require it in body
    const { tier, billingCycle = 'monthly' } = req.body;
    
    if (!tier) {
      return res.status(400).json({
        success: false,
        error: 'Tier is required',
      });
    }

    // Create invoice and update tenant
    const invoiceId = await billingService.createInvoice(
      tenantId,
      tier,
      capture.amount,
      capture.captureId
    );
    
    await billingService.updateTenantTier(tenantId, tier);

    res.json({
      success: true,
      data: {
        tier,
        status: 'active',
        invoiceId,
        captureId: capture.captureId,
      },
    });
  } catch (error: any) {
    console.error('[Subscription] PayPal capture error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to capture PayPal order',
    });
  }
});

/**
 * POST /api/subscription/paypal/create-billing-agreement
 * Create a billing agreement token for saving PayPal as payment method
 */
router.post('/paypal/create-billing-agreement', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    // Get tenant name
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const { payPalService } = await import('../services/subscription/PayPalService');
    
    const agreement = await payPalService.createBillingAgreementToken(
      tenantId,
      tenant?.name || 'Unknown'
    );

    res.json({
      success: true,
      data: agreement,
    });
  } catch (error: any) {
    console.error('[Subscription] PayPal billing agreement error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create PayPal billing agreement',
    });
  }
});

/**
 * POST /api/subscription/paypal/save-payment-method
 * Save PayPal payment method after approval
 * For order-based vaulting: capture the order and get the vaulted token
 */
router.post('/paypal/save-payment-method', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    const { tokenId } = req.body;
    if (!tokenId) {
      return res.status(400).json({
        success: false,
        error: 'Token ID (order ID) is required',
      });
    }

    const { payPalService } = await import('../services/subscription/PayPalService');
    const billingService = getSubscriptionBillingService();
    
    // For order-based flow, capture the order to get payment details
    const captureResult = await payPalService.captureOrder(tokenId);
    
    if (!captureResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Failed to capture PayPal order',
      });
    }

    // Save as payment method using the order ID as token
    const paymentMethod = await billingService.addPaymentMethod(
      tenantId,
      'paypal',
      tokenId, // Use order ID as the token
      {
        paypalEmail: captureResult.payerEmail,
        paypalAccountId: captureResult.payerId,
      }
    );

    res.json({
      success: true,
      data: paymentMethod,
    });
  } catch (error: any) {
    console.error('[Subscription] PayPal save payment method error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to save PayPal payment method',
    });
  }
});

export default router;
