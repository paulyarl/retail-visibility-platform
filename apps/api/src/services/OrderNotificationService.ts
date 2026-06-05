/**
 * Order Notification Service
 * 
 * Handles email notifications for order events:
 * - Order placed (to merchant)
 * - Order cancelled (to merchant and customer)
 * - Order fulfilled/picked up (to customer)
 * - Deposit forfeited (to merchant and customer)
 * - Refund processed (to customer)
 */

import { prisma } from '../prisma';
import { emailService } from './email-service';

export type OrderNotificationType = 
  | 'order_placed'
  | 'order_cancelled'
  | 'order_fulfilled'
  | 'order_picked_up'
  | 'deposit_forfeited'
  | 'refund_processed';

export interface OrderNotificationData {
  tenantId: string;
  orderId: string;
  orderNumber?: string;
  type: OrderNotificationType;
  customerEmail?: string;
  customerName?: string;
  amount?: number;
  reason?: string;
  metadata?: Record<string, any>;
}

class OrderNotificationService {
  /**
   * Send order notification and log it
   */
  async sendNotification(data: OrderNotificationData): Promise<boolean> {
    try {
      // Get tenant info for merchant email
      const tenant = await prisma.tenants.findUnique({
        where: { id: data.tenantId },
        select: {
          name: true,
          metadata: true,
        },
      });

      const tenantMetadata = tenant?.metadata as any;
      const merchantEmail = tenantMetadata?.email;
      const tenantName = tenant?.name || 'Store';

      // Build and send emails based on notification type
      const emailsSent: boolean[] = [];

      // Send to merchant for certain notification types
      if (merchantEmail && ['order_placed', 'order_cancelled', 'deposit_forfeited'].includes(data.type)) {
        const merchantEmailPayload = this.buildMerchantEmailPayload(merchantEmail, tenantName, data);
        const merchantSent = await emailService.sendEmail(merchantEmailPayload);
        emailsSent.push(merchantSent.success);
      }

      // Send to customer for certain notification types
      if (data.customerEmail && ['order_cancelled', 'order_fulfilled', 'deposit_forfeited', 'refund_processed'].includes(data.type)) {
        const customerEmailPayload = this.buildCustomerEmailPayload(data.customerEmail, data.customerName || 'Customer', tenantName, data);
        const customerSent = await emailService.sendEmail(customerEmailPayload);
        emailsSent.push(customerSent.success);
      }

      const sent = emailsSent.length > 0 ? emailsSent.every(s => s) : true;

      // Log notification
      await this.logNotification(data, sent);

      console.log('[OrderNotification] Notification processed:', {
        type: data.type,
        orderId: data.orderId,
        tenantId: data.tenantId,
        customerEmail: data.customerEmail,
        merchantEmail,
        sent,
      });

      return sent;
    } catch (error) {
      console.error('[OrderNotification] Error sending notification:', error);
      // Still try to log even if email failed
      await this.logNotification(data, false);
      return false;
    }
  }

  /**
   * Build email payload for merchant notifications
   */
  private buildMerchantEmailPayload(toEmail: string, tenantName: string, data: OrderNotificationData) {
    const orderRef = data.orderNumber || data.orderId;
    const amountFormatted = data.amount ? `$${(data.amount / 100).toFixed(2)}` : 'N/A';

    switch (data.type) {
      case 'order_placed':
        return {
          to: toEmail,
          subject: `New Order Received - ${orderRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">New Order Received</h2>
              <p>Hi,</p>
              <p>You have received a new order <strong>${orderRef}</strong>.</p>
              <p><strong>Customer:</strong> ${data.customerName || 'N/A'} (${data.customerEmail || 'N/A'})</p>
              <p><strong>Amount:</strong> ${amountFormatted}</p>
              <p>Please log in to your dashboard to process this order.</p>
              <p>Best regards,<br>${tenantName}</p>
            </div>
          `,
          text: `New Order Received\n\nOrder: ${orderRef}\nCustomer: ${data.customerName || 'N/A'} (${data.customerEmail || 'N/A'})\nAmount: ${amountFormatted}\n\nPlease log in to your dashboard to process this order.\n\nBest regards,\n${tenantName}`,
        };

      case 'order_cancelled':
        return {
          to: toEmail,
          subject: `Order Cancelled - ${orderRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">Order Cancelled</h2>
              <p>Hi,</p>
              <p>Order <strong>${orderRef}</strong> has been cancelled.</p>
              <p><strong>Customer:</strong> ${data.customerName || 'N/A'} (${data.customerEmail || 'N/A'})</p>
              <p><strong>Amount:</strong> ${amountFormatted}</p>
              ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
              <p>Best regards,<br>${tenantName}</p>
            </div>
          `,
          text: `Order Cancelled\n\nOrder: ${orderRef}\nCustomer: ${data.customerName || 'N/A'} (${data.customerEmail || 'N/A'})\nAmount: ${amountFormatted}${data.reason ? `\nReason: ${data.reason}` : ''}\n\nBest regards,\n${tenantName}`,
        };

      case 'deposit_forfeited':
        return {
          to: toEmail,
          subject: `Deposit Forfeited - ${orderRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">Deposit Forfeited</h2>
              <p>Hi,</p>
              <p>The deposit for order <strong>${orderRef}</strong> has been forfeited.</p>
              <p><strong>Customer:</strong> ${data.customerName || 'N/A'} (${data.customerEmail || 'N/A'})</p>
              <p><strong>Forfeited Amount:</strong> ${amountFormatted}</p>
              <p>The customer did not pick up the order within the deadline.</p>
              <p>Best regards,<br>${tenantName}</p>
            </div>
          `,
          text: `Deposit Forfeited\n\nOrder: ${orderRef}\nCustomer: ${data.customerName || 'N/A'} (${data.customerEmail || 'N/A'})\nForfeited Amount: ${amountFormatted}\n\nThe customer did not pick up the order within the deadline.\n\nBest regards,\n${tenantName}`,
        };

      default:
        return {
          to: toEmail,
          subject: `Order Update - ${orderRef}`,
          html: `<p>Order ${orderRef} has been updated.</p>`,
          text: `Order ${orderRef} has been updated.`,
        };
    }
  }

  /**
   * Build email payload for customer notifications
   */
  private buildCustomerEmailPayload(toEmail: string, customerName: string, tenantName: string, data: OrderNotificationData) {
    const orderRef = data.orderNumber || data.orderId;
    const amountFormatted = data.amount ? `$${(data.amount / 100).toFixed(2)}` : 'N/A';

    switch (data.type) {
      case 'order_cancelled':
        return {
          to: toEmail,
          subject: `Order Cancelled - ${orderRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">Order Cancelled</h2>
              <p>Hi ${customerName},</p>
              <p>Your order <strong>${orderRef}</strong> has been cancelled.</p>
              <p><strong>Amount:</strong> ${amountFormatted}</p>
              ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
              <p>If you have any questions, please contact us.</p>
              <p>Best regards,<br>${tenantName}</p>
            </div>
          `,
          text: `Order Cancelled\n\nHi ${customerName},\n\nYour order ${orderRef} has been cancelled.\nAmount: ${amountFormatted}${data.reason ? `\nReason: ${data.reason}` : ''}\n\nIf you have any questions, please contact us.\n\nBest regards,\n${tenantName}`,
        };

      case 'order_fulfilled':
        return {
          to: toEmail,
          subject: `Order Ready for Pickup - ${orderRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">Order Fulfilled</h2>
              <p>Hi ${customerName},</p>
              <p>Your order <strong>${orderRef}</strong> has been fulfilled and is ready!</p>
              <p><strong>Total:</strong> ${amountFormatted}</p>
              <p>Thank you for your business!</p>
              <p>Best regards,<br>${tenantName}</p>
            </div>
          `,
          text: `Order Fulfilled\n\nHi ${customerName},\n\nYour order ${orderRef} has been fulfilled and is ready!\nTotal: ${amountFormatted}\n\nThank you for your business!\n\nBest regards,\n${tenantName}`,
        };

      case 'deposit_forfeited':
        return {
          to: toEmail,
          subject: `Deposit Forfeited - ${orderRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">Deposit Forfeited</h2>
              <p>Hi ${customerName},</p>
              <p>Unfortunately, your deposit for order <strong>${orderRef}</strong> has been forfeited.</p>
              <p><strong>Forfeited Amount:</strong> ${amountFormatted}</p>
              <p>The order was not picked up within the deadline.</p>
              <p>If you have any questions, please contact us.</p>
              <p>Best regards,<br>${tenantName}</p>
            </div>
          `,
          text: `Deposit Forfeited\n\nHi ${customerName},\n\nUnfortunately, your deposit for order ${orderRef} has been forfeited.\nForfeited Amount: ${amountFormatted}\n\nThe order was not picked up within the deadline.\n\nIf you have any questions, please contact us.\n\nBest regards,\n${tenantName}`,
        };

      case 'refund_processed':
        return {
          to: toEmail,
          subject: `Refund Processed - ${orderRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">Refund Processed</h2>
              <p>Hi ${customerName},</p>
              <p>A refund of <strong>${amountFormatted}</strong> has been processed for your order <strong>${orderRef}</strong>.</p>
              ${data.reason ? `<p><strong>Reason:</strong> ${data.reason}</p>` : ''}
              <p>Please allow 5-10 business days for the refund to appear in your account.</p>
              <p>Best regards,<br>${tenantName}</p>
            </div>
          `,
          text: `Refund Processed\n\nHi ${customerName},\n\nA refund of ${amountFormatted} has been processed for your order ${orderRef}.${data.reason ? `\nReason: ${data.reason}` : ''}\n\nPlease allow 5-10 business days for the refund to appear in your account.\n\nBest regards,\n${tenantName}`,
        };

      default:
        return {
          to: toEmail,
          subject: `Order Update - ${orderRef}`,
          html: `<p>Hi ${customerName},</p><p>Your order ${orderRef} has been updated.</p>`,
          text: `Hi ${customerName},\n\nYour order ${orderRef} has been updated.`,
        };
    }
  }

  /**
   * Log notification for audit trail
   */
  private async logNotification(data: OrderNotificationData, sent: boolean): Promise<boolean> {
    try {
      await prisma.notification_logs.create({
        data: {
          tenant_id: data.tenantId,
          type: data.type,
          sent: sent,
          metadata: {
            orderId: data.orderId,
            orderNumber: data.orderNumber,
            customerEmail: data.customerEmail,
            customerName: data.customerName,
            amount: data.amount,
            reason: data.reason,
            ...data.metadata,
          } as any,
        },
      });
      return true;
    } catch (error) {
      console.error('[OrderNotification] Failed to log notification:', error);
      return false;
    }
  }

  /**
   * Notify when order is placed
   */
  async notifyOrderPlaced(params: {
    tenantId: string;
    orderId: string;
    orderNumber?: string;
    customerEmail: string;
    customerName?: string;
    amount: number;
  }): Promise<boolean> {
    return this.sendNotification({
      tenantId: params.tenantId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      type: 'order_placed',
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      amount: params.amount,
    });
  }

  /**
   * Notify when order is cancelled
   */
  async notifyOrderCancelled(params: {
    tenantId: string;
    orderId: string;
    orderNumber?: string;
    customerEmail: string;
    customerName?: string;
    amount: number;
    reason?: string;
    cancelledBy: 'buyer' | 'merchant';
  }): Promise<boolean> {
    return this.sendNotification({
      tenantId: params.tenantId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      type: 'order_cancelled',
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      amount: params.amount,
      reason: params.reason,
      metadata: { cancelledBy: params.cancelledBy },
    });
  }

  /**
   * Notify when order is fulfilled/picked up
   */
  async notifyOrderFulfilled(params: {
    tenantId: string;
    orderId: string;
    orderNumber?: string;
    customerEmail: string;
    customerName?: string;
    amount: number;
  }): Promise<boolean> {
    return this.sendNotification({
      tenantId: params.tenantId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      type: 'order_fulfilled',
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      amount: params.amount,
    });
  }

  /**
   * Notify when deposit is forfeited
   */
  async notifyDepositForfeited(params: {
    tenantId: string;
    orderId: string;
    orderNumber?: string;
    customerEmail: string;
    customerName?: string;
    depositAmount: number;
  }): Promise<boolean> {
    return this.sendNotification({
      tenantId: params.tenantId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      type: 'deposit_forfeited',
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      amount: params.depositAmount,
    });
  }

  /**
   * Notify when refund is processed
   */
  async notifyRefundProcessed(params: {
    tenantId: string;
    orderId: string;
    orderNumber?: string;
    customerEmail: string;
    customerName?: string;
    refundAmount: number;
    reason?: string;
  }): Promise<boolean> {
    return this.sendNotification({
      tenantId: params.tenantId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      type: 'refund_processed',
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      amount: params.refundAmount,
      reason: params.reason,
    });
  }
}

// Singleton instance
let instance: OrderNotificationService | null = null;

export function getOrderNotificationService(): OrderNotificationService {
  if (!instance) {
    instance = new OrderNotificationService();
  }
  return instance;
}
