import Stripe from 'stripe';
import { prisma } from '../../../prisma';
import { digitalFulfillmentService } from '../../digital-assets/DigitalFulfillmentService';
import { realtimeService } from '../../RealtimeService';
import { logger } from '../../../logger';
import { getSubscriptionStatusService } from '../../subscription/SubscriptionStatusService';
import { getSubscriptionBillingService } from '../../subscription/SubscriptionBillingService';

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

        // Subscription lifecycle events (merged from routes/stripe-webhook.ts —
        // that route was shadowed by webhooks.ts /stripe and never fired)
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
          break;

        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
          break;

        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
          break;

        case 'payment_method.attached':
          await this.handlePaymentMethodAttached(event.data.object as Stripe.PaymentMethod);
          break;

        case 'payment_method.detached':
          await this.handlePaymentMethodDetached(event.data.object as Stripe.PaymentMethod);
          break;

        case 'payment_method.automatically_updated':
          await this.handlePaymentMethodAutoUpdated(event.data.object as Stripe.PaymentMethod);
          break;

        case 'setup_intent.succeeded':
          await this.handleSetupIntentSucceeded(event.data.object as Stripe.SetupIntent);
          break;

        default:
          console.log(`[Stripe Webhook] Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      logger.error(`[Stripe Webhook] Error processing event ${event.id}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      throw error;
    }
  }

  /**
   * Handle successful payment intent
   */
  private static async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    // Subscription purchases carry tenantId/tier metadata and have no
    // payments row — activate the subscription alongside order bookkeeping.
    const { tenantId: subTenantId, tier: subTier, billingCycle } = (paymentIntent.metadata || {}) as Record<string, string>;
    if (subTenantId) {
      const statusService = getSubscriptionStatusService();
      const billingService = getSubscriptionBillingService();
      const existingInvoice = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM subscription_invoices
        WHERE transaction_id = ${paymentIntent.id}
      `;
      if (existingInvoice.length === 0 && subTier) {
        const pricing = await billingService.getTierPricingByTier(subTier);
        if (pricing) {
          const amount = billingCycle === 'annual' ? pricing.annualPriceCents : pricing.monthlyPriceCents;
          await statusService.handlePaymentSuccess(subTenantId, subTier, paymentIntent.id, amount);
        } else {
          await statusService.handlePaymentSuccess(subTenantId, subTier, paymentIntent.id);
        }
      } else {
        await statusService.handlePaymentSuccess(subTenantId, subTier || 'starter', paymentIntent.id);
      }
      console.log(`[Stripe Webhook] Subscription payment succeeded for tenant ${subTenantId}, tier: ${subTier}`);
    }

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

      // Fulfill digital products if applicable
      await this.fulfillDigitalProducts(payment.order_id, payment.tenant_id);

      console.log(`[Stripe Webhook] Payment ${payment.id} marked as paid`);
    }
  }

  /**
   * Handle failed payment intent
   */
  private static async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const { tenantId: subTenantId } = (paymentIntent.metadata || {}) as Record<string, string>;
    if (subTenantId) {
      const statusService = getSubscriptionStatusService();
      const reason = paymentIntent.last_payment_error?.code || 'unknown';
      await statusService.handlePaymentFailure(subTenantId, reason);
      console.log(`[Stripe Webhook] Subscription payment failed for tenant ${subTenantId}: ${paymentIntent.last_payment_error?.message}`);
    }

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
      logger.error('[Stripe Webhook] Error fetching balance transaction:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return null;
    }
  }

  /**
   * Fulfill digital products for an order after successful payment
   */
  private static async fulfillDigitalProducts(orderId: string, tenantId: string): Promise<void> {
    try {
      const hasDigital = await digitalFulfillmentService.hasDigitalProducts(orderId);
      
      if (!hasDigital) {
        return;
      }

      console.log(`[Stripe Webhook] Fulfilling digital products for order ${orderId}`);

      const baseUrl = process.env.WEB_URL || process.env.FRONTEND_URL || 'http://localhost:3000';
      const result = await digitalFulfillmentService.fulfillOrder(orderId, baseUrl);

      if (result.success) {
        console.log(`[Stripe Webhook] Digital fulfillment complete: ${result.accessGrants.length} grants created`);

        // Get order for customer notification
        const order = await prisma.orders.findUnique({
          where: { id: orderId },
          include: {
            order_items: {
              include: { inventory_items: true },
            },
          },
        });

        if (order?.customer_id) {
          // Send real-time notification
          await realtimeService.handlePaymentSuccess({
            id: order.id,
            customer_id: order.customer_id,
            customer_email: order.customer_email,
            items: order.order_items.map(item => ({
              id: item.id,
              product_type: (item.inventory_items as any)?.product_type || 'physical',
            })),
          });
        }
      } else {
        logger.error(`[Stripe Webhook] Digital fulfillment had errors:`, undefined, { error: { name: 'Error', message: String(result.errors) } });
      }
    } catch (error) {
      logger.error('[Stripe Webhook] Error fulfilling digital products:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      // Don't throw - payment was successful, fulfillment can be retried
    }
  }

  /**
   * Handle successful recurring invoice payment (subscription billing)
   */
  private static async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const tenantId = invoice.metadata?.tenantId ||
      (invoice.customer ? await this.getTenantIdFromCustomerId(invoice.customer as string) : null);
    if (!tenantId) {
      console.log('[Stripe Webhook] Invoice missing tenant identification');
      return;
    }
    const statusService = getSubscriptionStatusService();
    const tier = invoice.metadata?.tier || 'professional';
    await statusService.handlePaymentSuccess(tenantId, tier, invoice.id, invoice.amount_paid);
    console.log(`[Stripe Webhook] Invoice payment succeeded for tenant ${tenantId}`);
  }

  /**
   * Handle failed recurring invoice payment
   */
  private static async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const tenantId = invoice.metadata?.tenantId ||
      (invoice.customer ? await this.getTenantIdFromCustomerId(invoice.customer as string) : null);
    if (!tenantId) {
      console.log('[Stripe Webhook] Failed invoice missing tenant identification');
      return;
    }
    const statusService = getSubscriptionStatusService();
    await statusService.handlePaymentFailure(tenantId, 'invoice_payment_failed', invoice.attempt_count || 1);
    console.log(`[Stripe Webhook] Invoice payment failed for tenant ${tenantId}`);
  }

  /**
   * Handle subscription deletion (cancellation)
   */
  private static async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const tenantId = subscription.metadata?.tenantId ||
      (subscription.customer ? await this.getTenantIdFromCustomerId(subscription.customer as string) : null);
    if (!tenantId) {
      console.log('[Stripe Webhook] Deleted subscription missing tenant identification');
      return;
    }
    const statusService = getSubscriptionStatusService();
    await statusService.handleCancellation(tenantId, 'stripe_subscription_deleted');
    console.log(`[Stripe Webhook] Subscription deleted for tenant ${tenantId}`);
  }

  /**
   * Handle payment method attached to customer
   */
  private static async handlePaymentMethodAttached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    if (!paymentMethod.customer) return;
    const tenantId = await this.getTenantIdFromCustomerId(paymentMethod.customer as string);
    if (!tenantId) return;
    console.log(`[Stripe Webhook] Payment method ${paymentMethod.id} attached to tenant ${tenantId}`);
  }

  /**
   * Handle payment method detached from customer
   */
  private static async handlePaymentMethodDetached(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    console.log(`[Stripe Webhook] Payment method ${paymentMethod.id} detached`);
    await prisma.$executeRaw`
      UPDATE merchant_billing_gateways
      SET is_active = false
      WHERE payment_method_token = ${paymentMethod.id}
    `;
    await prisma.$executeRaw`
      UPDATE customer_payment_methods
      SET is_active = false, updated_at = now()
      WHERE payment_method_token = ${paymentMethod.id}
    `;
  }

  /**
   * Handle payment method automatically updated by Stripe
   * (e.g., card expiry updated by the network)
   */
  private static async handlePaymentMethodAutoUpdated(paymentMethod: Stripe.PaymentMethod): Promise<void> {
    console.log(`[Stripe Webhook] Payment method ${paymentMethod.id} automatically updated`);
    if (!paymentMethod.card) return;
    await prisma.$executeRaw`
      UPDATE customer_payment_methods
      SET
        card_last4 = ${paymentMethod.card.last4},
        card_brand = ${paymentMethod.card.brand},
        expiry_month = ${paymentMethod.card.exp_month},
        expiry_year = ${paymentMethod.card.exp_year},
        card_funding = ${paymentMethod.card.funding},
        card_country = ${paymentMethod.card.country},
        updated_at = now()
      WHERE payment_method_token = ${paymentMethod.id} AND is_active = true
    `;
  }

  /**
   * Handle setup_intent.succeeded — safety-net save of the payment method
   * when the frontend's POST /api/customer-payment-methods never landed.
   */
  private static async handleSetupIntentSucceeded(setupIntent: Stripe.SetupIntent): Promise<void> {
    const { platform_customer_id, tenant_id } = setupIntent.metadata || {};
    console.log(`[Stripe Webhook] SetupIntent ${setupIntent.id} succeeded for customer ${platform_customer_id}, tenant ${tenant_id}`);
    if (!platform_customer_id || !tenant_id || !setupIntent.payment_method) return;

    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM customer_payment_methods
      WHERE customer_id = ${platform_customer_id}
      AND tenant_id = ${tenant_id}
      AND payment_method_token = ${setupIntent.payment_method as string}
      AND is_active = true
    `;
    if (existing.length > 0) return;

    try {
      const { CustomerPaymentMethodsService } = await import('../../CustomerPaymentMethodsService');
      const service = CustomerPaymentMethodsService.getInstance();
      await service.addPaymentMethod(platform_customer_id, {
        tenantId: tenant_id,
        gatewayType: 'stripe',
        paymentMethodToken: setupIntent.payment_method as string,
      });
      console.log(`[Stripe Webhook] Auto-saved payment method ${setupIntent.payment_method} for customer ${platform_customer_id}`);
    } catch (error: any) {
      logger.error('[Stripe Webhook] Failed to auto-save payment method:', undefined, { error: { name: 'Error', message: String(error.message) } });
    }
  }

  /**
   * Helper: resolve tenant ID from Stripe customer ID
   */
  private static async getTenantIdFromCustomerId(customerId: string): Promise<string | null> {
    const results = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM tenants
      WHERE metadata->>'stripeCustomerId' = ${customerId}
    `;
    return results[0]?.id || null;
  }
}
