import Stripe from 'stripe';
import { prisma } from '../../../prisma';

/**
 * Stripe Webhook Event Handler
 * Processes asynchronous payment events from Stripe
 */
export class StripeWebhookHandler {
  /**
   * Process a Stripe webhook event
   */
  static async handleEvent(event: Stripe.Event): Promise<void> {
    console.log(`[Stripe Webhook] Processing event: ${event.type} (${event.id})`);

    try {
      switch (event.type) {
        // Payment Intent Events
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(event.data.object as Stripe.PaymentIntent);
          break;

        case 'payment_intent.requires_action':
          await this.handlePaymentIntentRequiresAction(event.data.object as Stripe.PaymentIntent);
          break;

        // Charge Events
        case 'charge.succeeded':
          await this.handleChargeSucceeded(event.data.object as Stripe.Charge);
          break;

        case 'charge.failed':
          await this.handleChargeFailed(event.data.object as Stripe.Charge);
          break;

        case 'charge.refunded':
          await this.handleChargeRefunded(event.data.object as Stripe.Charge);
          break;

        // Dispute Events
        case 'charge.dispute.created':
          await this.handleDisputeCreated(event.data.object as Stripe.Dispute);
          break;

        case 'charge.dispute.closed':
          await this.handleDisputeClosed(event.data.object as Stripe.Dispute);
          break;

        // Refund Events
        case 'refund.created':
          await this.handleRefundCreated(event.data.object as Stripe.Refund);
          break;

        case 'refund.updated':
          await this.handleRefundUpdated(event.data.object as Stripe.Refund);
          break;

        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`[Stripe Webhook] Error processing event ${event.id}:`, error);
      throw error;
    }
  }

  /**
   * Handle successful payment intent
   */
  private static async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await prisma.payments.findFirst({
      where: {
        gateway_transaction_id: paymentIntent.id,
      },
      include: {
        orders: true,
      },
    });

    if (!payment) {
      console.warn(`[Stripe Webhook] Payment not found for PaymentIntent: ${paymentIntent.id}`);
      return;
    }

    // Update payment status if it's still pending or authorized
    if (payment.payment_status === 'pending' || payment.payment_status === 'authorized') {
      await prisma.payments.update({
        where: { id: payment.id },
        data: {
          payment_status: 'paid',
          captured_at: new Date(),
          gateway_response: paymentIntent as any,
          updated_at: new Date(),
        },
      });

      // Update order payment status
      await prisma.orders.update({
        where: { id: payment.order_id },
        data: {
          payment_status: 'paid',
          paid_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Create order status history
      await prisma.order_status_history.create({
        data: {
          id: `osh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          order_id: payment.order_id,
          from_status: payment.orders.order_status,
          to_status: payment.orders.order_status,
          changed_by_name: 'system',
          reason: 'Payment succeeded via webhook',
          metadata: { paymentIntentId: paymentIntent.id },
          created_at: new Date(),
        },
      });

      console.log(`[Stripe Webhook] Payment ${payment.id} marked as paid`);
    }
  }

  /**
   * Handle failed payment intent
   */
  private static async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await prisma.payments.findFirst({
      where: {
        gateway_transaction_id: paymentIntent.id,
      },
    });

    if (!payment) {
      console.warn(`[Stripe Webhook] Payment not found for PaymentIntent: ${paymentIntent.id}`);
      return;
    }

    await prisma.payments.update({
      where: { id: payment.id },
      data: {
        payment_status: 'failed',
        failed_at: new Date(),
        error_code: paymentIntent.last_payment_error?.code || 'unknown',
        error_message: paymentIntent.last_payment_error?.message || 'Payment failed',
        gateway_response: paymentIntent as any,
        updated_at: new Date(),
      },
    });

    // Update order payment status
    await prisma.orders.update({
      where: { id: payment.order_id },
      data: {
        payment_status: 'failed',
        updated_at: new Date(),
      },
    });

    console.log(`[Stripe Webhook] Payment ${payment.id} marked as failed`);
  }

  /**
   * Handle canceled payment intent
   */
  private static async handlePaymentIntentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await prisma.payments.findFirst({
      where: {
        gateway_transaction_id: paymentIntent.id,
      },
    });

    if (!payment) {
      console.warn(`[Stripe Webhook] Payment not found for PaymentIntent: ${paymentIntent.id}`);
      return;
    }

    await prisma.payments.update({
      where: { id: payment.id },
      data: {
        payment_status: 'cancelled',
        cancelled_at: new Date(),
        gateway_response: paymentIntent as any,
        updated_at: new Date(),
      },
    });

    // Update order payment status
    await prisma.orders.update({
      where: { id: payment.order_id },
      data: {
        payment_status: 'cancelled',
        updated_at: new Date(),
      },
    });

    console.log(`[Stripe Webhook] Payment ${payment.id} marked as cancelled`);
  }

  /**
   * Handle payment intent requiring action
   */
  private static async handlePaymentIntentRequiresAction(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const payment = await prisma.payments.findFirst({
      where: {
        gateway_transaction_id: paymentIntent.id,
      },
    });

    if (!payment) {
      console.warn(`[Stripe Webhook] Payment not found for PaymentIntent: ${paymentIntent.id}`);
      return;
    }

    // Update gateway response with latest info
    await prisma.payments.update({
      where: { id: payment.id },
      data: {
        gateway_response: paymentIntent as any,
        updated_at: new Date(),
      },
    });

    console.log(`[Stripe Webhook] Payment ${payment.id} requires action`);
  }

  /**
   * Handle successful charge
   */
  private static async handleChargeSucceeded(charge: Stripe.Charge): Promise<void> {
    // Find payment by charge ID or payment intent ID
    const payment = await prisma.payments.findFirst({
      where: {
        OR: [
          { gateway_transaction_id: charge.payment_intent as string },
          { gateway_transaction_id: charge.id },
        ],
      },
    });

    if (!payment) {
      console.warn(`[Stripe Webhook] Payment not found for Charge: ${charge.id}`);
      return;
    }

    // Update with actual fee information from Stripe
    const stripeFee = charge.balance_transaction
      ? await this.getBalanceTransactionFee(charge.balance_transaction as string)
      : null;

    await prisma.payments.update({
      where: { id: payment.id },
      data: {
        gateway_fee_cents: stripeFee || payment.gateway_fee_cents,
        gateway_response: charge as any,
        updated_at: new Date(),
      },
    });

    console.log(`[Stripe Webhook] Charge ${charge.id} succeeded for payment ${payment.id}`);
  }

  /**
   * Handle failed charge
   */
  private static async handleChargeFailed(charge: Stripe.Charge): Promise<void> {
    const payment = await prisma.payments.findFirst({
      where: {
        OR: [
          { gateway_transaction_id: charge.payment_intent as string },
          { gateway_transaction_id: charge.id },
        ],
      },
    });

    if (!payment) {
      console.warn(`[Stripe Webhook] Payment not found for Charge: ${charge.id}`);
      return;
    }

    await prisma.payments.update({
      where: { id: payment.id },
      data: {
        payment_status: 'failed',
        failed_at: new Date(),
        error_code: charge.failure_code || 'unknown',
        error_message: charge.failure_message || 'Charge failed',
        gateway_response: charge as any,
        updated_at: new Date(),
      },
    });

    console.log(`[Stripe Webhook] Charge ${charge.id} failed for payment ${payment.id}`);
  }

  /**
   * Handle refunded charge
   */
  private static async handleChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const payment = await prisma.payments.findFirst({
      where: {
        OR: [
          { gateway_transaction_id: charge.payment_intent as string },
          { gateway_transaction_id: charge.id },
        ],
      },
    });

    if (!payment) {
      console.warn(`[Stripe Webhook] Payment not found for Charge: ${charge.id}`);
      return;
    }

    const isFullRefund = charge.amount_refunded === charge.amount;

    await prisma.payments.update({
      where: { id: payment.id },
      data: {
        payment_status: isFullRefund ? 'refunded' : 'partially_refunded',
        gateway_response: charge as any,
        updated_at: new Date(),
      },
    });

    console.log(`[Stripe Webhook] Charge ${charge.id} refunded for payment ${payment.id}`);
  }

  /**
   * Handle dispute created
   */
  private static async handleDisputeCreated(dispute: Stripe.Dispute): Promise<void> {
    const payment = await prisma.payments.findFirst({
      where: {
        gateway_transaction_id: dispute.payment_intent as string,
      },
    });

    if (!payment) {
      console.warn(`[Stripe Webhook] Payment not found for Dispute: ${dispute.id}`);
      return;
    }

    // Store dispute information in metadata
    const currentMetadata = (payment.metadata as any) || {};
    await prisma.payments.update({
      where: { id: payment.id },
      data: {
        metadata: {
          ...currentMetadata,
          dispute: {
            id: dispute.id,
            amount: dispute.amount,
            reason: dispute.reason,
            status: dispute.status,
            created: dispute.created,
          },
        },
        updated_at: new Date(),
      },
    });

    console.log(`[Stripe Webhook] Dispute ${dispute.id} created for payment ${payment.id}`);
  }

  /**
   * Handle dispute closed
   */
  private static async handleDisputeClosed(dispute: Stripe.Dispute): Promise<void> {
    const payment = await prisma.payments.findFirst({
      where: {
        gateway_transaction_id: dispute.payment_intent as string,
      },
    });

    if (!payment) {
      console.warn(`[Stripe Webhook] Payment not found for Dispute: ${dispute.id}`);
      return;
    }

    // Update dispute information in metadata
    const currentMetadata = (payment.metadata as any) || {};
    await prisma.payments.update({
      where: { id: payment.id },
      data: {
        metadata: {
          ...currentMetadata,
          dispute: {
            ...currentMetadata.dispute,
            status: dispute.status,
            closedAt: new Date().toISOString(),
          },
        },
        updated_at: new Date(),
      },
    });

    console.log(`[Stripe Webhook] Dispute ${dispute.id} closed for payment ${payment.id}`);
  }

  /**
   * Handle refund created
   */
  private static async handleRefundCreated(refund: Stripe.Refund): Promise<void> {
    console.log(`[Stripe Webhook] Refund ${refund.id} created`);
    // Refund is already handled in the charge.refunded event
  }

  /**
   * Handle refund updated
   */
  private static async handleRefundUpdated(refund: Stripe.Refund): Promise<void> {
    console.log(`[Stripe Webhook] Refund ${refund.id} updated to status: ${refund.status}`);
  }

  /**
   * Get actual fee from balance transaction
   */
  private static async getBalanceTransactionFee(balanceTransactionId: string): Promise<number | null> {
    try {
      // This would require a Stripe instance - for now return null
      // In production, you'd fetch the balance transaction and get the fee
      return null;
    } catch (error) {
      console.error('[Stripe Webhook] Error fetching balance transaction:', error);
      return null;
    }
  }
}
