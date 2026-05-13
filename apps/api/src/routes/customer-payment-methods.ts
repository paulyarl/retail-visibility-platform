/**
 * Customer Payment Methods Routes
 * 
 * API endpoints for customer saved payment method management:
 * - List payment methods (all or filtered by tenant)
 * - Add payment method (Stripe PaymentMethod attach, PayPal billing agreement)
 * - Set default payment method per tenant
 * - Remove payment method (soft-delete with Stripe detach)
 * 
 * Uses JWT token authentication (same pattern as customer-addresses)
 */

import { Router, Request, Response } from 'express';
import { CustomerPaymentMethodsService } from '../services/CustomerPaymentMethodsService';
import { CustomerTokenService } from '../services/CustomerTokenService';
import { prisma } from '../prisma';

const router = Router();
const paymentMethodsService = CustomerPaymentMethodsService.getInstance();
const customerTokenService = CustomerTokenService.getInstance();

// Middleware to extract customer from JWT token or session cookie
const getCustomerId = (req: Request): string | null => {
  // Try JWT token first
  const token = CustomerTokenService.extractBearerToken(req);
  if (token) {
    const payload = customerTokenService.verifyAccessToken(token);
    if (payload) {
      return payload.customerId;
    }
  }

  // Fallback to session cookie
  return req.cookies?.customer_session_id || null;
};

// Middleware to require authentication
const requireCustomerAuth = (req: Request, res: Response, next: Function) => {
  const customerId = getCustomerId(req);

  if (!customerId) {
    console.log('[Customer Payment Methods] Authentication failed');
    return res.status(401).json({
      success: false,
      error: 'unauthorized',
      message: 'Authentication required',
    });
  }

  (req as any).customerId = customerId;
  next();
};

/**
 * GET /api/customer-payment-methods
 * 
 * List all active payment methods for the authenticated customer
 * Optional query: ?tenantId=xxx to filter by tenant
 */
router.get('/', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const tenantId = req.query.tenantId as string | undefined;

    const methods = await paymentMethodsService.getPaymentMethods(customerId, tenantId);

    return res.json({
      success: true,
      paymentMethods: methods.map(m => paymentMethodsService.maskForResponse(m)),
    });
  } catch (error: any) {
    console.error('[Customer Payment Methods] List error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'list_failed',
      message: 'Failed to retrieve payment methods',
    });
  }
});

/**
 * GET /api/customer-payment-methods/:id
 * 
 * Get a single payment method by ID (with ownership check)
 */
router.get('/:id', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { id } = req.params;

    const method = await paymentMethodsService.getPaymentMethod(customerId, id);

    if (!method) {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Payment method not found',
      });
    }

    return res.json({
      success: true,
      paymentMethod: paymentMethodsService.maskForResponse(method),
    });
  } catch (error: any) {
    console.error('[Customer Payment Methods] Get error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'get_failed',
      message: 'Failed to retrieve payment method',
    });
  }
});

/**
 * GET /api/customer-payment-methods/default/:tenantId
 * 
 * Get the default payment method for a specific tenant
 */
router.get('/default/:tenantId', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { tenantId } = req.params;

    const method = await paymentMethodsService.getDefaultPaymentMethod(customerId, tenantId);

    if (!method) {
      return res.json({
        success: true,
        paymentMethod: null,
      });
    }

    return res.json({
      success: true,
      paymentMethod: paymentMethodsService.maskForResponse(method),
    });
  } catch (error: any) {
    console.error('[Customer Payment Methods] Get default error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'get_default_failed',
      message: 'Failed to retrieve default payment method',
    });
  }
});

/**
 * POST /api/customer-payment-methods
 * 
 * Add a new payment method for the authenticated customer
 * 
 * Body:
 *   tenantId           - required, which tenant's gateway
 *   gatewayType        - required, 'stripe' | 'paypal' | 'square' | 'clover'
 *   paymentMethodToken - required, gateway-specific token (Stripe pm_xxx, PayPal billing agreement)
 *   type               - optional, 'card' | 'paypal' | 'wallet' | 'bank_account'
 *   cardLast4          - optional, for cards
 *   cardBrand          - optional, for cards
 *   expiryMonth        - optional, for cards
 *   expiryYear         - optional, for cards
 *   paypalEmail        - optional, for PayPal
 *   paypalAccountId    - optional, for PayPal
 *   walletType         - optional, for digital wallets
 */
router.post('/', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { tenantId, gatewayType, paymentMethodToken, type, cardLast4, cardBrand, expiryMonth, expiryYear, paypalEmail, paypalAccountId, walletType } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenant',
        message: 'tenantId is required',
      });
    }

    if (!gatewayType) {
      return res.status(400).json({
        success: false,
        error: 'missing_gateway_type',
        message: 'gatewayType is required (stripe, paypal, square, clover)',
      });
    }

    if (!paymentMethodToken) {
      return res.status(400).json({
        success: false,
        error: 'missing_token',
        message: 'paymentMethodToken is required',
      });
    }

    const method = await paymentMethodsService.addPaymentMethod(customerId, {
      tenantId,
      gatewayType,
      paymentMethodToken,
      type,
      cardLast4,
      cardBrand,
      expiryMonth,
      expiryYear,
      paypalEmail,
      paypalAccountId,
      walletType,
    });

    return res.status(201).json({
      success: true,
      paymentMethod: paymentMethodsService.maskForResponse(method),
    });
  } catch (error: any) {
    console.error('[Customer Payment Methods] Add error:', error.message);

    // Handle Stripe configuration mismatch with a clear error
    if (error.message?.includes('Stripe configuration mismatch')) {
      return res.status(400).json({
        success: false,
        error: 'stripe_config_mismatch',
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      error: 'add_failed',
      message: 'Failed to add payment method',
    });
  }
});

/**
 * PUT /api/customer-payment-methods/:id/default
 * 
 * Set a payment method as the default for its tenant scope
 */
router.put('/:id/default', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { id } = req.params;

    await paymentMethodsService.setDefaultPaymentMethod(customerId, id);

    return res.json({
      success: true,
      message: 'Default payment method updated',
    });
  } catch (error: any) {
    console.error('[Customer Payment Methods] Set default error:', error.message);

    if (error.message === 'Payment method not found') {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Payment method not found',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'set_default_failed',
      message: 'Failed to set default payment method',
    });
  }
});

/**
 * DELETE /api/customer-payment-methods/:id
 * 
 * Remove (soft-delete) a payment method
 * Detaches from Stripe if applicable
 */
router.delete('/:id', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { id } = req.params;

    await paymentMethodsService.removePaymentMethod(customerId, id);

    return res.json({
      success: true,
      message: 'Payment method removed',
    });
  } catch (error: any) {
    console.error('[Customer Payment Methods] Remove error:', error.message);

    if (error.message === 'Payment method not found') {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Payment method not found',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'remove_failed',
      message: 'Failed to remove payment method',
    });
  }
});

/**
 * POST /api/customer-payment-methods/setup-intent
 * 
 * Create a Stripe SetupIntent for PCI-compliant card saving.
 * Returns a client_secret for the frontend to confirm with Stripe.js.
 * 
 * Body:
 *   tenantId - required, which tenant's Stripe account
 */
router.post('/setup-intent', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenant',
        message: 'tenantId is required',
      });
    }

    const result = await paymentMethodsService.createSetupIntent(customerId, tenantId);

    return res.json({
      success: true,
      clientSecret: result.clientSecret,
      stripeCustomerId: result.stripeCustomerId,
    });
  } catch (error: any) {
    console.error('[Customer Payment Methods] SetupIntent error:', error.message);

    if (error.message === 'Stripe not configured') {
      return res.status(503).json({
        success: false,
        error: 'stripe_not_configured',
        message: 'Stripe is not configured for this tenant',
      });
    }

    if (error.message === 'Customer not found') {
      return res.status(404).json({
        success: false,
        error: 'not_found',
        message: 'Customer not found',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'setup_intent_failed',
      message: 'Failed to create setup intent',
    });
  }
});

/**
 * GET /api/customer-payment-methods/checkout/:tenantId
 * 
 * Get saved payment method tokens for checkout selection.
 * Returns lightweight data for the Stripe PaymentIntent creation.
 */
router.get('/checkout/:tenantId', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { tenantId } = req.params;

    const [tokens, stripeInfo] = await Promise.all([
      paymentMethodsService.getPaymentMethodTokensForCheckout(customerId, tenantId),
      paymentMethodsService.getStripeCustomerForCheckout(customerId, tenantId),
    ]);

    return res.json({
      success: true,
      paymentMethods: tokens,
      stripeCustomerId: stripeInfo.stripeCustomerId,
      defaultPaymentMethodToken: stripeInfo.defaultPaymentMethodToken,
    });
  } catch (error: any) {
    console.error('[Customer Payment Methods] Checkout info error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'checkout_info_failed',
      message: 'Failed to retrieve checkout payment info',
    });
  }
});

/**
 * GET /api/customer-payment-methods/expiring
 * 
 * Get payment methods that are expired or expiring soon.
 * Query: ?monthsAhead=2 (default 2 months)
 */
router.get('/expiring', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const monthsAhead = parseInt(req.query.monthsAhead as string) || 2;

    const methods = await paymentMethodsService.getExpiringPaymentMethods(customerId, monthsAhead);

    return res.json({
      success: true,
      expiringMethods: methods.map(m => paymentMethodsService.maskForResponse(m)),
    });
  } catch (error: any) {
    console.error('[Customer Payment Methods] Expiring check error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'expiring_check_failed',
      message: 'Failed to check expiring payment methods',
    });
  }
});

/**
 * POST /api/customer-payment-methods/paypal/create-billing-agreement
 * 
 * Create a PayPal billing agreement token for saving PayPal as a customer payment method.
 * Returns an approval URL for the customer to authorize on PayPal.
 * 
 * Body:
 *   tenantId - required, which tenant's PayPal configuration
 */
router.post('/paypal/create-billing-agreement', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { tenantId } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenant',
        message: 'tenantId is required',
      });
    }

    const { payPalService } = await import('../services/subscription/PayPalService');

    // Get tenant name for the billing agreement description
    const tenant = await prisma.tenants.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    const agreement = await payPalService.createBillingAgreementToken(
      tenantId,
      tenant?.name || 'VisibleShelf Store'
    );

    return res.json({
      success: true,
      approvalUrl: agreement.approvalUrl,
      tokenId: agreement.tokenId,
    });
  } catch (error: any) {
    console.error('[Customer Payment Methods] PayPal billing agreement error:', error.message);

    if (error.message?.includes('credentials not configured')) {
      return res.status(503).json({
        success: false,
        error: 'paypal_not_configured',
        message: 'PayPal is not configured for this store',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'paypal_agreement_failed',
      message: 'Failed to create PayPal billing agreement',
    });
  }
});

/**
 * POST /api/customer-payment-methods/paypal/save-payment-method
 * 
 * Save a PayPal payment method after customer approval.
 * Captures the PayPal order and stores the payment method in the database.
 * 
 * Body:
 *   tenantId - required
 *   tokenId  - required, the PayPal order/token ID from the approval redirect
 */
router.post('/paypal/save-payment-method', requireCustomerAuth, async (req: Request, res: Response) => {
  try {
    const customerId = (req as any).customerId;
    const { tenantId, tokenId } = req.body;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'missing_tenant',
        message: 'tenantId is required',
      });
    }

    if (!tokenId) {
      return res.status(400).json({
        success: false,
        error: 'missing_token',
        message: 'tokenId is required',
      });
    }

    const { payPalService } = await import('../services/subscription/PayPalService');

    // Capture the PayPal order to get payer details
    const captureResult = await payPalService.captureOrder(tokenId);

    if (!captureResult.success) {
      return res.status(400).json({
        success: false,
        error: 'paypal_capture_failed',
        message: 'Failed to capture PayPal order',
      });
    }

    // Save as customer payment method
    const paymentMethod = await paymentMethodsService.addPaymentMethod(customerId, {
      tenantId,
      gatewayType: 'paypal',
      paymentMethodToken: tokenId,
      paypalEmail: captureResult.payerEmail,
      paypalAccountId: captureResult.payerId,
    });

    return res.json({
      success: true,
      paymentMethod: paymentMethodsService.maskForResponse(paymentMethod),
    });
  } catch (error: any) {
    console.error('[Customer Payment Methods] PayPal save error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'paypal_save_failed',
      message: 'Failed to save PayPal payment method',
    });
  }
});

export default router;
