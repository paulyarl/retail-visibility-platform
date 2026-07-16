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
import CrmAlertService from './CrmAlertService';
import { logger } from '../logger';

export type OrderNotificationType = 
  | 'order_placed'
  | 'order_cancelled'
  | 'order_fulfilled'
  | 'order_picked_up'
  | 'order_shipped'
  | 'order_out_for_delivery'
  | 'order_delivered'
  | 'deposit_forfeited'
  | 'refund_processed'
  | 'digital_delivered'
  | 'service_scheduled'
  | 'service_completed';

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
      if (data.customerEmail && ['order_cancelled', 'order_fulfilled', 'order_shipped', 'order_out_for_delivery', 'order_delivered', 'deposit_forfeited', 'refund_processed', 'digital_delivered', 'service_scheduled', 'service_completed'].includes(data.type)) {
        const customerEmailPayload = this.buildCustomerEmailPayload(data.customerEmail, data.customerName || 'Customer', tenantName, data);
        const customerSent = await emailService.sendEmail(customerEmailPayload);
        emailsSent.push(customerSent.success);
      }

      const sent = emailsSent.length > 0 ? emailsSent.every(s => s) : true;

      // Log notification
      await this.logNotification(data, sent);

      // Create CRM alert (fire-and-forget)
      CrmAlertService.getInstance().createOrderAlert({
        tenantId: data.tenantId,
        orderId: data.orderId,
        orderNumber: data.orderNumber,
        eventType: data.type,
        customerName: data.customerName,
        amount: data.amount,
        metadata: data.metadata,
      }).catch(err => console.error('[OrderNotification] Failed to create CRM alert:', err));

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
      logger.error('[OrderNotification] Error sending notification:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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

      case 'order_fulfilled': {
        const fulfillmentMethod = data.metadata?.fulfillmentMethod || 'pickup';
        const isShipping = fulfillmentMethod === 'shipping';
        const trackingNumber = data.metadata?.trackingNumber;
        const carrier = data.metadata?.carrier;
        const trackingUrl = data.metadata?.trackingUrl;

        const subject = isShipping
          ? `Order Shipped - ${orderRef}`
          : `Order Ready for Pickup - ${orderRef}`;
        const headline = isShipping ? 'Order Shipped!' : 'Order Fulfilled';
        const message = isShipping
          ? `Your order <strong>${orderRef}</strong> has been shipped!`
          : `Your order <strong>${orderRef}</strong> has been fulfilled and is ready!`;

        let trackingHtml = '';
        let trackingText = '';
        if (isShipping && trackingNumber) {
          trackingHtml = `
            <div style="margin: 16px 0; padding: 12px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
              <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af;">Tracking Information</p>
              ${carrier ? `<p style="margin: 0 0 4px 0;"><strong>Carrier:</strong> ${carrier}</p>` : ''}
              <p style="margin: 0 0 4px 0;"><strong>Tracking #:</strong> ${trackingNumber}</p>
              ${trackingUrl ? `<p style="margin: 8px 0 0 0;"><a href="${trackingUrl}" style="color: #2563eb;">Track your package →</a></p>` : ''}
            </div>`;
          trackingText = `\nTracking Information:\n${carrier ? `Carrier: ${carrier}\n` : ''}Tracking #: ${trackingNumber}${trackingUrl ? `\nTrack: ${trackingUrl}` : ''}\n`;
        }

        return {
          to: toEmail,
          subject: subject,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">${headline}</h2>
              <p>Hi ${customerName},</p>
              <p>${message}</p>
              ${trackingHtml}
              <p><strong>Total:</strong> ${amountFormatted}</p>
              <p>Thank you for your business!</p>
              <p>Best regards,<br>${tenantName}</p>
            </div>
          `,
          text: `${headline}\n\nHi ${customerName},\n\n${isShipping ? `Your order ${orderRef} has been shipped!` : `Your order ${orderRef} has been fulfilled and is ready!`}${trackingText}\nTotal: ${amountFormatted}\n\nThank you for your business!\n\nBest regards,\n${tenantName}`,
        };
      }

      case 'order_shipped': {
        const shippedTrackingNumber = data.metadata?.trackingNumber || '';
        const shippedCarrier = data.metadata?.carrier || '';
        const shippedTrackingUrl = data.metadata?.trackingUrl || '';

        return {
          to: toEmail,
          subject: `Order Shipped - ${orderRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Order Shipped!</h2>
              <p>Hi ${customerName},</p>
              <p>Your order <strong>${orderRef}</strong> is on its way!</p>
              <div style="margin: 16px 0; padding: 12px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
                <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af;">Tracking Information</p>
                ${shippedCarrier ? `<p style="margin: 0 0 4px 0;"><strong>Carrier:</strong> ${shippedCarrier}</p>` : ''}
                <p style="margin: 0 0 4px 0;"><strong>Tracking #:</strong> ${shippedTrackingNumber}</p>
                ${shippedTrackingUrl ? `<p style="margin: 8px 0 0 0;"><a href="${shippedTrackingUrl}" style="color: #2563eb;">Track your package →</a></p>` : ''}
              </div>
              <p><strong>Total:</strong> ${amountFormatted}</p>
              <p>Best regards,<br>${tenantName}</p>
            </div>
          `,
          text: `Order Shipped!\n\nHi ${customerName},\n\nYour order ${orderRef} is on its way!\n\nTracking Information:\n${shippedCarrier ? `Carrier: ${shippedCarrier}\n` : ''}Tracking #: ${shippedTrackingNumber}${shippedTrackingUrl ? `\nTrack: ${shippedTrackingUrl}` : ''}\n\nTotal: ${amountFormatted}\n\nBest regards,\n${tenantName}`,
        };
      }

      case 'order_out_for_delivery': {
        const oodTrackingNumber = data.metadata?.trackingNumber || '';
        const oodCarrier = data.metadata?.carrier || '';
        const oodTrackingUrl = data.metadata?.trackingUrl || '';
        const estimatedDelivery = data.metadata?.estimatedDelivery;

        return {
          to: toEmail,
          subject: `Out for Delivery - ${orderRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #ea580c;">Out for Delivery!</h2>
              <p>Hi ${customerName},</p>
              <p>Your order <strong>${orderRef}</strong> is out for delivery and will arrive today!</p>
              <div style="margin: 16px 0; padding: 12px; background-color: #fff7ed; border: 1px solid #fdba74; border-radius: 8px;">
                <p style="margin: 0 0 8px 0; font-weight: 600; color: #9a3412;">Tracking Information</p>
                ${oodCarrier ? `<p style="margin: 0 0 4px 0;"><strong>Carrier:</strong> ${oodCarrier}</p>` : ''}
                <p style="margin: 0 0 4px 0;"><strong>Tracking #:</strong> ${oodTrackingNumber}</p>
                ${estimatedDelivery ? `<p style="margin: 0 0 4px 0;"><strong>Estimated Delivery:</strong> ${estimatedDelivery}</p>` : ''}
                ${oodTrackingUrl ? `<p style="margin: 8px 0 0 0;"><a href="${oodTrackingUrl}" style="color: #2563eb;">Track your package →</a></p>` : ''}
              </div>
              <p>Best regards,<br>${tenantName}</p>
            </div>
          `,
          text: `Out for Delivery!\n\nHi ${customerName},\n\nYour order ${orderRef} is out for delivery and will arrive today!\n\nTracking Information:\n${oodCarrier ? `Carrier: ${oodCarrier}\n` : ''}Tracking #: ${oodTrackingNumber}${estimatedDelivery ? `\nEstimated Delivery: ${estimatedDelivery}` : ''}${oodTrackingUrl ? `\nTrack: ${oodTrackingUrl}` : ''}\n\nBest regards,\n${tenantName}`,
        };
      }

      case 'order_delivered': {
        const delTrackingNumber = data.metadata?.trackingNumber || '';
        const delCarrier = data.metadata?.carrier || '';
        const delTrackingUrl = data.metadata?.trackingUrl || '';
        const remainingBalance = data.metadata?.remainingBalance;

        return {
          to: toEmail,
          subject: `Delivered - ${orderRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">Delivered!</h2>
              <p>Hi ${customerName},</p>
              <p>Your order <strong>${orderRef}</strong> has been delivered!</p>
              <div style="margin: 16px 0; padding: 12px; background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px;">
                <p style="margin: 0 0 8px 0; font-weight: 600; color: #166534;">Tracking Information</p>
                ${delCarrier ? `<p style="margin: 0 0 4px 0;"><strong>Carrier:</strong> ${delCarrier}</p>` : ''}
                <p style="margin: 0 0 4px 0;"><strong>Tracking #:</strong> ${delTrackingNumber}</p>
                ${delTrackingUrl ? `<p style="margin: 8px 0 0 0;"><a href="${delTrackingUrl}" style="color: #2563eb;">View tracking details →</a></p>` : ''}
              </div>
              <p><strong>Total:</strong> ${amountFormatted}</p>
              ${remainingBalance ? `<p style="color: #dc2626;"><strong>Remaining Balance:</strong> $${(remainingBalance / 100).toFixed(2)}</p>` : ''}
              <p>Thank you for your business!</p>
              <p>Best regards,<br>${tenantName}</p>
            </div>
          `,
          text: `Delivered!\n\nHi ${customerName},\n\nYour order ${orderRef} has been delivered!\n\nTracking Information:\n${delCarrier ? `Carrier: ${delCarrier}\n` : ''}Tracking #: ${delTrackingNumber}${delTrackingUrl ? `\nTrack: ${delTrackingUrl}` : ''}\n\nTotal: ${amountFormatted}${remainingBalance ? `\nRemaining Balance: $${(remainingBalance / 100).toFixed(2)}` : ''}\n\nThank you for your business!\n\nBest regards,\n${tenantName}`,
        };
      }

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

      case 'digital_delivered': {
        const downloadLinks = (data.metadata?.downloadLinks || []) as Array<{ productName: string; url: string; expiresAt?: string }>;
        const downloadHtml = downloadLinks.length > 0
          ? `<div style="margin: 16px 0; padding: 12px; background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px;">
               <p style="margin: 0 0 8px 0; font-weight: 600; color: #1e40af;">Your Downloads</p>
               ${downloadLinks.map(d => `<p style="margin: 4px 0;"><a href="${d.url}" style="color: #2563eb;">${d.productName} →</a>${d.expiresAt ? ` <span style="color: #6b7280; font-size: 0.875rem;">(expires ${d.expiresAt})</span>` : ''}</p>`).join('')}
             </div>`
          : '';
        const downloadText = downloadLinks.length > 0
          ? `\nYour Downloads:\n${downloadLinks.map(d => `- ${d.productName}: ${d.url}${d.expiresAt ? ` (expires ${d.expiresAt})` : ''}`).join('\n')}\n`
          : '';
        return {
          to: toEmail,
          subject: `Your Digital Products Are Ready - ${orderRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Digital Products Ready to Download</h2>
              <p>Hi ${customerName},</p>
              <p>Your digital products from order <strong>${orderRef}</strong> are ready to download!</p>
              ${downloadHtml}
              <p><strong>Total:</strong> ${amountFormatted}</p>
              <p>You can access your downloads anytime from your account.</p>
              <p>Best regards,<br>${tenantName}</p>
            </div>
          `,
          text: `Digital Products Ready to Download\n\nHi ${customerName},\n\nYour digital products from order ${orderRef} are ready to download!${downloadText}\nTotal: ${amountFormatted}\n\nYou can access your downloads anytime from your account.\n\nBest regards,\n${tenantName}`,
        };
      }

      case 'service_scheduled': {
        const appointmentDate = data.metadata?.appointmentDate || 'N/A';
        const appointmentTime = data.metadata?.appointmentTime || '';
        const providerName = data.metadata?.providerName;
        const serviceLocation = data.metadata?.serviceLocation;
        const apptHtml = `
          <div style="margin: 16px 0; padding: 12px; background-color: #f0fdf4; border: 1px solid #86efac; border-radius: 8px;">
            <p style="margin: 0 0 8px 0; font-weight: 600; color: #166534;">Appointment Details</p>
            <p style="margin: 0 0 4px 0;"><strong>Date:</strong> ${appointmentDate}</p>
            ${appointmentTime ? `<p style="margin: 0 0 4px 0;"><strong>Time:</strong> ${appointmentTime}</p>` : ''}
            ${providerName ? `<p style="margin: 0 0 4px 0;"><strong>Provider:</strong> ${providerName}</p>` : ''}
            ${serviceLocation ? `<p style="margin: 0 0 4px 0;"><strong>Location:</strong> ${serviceLocation}</p>` : ''}
          </div>`;
        const apptText = `\nAppointment Details:\nDate: ${appointmentDate}${appointmentTime ? `\nTime: ${appointmentTime}` : ''}${providerName ? `\nProvider: ${providerName}` : ''}${serviceLocation ? `\nLocation: ${serviceLocation}` : ''}\n`;
        return {
          to: toEmail,
          subject: `Service Confirmed - ${orderRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">Service Confirmed</h2>
              <p>Hi ${customerName},</p>
              <p>Your service booking for order <strong>${orderRef}</strong> has been confirmed!</p>
              ${apptHtml}
              <p><strong>Total:</strong> ${amountFormatted}</p>
              <p>If you need to reschedule, please contact us.</p>
              <p>Best regards,<br>${tenantName}</p>
            </div>
          `,
          text: `Service Confirmed\n\nHi ${customerName},\n\nYour service booking for order ${orderRef} has been confirmed!${apptText}\nTotal: ${amountFormatted}\n\nIf you need to reschedule, please contact us.\n\nBest regards,\n${tenantName}`,
        };
      }

      case 'service_completed': {
        return {
          to: toEmail,
          subject: `Service Completed - ${orderRef}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">Service Completed</h2>
              <p>Hi ${customerName},</p>
              <p>Your service from order <strong>${orderRef}</strong> has been completed.</p>
              <p><strong>Total:</strong> ${amountFormatted}</p>
              <p>Thank you for your business! We'd love to hear your feedback.</p>
              <p>Best regards,<br>${tenantName}</p>
            </div>
          `,
          text: `Service Completed\n\nHi ${customerName},\n\nYour service from order ${orderRef} has been completed.\n\nTotal: ${amountFormatted}\n\nThank you for your business! We'd love to hear your feedback.\n\nBest regards,\n${tenantName}`,
        };
      }

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
      logger.error('[OrderNotification] Failed to log notification:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
    fulfillmentMethod?: string;
    trackingNumber?: string;
    carrier?: string;
    trackingUrl?: string;
  }): Promise<boolean> {
    return this.sendNotification({
      tenantId: params.tenantId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      type: 'order_fulfilled',
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      amount: params.amount,
      metadata: {
        fulfillmentMethod: params.fulfillmentMethod || 'pickup',
        trackingNumber: params.trackingNumber || null,
        carrier: params.carrier || null,
        trackingUrl: params.trackingUrl || null,
      },
    });
  }

  /**
   * Notify when order is shipped (carrier tracking provided)
   */
  async notifyOrderShipped(params: {
    tenantId: string;
    orderId: string;
    orderNumber?: string;
    customerEmail: string;
    customerName?: string;
    amount: number;
    trackingNumber: string;
    carrier: string;
    trackingUrl?: string;
  }): Promise<boolean> {
    return this.sendNotification({
      tenantId: params.tenantId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      type: 'order_shipped',
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      amount: params.amount,
      metadata: {
        trackingNumber: params.trackingNumber,
        carrier: params.carrier,
        trackingUrl: params.trackingUrl || null,
      },
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

  /**
   * Notify when order is out for delivery
   */
  async notifyOrderOutForDelivery(params: {
    tenantId: string;
    orderId: string;
    orderNumber?: string;
    customerEmail: string;
    customerName?: string;
    amount: number;
    trackingNumber?: string;
    carrier?: string;
    trackingUrl?: string;
    estimatedDelivery?: string;
  }): Promise<boolean> {
    return this.sendNotification({
      tenantId: params.tenantId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      type: 'order_out_for_delivery',
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      amount: params.amount,
      metadata: {
        trackingNumber: params.trackingNumber || null,
        carrier: params.carrier || null,
        trackingUrl: params.trackingUrl || null,
        estimatedDelivery: params.estimatedDelivery || null,
      },
    });
  }

  /**
   * Notify when order has been delivered
   */
  async notifyOrderDelivered(params: {
    tenantId: string;
    orderId: string;
    orderNumber?: string;
    customerEmail: string;
    customerName?: string;
    amount: number;
    trackingNumber?: string;
    carrier?: string;
    trackingUrl?: string;
    remainingBalance?: number;
  }): Promise<boolean> {
    return this.sendNotification({
      tenantId: params.tenantId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      type: 'order_delivered',
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      amount: params.amount,
      metadata: {
        trackingNumber: params.trackingNumber || null,
        carrier: params.carrier || null,
        trackingUrl: params.trackingUrl || null,
        remainingBalance: params.remainingBalance || null,
      },
    });
  }

  /**
   * Notify when digital products are delivered (access granted)
   */
  async notifyDigitalDelivered(params: {
    tenantId: string;
    orderId: string;
    orderNumber?: string;
    customerEmail: string;
    customerName?: string;
    amount: number;
    downloadLinks?: Array<{ productName: string; url: string; expiresAt?: string }>;
  }): Promise<boolean> {
    return this.sendNotification({
      tenantId: params.tenantId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      type: 'digital_delivered',
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      amount: params.amount,
      metadata: {
        downloadLinks: params.downloadLinks || [],
      },
    });
  }

  /**
   * Notify when service booking is scheduled/confirmed
   */
  async notifyServiceScheduled(params: {
    tenantId: string;
    orderId: string;
    orderNumber?: string;
    customerEmail: string;
    customerName?: string;
    amount: number;
    appointmentDate?: string;
    appointmentTime?: string;
    providerName?: string;
    serviceLocation?: string;
  }): Promise<boolean> {
    return this.sendNotification({
      tenantId: params.tenantId,
      orderId: params.orderId,
      orderNumber: params.orderNumber,
      type: 'service_scheduled',
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      amount: params.amount,
      metadata: {
        appointmentDate: params.appointmentDate,
        appointmentTime: params.appointmentTime,
        providerName: params.providerName,
        serviceLocation: params.serviceLocation,
      },
    });
  }

  /**
   * Notify when service has been completed
   */
  async notifyServiceCompleted(params: {
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
      type: 'service_completed',
      customerEmail: params.customerEmail,
      customerName: params.customerName,
      amount: params.amount,
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
