/**
 * Guest Payment API Routes
 * For testing payment processing without authentication
 */

import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { StripeGateway } from '../services/payments/gateways/StripeGateway';
import { generatePaymentId } from '../lib/id-generator';

const router = Router();

/**
 * POST /api/checkout/payments/charge
 * Process payment without authentication (guest checkout)
 */
router.post('/payments/charge', async (req: Request, res: Response) => {
  try {
    const { orderId, paymentMethod, gatewayType = 'stripe' } = req.body;

    // Validation
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'order_id_required',
        message: 'Order ID is required',
      });
    }

    if (!paymentMethod?.type) {
      return res.status(400).json({
        success: false,
        error: 'payment_method_required',
        message: 'Payment method is required',
      });
    }

    // Verify order exists
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'order_not_found',
        message: 'Order not found',
      });
    }

    // Initialize Stripe directly for PaymentIntent creation
    const Stripe = require('stripe');
    console.log('STRIPE_SECRET_KEY loaded:', !!process.env.STRIPE_SECRET_KEY);
    console.log('STRIPE_SECRET_KEY length:', process.env.STRIPE_SECRET_KEY?.length || 0);
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      // Let Stripe use default API version to avoid conflicts
    });

    // Create PaymentIntent (not confirmed yet - frontend will confirm with Elements)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: order.total_cents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        order_id: orderId,
        order_number: order.order_number,
        customer_email: order.customer_email,
        tenant_id: order.tenant_id,
      },
    });

    console.log('PaymentIntent created:', {
      id: paymentIntent.id,
      client_secret: paymentIntent.client_secret ? paymentIntent.client_secret.substring(0, 10) + '...' : 'null',
      status: paymentIntent.status,
      amount: paymentIntent.amount,
    });

    // Create payment record
    const payment = await prisma.payments.create({
      data: {
        id: generatePaymentId(),
        tenant_id: order.tenant_id,
        order_id: orderId,
        gateway_type: gatewayType,
        payment_method: paymentMethod.type === 'card' ? 'credit_card' : paymentMethod.type,
        amount_cents: order.total_cents,
        platform_fee_cents: Math.round(order.total_cents * 0.03), // 3% platform fee
        gateway_fee_cents: 0, // Will be updated by webhook
        net_amount_cents: order.total_cents,
        payment_status: 'pending',
        gateway_transaction_id: paymentIntent.id,
        gateway_response: paymentIntent,
        updated_at: new Date(),
      },
    });

    const responseData = {
      success: true,
      payment: {
        id: payment.id,
        status: payment.payment_status,
        amount_cents: payment.amount_cents,
        gateway_transaction_id: payment.gateway_transaction_id,
      },
      clientSecret: paymentIntent.client_secret,
    };

    console.log('Sending payment response:', {
      success: responseData.success,
      paymentId: responseData.payment.id,
      hasClientSecret: !!responseData.clientSecret,
      clientSecretLength: responseData.clientSecret?.length,
    });

    res.json(responseData);
  } catch (error) {
    console.error('Guest payment processing error:', error);
    res.status(500).json({
      success: false,
      error: 'payment_processing_failed',
      message: 'Failed to process payment',
    });
  }
});

/**
 * GET /api/checkout/payments/:id
 * Get payment details without authentication
 */
router.get('/payments/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const payment = await prisma.payments.findUnique({
      where: { id },
      include: {
        orders: {
          include: {
            order_items: true,
          },
        },
      },
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'payment_not_found',
        message: 'Payment not found',
      });
    }

    res.json({
      success: true,
      payment,
    });
  } catch (error) {
    console.error('Guest payment retrieval error:', error);
    res.status(500).json({
      success: false,
      error: 'payment_retrieval_failed',
      message: 'Failed to retrieve payment',
    });
  }
});

export default router;
