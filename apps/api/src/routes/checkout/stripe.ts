import { Router } from 'express';
import { prisma } from '../../prisma';
import { stripeConnectService } from '../../services/payments/StripeConnectService';
import { PostPaymentFulfillment } from '../../services/PostPaymentFulfillment';
import { redeemOrderCoupon } from '../../services/PostPaymentCouponRedemption';
import FunnelEngine from '../../services/FunnelEngine';
import { logger } from '../../logger';

const router = Router();

/**
 * POST /api/checkout/stripe/create-payment-intent
 * Create a Stripe payment intent with platform fee
 */
router.post('/create-payment-intent', async (req, res) => {
  try {
    const { orderId, paymentId, amount, customerInfo, cartItems } = req.body;

    // Validate required fields
    if (!orderId || !paymentId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'orderId, paymentId, and amount are required'
      });
    }

    // Get the order to find tenant_id
    const payment = await prisma.payments.findUnique({
      where: { id: paymentId },
      include: { orders: true },
    });

    if (!payment?.orders) {
      return res.status(404).json({
        error: 'Payment not found',
        message: 'Payment record not found'
      });
    }

    const tenantId = payment.orders.tenant_id;

    // Create payment intent with platform fee
    const result = await stripeConnectService.createPaymentIntentWithFee(
      tenantId,
      amount,
      'usd',
      {
        order_id: orderId,
        payment_id: paymentId,
        customer_email: customerInfo?.email || '',
      }
    );

    if (!result.success) {
      return res.status(400).json({
        error: 'payment_intent_failed',
        message: result.error || 'Failed to create payment intent'
      });
    }

    // Update payment record with Stripe payment intent ID
    await prisma.payments.update({
      where: { id: paymentId },
      data: {
        gateway_transaction_id: result.paymentIntentId,
        payment_method: 'credit_card',
        payment_status: 'pending',
        platform_fee_cents: result.platformFeeCents,
        updated_at: new Date(),
      },
    });

    res.json({
      success: true,
      clientSecret: result.clientSecret,
      paymentIntentId: result.paymentIntentId,
      platformFee: result.platformFeeCents,
    });
  } catch (error) {
    logger.error('[Stripe] Create payment intent error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      error: 'Failed to create payment intent',
      message: 'An error occurred while setting up your payment. Please try again.',
    });
  }
});

/**
 * POST /api/checkout/stripe/confirm-payment
 * Confirm a successful Stripe payment
 */
router.post('/confirm-payment', async (req, res) => {
  try {
    const { paymentIntentId, paymentId, clientSecret } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'paymentIntentId is required'
      });
    }

    // Find payment by paymentId or by gateway_transaction_id (paymentIntentId)
    let payment;
    if (paymentId) {
      payment = await prisma.payments.findUnique({
        where: { id: paymentId },
        include: { orders: true },
      });
    } else {
      // Find by Stripe payment intent ID
      payment = await prisma.payments.findFirst({
        where: { gateway_transaction_id: paymentIntentId },
        include: { orders: true },
      });
    }

    if (!payment?.orders) {
      return res.status(404).json({
        error: 'Payment not found',
        message: 'Payment record not found'
      });
    }

    // Update payment status
    await prisma.payments.update({
      where: { id: payment.id },
      data: {
        payment_status: 'paid',
        captured_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Decrement stock and fulfill digital products via shared coordinator
    await PostPaymentFulfillment.run(payment.orders.id);

    // Record platform revenue transaction
    if (payment.platform_fee_cents && payment.platform_fee_cents > 0) {
      try {
        await stripeConnectService.recordRevenueTransaction({
          tenantId: payment.orders.tenant_id,
          orderId: payment.orders.id,
          paymentId: payment.id,
          transactionType: 'transaction_fee',
          grossAmountCents: payment.amount_cents,
          platformFeeCents: payment.platform_fee_cents,
          gatewayFeeCents: payment.gateway_fee_cents || 0,
          netAmountCents: payment.net_amount_cents || (payment.amount_cents - payment.platform_fee_cents - (payment.gateway_fee_cents || 0)),
          stripeTransactionId: paymentIntentId,
        });
        console.log('[Stripe] Recorded revenue transaction:', payment.platform_fee_cents, 'cents');
      } catch (revenueError) {
        logger.error('[Stripe] Failed to record revenue transaction:', undefined, { error: { name: (revenueError as any)?.name || 'Error', message: (revenueError as any)?.message || String(revenueError), stack: (revenueError as any)?.stack } });
        // Don't fail the confirmation if revenue recording fails
      }
    }

    // Update order status
    await prisma.orders.update({
      where: { id: payment.orders.id },
      data: {
        order_status: 'paid',
        paid_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Record coupon redemption after successful payment
    await redeemOrderCoupon(payment.orders.id);

    // Retrieve PaymentIntent from Stripe to get PaymentMethod details for saved payment methods
    let paymentMethodId: string | undefined;
    let cardLast4: string | undefined;
    let cardBrand: string | undefined;
    let expiryMonth: number | undefined;
    let expiryYear: number | undefined;
    try {
      const stripe = await stripeConnectService['getStripeClient']();
      if (stripe) {
        const retrievedPI = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (retrievedPI.payment_method && typeof retrievedPI.payment_method === 'string') {
          paymentMethodId = retrievedPI.payment_method;
          const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
          if (pm.card) {
            cardLast4 = pm.card.last4 ?? undefined;
            cardBrand = pm.card.brand ?? undefined;
            expiryMonth = pm.card.exp_month ?? undefined;
            expiryYear = pm.card.exp_year ?? undefined;
          }
        }
      }
    } catch (stripeError) {
      logger.error('[Stripe] Failed to retrieve PaymentIntent for saved payment method:', undefined, { error: { name: (stripeError as any)?.name || 'Error', message: (stripeError as any)?.message || String(stripeError), stack: (stripeError as any)?.stack } });
      // Don't fail the confirmation if we can't retrieve card details
    }

    // Determine whether a post-payment funnel upsell should be shown
    let funnelNextStep = null;
    try {
      funnelNextStep = await FunnelEngine.getInstance().getNextStepForOrder(
        payment.orders.tenant_id,
        payment.orders.id
      );
    } catch (funnelError) {
      logger.error('[Stripe] Failed to resolve funnel next step:', undefined, { error: { name: (funnelError as any)?.name || 'Error', message: (funnelError as any)?.message || String(funnelError), stack: (funnelError as any)?.stack } });
      // Non-fatal: continue without funnel redirect
    }

    res.json({
      success: true,
      orderId: payment.orders.id,
      paymentMethodId,
      cardLast4,
      cardBrand,
      expiryMonth,
      expiryYear,
      funnelNextStep,
    });
  } catch (error) {
    logger.error('[Stripe] Confirm payment error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    res.status(500).json({
      error: 'Failed to confirm payment',
      message: 'An error occurred while confirming your payment. Please try again.',
    });
  }
});

export default router;
