/**
 * Stripe Connect Webhooks
 * 
 * Handles webhook events from Stripe for:
 * - Account updates (onboarding status, requirements)
 * - Payment events (successful charges, transfers)
 * - Payout events
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { prisma } from '../prisma';

const router = Router();

// Webhook secret for signature verification (from Doppler)
const getWebhookSecret = (): string | null => {
  return process.env.STRIPE_WEBHOOK_SECRET || null;
};

// Get Stripe client (from Doppler)
const getStripeClient = (): Stripe | null => {
  const secretKey = process.env.STRIPE_PLATFORM_SECRET_KEY;
  if (!secretKey) {
    return null;
  }

  return new Stripe(secretKey, {
    apiVersion: '2026-06-24.dahlia',
  });
};

/**
 * POST /api/webhooks/stripe-connect
 * Handle Stripe Connect webhook events
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const sig = req.headers['stripe-signature'] as string;
    const webhookSecret = getWebhookSecret();

    if (!webhookSecret) {
      console.error('[StripeWebhook] No webhook secret configured');
      return res.status(400).send('Webhook secret not configured');
    }

    const stripe = getStripeClient();
    if (!stripe) {
      console.error('[StripeWebhook] Stripe not configured');
      return res.status(400).send('Stripe not configured');
    }

    // Verify webhook signature
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err: any) {
      console.error('[StripeWebhook] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`[StripeWebhook] Received event: ${event.type}`);

    // Handle different event types
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(event.data.object as Stripe.Account);
        break;

      case 'account.application.deauthorized':
        await handleAccountDeauthorized(event.data.object as unknown as Stripe.Account);
        break;

      case 'charge.succeeded':
        await handleChargeSucceeded(event.data.object as Stripe.Charge);
        break;

      case 'transfer.created':
        await handleTransferCreated(event.data.object as Stripe.Transfer);
        break;

      case 'payout.created':
        await handlePayoutCreated(event.data.object as Stripe.Payout);
        break;

      case 'payout.failed':
        await handlePayoutFailed(event.data.object as Stripe.Payout);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object as Stripe.Dispute);
        break;

      case 'charge.dispute.closed':
        await handleDisputeClosed(event.data.object as Stripe.Dispute);
        break;

      default:
        console.log(`[StripeWebhook] Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error: any) {
    console.error('[StripeWebhook] Error processing webhook:', error);
    res.status(500).send('Webhook processing failed');
  }
});

/**
 * Handle account.updated event
 * Updates merchant connection status when Stripe account changes
 */
async function handleAccountUpdated(account: Stripe.Account) {
  try {
    const tenantId = account.metadata?.tenant_id;
    if (!tenantId) {
      console.log('[StripeWebhook] Account update without tenant_id metadata');
      return;
    }

    const connection = await prisma.merchant_stripe_connections.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!connection) {
      console.log(`[StripeWebhook] No connection found for tenant: ${tenantId}`);
      return;
    }

    // Determine onboarding status
    let onboardingStatus = connection.onboarding_status;
    if (account.charges_enabled && account.payouts_enabled) {
      onboardingStatus = 'completed';
    } else if (account.requirements?.currently_due?.length) {
      onboardingStatus = 'in_progress';
    }

    await prisma.merchant_stripe_connections.update({
      where: { tenant_id: tenantId },
      data: {
        stripe_account_status: account.charges_enabled ? 'enabled' : 
                               account.payouts_enabled ? 'restricted' : 'pending',
        stripe_payouts_enabled: account.payouts_enabled,
        stripe_payments_enabled: account.charges_enabled,
        stripe_requirements: account.requirements?.currently_due || [],
        onboarding_status: onboardingStatus,
        onboarding_completed_at: onboardingStatus === 'completed' && connection.onboarding_status !== 'completed'
          ? new Date()
          : connection.onboarding_completed_at,
      },
    });

    // Send admin notification for onboarding status changes
    try {
      const { getAdminEmailService } = await import('../services/email/AdminEmailService');
      const adminEmailService = getAdminEmailService();
      
      // Get tenant info
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      
      // Get owner email
      const owner = await prisma.user_tenants.findFirst({
        where: { tenant_id: tenantId, role: 'OWNER' },
        include: { users: { select: { email: true } } },
      });

      if (onboardingStatus === 'completed' && connection.onboarding_status !== 'completed') {
        // Onboarding just completed
        await adminEmailService.sendMerchantOnboardingComplete({
          tenantId,
          tenantName: tenant?.name || 'Unknown',
          ownerEmail: owner?.users?.email || 'Unknown',
          stripeAccountId: account.id,
        });
      } else if (account.requirements?.currently_due?.length && connection.onboarding_status !== 'in_progress') {
        // Now requires action
        await adminEmailService.sendMerchantOnboardingRequiresAction({
          tenantId,
          tenantName: tenant?.name || 'Unknown',
          ownerEmail: owner?.users?.email || 'Unknown',
          requirements: account.requirements.currently_due,
          gateway: 'stripe',
        });
      }
    } catch (emailError) {
      console.error('[StripeWebhook] Failed to send admin notification:', emailError);
    }

    console.log(`[StripeWebhook] Updated account status for tenant: ${tenantId}`);
  } catch (error) {
    console.error('[StripeWebhook] Error handling account.updated:', error);
    throw error;
  }
}

/**
 * Handle account.application.deauthorized event
 * Merchant revoked platform's access
 */
async function handleAccountDeauthorized(account: Stripe.Account) {
  try {
    const connection = await prisma.merchant_stripe_connections.findFirst({
      where: { stripe_account_id: account.id },
    });

    if (!connection) {
      return;
    }

    await prisma.merchant_stripe_connections.update({
      where: { id: connection.id },
      data: {
        onboarding_status: 'rejected',
        stripe_account_status: 'restricted',
        stripe_payouts_enabled: false,
        stripe_payments_enabled: false,
      },
    });

    console.log(`[StripeWebhook] Account deauthorized for tenant: ${connection.tenant_id}`);
  } catch (error) {
    console.error('[StripeWebhook] Error handling account.application.deauthorized:', error);
    throw error;
  }
}

/**
 * Handle charge.succeeded event
 * Record platform revenue from successful charges
 */
async function handleChargeSucceeded(charge: Stripe.Charge) {
  try {
    // Only process charges with application fee (Stripe Connect)
    if (!charge.application_fee_amount) {
      return;
    }

    const tenantId = charge.metadata?.tenant_id;
    if (!tenantId) {
      return;
    }

    // Check if transaction already recorded
    const existing = await prisma.platform_revenue_transactions.findUnique({
      where: { stripe_transaction_id: charge.id },
    });

    if (existing) {
      return; // Already recorded
    }

    // Record the revenue transaction
    await prisma.platform_revenue_transactions.create({
      data: {
        id: `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tenant_id: tenantId,
        order_id: charge.metadata?.order_id,
        payment_id: charge.metadata?.payment_id,
        transaction_type: 'transaction_fee',
        gross_amount_cents: charge.amount,
        platform_fee_cents: charge.application_fee_amount,
        gateway_fee_cents: 0, // Would need to calculate from balance transaction
        net_amount_cents: charge.amount - charge.application_fee_amount,
        stripe_transaction_id: charge.id,
        stripe_transfer_id: charge.transfer?.toString(),
        status: 'completed',
        processed_at: new Date(),
      },
    });

    console.log(`[StripeWebhook] Recorded revenue for charge: ${charge.id}`);
  } catch (error) {
    console.error('[StripeWebhook] Error handling charge.succeeded:', error);
    throw error;
  }
}

/**
 * Handle transfer.created event
 * Track transfers to connected accounts
 */
async function handleTransferCreated(transfer: Stripe.Transfer) {
  try {
    // Update existing transaction with transfer ID
    const transaction = await prisma.platform_revenue_transactions.findFirst({
      where: {
        stripe_transaction_id: transfer.source_transaction?.toString(),
      },
    });

    if (transaction) {
      await prisma.platform_revenue_transactions.update({
        where: { id: transaction.id },
        data: {
          stripe_transfer_id: transfer.id,
        },
      });
    }

    console.log(`[StripeWebhook] Transfer created: ${transfer.id}`);
  } catch (error) {
    console.error('[StripeWebhook] Error handling transfer.created:', error);
    throw error;
  }
}

/**
 * Handle payout.created event
 * Send email notification to merchant
 */
async function handlePayoutCreated(payout: Stripe.Payout) {
  try {
    console.log(`[StripeWebhook] Payout created: ${payout.id} for ${payout.amount}`);
    
    // Get Stripe account ID from payout (connected account)
    const stripeAccountId = (payout as any).account as string;
    
    if (!stripeAccountId) {
      console.log('[StripeWebhook] No account ID in payout event');
      return;
    }
    
    // Get merchant email from Stripe account ID
    const { getMerchantPayoutEmailService } = await import('../services/email/MerchantPayoutEmailService');
    const payoutEmailService = getMerchantPayoutEmailService();
    
    const merchant = await payoutEmailService.getMerchantEmailFromStripeAccount(stripeAccountId);
    
    if (merchant) {
      await payoutEmailService.sendPayoutNotification('payout_sent', {
        merchantEmail: merchant.email,
        merchantName: merchant.name,
        tenantName: merchant.tenantName,
        payoutId: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        estimatedArrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : undefined,
        bankAccountLast4: (payout as any).bank_account?.last4,
      });
    } else {
      console.log(`[StripeWebhook] No merchant found for Stripe account ${stripeAccountId}`);
    }
  } catch (error) {
    console.error('[StripeWebhook] Error handling payout.created:', error);
    throw error;
  }
}

/**
 * Handle payout.failed event
 * Send email notification to merchant about failure
 */
async function handlePayoutFailed(payout: Stripe.Payout) {
  try {
    console.log(`[StripeWebhook] Payout failed: ${payout.id}`);
    
    // Update any related transactions
    await prisma.platform_revenue_transactions.updateMany({
      where: { stripe_payout_id: payout.id },
      data: {
        status: 'failed',
        failed_at: new Date(),
        failure_reason: payout.failure_message,
      },
    });
    
    // Get Stripe account ID from payout (connected account)
    const stripeAccountId = (payout as any).account as string;
    
    if (!stripeAccountId) {
      console.log('[StripeWebhook] No account ID in payout event');
      return;
    }
    
    // Get merchant email from Stripe account ID
    const { getMerchantPayoutEmailService } = await import('../services/email/MerchantPayoutEmailService');
    const payoutEmailService = getMerchantPayoutEmailService();
    
    const merchant = await payoutEmailService.getMerchantEmailFromStripeAccount(stripeAccountId);
    
    if (merchant) {
      await payoutEmailService.sendPayoutNotification('payout_failed', {
        merchantEmail: merchant.email,
        merchantName: merchant.name,
        tenantName: merchant.tenantName,
        payoutId: payout.id,
        amount: payout.amount,
        currency: payout.currency,
        failureReason: payout.failure_message ?? payout.failure_code ?? undefined,
      });
    } else {
      console.log(`[StripeWebhook] No merchant found for Stripe account ${stripeAccountId}`);
    }
  } catch (error) {
    console.error('[StripeWebhook] Error handling payout.failed:', error);
    throw error;
  }
}

/**
 * Handle charge.refunded event
 * Reverse platform fee when a charge is refunded
 */
async function handleChargeRefunded(charge: Stripe.Charge) {
  try {
    console.log(`[StripeWebhook] Charge refunded: ${charge.id}`);
    
    // Only process if this was a Connect charge with application fee
    if (!charge.application_fee || !charge.refunded) {
      return;
    }

    const refundAmountCents = charge.amount_refunded;
    
    // Import service and reverse the fee
    const { StripeConnectService } = await import('../services/payments/StripeConnectService');
    const stripeConnectService = new StripeConnectService();
    
    const result = await stripeConnectService.reversePlatformFee(
      charge.id,
      'refund',
      refundAmountCents
    );

    if (result.success) {
      console.log(`[StripeWebhook] Reversed platform fee: ${result.reversedFeeCents} cents for charge ${charge.id}`);
    } else {
      console.error(`[StripeWebhook] Failed to reverse fee: ${result.error}`);
    }
  } catch (error) {
    console.error('[StripeWebhook] Error handling charge.refunded:', error);
    throw error;
  }
}

/**
 * Handle charge.dispute.created event
 * Track dispute and potentially reverse fee
 */
async function handleDisputeCreated(dispute: Stripe.Dispute) {
  try {
    console.log(`[StripeWebhook] Dispute created: ${dispute.id} for charge ${dispute.charge}`);
    
    // Record the dispute in metadata
    const transaction = await prisma.platform_revenue_transactions.findFirst({
      where: {
        stripe_transaction_id: dispute.charge as string,
      },
    });

    if (transaction) {
      await prisma.platform_revenue_transactions.update({
        where: { id: transaction.id },
        data: {
          metadata: {
            ...(transaction.metadata as object || {}),
            dispute_id: dispute.id,
            dispute_status: dispute.status,
            dispute_reason: dispute.reason,
          } as any,
        },
      });
    }
  } catch (error) {
    console.error('[StripeWebhook] Error handling charge.dispute.created:', error);
    throw error;
  }
}

/**
 * Handle charge.dispute.closed event
 * Reverse platform fee if dispute is lost (chargeback)
 */
async function handleDisputeClosed(dispute: Stripe.Dispute) {
  try {
    console.log(`[StripeWebhook] Dispute closed: ${dispute.id} with status ${dispute.status}`);
    
    // Only reverse fee if dispute was lost (chargeback)
    if (dispute.status !== 'lost') {
      return;
    }

    const { StripeConnectService } = await import('../services/payments/StripeConnectService');
    const stripeConnectService = new StripeConnectService();
    
    const result = await stripeConnectService.reversePlatformFee(
      dispute.charge as string,
      'dispute'
    );

    if (result.success) {
      console.log(`[StripeWebhook] Reversed platform fee due to lost dispute: ${result.reversedFeeCents} cents`);
    }
  } catch (error) {
    console.error('[StripeWebhook] Error handling charge.dispute.closed:', error);
    throw error;
  }
}

export default router;
