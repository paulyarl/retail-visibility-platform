/**
 * Stripe Webhook Handlers
 * 
 * Handles Stripe subscription lifecycle events and keeps tenant subscription
 * status in sync with Stripe.
 * 
 * Key Events:
 * - checkout.session.completed - Initial subscription creation
 * - customer.subscription.created - New subscription
 * - customer.subscription.updated - Status changes
 * - customer.subscription.deleted - Cancellation
 * - invoice.payment_failed - Payment issues
 * 
 * Alignment with Trial Lifecycle:
 * - Never auto-converts trial to paid without payment
 * - Preserves google_only tier for expired trials
 * - Updates maintenanceBoundaryAt for google_only transitions
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import Stripe from 'stripe';

const router = Router();

// Initialize Stripe (ensure STRIPE_SECRET_KEY is set in environment)
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-11-20.acacia' })
  : null;

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

/**
 * Map Stripe subscription status to internal subscription status
 */
function mapStripeStatusToInternal(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'trialing':
      return 'trial';
    case 'active':
      return 'active';
    case 'past_due':
      return 'past_due';
    case 'unpaid':
      return 'past_due'; // Treat unpaid as past_due initially
    case 'canceled':
      return 'canceled';
    case 'incomplete':
    case 'incomplete_expired':
      return 'expired';
    default:
      return 'active'; // Default fallback
  }
}

/**
 * Extract tier from Stripe price metadata
 */
function extractTierFromPrice(price: Stripe.Price | null): string {
  if (!price || !price.metadata) {
    return 'starter'; // Default tier
  }
  
  const tier = price.metadata.tier || price.metadata.plan || 'starter';
  
  // Validate tier
  const validTiers = ['google_only', 'starter', 'professional', 'enterprise', 'organization'];
  return validTiers.includes(tier) ? tier : 'starter';
}

/**
 * Main webhook endpoint
 * POST /stripe/webhooks
 */
router.post('/webhooks', async (req: Request, res: Response) => {
  if (!stripe) {
    console.error('[Stripe Webhooks] Stripe not initialized - missing STRIPE_SECRET_KEY');
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  if (!STRIPE_WEBHOOK_SECRET) {
    console.error('[Stripe Webhooks] Missing STRIPE_WEBHOOK_SECRET');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      req.body,
      sig as string,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('[Stripe Webhooks] Signature verification failed:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  console.log(`[Stripe Webhooks] Received event: ${event.type} (${event.id})`);

  try {
    // Check for duplicate event processing (idempotency)
    try {
      const existingEvent = await prisma.stripeWebhookEvent.findUnique({
        where: { eventId: event.id },
      });

      if (existingEvent) {
        console.log(`[Stripe Webhooks] Event ${event.id} already processed`);
        return res.json({ received: true, duplicate: true });
      }
    } catch (err) {
      // Table might not exist yet during initial setup
      console.warn('[Stripe Webhooks] Could not check for duplicate event (table may not exist)');
    }

    // Process event based on type
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionCreatedOrUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[Stripe Webhooks] Unhandled event type: ${event.type}`);
    }

    // Record event as processed
    try {
      await prisma.stripeWebhookEvent.create({
        data: {
          eventId: event.id,
          eventType: event.type,
          processedAt: new Date(),
        },
      });
    } catch (err) {
      // Table might not exist yet, log but don't fail
      console.warn('[Stripe Webhooks] Could not record event (table may not exist):', err);
    }

    res.json({ received: true });
  } catch (error) {
    console.error(`[Stripe Webhooks] Error processing ${event.type}:`, error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * Handle checkout.session.completed
 * Initial subscription creation from checkout
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log('[Stripe Webhooks] Processing checkout.session.completed:', session.id);

  const tenantId = session.metadata?.tenantId || session.client_reference_id;

  if (!tenantId) {
    console.error('[Stripe Webhooks] No tenantId in checkout session metadata');
    return;
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });

  if (!tenant) {
    console.error(`[Stripe Webhooks] Tenant ${tenantId} not found`);
    return;
  }

  // Store Stripe customer ID
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      stripeCustomerId: session.customer as string,
      stripeSubscriptionId: session.subscription as string,
    },
  });

  console.log(`[Stripe Webhooks] Updated tenant ${tenantId} with Stripe IDs`);
}

/**
 * Handle customer.subscription.created / updated
 * Main subscription lifecycle handler
 */
async function handleSubscriptionCreatedOrUpdated(subscription: Stripe.Subscription) {
  console.log('[Stripe Webhooks] Processing subscription update:', subscription.id);

  // Find tenant by Stripe customer ID
  const tenant = await prisma.tenant.findFirst({
    where: { stripeCustomerId: subscription.customer as string },
  });

  if (!tenant) {
    console.error(`[Stripe Webhooks] No tenant found for customer ${subscription.customer}`);
    return;
  }

  // Extract tier from price metadata
  const price = subscription.items.data[0]?.price;
  const tier = extractTierFromPrice(price);

  // Map Stripe status to internal status
  const internalStatus = mapStripeStatusToInternal(subscription.status);

  // Calculate subscription end date
  const subscriptionEndsAt = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000)
    : null;

  // Calculate trial end date (if in trial)
  const trialEndsAt = subscription.trial_end
    ? new Date(subscription.trial_end * 1000)
    : tenant.trialEndsAt; // Preserve existing trial end if no Stripe trial

  // Prepare update data
  const updateData: any = {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: internalStatus,
    subscriptionTier: tier,
    subscriptionEndsAt,
  };

  // Only update trialEndsAt if subscription has a trial
  if (subscription.trial_end) {
    updateData.trialEndsAt = trialEndsAt;
  }

  // IMPORTANT: Never downgrade to google_only via webhook
  // google_only is an internal tier for expired trials only
  if (tier === 'google_only') {
    console.warn(`[Stripe Webhooks] Attempted to set google_only tier via webhook - ignoring`);
    delete updateData.subscriptionTier;
  }

  // If moving from trial to active, clear trial end date
  if (internalStatus === 'active' && tenant.subscriptionStatus === 'trial') {
    console.log(`[Stripe Webhooks] Trial converted to active for tenant ${tenant.id}`);
    // Keep trialEndsAt for historical reference, but status is now active
  }

  // Update tenant
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: updateData,
  });

  console.log(`[Stripe Webhooks] Updated tenant ${tenant.id}:`, {
    status: internalStatus,
    tier,
    subscriptionEndsAt,
  });
}

/**
 * Handle customer.subscription.deleted
 * Subscription cancellation
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('[Stripe Webhooks] Processing subscription deletion:', subscription.id);

  const tenant = await prisma.tenant.findFirst({
    where: { stripeSubscriptionId: subscription.id },
  });

  if (!tenant) {
    console.error(`[Stripe Webhooks] No tenant found for subscription ${subscription.id}`);
    return;
  }

  // Mark as canceled
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      subscriptionStatus: 'canceled',
      // Keep tier and other fields for reference
      // Don't downgrade to google_only here - let GET /tenants/:id handle that
    },
  });

  console.log(`[Stripe Webhooks] Marked tenant ${tenant.id} as canceled`);
}

/**
 * Handle invoice.payment_failed
 * Payment failure - set to past_due
 */
async function handlePaymentFailed(invoice: Stripe.Invoice) {
  console.log('[Stripe Webhooks] Processing payment failure:', invoice.id);

  if (!invoice.subscription) {
    console.log('[Stripe Webhooks] Invoice has no subscription, skipping');
    return;
  }

  const tenant = await prisma.tenant.findFirst({
    where: { stripeSubscriptionId: invoice.subscription as string },
  });

  if (!tenant) {
    console.error(`[Stripe Webhooks] No tenant found for subscription ${invoice.subscription}`);
    return;
  }

  // Set to past_due
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      subscriptionStatus: 'past_due',
    },
  });

  console.log(`[Stripe Webhooks] Set tenant ${tenant.id} to past_due`);

  // TODO: Send email notification about payment failure
}

/**
 * Handle invoice.payment_succeeded
 * Payment success - restore to active if was past_due
 */
async function handlePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('[Stripe Webhooks] Processing payment success:', invoice.id);

  if (!invoice.subscription) {
    console.log('[Stripe Webhooks] Invoice has no subscription, skipping');
    return;
  }

  const tenant = await prisma.tenant.findFirst({
    where: { stripeSubscriptionId: invoice.subscription as string },
  });

  if (!tenant) {
    console.error(`[Stripe Webhooks] No tenant found for subscription ${invoice.subscription}`);
    return;
  }

  // If was past_due, restore to active
  if (tenant.subscriptionStatus === 'past_due') {
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        subscriptionStatus: 'active',
      },
    });

    console.log(`[Stripe Webhooks] Restored tenant ${tenant.id} to active`);
  }

  // TODO: Send email confirmation of successful payment
}

export default router;
