import { Router } from 'express';
import { prisma } from '../../prisma';
import { digitalFulfillmentService } from '../../services/digital-assets';
import { randomUUID } from 'crypto';

const router = Router();

// Note: Square SDK integration removed - using direct API calls instead
// The Square SDK has complex typing issues in this environment
// Process Square payment
const processSquarePayment = async (sourceId: string, amount: number, orderId: string, customerInfo: any) => {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const environment = process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';
  const baseUrl = environment === 'production' 
    ? 'https://connect.squareup.com' 
    : 'https://connect.squareupsandbox.com';

  if (!accessToken || !locationId) {
    throw new Error('Square configuration missing');
  }

  const response = await fetch(`${baseUrl}/v2/payments`, {
    method: 'POST',
    headers: {
      'Square-Version': '2024-01-18',
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_id: sourceId,
      idempotency_key: randomUUID(),
      amount_money: {
        amount: amount,
        currency: 'USD',
      },
      location_id: locationId,
      reference_id: orderId,
      note: `Order ${orderId} - ${customerInfo.firstName} ${customerInfo.lastName}`,
      buyer_email_address: customerInfo.email,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Square payment failed: ${error}`);
  }

  return await response.json();
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

    // Process payment with Square API
    const result = await processSquarePayment(sourceId, amount, orderId, customerInfo) as any;
    const payment = result.payment;

    if (!payment) {
      throw new Error('Square payment failed - no payment object returned');
    }

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

    // Fulfill digital products
    try {
      const hasDigital = await digitalFulfillmentService.hasDigitalProducts(orderId);
      if (hasDigital) {
        console.log('[Square] Order contains digital products, fulfilling...');
        const baseUrl = process.env.API_BASE_URL || 'http://localhost:4000';
        const fulfillmentResult = await digitalFulfillmentService.fulfillOrder(
          orderId,
          baseUrl
        );
        console.log('[Square] Digital fulfillment result:', {
          success: fulfillmentResult.success,
          grants: fulfillmentResult.accessGrants.length,
          errors: fulfillmentResult.errors.length,
        });
      }
    } catch (error) {
      console.error('[Square] Digital fulfillment failed:', error);
      // Don't fail the payment if digital fulfillment fails - can retry later
    }

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
