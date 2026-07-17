import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { StripeWebhookHandler } from '../services/payments/webhooks/StripeWebhookHandler';
import { prisma } from '../prisma';
import { unifiedConfig } from '../config/unifiedConfig';

const router = express.Router();

/**
 * Stripe Webhook Endpoint
 * Receives and processes webhook events from Stripe
 * 
 * IMPORTANT: This endpoint must use raw body parsing, not JSON
 * The signature verification requires the raw request body
 */
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];

    if (!sig) {
      console.error('[Webhook] Missing stripe-signature header');
      return res.status(400).json({
        success: false,
        error: 'missing_signature',
        message: 'Missing Stripe signature header',
      });
    }

    try {
      // Get webhook secret from tenant configuration
      // For now, we'll use environment variable, but in production
      // you'd look up the tenant's webhook secret from the database
      const webhookSecret = unifiedConfig.stripeWebhookSecret;

      if (!webhookSecret) {
        console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
        return res.status(500).json({
          success: false,
          error: 'webhook_not_configured',
          message: 'Webhook secret not configured',
        });
      }

      // Verify webhook signature
      const stripe = new Stripe(unifiedConfig.stripeSecretKey, {
        apiVersion: '2026-06-24.dahlia',
      });

      const event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        webhookSecret
      );

      console.log(`[Webhook] Received event: ${event.type} (${event.id})`);

      // Log webhook event to database for audit trail
      try {
        await prisma.webhook_events.create({
          data: {
            id: `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            event_type: event.type,
            event_id: event.id,
            payload: event as any,
            processed: false,
            created_at: new Date(),
          },
        });
      } catch (error: any) {
        // Handle duplicate event_id gracefully
        if (error.code === 'P2002') {
          console.log(`[Webhook] Event ${event.id} already exists, skipping`);
        } else {
          throw error;
        }
      }

      // Process the event asynchronously
      // In production, you might want to use a queue system
      setImmediate(async () => {
        try {
          await StripeWebhookHandler.handleEvent(event);
          
          // Mark as processed
          await prisma.webhook_events.update({
            where: { event_id: event.id },
            data: {
              processed: true,
              processed_at: new Date(),
            },
          });
        } catch (error) {
          console.error('[Webhook] Error processing event:', error);
          
          // Mark as failed
          await prisma.webhook_events.update({
            where: { event_id: event.id },
            data: {
              processed: false,
              error_message: error instanceof Error ? error.message : 'Unknown error',
              processed_at: new Date(),
            },
          });
        }
      });

      // Return 200 immediately to acknowledge receipt
      return res.status(200).json({
        success: true,
        received: true,
        eventId: event.id,
        eventType: event.type,
      });

    } catch (error: any) {
      console.error('[Webhook] Error verifying signature:', error);
      
      return res.status(400).json({
        success: false,
        error: 'signature_verification_failed',
        message: error.message || 'Webhook signature verification failed',
      });
    }
  }
);

/**
 * PayPal Webhook Endpoint
 * Handles PayPal subscription lifecycle events
 * 
 * Key Events:
 * - PAYMENT.SALE.COMPLETED - Recurring payment succeeded
 * - PAYMENT.SALE.DENIED - Payment failed
 * - BILLING.SUBSCRIPTION.ACTIVATED - Subscription activated
 * - BILLING.SUBSCRIPTION.CANCELLED - Subscription cancelled
 * - BILLING.SUBSCRIPTION.SUSPENDED - Subscription suspended
 * - BILLING.SUBSCRIPTION.EXPIRED - Subscription expired
 */
router.post('/paypal', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const authAlgo = req.headers['paypal-auth-algo'] as string;
  const certUrl = req.headers['paypal-cert-url'] as string;
  const transmissionId = req.headers['paypal-transmission-id'] as string;
  const transmissionSig = req.headers['paypal-transmission-sig'] as string;
  const transmissionTime = req.headers['paypal-transmission-time'] as string;
  const webhookId = unifiedConfig.paypalWebhookId;

  if (!transmissionId || !transmissionSig || !certUrl) {
    console.error('[PayPal Webhook] Missing required headers');
    return res.status(400).json({
      success: false,
      error: 'missing_headers',
      message: 'Missing PayPal webhook verification headers',
    });
  }

  try {
    // Verify webhook signature
    const crypto = await import('crypto');
    
    // Fetch PayPal's certificate
    const certResponse = await fetch(certUrl);
    if (!certResponse.ok) {
      console.error('[PayPal Webhook] Failed to fetch certificate');
      return res.status(400).json({
        success: false,
        error: 'cert_fetch_failed',
        message: 'Failed to fetch PayPal certificate',
      });
    }
    
    const certPem = await certResponse.text();
    
    // Create verification data: transmissionId|transmissionTime|webhookId|crc32(body)
    const body = req.body.toString();
    const expectedSignature = `${transmissionId}|${transmissionTime}|${webhookId}|${crypto.createHash('crc32').update(body).digest('hex')}`;
    
    // Verify signature using PayPal's public key
    const verifier = crypto.createVerify('SHA256');
    verifier.update(expectedSignature);
    verifier.end();
    
    // Extract public key from certificate
    const certMatch = certPem.match(/-----BEGIN CERTIFICATE-----[\s\S]*-----END CERTIFICATE-----/);
    if (!certMatch) {
      console.error('[PayPal Webhook] Invalid certificate format');
      return res.status(400).json({
        success: false,
        error: 'invalid_cert',
        message: 'Invalid PayPal certificate format',
      });
    }
    
    // Decode certificate to get public key
    const cert = new crypto.X509Certificate(certMatch[0]);
    const publicKey = cert.publicKey;
    
    const isValid = verifier.verify(publicKey, transmissionSig, 'base64');
    
    if (!isValid) {
      console.error('[PayPal Webhook] Signature verification failed');
      return res.status(400).json({
        success: false,
        error: 'invalid_signature',
        message: 'PayPal webhook signature verification failed',
      });
    }
    
    console.log('[PayPal Webhook] Signature verified successfully');

    // Parse the webhook body
    const parsedBody = JSON.parse(body);
    const eventType = parsedBody.event_type;
    const resourceId = parsedBody.resource?.id;

    console.log(`[PayPal Webhook] Received event: ${eventType} (${parsedBody.id})`);

    // Log webhook event to database
    try {
      await prisma.webhook_events.create({
        data: {
          id: `wh_pp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          event_type: eventType,
          event_id: parsedBody.id,
          payload: parsedBody as any,
          processed: false,
          created_at: new Date(),
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        console.log(`[PayPal Webhook] Event ${parsedBody.id} already exists, skipping`);
        return res.status(200).json({ received: true, duplicate: true });
      }
    }

    // Process event asynchronously
    setImmediate(async () => {
      try {
        await handlePayPalWebhookEvent(parsedBody);
        
        await prisma.webhook_events.update({
          where: { event_id: parsedBody.id },
          data: {
            processed: true,
            processed_at: new Date(),
          },
        });
      } catch (error) {
        console.error('[PayPal Webhook] Error processing event:', error);
        
        await prisma.webhook_events.update({
          where: { event_id: parsedBody.id },
          data: {
            processed: false,
            error_message: error instanceof Error ? error.message : 'Unknown error',
            processed_at: new Date(),
          },
        });
      }
    });

    return res.status(200).json({
      success: true,
      received: true,
      eventId: body.id,
      eventType,
    });

  } catch (error: any) {
    console.error('[PayPal Webhook] Error processing webhook:', error);
    return res.status(400).json({
      success: false,
      error: 'processing_failed',
      message: error.message || 'PayPal webhook processing failed',
    });
  }
});

/**
 * Handle PayPal webhook events
 */
async function handlePayPalWebhookEvent(event: any) {
  const { event_type, resource } = event;

  switch (event_type) {
    case 'PAYMENT.SALE.COMPLETED':
      await handlePayPalPaymentCompleted(resource);
      break;

    case 'PAYMENT.SALE.DENIED':
    case 'PAYMENT.SALE.REFUNDED':
    case 'PAYMENT.SALE.REVERSED':
      await handlePayPalPaymentFailed(resource);
      break;

    case 'BILLING.SUBSCRIPTION.ACTIVATED':
      await handlePayPalSubscriptionActivated(resource);
      break;

    case 'BILLING.SUBSCRIPTION.CANCELLED':
    case 'BILLING.SUBSCRIPTION.EXPIRED':
      await handlePayPalSubscriptionCancelled(resource);
      break;

    case 'BILLING.SUBSCRIPTION.SUSPENDED':
      await handlePayPalSubscriptionSuspended(resource);
      break;

    default:
      console.log(`[PayPal Webhook] Unhandled event type: ${event_type}`);
  }
}

/**
 * Handle successful PayPal subscription payment
 */
async function handlePayPalPaymentCompleted(resource: any) {
  const subscriptionId = resource.billing_agreement_id || resource.agreement_id;
  
  if (!subscriptionId) {
    console.log('[PayPal Webhook] No subscription ID in payment resource');
    return;
  }

  // Find tenant by PayPal subscription ID
  const tenant = await prisma.tenants.findFirst({
    where: {
      metadata: {
        path: ['paypalSubscriptionId'],
        equals: subscriptionId,
      },
    },
  });

  if (!tenant) {
    console.error(`[PayPal Webhook] No tenant found for PayPal subscription ${subscriptionId}`);
    return;
  }

  // Parse custom_id for tier info
  let tier = tenant?.subscription_tier;
  let amountCents = 0;
  
  try {
    const customId = JSON.parse(resource.custom_id || '{}');
    tier = tier||customId.tier||'discovery';
    amountCents = Math.round(parseFloat(resource.amount.total) * 100);
  } catch {
    // Use existing tier
  }

  // Create invoice record
  const { getSubscriptionBillingService } = await import('../services/subscription/SubscriptionBillingService');
  const billingService = getSubscriptionBillingService();
  
  await billingService.createInvoice(
    tenant.id,
    tier || 'discovery',
    amountCents,
    resource.id || `pp_${Date.now()}`
  );

  // Update tenant status to active
  await prisma.tenants.update({
    where: { id: tenant.id },
    data: {
      subscription_status: 'active',
      status_changed_at: new Date(),
      billing_cycle_start: new Date(),
      billing_cycle_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
  });

  // Send payment success email
  try {
    const { getBillingNotificationService } = await import('../services/subscription/BillingNotificationService');
    await getBillingNotificationService().sendNotification({
      tenantId: tenant.id,
      type: 'payment_success',
      tier: tier || tenant.subscription_tier || 'discovery',
      amount: amountCents,
    });
  } catch (emailError) {
    console.error('[PayPal Webhook] Failed to send payment success email:', emailError);
  }

  console.log(`[PayPal Webhook] Payment completed for tenant ${tenant.id}`);
}

/**
 * Handle failed PayPal subscription payment
 */
async function handlePayPalPaymentFailed(resource: any) {
  const subscriptionId = resource.billing_agreement_id || resource.agreement_id;

  if (!subscriptionId) return;

  const tenant = await prisma.tenants.findFirst({
    where: {
      metadata: {
        path: ['paypalSubscriptionId'],
        equals: subscriptionId,
      },
    },
  });

  if (!tenant) return;

  // Set to past_due
  await prisma.tenants.update({
    where: { id: tenant.id },
    data: {
      subscription_status: 'past_due',
      status_changed_at: new Date(),
    },
  });

  // Send payment failed email
  try {
    const { getBillingNotificationService } = await import('../services/subscription/BillingNotificationService');
    await getBillingNotificationService().sendNotification({
      tenantId: tenant.id,
      type: 'payment_failed',
      tier: tenant.subscription_tier ?? undefined,
      reason: 'PayPal payment failed',
    });
  } catch (emailError) {
    console.error('[PayPal Webhook] Failed to send payment failed email:', emailError);
  }

  console.log(`[PayPal Webhook] Payment failed for tenant ${tenant.id}`);
}

/**
 * Handle PayPal subscription activation
 */
async function handlePayPalSubscriptionActivated(resource: any) {
  const subscriptionId = resource.id;
  const customId = JSON.parse(resource.custom_id || '{}');
  const tenantId = customId.tenantId;

  if (!tenantId) {
    console.error('[PayPal Webhook] No tenantId in subscription custom_id');
    return;
  }

  // Update tenant with PayPal subscription ID
  await prisma.tenants.update({
    where: { id: tenantId },
    data: {
      subscription_status: 'active',
      subscription_tier: customId.tier,
      status_changed_at: new Date(),
      metadata: {
        ...((await prisma.tenants.findUnique({ where: { id: tenantId } }))?.metadata as any),
        paypalSubscriptionId: subscriptionId,
      },
    },
  });

  console.log(`[PayPal Webhook] Subscription activated for tenant ${tenantId}`);
}

/**
 * Handle PayPal subscription cancellation
 */
async function handlePayPalSubscriptionCancelled(resource: any) {
  const subscriptionId = resource.id;

  const tenant = await prisma.tenants.findFirst({
    where: {
      metadata: {
        path: ['paypalSubscriptionId'],
        equals: subscriptionId,
      },
    },
  });

  if (!tenant) return;

  await prisma.tenants.update({
    where: { id: tenant.id },
    data: {
      subscription_status: 'canceled',
      status_changed_at: new Date(),
    },
  });

  // Send subscription canceled email
  try {
    const { getBillingNotificationService } = await import('../services/subscription/BillingNotificationService');
    await getBillingNotificationService().sendNotification({
      tenantId: tenant.id,
      type: 'subscription_canceled',
      tier: tenant.subscription_tier ?? undefined,
      reason: 'Subscription cancelled via PayPal',
    });
  } catch (emailError) {
    console.error('[PayPal Webhook] Failed to send cancellation email:', emailError);
  }

  console.log(`[PayPal Webhook] Subscription cancelled for tenant ${tenant.id}`);
}

/**
 * Handle PayPal subscription suspension
 */
async function handlePayPalSubscriptionSuspended(resource: any) {
  const subscriptionId = resource.id;

  const tenant = await prisma.tenants.findFirst({
    where: {
      metadata: {
        path: ['paypalSubscriptionId'],
        equals: subscriptionId,
      },
    },
  });

  if (!tenant) return;

  await prisma.tenants.update({
    where: { id: tenant.id },
    data: {
      subscription_status: 'past_due',
      status_changed_at: new Date(),
    },
  });

  console.log(`[PayPal Webhook] Subscription suspended for tenant ${tenant.id}`);
}

/**
 * Webhook Health Check
 */
router.get('/health', async (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    status: 'healthy',
    webhooks: {
      stripe: 'active',
      paypal: 'active',
    },
  });
});

/**
 * Get Webhook Events (for debugging/monitoring)
 * Requires authentication
 */
router.get('/events', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const events = await prisma.$queryRaw`
      SELECT 
        id,
        event_type,
        event_id,
        processed,
        error_message,
        created_at,
        processed_at
      FROM webhook_events
      ORDER BY created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    return res.status(200).json({
      success: true,
      events,
      pagination: {
        limit,
        offset,
      },
    });
  } catch (error) {
    console.error('[Webhook] Error fetching events:', error);
    return res.status(500).json({
      success: false,
      error: 'fetch_failed',
      message: 'Failed to fetch webhook events',
    });
  }
});

export default router;
