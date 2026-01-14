import { prisma } from '../../prisma';
import { customAlphabet } from 'nanoid';

const generateRefundId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

interface PayPalRefundResponse {
  id: string;
  status: string;
  amount?: {
    currency_code: string;
    value: string;
  };
  create_time?: string;
  update_time?: string;
  message?: string;
  details?: any[];
}

interface RefundRequest {
  orderId: string;
  paymentId: string;
  tenantId: string;
  reason: string;
  initiatedBy?: string;
}

interface RefundResult {
  success: boolean;
  refundId?: string;
  gatewayRefundId?: string;
  status: string;
  message?: string;
  error?: string;
}

export class RefundService {
  /**
   * Process a refund for a cancelled order
   */
  static async processRefund(request: RefundRequest): Promise<RefundResult> {
    try {
      console.log('[RefundService] Processing refund:', request);

      // Get payment details
      const payment = await prisma.payments.findUnique({
        where: { id: request.paymentId },
        include: {
          orders: true,
        },
      });

      if (!payment) {
        return {
          success: false,
          status: 'failed',
          error: 'payment_not_found',
          message: 'Payment record not found',
        };
      }

      // Check if payment was successful
      if (payment.payment_status !== 'paid') {
        return {
          success: false,
          status: 'failed',
          error: 'payment_not_paid',
          message: 'Cannot refund unpaid order',
        };
      }

      // Check if already refunded
      const existingRefund = await prisma.refunds.findFirst({
        where: {
          payment_id: request.paymentId,
          refund_status: { in: ['pending', 'processing', 'completed'] },
        },
      });

      if (existingRefund) {
        return {
          success: false,
          status: 'failed',
          error: 'already_refunded',
          message: 'This order has already been refunded',
        };
      }

      // Create refund record
      const refundId = `ref_${generateRefundId()}`;
      const refund = await prisma.refunds.create({
        data: {
          id: refundId,
          payment_id: request.paymentId,
          order_id: request.orderId,
          tenant_id: request.tenantId,
          amount_cents: payment.amount_cents,
          refund_status: 'pending',
          refund_reason: request.reason,
          gateway_type: payment.gateway_type || 'unknown',
          initiated_by: request.initiatedBy || 'system',
          metadata: {
            original_payment_method: payment.payment_method,
            original_transaction_id: payment.gateway_transaction_id,
          },
        },
      });

      console.log('[RefundService] Refund record created:', refundId);

      // Process refund based on gateway type
      let gatewayResult;
      if (payment.gateway_type === 'paypal') {
        gatewayResult = await this.processPayPalRefund(payment, refund);
      } else if (payment.gateway_type === 'stripe') {
        gatewayResult = await this.processStripeRefund(payment, refund);
      } else {
        // Unknown gateway - mark as failed
        await prisma.refunds.update({
          where: { id: refundId },
          data: {
            refund_status: 'failed',
            gateway_response: { error: 'Unknown gateway type' },
          },
        });
        return {
          success: false,
          refundId,
          status: 'failed',
          error: 'unknown_gateway',
          message: 'Unknown payment gateway',
        };
      }

      return {
        success: gatewayResult.success,
        refundId,
        gatewayRefundId: gatewayResult.gatewayRefundId,
        status: gatewayResult.status,
        message: gatewayResult.message,
        error: gatewayResult.error,
      };
    } catch (error) {
      console.error('[RefundService] Error processing refund:', error);
      return {
        success: false,
        status: 'failed',
        error: 'refund_processing_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process PayPal refund
   */
  private static async processPayPalRefund(payment: any, refund: any): Promise<RefundResult> {
    try {
      console.log('[RefundService] Processing PayPal refund:', refund.id);

      const paypalClientId = process.env.PAYPAL_CLIENT_ID;
      const paypalClientSecret = process.env.PAYPAL_CLIENT_SECRET;
      // Check for development mode - also treat missing NODE_ENV as development
      const isDevelopment = !process.env.NODE_ENV || process.env.NODE_ENV === 'development';

      console.log('[RefundService] Environment check:', {
        NODE_ENV: process.env.NODE_ENV,
        isDevelopment,
      });

      if (!paypalClientId || !paypalClientSecret) {
        throw new Error('PayPal credentials not configured');
      }

      // Get capture ID from payment
      const captureId = payment.gateway_transaction_id;
      if (!captureId) {
        throw new Error('No PayPal capture ID found');
      }

      // In development, simulate successful refund if PayPal API fails
      // This handles sandbox capture IDs that may have expired or are invalid
      if (isDevelopment) {
        console.log('[RefundService] Development mode - will simulate refund if PayPal API fails');
      }

      // Get PayPal access token
      const auth = Buffer.from(`${paypalClientId}:${paypalClientSecret}`).toString('base64');
      const tokenResponse = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get PayPal access token');
      }

      const tokenData = await tokenResponse.json() as { access_token: string };
      const { access_token } = tokenData;

      // Process refund
      const refundResponse = await fetch(
        `https://api-m.sandbox.paypal.com/v2/payments/captures/${captureId}/refund`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            amount: {
              currency_code: 'USD',
              value: (payment.amount_cents / 100).toFixed(2),
            },
            note_to_payer: refund.refund_reason || 'Order cancelled by store',
          }),
        }
      );

      const refundData = await refundResponse.json() as PayPalRefundResponse;

      if (!refundResponse.ok) {
        console.error('[RefundService] PayPal refund failed:', refundData);
        
        // In development mode, simulate successful refund for invalid capture IDs
        // This handles sandbox transactions that have expired or were never captured
        const isInvalidResourceError = refundData.details?.some(
          (d: any) => d.issue === 'INVALID_RESOURCE_ID'
        );
        
        if (isDevelopment && isInvalidResourceError) {
          console.log('[RefundService] Development mode: Simulating successful refund for invalid capture ID');
          
          const simulatedRefundId = `SIMULATED-${Date.now()}`;
          await prisma.refunds.update({
            where: { id: refund.id },
            data: {
              refund_status: 'completed',
              gateway_refund_id: simulatedRefundId,
              gateway_response: {
                simulated: true,
                original_error: refundData,
                note: 'Simulated refund in development mode due to invalid PayPal capture ID',
              } as any,
              processed_at: new Date(),
              completed_at: new Date(),
            },
          });

          return {
            success: true,
            gatewayRefundId: simulatedRefundId,
            status: 'completed',
            message: 'Refund simulated successfully (development mode)',
          };
        }
        
        // Production or non-resource errors: mark as failed
        await prisma.refunds.update({
          where: { id: refund.id },
          data: {
            refund_status: 'failed',
            gateway_response: refundData as any,
          },
        });

        return {
          success: false,
          status: 'failed',
          error: 'paypal_refund_failed',
          message: refundData.message || 'PayPal refund failed',
        };
      }

      // Update refund with gateway response
      await prisma.refunds.update({
        where: { id: refund.id },
        data: {
          refund_status: refundData.status === 'COMPLETED' ? 'completed' : 'processing',
          gateway_refund_id: refundData.id,
          gateway_response: refundData as any,
          processed_at: new Date(),
          completed_at: refundData.status === 'COMPLETED' ? new Date() : null,
        },
      });

      console.log('[RefundService] PayPal refund successful:', refundData.id);

      return {
        success: true,
        gatewayRefundId: refundData.id,
        status: refundData.status === 'COMPLETED' ? 'completed' : 'processing',
        message: 'Refund processed successfully',
      };
    } catch (error) {
      console.error('[RefundService] PayPal refund error:', error);
      
      // Update refund status to failed
      await prisma.refunds.update({
        where: { id: refund.id },
        data: {
          refund_status: 'failed',
          gateway_response: { error: error instanceof Error ? error.message : 'Unknown error' },
        },
      });

      return {
        success: false,
        status: 'failed',
        error: 'paypal_error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process Stripe refund
   */
  private static async processStripeRefund(payment: any, refund: any): Promise<RefundResult> {
    try {
      console.log('[RefundService] Processing Stripe refund:', refund.id);

      const Stripe = require('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

      // Create refund
      const stripeRefund = await stripe.refunds.create({
        payment_intent: payment.gateway_transaction_id,
        amount: payment.amount_cents,
        reason: 'requested_by_customer',
        metadata: {
          refund_id: refund.id,
          order_id: refund.order_id,
          reason: refund.refund_reason || 'Order cancelled',
        },
      });

      // Update refund with gateway response
      await prisma.refunds.update({
        where: { id: refund.id },
        data: {
          refund_status: stripeRefund.status === 'succeeded' ? 'completed' : 'processing',
          gateway_refund_id: stripeRefund.id,
          gateway_response: stripeRefund,
          processed_at: new Date(),
          completed_at: stripeRefund.status === 'succeeded' ? new Date() : null,
        },
      });

      console.log('[RefundService] Stripe refund successful:', stripeRefund.id);

      return {
        success: true,
        gatewayRefundId: stripeRefund.id,
        status: stripeRefund.status === 'succeeded' ? 'completed' : 'processing',
        message: 'Refund processed successfully',
      };
    } catch (error: any) {
      console.error('[RefundService] Stripe refund error:', error);
      
      // Update refund status to failed
      await prisma.refunds.update({
        where: { id: refund.id },
        data: {
          refund_status: 'failed',
          gateway_response: { error: error.message || 'Unknown error' },
        },
      });

      return {
        success: false,
        status: 'failed',
        error: 'stripe_error',
        message: error.message || 'Unknown error',
      };
    }
  }

  /**
   * Get refund status
   */
  static async getRefundStatus(refundId: string) {
    return await prisma.refunds.findUnique({
      where: { id: refundId },
      include: {
        payments: true,
        orders: true,
      },
    });
  }

  /**
   * Get refunds for an order
   */
  static async getOrderRefunds(orderId: string) {
    return await prisma.refunds.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: 'desc' },
    });
  }
}
