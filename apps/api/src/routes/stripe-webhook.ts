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
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any,
});

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * POST /api/webhooks/stripe
 * Handle Stripe webhook events
 */
router.post('/', async (req: Request, res: Response) => {
  // Verify webhook signature
  const sig = req.headers['stripe-signature'] as string;
  let event: Stripe.Event;

  try {
    if (!WEBHOOK_SECRET) {
      console.error('[StripeWebhook] Missing STRIPE_WEBHOOK_SECRET');
      return res.status(500).json({ error: 'Webhook secret not configured' });
    }

    // Get raw body for signature verification
    const rawBody = req.body;
    event = stripe.webhooks.constructEvent(rawBody, sig, WEBHOOK_SECRET);
  } catch (err: any) {
    console.error('[StripeWebhook] Signature verification failed:', err.message);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
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
    }
  }

  // Activate subscription
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

  await statusService.handlePaymentSuccess(tenantId, tier, invoice.id);
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

  // Mark as inactive in our database
  await prisma.$executeRaw`
    UPDATE merchant_billing_gateways
    SET is_active = false
    WHERE payment_method_token = ${paymentMethod.id}
  `;
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
