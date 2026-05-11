import { Router } from 'express';
import { prisma } from '../../prisma';
import { digitalFulfillmentService } from '../../services/digital-assets';
import { stripeConnectService } from '../../services/payments/StripeConnectService';

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
    console.error('[Stripe] Create payment intent error:', error);
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
    const { paymentIntentId, paymentId } = req.body;

    if (!paymentIntentId || !paymentId) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'paymentIntentId and paymentId are required'
      });
    }

    // Get payment record
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

    // Update payment status
    await prisma.payments.update({
      where: { id: paymentId },
      data: {
        payment_status: 'paid',
        captured_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Decrement stock after successful payment
    try {
      const { getStockService } = await import('../../services/StockService');
      const stockService = getStockService(prisma);
      await stockService.decrementStockForOrder(payment.orders.id);
      console.log(`[Stripe] Stock decremented for order ${payment.orders.id} after payment completion`);
    } catch (stockError) {
      console.error(`[Stripe] Failed to decrement stock for order ${payment.orders.id}:`, stockError);
      // Don't fail the payment processing if stock decrement fails
    }

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
        console.error('[Stripe] Failed to record revenue transaction:', revenueError);
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

    // Reduce inventory stock for each order item
    const orderItems = await prisma.order_items.findMany({
      where: { order_id: payment.orders.id },
    });

    for (const item of orderItems) {
      if (item.variant_id) {
        try {
          await prisma.product_variants.update({
            where: { id: item.variant_id },
            data: {
              stock: { decrement: item.quantity },
              updated_at: new Date(),
            },
          });
          console.log(`[Inventory] Reduced variant stock for ${item.variant_id} by ${item.quantity}`);
        } catch (error) {
          console.error(`[Inventory] Failed to reduce variant stock for ${item.variant_id}:`, error);
        }
      } else if (item.inventory_item_id) {
        try {
          await prisma.inventory_items.update({
            where: { id: item.inventory_item_id },
            data: {
              stock: { decrement: item.quantity },
              updated_at: new Date(),
            },
          });
          console.log(`[Inventory] Reduced stock for item ${item.inventory_item_id} by ${item.quantity}`);
        } catch (error) {
          console.error(`[Inventory] Failed to reduce stock for item ${item.inventory_item_id}:`, error);
        }
      }
    }

    // Fulfill digital products
    try {
      const hasDigital = await digitalFulfillmentService.hasDigitalProducts(payment.orders.id);
      if (hasDigital) {
        console.log('[Stripe] Order contains digital products, fulfilling...');
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
        const fulfillmentResult = await digitalFulfillmentService.fulfillOrder(
          payment.orders.id,
          baseUrl
        );
        console.log('[Stripe] Digital fulfillment result:', {
          success: fulfillmentResult.success,
          grants: fulfillmentResult.accessGrants.length,
          errors: fulfillmentResult.errors.length,
        });
      }
    } catch (error) {
      console.error('[Stripe] Digital fulfillment failed:', error);
      // Don't fail the payment if digital fulfillment fails - can retry later
    }

    res.json({
      success: true,
      orderId: payment.orders.id,
    });
  } catch (error) {
    console.error('[Stripe] Confirm payment error:', error);
    res.status(500).json({
      error: 'Failed to confirm payment',
      message: 'An error occurred while confirming your payment. Please try again.',
    });
  }
});

export default router;
