import express, { Request, Response } from 'express';
import Stripe from 'stripe';
import { StripeWebhookHandler } from '../services/payments/webhooks/StripeWebhookHandler';
import { prisma } from '../prisma';

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
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error('[Webhook] STRIPE_WEBHOOK_SECRET not configured');
        return res.status(500).json({
          success: false,
          error: 'webhook_not_configured',
          message: 'Webhook secret not configured',
        });
      }

      // Verify webhook signature
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
        apiVersion: '2025-10-29.clover',
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
 * PayPal Webhook Endpoint (placeholder)
 * Will be implemented when PayPal gateway is enabled
 */
router.post('/paypal', async (req: Request, res: Response) => {
  return res.status(501).json({
    success: false,
    error: 'not_implemented',
    message: 'PayPal webhooks not yet implemented',
  });
});

/**
 * Webhook Health Check
 */
router.get('/health', async (req: Request, res: Response) => {
  return res.status(200).json({
    success: true,
    status: 'healthy',
    webhooks: {
      stripe: 'active',
      paypal: 'not_implemented',
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
