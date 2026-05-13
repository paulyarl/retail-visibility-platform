/**
 * Stripe Webhook Handler
 * 
 * Handles Stripe events for subscription billing:
 * - payment_intent.succeeded: Activate subscription
 * - payment_intent.payment_failed: Set to past_due
 * - invoice.payment_succeeded: Recurring payment success
 * - invoice.payment_failed: Recurring payment failure
 * - customer.subscription.deleted: Handle cancellation
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { getSubscriptionStatusService } from '../services/subscription/SubscriptionStatusService';
import { getSubscriptionBillingService } from '../services/subscription/SubscriptionBillingService';
import { prisma } from '../prisma';

const router = Router();

// Check if Stripe is properly configured
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!stripeSecretKey) {
  console.warn('[Stripe Webhook] STRIPE_SECRET_KEY not configured. Stripe webhook routes will be disabled.');
}

const stripe = stripeSecretKey ? new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16' as any,
}) : null;

const WEBHOOK_SECRET = webhookSecret;

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
router.post('/', async (req: Request, res: Response) => {
  // Check if Stripe is configured
  if (!stripe || !WEBHOOK_SECRET) {
    console.warn('[Stripe Webhook] Stripe not properly configured. Skipping webhook processing.');
    return res.status(503).json({ error: 'Stripe webhook service not available' });
  }

  // Verify webhook signature
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  } catch (err) {
    console.error('[Stripe Webhook] Webhook signature verification failed:', err);
    return res.status(400).json({ error: 'Webhook signature verification failed' });
  }

  console.log(`[StripeWebhook] Received event: ${event.type} (${event.id})`);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
        break;

      case 'payment_method.detached':
        await handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
        break;

      case 'payment_method.automatically_updated':
        await handlePaymentMethodAutoUpdated(event.data.object as Stripe.PaymentMethod);
        break;

      case 'setup_intent.succeeded':
        await handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
        break;

      default:
        console.log(`[StripeWebhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('[StripeWebhook] Error handling event:', err);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

/**
 * Handle successful one-time payment (subscription purchase)
 */
async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  const { tenantId, tier, billingCycle } = paymentIntent.metadata || {};

  if (!tenantId) {
    console.log('[StripeWebhook] Payment intent missing tenantId metadata');
    return;
  }

  console.log(`[StripeWebhook] Payment succeeded for tenant ${tenantId}, tier: ${tier}`);

  const statusService = getSubscriptionStatusService();
  const billingService = getSubscriptionBillingService();

  // Create invoice record if not exists
  const existingInvoice = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM subscription_invoices 
    WHERE transaction_id = ${paymentIntent.id}
  `;

  if (existingInvoice.length === 0 && tier) {
    // Get amount
    const pricing = await billingService.getTierPricingByTier(tier);
    if (pricing) {
      const amount = billingCycle === 'annual' 
        ? pricing.annualPriceCents 
        : pricing.monthlyPriceCents;

      // Create invoice via billing service internal method
      // This is handled by the subscribe method, but webhook might arrive first
      console.log(`[StripeWebhook] Payment for ${tenantId} - amount: ${amount} cents`);
      
      // Activate subscription with amount
      await statusService.handlePaymentSuccess(tenantId, tier || 'starter', paymentIntent.id, amount);
      return;
    }
  }

  // Activate subscription without amount (fallback)
  await statusService.handlePaymentSuccess(tenantId, tier || 'starter', paymentIntent.id);
}

/**
 * Handle failed one-time payment
 */
async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
  const { tenantId } = paymentIntent.metadata || {};

  if (!tenantId) {
    console.log('[StripeWebhook] Failed payment intent missing tenantId metadata');
    return;
  }

  console.log(`[StripeWebhook] Payment failed for tenant ${tenantId}: ${paymentIntent.last_payment_error?.message}`);

  const statusService = getSubscriptionStatusService();
  const reason = paymentIntent.last_payment_error?.code || 'unknown';
  
  await statusService.handlePaymentFailure(tenantId, reason);
}

/**
 * Handle successful recurring invoice payment
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const tenantId = invoice.metadata?.tenantId || 
    (invoice.customer ? await getTenantIdFromCustomerId(invoice.customer as string) : null);

  if (!tenantId) {
    console.log('[StripeWebhook] Invoice missing tenant identification');
    return;
  }

  console.log(`[StripeWebhook] Invoice payment succeeded for tenant ${tenantId}`);

  const statusService = getSubscriptionStatusService();
  const tier = invoice.metadata?.tier || 'professional';
  const amount = invoice.amount_paid;

  await statusService.handlePaymentSuccess(tenantId, tier, invoice.id, amount);
}

/**
 * Handle failed recurring invoice payment
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const tenantId = invoice.metadata?.tenantId ||
    (invoice.customer ? await getTenantIdFromCustomerId(invoice.customer as string) : null);

  if (!tenantId) {
    console.log('[StripeWebhook] Failed invoice missing tenant identification');
    return;
  }

  console.log(`[StripeWebhook] Invoice payment failed for tenant ${tenantId}`);

  const statusService = getSubscriptionStatusService();
  const attemptCount = invoice.attempt_count || 1;
  
  await statusService.handlePaymentFailure(tenantId, 'invoice_payment_failed', attemptCount);
}

/**
 * Handle subscription deletion (cancellation)
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const tenantId = subscription.metadata?.tenantId ||
    (subscription.customer ? await getTenantIdFromCustomerId(subscription.customer as string) : null);

  if (!tenantId) {
    console.log('[StripeWebhook] Deleted subscription missing tenant identification');
    return;
  }

  console.log(`[StripeWebhook] Subscription deleted for tenant ${tenantId}`);

  const statusService = getSubscriptionStatusService();
  await statusService.handleCancellation(tenantId, 'stripe_subscription_deleted');
}

/**
 * Handle payment method attached to customer
 */
async function handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod) {
  if (!paymentMethod.customer) {
    return;
  }

  const tenantId = await getTenantIdFromCustomerId(paymentMethod.customer as string);
  if (!tenantId) {
    return;
  }

  console.log(`[StripeWebhook] Payment method ${paymentMethod.id} attached to tenant ${tenantId}`);
  
  // The billing service handles this via addPaymentMethod
  // This webhook is just for logging/verification
}

/**
 * Handle payment method detached from customer
 */
async function handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod) {
  console.log(`[StripeWebhook] Payment method ${paymentMethod.id} detached`);

  // Mark as inactive in tenant billing gateways
  await prisma.$executeRaw`
    UPDATE merchant_billing_gateways
    SET is_active = false
    WHERE payment_method_token = ${paymentMethod.id}
  `;

  // Also mark as inactive in customer payment methods
  await prisma.$executeRaw`
    UPDATE customer_payment_methods
    SET is_active = false, updated_at = now()
    WHERE payment_method_token = ${paymentMethod.id}
  `;
}

/**
 * Handle payment method automatically updated by Stripe
 * (e.g., card expiry date updated by the network)
 */
async function handlePaymentMethodAutoUpdated(paymentMethod: Stripe.PaymentMethod) {
  console.log(`[StripeWebhook] Payment method ${paymentMethod.id} automatically updated`);

  if (!paymentMethod.card) return;

  // Update card details in customer_payment_methods
  await prisma.$executeRaw`
    UPDATE customer_payment_methods
    SET 
      card_last4 = ${paymentMethod.card.last4},
      card_brand = ${paymentMethod.card.brand},
      expiry_month = ${paymentMethod.card.exp_month},
      expiry_year = ${paymentMethod.card.exp_year},
      card_funding = ${paymentMethod.card.funding},
      card_country = ${paymentMethod.card.country},
      updated_at = now()
    WHERE payment_method_token = ${paymentMethod.id} AND is_active = true
  `;
}

/**
 * Handle setup_intent.succeeded
 * Customer has successfully saved a card via SetupIntent flow
 */
async function handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent) {
  const { platform_customer_id, tenant_id } = setupIntent.metadata || {};

  console.log(`[StripeWebhook] SetupIntent ${setupIntent.id} succeeded for customer ${platform_customer_id}, tenant ${tenant_id}`);

  // The frontend is responsible for calling POST /api/customer-payment-methods
  // after confirmSetup() succeeds. This webhook is for logging and verification.
  // If the frontend fails to save, we can do it here as a safety net.

  if (!platform_customer_id || !tenant_id || !setupIntent.payment_method) return;

  // Check if this payment method was already saved by the frontend
  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM customer_payment_methods
    WHERE customer_id = ${platform_customer_id}
    AND tenant_id = ${tenant_id}
    AND payment_method_token = ${setupIntent.payment_method as string}
    AND is_active = true
  `;

  if (existing.length > 0) {
    console.log(`[StripeWebhook] Payment method ${setupIntent.payment_method} already saved for customer ${platform_customer_id}`);
    return;
  }

  // Safety net: save the payment method if frontend didn't
  console.log(`[StripeWebhook] Auto-saving payment method ${setupIntent.payment_method} for customer ${platform_customer_id}`);

  try {
    const { CustomerPaymentMethodsService } = await import('../services/CustomerPaymentMethodsService');
    const service = CustomerPaymentMethodsService.getInstance();
    await service.addPaymentMethod(platform_customer_id, {
      tenantId: tenant_id,
      gatewayType: 'stripe',
      paymentMethodToken: setupIntent.payment_method as string,
    });
  } catch (error: any) {
    console.error(`[StripeWebhook] Failed to auto-save payment method:`, error.message);
  }
}

/**
 * Helper: Get tenant ID from Stripe customer ID
 */
async function getTenantIdFromCustomerId(customerId: string): Promise<string | null> {
  const results = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM tenants
    WHERE metadata->>'stripeCustomerId' = ${customerId}
  `;

  return results[0]?.id || null;
}

export default router;
