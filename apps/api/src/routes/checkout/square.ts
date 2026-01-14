import { Router } from 'express';
const { Client: SquareClient } = require('square');
import { prisma } from '../../prisma';
import { randomUUID } from 'crypto';

const router = Router();

// Initialize Square client
const getSquareClient = () => {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const environment = process.env.SQUARE_ENVIRONMENT === 'production' 
    ? 'production' 
    : 'sandbox';

  if (!accessToken) {
    throw new Error('Square access token not configured');
  }

  return new SquareClient({
    accessToken,
    environment,
  });
};

// Process Square payment
router.post('/process-payment', async (req, res) => {
  try {
    const { 
      orderId, 
      paymentId, 
      sourceId, 
      amount, 
      customerInfo, 
      shippingAddress, 
      cartItems 
    } = req.body;

    // Validate required fields
    if (!orderId || !paymentId || !sourceId || !amount) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'orderId, paymentId, sourceId, and amount are required'
      });
    }

    const squareClient = getSquareClient();
    const locationId = process.env.SQUARE_LOCATION_ID;

    if (!locationId) {
      return res.status(500).json({
        error: 'Square configuration missing',
        message: 'Square location ID not configured'
      });
    }

    // Create payment with Square
    const { result, statusCode } = await squareClient.paymentsApi.createPayment({
      sourceId,
      idempotencyKey: randomUUID(),
      amountMoney: {
        amount: BigInt(amount),
        currency: 'USD',
      },
      locationId,
      referenceId: orderId,
      note: `Order ${orderId} - ${customerInfo.firstName} ${customerInfo.lastName}`,
      buyerEmailAddress: customerInfo.email,
    });

    if (statusCode !== 200 || !result.payment) {
      throw new Error('Square payment failed');
    }

    const payment = result.payment;

    // Update payment record in database
    await prisma.payments.update({
      where: { id: paymentId },
      data: {
        payment_status: 'paid',
        gateway_transaction_id: payment.id,
        gateway_response: JSON.stringify(payment),
        updated_at: new Date(),
      },
    });

    // Update order status
    await prisma.orders.update({
      where: { id: orderId },
      data: {
        order_status: 'paid',
        updated_at: new Date(),
      },
    });

    console.log('[Square] Payment processed successfully:', {
      orderId,
      paymentId,
      squarePaymentId: payment.id,
      amount,
    });

    res.json({
      success: true,
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amountMoney?.amount?.toString(),
        orderId,
      },
    });
  } catch (error) {
    console.error('[Square] Payment processing error:', error);
    
    // Update payment record to failed
    if (req.body.paymentId) {
      try {
        await prisma.payments.update({
          where: { id: req.body.paymentId },
          data: {
            payment_status: 'failed',
            gateway_response: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
            updated_at: new Date(),
          },
        });
      } catch (dbError) {
        console.error('[Square] Failed to update payment status:', dbError);
      }
    }

    res.status(500).json({
      error: 'Payment processing failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    });
  }
});

// Webhook handler for Square events
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-square-signature'] as string;
    const body = JSON.stringify(req.body);

    // Verify webhook signature
    const webhookSignatureKey = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
    if (webhookSignatureKey) {
      const crypto = require('crypto');
      const hmac = crypto.createHmac('sha256', webhookSignatureKey);
      hmac.update(body);
      const hash = hmac.digest('base64');

      if (hash !== signature) {
        console.error('[Square] Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const event = req.body;
    console.log('[Square] Webhook event received:', event.type);

    // Handle different event types
    switch (event.type) {
      case 'payment.created':
      case 'payment.updated':
        const paymentData = event.data?.object?.payment;
        if (paymentData) {
          // Update payment record
          const payment = await prisma.payments.findFirst({
            where: { gateway_transaction_id: paymentData.id },
          });

          if (payment) {
            await prisma.payments.update({
              where: { id: payment.id },
              data: {
                payment_status: paymentData.status === 'COMPLETED' ? 'paid' : 'pending',
                gateway_response: JSON.stringify(paymentData),
                updated_at: new Date(),
              },
            });
          }
        }
        break;

      case 'refund.created':
      case 'refund.updated':
        const refundData = event.data?.object?.refund;
        if (refundData) {
          // Handle refund events
          console.log('[Square] Refund event:', refundData);
        }
        break;

      default:
        console.log('[Square] Unhandled webhook event type:', event.type);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Square] Webhook processing error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
