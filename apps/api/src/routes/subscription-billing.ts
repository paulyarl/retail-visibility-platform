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
import { SubscriptionValidationService } from '../services/subscription/SubscriptionValidationService';
import { prisma } from '../prisma';
import { generatePaymentId } from '../lib/id-generator';
import { unifiedConfig } from '../config/unifiedConfig';

const router = Router();

// PayPal config check - no auth required (just checks if PayPal is configured)
router.get('/paypal/config', async (req: Request, res: Response) => {
  try {
    const { payPalService } = await import('../services/subscription/PayPalService');
    
    res.json({
      success: true,
      data: {
        configured: payPalService.isConfigured(),
        mode: unifiedConfig.paypalMode,
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
  // For subscription routes, prioritize query parameter (from URL) over header
  // This fixes issues when switching tenants in the UI
  return (
    req.query.tenantId as string || // URL parameter ?tenantId=...
    req.params.tenantId || // Route parameter /:tenantId
    req.body?.tenantId || // Request body
    req.headers['x-tenant-id'] as string || // X-Tenant-ID header
    (req as any).user?.tenantId || // User's default tenant
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

    // Validate subscription change before proceeding
    const validationService = SubscriptionValidationService.getInstance();
    const validation = await validationService.validateSubscriptionChange(
      tenantId,
      tier as string,
      (req as any).user?.id
    );

    if (!validation.allowed) {
      return res.status(400).json({
        success: false,
        error: validation.reason,
        errorCode: validation.errorCode,
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
    
    // Check if this is a synthetic payment method (derived from payment history)
    const isSyntheticPaymentMethod = paymentMethodId?.startsWith('synthetic-');
    
    if (requiresPayment && !paymentMethodId) {
      return res.status(400).json({
        success: false,
        error: 'Payment method required for paid tiers',
      });
    }

    // For synthetic payment methods, verify tenant has existing Stripe customer
    if (isSyntheticPaymentMethod && requiresPayment) {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { stripe_customer_id: true, name: true },
      });
      
      // If no Stripe customer, try to find one from payment history
      if (!tenant?.stripe_customer_id) {
        // Look up the Stripe customer from successful payments
        const successfulPayment = await prisma.subscription_payments.findFirst({
          where: { 
            invoice_id: { startsWith: `inv-${tenantId}` },
            status: 'succeeded',
            gateway_type: 'stripe'
          },
          orderBy: { created_at: 'desc' },
          select: { transaction_id: true }
        });
        
        if (successfulPayment?.transaction_id) {
          // Create a new Stripe customer for this tenant
          const stripeCustomerId = await billingService.createStripeCustomerForTenant(
            tenantId, 
            tenant?.name || 'Unknown'
          );
          
          if (stripeCustomerId) {
            // Attach the payment method from the original charge
            const paymentMethodAttached = await billingService.attachPaymentMethodFromCharge(
              stripeCustomerId,
              successfulPayment.transaction_id
            );
            
            if (!paymentMethodAttached) {
              // Could not attach payment method - need real payment method
              return res.status(400).json({ 
                success: false, 
                error: 'Your saved payment method is no longer valid. Please add a new payment method to continue.' 
              });
            }
            
            // Now try subscription with the new customer
            const result = await billingService.subscribeWithExistingCustomer(
              tenantId,
              tier,
              stripeCustomerId,
              billingCycle
            );
            
            if (result.success) {
              return res.json({ success: true, data: result });
            } else {
              return res.status(400).json({ success: false, error: result.error || 'Subscription failed' });
            }
          }
        }
        
        return res.status(400).json({
          success: false,
          error: 'No valid payment method on file. Please add a payment method to continue.',
        });
      }
      
      // Use the existing Stripe customer for subscription
      const result = await billingService.subscribeWithExistingCustomer(
        tenantId,
        tier,
        tenant.stripe_customer_id,
        billingCycle
      );
      
      if (result.success) {
        return res.json({ success: true, data: result });
      } else {
        return res.status(400).json({ success: false, error: result.error || 'Subscription failed' });
      }
    }

    const result = await billingService.subscribe(
      tenantId,
      tier,
      paymentMethodId,
      billingCycle
    );
    
    if (result.success) {
      // Check if tenant needs Stripe Connect onboarding for payouts
      const stripeConnection = await prisma.merchant_stripe_connections.findUnique({
        where: { tenant_id: tenantId },
        select: { 
          onboarding_status: true, 
          stripe_payouts_enabled: true 
        },
      });
      
      const needsStripeConnect = !stripeConnection || 
        stripeConnection.onboarding_status !== 'completed' ||
        !stripeConnection.stripe_payouts_enabled;
      
      res.json({
        success: true,
        data: {
          ...result,
          // Include Stripe Connect status for frontend to prompt onboarding
          stripeConnect: {
            needed: needsStripeConnect,
            status: stripeConnection?.onboarding_status || null,
            payoutsEnabled: stripeConnection?.stripe_payouts_enabled || false,
            onboardingUrl: needsStripeConnect 
              ? `/t/${tenantId}/settings/payment-gateways?stripe_connect=required`
              : null,
          },
        },
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
 * POST /api/subscription/confirm
 * Confirm a subscription after 3D Secure payment succeeds
 * This is called by the frontend after stripe.confirmCardPayment succeeds
 */
router.post('/confirm', authenticateToken, async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { paymentIntentId, stripeSubscriptionId, tier } = req.body;

    console.log('[Subscription] Confirm endpoint called:', {
      tenantId,
      paymentIntentId,
      stripeSubscriptionId,
      tier
    });

    if (!tenantId) {
      console.error('[Subscription] Confirm failed: No tenant context');
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    if (!paymentIntentId || !stripeSubscriptionId || !tier) {
      console.error('[Subscription] Confirm failed: Missing required fields:', {
        hasPaymentIntentId: !!paymentIntentId,
        hasStripeSubscriptionId: !!stripeSubscriptionId,
        hasTier: !!tier
      });
      return res.status(400).json({
        success: false,
        error: 'paymentIntentId, stripeSubscriptionId, and tier are required',
      });
    }

    console.log(`[Subscription] Confirming payment for tenant ${tenantId}, tier: ${tier}`);

    const billingService = getSubscriptionBillingService();
    const { getSubscriptionStatusService } = await import('../services/subscription/SubscriptionStatusService');
    const statusService = getSubscriptionStatusService();

    // Get pricing for invoice
    const pricing = await billingService.getTierPricingByTier(tier);
    const amount = pricing ? pricing.monthlyPriceCents : 0;
    console.log('[Subscription] Pricing:', { tier, amount, pricingFound: !!pricing });

    // Create invoice record
    console.log('[Subscription] Creating invoice...');
    const invoiceId = await billingService.createInvoice(tenantId, tier, amount, stripeSubscriptionId);
    console.log('[Subscription] Invoice created:', invoiceId);

    // Update tenant tier
    console.log('[Subscription] Updating tenant tier...');
    await billingService.updateTenantTier(tenantId, tier, stripeSubscriptionId);
    console.log('[Subscription] Tenant tier updated');

    // Update subscription status
    console.log('[Subscription] Calling handlePaymentSuccess...');
    await statusService.handlePaymentSuccess(tenantId, tier, paymentIntentId, amount);
    console.log('[Subscription] Payment success handled');

    console.log(`[Subscription] Payment confirmed for tenant ${tenantId}, tier updated to ${tier}`);

    res.json({
      success: true,
      data: {
        tier,
        status: 'active',
        invoiceId,
      },
    });
  } catch (error: any) {
    console.error('[Subscription] Error confirming payment:', error);
    console.error('[Subscription] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to confirm payment',
    });
  }
});

/**
 * POST /api/subscription/paypal/activate
 * Activate a PayPal subscription after user approval
 */
router.post('/paypal/activate', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { subscriptionId } = req.body;

    console.log('[Subscription] PayPal activate:', { tenantId, subscriptionId });

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'subscriptionId is required',
      });
    }

    // Get PayPal subscription details
    const { payPalService } = await import('../services/subscription/PayPalService');
    const paypalSubscription = await payPalService.getSubscription(subscriptionId);

    if (!paypalSubscription) {
      return res.status(400).json({
        success: false,
        error: 'PayPal subscription not found',
      });
    }

    console.log('[Subscription] PayPal subscription status:', paypalSubscription.status);

    // Parse custom_id to get tier info
    let tier = 'unknown';
    let billingCycle = 'monthly';
    try {
      const customData = JSON.parse((paypalSubscription as any).custom_id || '{}');
      tier = customData.tier || tier;
      billingCycle = customData.billingCycle || billingCycle;
    } catch (e) {
      console.warn('[Subscription] Could not parse PayPal custom_id');
    }

    // Get pricing
    const tierData = await prisma.subscription_tiers_list.findFirst({
      where: { tier_key: tier }
    });
    const amount = tierData?.price_monthly 
      ? Math.round(parseFloat(String(tierData.price_monthly)) * 100)
      : 0;

    // Check if invoice already exists for this PayPal subscription (idempotency)
    const existingPayment = await prisma.subscription_payments.findFirst({
      where: { transaction_id: subscriptionId }
    });
    
    if (existingPayment) {
      console.log('[Subscription] PayPal subscription already activated, skipping invoice creation');
      
      // Still update tenant tier if needed and return success
      const existingInvoice = await prisma.subscription_invoices.findFirst({
        where: { id: existingPayment.invoice_id }
      });
      
      return res.json({
        success: true,
        tier: existingInvoice?.tier || tier,
        status: 'active',
        invoiceId: existingInvoice?.id,
        alreadyActivated: true,
      });
    }

    // Create invoice
    const invoiceId = `inv-${tenantId}-${Date.now().toString(36)}`;
    const now = new Date();
    const billingPeriodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await prisma.subscription_invoices.create({
      data: {
        id: invoiceId,
        tenant_id: tenantId,
        tier: tier,
        amount_cents: amount,
        status: 'paid',
        due_date: now,
        paid_at: now,
        billing_period_start: now,
        billing_period_end: billingPeriodEnd,
        created_at: now,
        updated_at: now,
        subscription_payments: {
          create: {
            id: generatePaymentId(tenantId),
            gateway_type: 'paypal',
            transaction_id: subscriptionId,
            amount_cents: amount,
            status: 'completed',
            created_at: now,
          }
        }
      }
    });

    console.log('[Subscription] Invoice created:', invoiceId);

    // Update tenant tier
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_tier: tier,
        subscription_status: 'active',
        stripe_subscription_id: `paypal_${subscriptionId}`,
        billing_cycle_start: new Date(),
        billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updated_at: new Date(),
      }
    });

    console.log('[Subscription] Tenant tier updated to:', tier);

    // Handle payment success (send notifications, etc.)
    const { getSubscriptionStatusService } = await import('../services/subscription/SubscriptionStatusService');
    const statusService = getSubscriptionStatusService();
    await statusService.handlePaymentSuccess(tenantId, tier, `paypal_${subscriptionId}`, amount);

    res.json({
      success: true,
      tier,
      status: 'active',
      invoiceId,
    });
  } catch (error: any) {
    console.error('[Subscription] Error activating PayPal subscription:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to activate PayPal subscription',
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

/**
 * GET /api/subscription/invoices/:id/pdf
 * Generate PDF for a specific invoice
 * Requires CAN_MANAGE_TENANT_BILLING permission
 */
router.get('/invoices/:id/pdf', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
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

    // Get platform branding settings
    const platformSettings = await prisma.platform_settings_list.findFirst();
    const branding = {
      platformName: platformSettings?.platform_name || 'Visible Shelf',
      logoUrl: platformSettings?.logo_url,
      primaryColor: (platformSettings?.theme_colors as any)?.primary || '#0066ff',
      contactEmail: platformSettings?.contact_email || 'billing@visibleshelf.store',
      contactPhone: platformSettings?.contact_phone || '(913) 703-6157',
      contactAddress: platformSettings?.contact_address || '',
      contactWebsite: platformSettings?.contact_website || 'https://visibleshelf.store',
    };

    // Get tenant info for billing address
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { name: true, slug: true },
    });

    // Generate PDF using jsPDF
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let yPos = 20;

    // Header with platform branding
    doc.setFontSize(24);
    doc.setTextColor(branding.primaryColor);
    doc.text(branding.platformName, margin, yPos);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    yPos += 8;
    if (branding.contactWebsite) {
      doc.text(branding.contactWebsite, margin, yPos);
    }
    
    // Invoice title
    yPos += 15;
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text('INVOICE', pageWidth - margin - 30, 20, { align: 'left' });
    
    doc.setFontSize(12);
    doc.setTextColor(100, 100, 100);
    doc.text(`#${invoice.id}`, pageWidth - margin - 30, 28, { align: 'left' });

    // From/To section
    yPos = 50;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    
    // From
    doc.setFont('helvetica', 'bold');
    doc.text('From:', margin, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    doc.text(branding.platformName, margin, yPos);
    yPos += 5;
    if (branding.contactEmail) doc.text(branding.contactEmail, margin, yPos);
    yPos += 5;
    if (branding.contactAddress) {
      const addressLines = branding.contactAddress.split('\n');
      for (const line of addressLines) {
        doc.text(line, margin, yPos);
        yPos += 5;
      }
    }

    // To (right side)
    yPos = 50;
    const toX = pageWidth / 2;
    doc.setFont('helvetica', 'bold');
    doc.text('Bill To:', toX, yPos);
    doc.setFont('helvetica', 'normal');
    yPos += 5;
    doc.text(tenant?.name || 'Tenant', toX, yPos);

    // Invoice details
    yPos = Math.max(yPos, 85) + 10;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;

    // Invoice info table
    doc.setFontSize(10);
    const formatDate = (date: string | Date | null) => {
      if (!date) return '-';
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    };

    const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

    const infoRows = [
      ['Invoice Date:', formatDate(invoice.createdAt)],
      ['Due Date:', formatDate(invoice.dueDate)],
      ['Status:', invoice.status.toUpperCase()],
      ['Billing Period:', `${formatDate(invoice.billingPeriodStart)} - ${formatDate(invoice.billingPeriodEnd)}`],
    ];

    for (const [label, value] of infoRows) {
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, yPos);
      doc.setFont('helvetica', 'normal');
      doc.text(value, margin + 40, yPos);
      yPos += 6;
    }

    // Line items header
    yPos += 10;
    doc.setFillColor(240, 240, 240);
    doc.rect(margin, yPos, pageWidth - 2 * margin, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Description', margin + 2, yPos + 5);
    doc.text('Amount', pageWidth - margin - 20, yPos + 5, { align: 'right' });
    yPos += 12;

    // Line item
    doc.setFont('helvetica', 'normal');
    const tierName = invoice.tier.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    doc.text(`Subscription: ${tierName}`, margin + 2, yPos);
    doc.text(formatPrice(invoice.amountCents), pageWidth - margin - 20, yPos, { align: 'right' });
    yPos += 8;

    // Total
    yPos += 5;
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 8;
    doc.setFont('helvetica', 'bold');
    doc.text('Total:', margin + 2, yPos);
    doc.text(formatPrice(invoice.amountCents), pageWidth - margin - 20, yPos, { align: 'right' });

    // Payment history
    if (invoice.payments && invoice.payments.length > 0) {
      yPos += 15;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('Payment History', margin, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      for (const payment of invoice.payments) {
        doc.text(`${payment.gatewayType} - ${formatDate(payment.createdAt)} - ${formatPrice(payment.amountCents)} - ${payment.status}`, margin, yPos);
        yPos += 5;
      }
    }

    // Footer
    yPos = doc.internal.pageSize.getHeight() - 30;
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('Thank you for your business!', margin, yPos);
    yPos += 10;
    if (branding.contactPhone) {
      doc.text(`Phone: ${branding.contactPhone}  |  Email: ${branding.contactEmail}`, margin, yPos);
    } else {
      doc.text(`Email: ${branding.contactEmail}`, margin, yPos);
    }

    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoice.id}.pdf"`);
    
    // Send PDF as buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
    res.send(pdfBuffer);
  } catch (error: any) {
    console.error('[Subscription] Error generating invoice PDF:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate invoice PDF',
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
        mode: unifiedConfig.paypalMode,
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

    // Record platform revenue for subscription
    // Full subscription amount is platform revenue (SaaS subscription model)
    try {
      const gatewayFeeCents = Math.round(capture.amount * 0.029 + 30); // Approximate PayPal fee
      
      const { stripeConnectService } = await import('../services/payments/StripeConnectService');
      const isActive = await stripeConnectService.isRevenueCollectionActive();
      if (isActive) {
        await stripeConnectService.recordRevenueTransaction({
          tenantId,
          transactionType: 'subscription',
          grossAmountCents: capture.amount,
          platformFeeCents: capture.amount, // Full subscription = platform revenue
          gatewayFeeCents,
          netAmountCents: capture.amount - gatewayFeeCents, // Platform keeps all after gateway fees
          stripeTransactionId: capture.captureId,
        });
        console.log('[Subscription] Recorded PayPal revenue transaction:', capture.amount, 'cents platform revenue');
      }
    } catch (revenueError) {
      console.error('[Subscription] Failed to record PayPal revenue transaction:', revenueError);
      // Don't fail the capture if revenue recording fails
    }

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

    // Send notification about payment method added
    const { getBillingNotificationService } = await import('../services/subscription/BillingNotificationService');
    const notificationService = getBillingNotificationService();
    await notificationService.sendNotification({
      tenantId,
      type: 'payment_method_added',
      metadata: {
        paymentType: 'PayPal',
        paypalEmail: captureResult.payerEmail,
      }
    }).catch(err => console.error('[Subscription] Failed to send payment method added notification:', err));

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

// ==================
// SUBSCRIPTION MANAGEMENT
// ==================

/**
 * POST /api/subscription/cancel
 * Cancel the current subscription
 * Requires CAN_MANAGE_TENANT_BILLING permission
 */
router.post('/cancel', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { reason, immediately = false } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { 
        subscription_tier: true, 
        subscription_status: true,
        metadata: true,
        stripe_customer_id: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
    }

    const metadata = tenant.metadata as any;
    const stripeSubscriptionId = metadata?.stripeSubscriptionId;
    const paypalSubscriptionId = metadata?.paypalSubscriptionId;

    // Cancel Stripe subscription
    if (stripeSubscriptionId) {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(unifiedConfig.stripeSecretKey, {
        apiVersion: '2026-06-24.dahlia',
      });

      if (immediately) {
        await stripe.subscriptions.cancel(stripeSubscriptionId);
      } else {
        // Cancel at period end
        await stripe.subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: true,
          cancellation_details: {
            comment: reason,
          },
        });
      }
    }

    // Cancel PayPal subscription
    if (paypalSubscriptionId) {
      const { payPalService } = await import('../services/subscription/PayPalService');
      await payPalService.cancelSubscription(paypalSubscriptionId, reason || 'Customer requested cancellation');
    }

    // Update tenant status
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_status: immediately ? 'canceled' : 'canceling',
        status_changed_at: new Date(),
      },
    });

    res.json({
      success: true,
      message: immediately ? 'Subscription canceled immediately' : 'Subscription will cancel at end of billing period',
      status: immediately ? 'canceled' : 'canceling',
    });
  } catch (error: any) {
    console.error('[Subscription] Cancel error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel subscription',
    });
  }
});

/**
 * POST /api/subscription/pause
 * Pause/suspend the current subscription
 * Requires CAN_MANAGE_TENANT_BILLING permission
 */
router.post('/pause', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { reason } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { metadata: true },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
    }

    const metadata = tenant.metadata as any;
    const paypalSubscriptionId = metadata?.paypalSubscriptionId;

    // Stripe doesn't support pause - must cancel and recreate
    // PayPal supports suspend
    if (paypalSubscriptionId) {
      const { payPalService } = await import('../services/subscription/PayPalService');
      await payPalService.suspendSubscription(paypalSubscriptionId, reason || 'Customer requested pause');
    }

    // Update tenant status
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_status: 'paused',
        status_changed_at: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Subscription paused',
      status: 'paused',
    });
  } catch (error: any) {
    console.error('[Subscription] Pause error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to pause subscription',
    });
  }
});

/**
 * POST /api/subscription/resume
 * Resume a paused subscription
 * Requires CAN_MANAGE_TENANT_BILLING permission
 */
router.post('/resume', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { 
        subscription_tier: true,
        subscription_status: true,
        metadata: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
    }

    if (tenant.subscription_status !== 'paused') {
      return res.status(400).json({
        success: false,
        error: 'Subscription is not paused',
      });
    }

    const metadata = tenant.metadata as any;
    const paypalSubscriptionId = metadata?.paypalSubscriptionId;

    // Resume PayPal subscription
    if (paypalSubscriptionId) {
      const { payPalService } = await import('../services/subscription/PayPalService');
      await payPalService.activateSubscription(paypalSubscriptionId, 'Customer requested resume');
    }

    // Update tenant status
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_status: 'active',
        status_changed_at: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Subscription resumed',
      status: 'active',
    });
  } catch (error: any) {
    console.error('[Subscription] Resume error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resume subscription',
    });
  }
});

/**
 * POST /api/subscription/change-tier
 * Change subscription tier with proration
 * Requires CAN_MANAGE_TENANT_BILLING permission
 */
router.post('/change-tier', requirePermission('CAN_MANAGE_TENANT_BILLING'), async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    const { newTier, billingCycle = 'monthly' } = req.body;
    
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'No tenant context',
      });
    }

    if (!newTier) {
      return res.status(400).json({
        success: false,
        error: 'New tier is required',
      });
    }

    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { 
        subscription_tier: true,
        subscription_status: true,
        metadata: true,
        stripe_customer_id: true,
      },
    });

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: 'Tenant not found',
      });
    }

    const metadata = tenant.metadata as any;
    const stripeSubscriptionId = metadata?.stripeSubscriptionId;
    const paypalSubscriptionId = metadata?.paypalSubscriptionId;

    // Get pricing for new tier
    const billingService = getSubscriptionBillingService();
    const pricing = await billingService.getTierPricingByTier(newTier);
    
    if (!pricing) {
      return res.status(400).json({
        success: false,
        error: `Tier pricing not found: ${newTier}`,
      });
    }

    const amount = billingCycle === 'monthly' ? pricing.monthlyPriceCents : pricing.annualPriceCents;

    // Change Stripe subscription
    if (stripeSubscriptionId) {
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(unifiedConfig.stripeSecretKey, {
        apiVersion: '2026-06-24.dahlia',
      });

      // Get new price
      const priceId = await billingService.getOrCreateStripePrice(newTier, billingCycle, amount);

      // Update subscription with proration
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      
      await stripe.subscriptions.update(stripeSubscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: priceId,
        }],
        proration_behavior: 'create_prorations',
        metadata: {
          tenantId,
          tier: newTier,
          billingCycle,
        },
      });
    }

    // PayPal: Cancel old subscription and create new one
    if (paypalSubscriptionId) {
      const { payPalService } = await import('../services/subscription/PayPalService');
      
      // Cancel existing
      await payPalService.cancelSubscription(paypalSubscriptionId, 'Tier change');
      
      // Create new subscription
      const result = await payPalService.createSubscription(tenantId, newTier, amount, billingCycle);
      
      // Update metadata with new subscription ID
      await prisma.tenants.update({
        where: { id: tenantId },
        data: {
          metadata: {
            ...metadata,
            paypalSubscriptionId: result.subscriptionId,
          },
        },
      });

      // Return approval URL for PayPal
      return res.json({
        success: true,
        message: 'PayPal subscription changed - approval required',
        requiresAction: true,
        paypalApprovalUrl: result.approvalUrl,
        paypalSubscriptionId: result.subscriptionId,
      });
    }

    // Update tenant tier
    await prisma.tenants.update({
      where: { id: tenantId },
      data: {
        subscription_tier: newTier,
        status_changed_at: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Subscription tier changed',
      tier: newTier,
      billingCycle,
    });
  } catch (error: any) {
    console.error('[Subscription] Change tier error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to change subscription tier',
    });
  }
});

// ====================
// BSaaS Feature Purchase Routes
// ====================
import bsaasPurchaseRoutes from './bsaas-purchases';
router.use(bsaasPurchaseRoutes);

export default router;
