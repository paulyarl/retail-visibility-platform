/**
 * Order Receipt Email Service
 *
 * Sends customer order receipt emails with itemized products, prices, totals,
 * and type-specific information (download links for digital, appointment details
 * for service, shipping info for physical).
 *
 * Triggered after successful payment via PostPaymentFulfillment.
 */

import { prisma } from '../prisma';
import { emailService } from './email-service';
import { logger } from '../logger';

interface ReceiptItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productType?: string;
  variantName?: string;
  downloadUrl?: string;
  accessExpiry?: Date | null;
  downloadLimit?: number | null;
  appointmentDate?: string;
  appointmentTime?: string;
  providerName?: string;
  serviceLocation?: string;
}

class OrderReceiptEmailService {
  /**
   * Send order receipt email after successful payment
   */
  async sendReceiptEmail(orderId: string, baseUrl?: string): Promise<void> {
    try {
      const order = await prisma.orders.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          order_number: true,
          tenant_id: true,
          customer_email: true,
          customer_name: true,
          total_cents: true,
          subtotal_cents: true,
          tax_cents: true,
          shipping_cents: true,
          order_status: true,
          metadata: true,
        },
      });

      if (!order) {
        logger.error('[OrderReceiptEmail] Order not found:', undefined, { error: { name: (orderId as any)?.name || 'Error', message: (orderId as any)?.message || String(orderId), stack: (orderId as any)?.stack } });
        return;
      }

      if (!order.customer_email) {
        console.log('[OrderReceiptEmail] No customer email on order, skipping:', orderId);
        return;
      }

      const items = await this.getOrderItems(orderId);

      const tenant = await prisma.tenants.findUnique({
        where: { id: order.tenant_id },
        select: { name: true },
      });
      const tenantName = tenant?.name || 'Store';

      const amountFormatted = `$${((order.total_cents || 0) / 100).toFixed(2)}`;
      const subtotalFormatted = `$${((order.subtotal_cents || 0) / 100).toFixed(2)}`;
      const taxFormatted = order.tax_cents ? `$${(order.tax_cents / 100).toFixed(2)}` : null;
      const shippingFormatted = order.shipping_cents ? `$${(order.shipping_cents / 100).toFixed(2)}` : null;

      const itemsHtml = items.map(item => this.renderItemHtml(item)).join('');
      const itemsText = items.map(item => this.renderItemText(item)).join('\n');

      const orderRef = order.order_number || order.id;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Order Receipt</h2>
          <p>Hi ${order.customer_name || 'Customer'},</p>
          <p>Thank you for your purchase! Here's your receipt for order <strong>${orderRef}</strong>.</p>

          <div style="margin: 16px 0;">
            <h3 style="margin: 0 0 8px 0; font-size: 1rem; font-weight: 600;">Items</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid #e5e7eb;">
                  <th style="text-align: left; padding: 8px 0; font-size: 0.875rem;">Product</th>
                  <th style="text-align: center; padding: 8px 0; font-size: 0.875rem;">Qty</th>
                  <th style="text-align: right; padding: 8px 0; font-size: 0.875rem;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
          </div>

          <div style="margin: 16px 0; padding: 12px; background-color: #f9fafb; border-radius: 8px;">
            <p style="margin: 0 0 4px 0; display: flex; justify-content: space-between;"><span>Subtotal:</span> <span>${subtotalFormatted}</span></p>
            ${taxFormatted ? `<p style="margin: 0 0 4px 0; display: flex; justify-content: space-between;"><span>Tax:</span> <span>${taxFormatted}</span></p>` : ''}
            ${shippingFormatted ? `<p style="margin: 0 0 4px 0; display: flex; justify-content: space-between;"><span>Shipping:</span> <span>${shippingFormatted}</span></p>` : ''}
            <p style="margin: 4px 0 0 0; display: flex; justify-content: space-between; font-weight: 600; font-size: 1.125rem;"><span>Total:</span> <span>${amountFormatted}</span></p>
          </div>

          <p>You can view your order details anytime from your account.</p>
          <p>Best regards,<br>${tenantName}</p>
        </div>
      `;

      const text = `Order Receipt\n\nHi ${order.customer_name || 'Customer'},\n\nThank you for your purchase! Here's your receipt for order ${orderRef}.\n\nItems:\n${itemsText}\n\nSubtotal: ${subtotalFormatted}${taxFormatted ? `\nTax: ${taxFormatted}` : ''}${shippingFormatted ? `\nShipping: ${shippingFormatted}` : ''}\nTotal: ${amountFormatted}\n\nYou can view your order details anytime from your account.\n\nBest regards,\n${tenantName}`;

      await emailService.sendEmail({
        to: order.customer_email,
        subject: `Order Receipt - ${orderRef}`,
        html,
        text,
      });

      console.log('[OrderReceiptEmail] Receipt email sent for order:', orderId);
    } catch (error) {
      logger.error('[OrderReceiptEmail] Error sending receipt email:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    }
  }

  /**
   * Fetch order items with product type info
   */
  private async getOrderItems(orderId: string): Promise<ReceiptItem[]> {
    const orderItems = await prisma.order_items.findMany({
      where: { order_id: orderId },
      select: {
        id: true,
        name: true,
        quantity: true,
        unit_price_cents: true,
        total_cents: true,
        variant_name: true,
        product_type: true,
      },
    });

    // Also fetch digital access grants for download links
    const grants = await prisma.digital_access_grants.findMany({
      where: { order_id: orderId },
      select: {
        access_token: true,
        max_downloads: true,
        access_expires_at: true,
        order_items: {
          select: { name: true },
        },
      },
    }).catch(() => []);

    const baseUrl = process.env.FRONTEND_URL || process.env.WEB_URL || 'http://localhost:3000';

    return orderItems.map(item => {
      const productType = item.product_type || 'physical';
      const grant = grants.find(g => g.order_items?.name === item.name);
      return {
        productName: item.name,
        quantity: item.quantity,
        unitPrice: item.unit_price_cents,
        totalPrice: item.total_cents,
        productType,
        variantName: item.variant_name || undefined,
        downloadUrl: grant ? `${baseUrl}/download/${grant.access_token}` : undefined,
        accessExpiry: grant?.access_expires_at || null,
        downloadLimit: grant?.max_downloads || null,
      };
    });
  }

  /**
   * Render a single item as HTML table row
   */
  private renderItemHtml(item: ReceiptItem): string {
    const unitPriceFormatted = `$${(item.unitPrice / 100).toFixed(2)}`;
    const totalPriceFormatted = `$${(item.totalPrice / 100).toFixed(2)}`;
    const typeBadge = this.getTypeBadgeHtml(item.productType);
    const variantInfo = item.variantName ? `<br><span style="font-size: 0.75rem; color: #6b7280;">${item.variantName}</span>` : '';
    const downloadInfo = item.downloadUrl
      ? `<br><span style="font-size: 0.75rem; color: #2563eb;"><a href="${item.downloadUrl}" style="color: #2563eb;">Download →</a>${item.accessExpiry ? ` (expires ${new Date(item.accessExpiry).toLocaleDateString()})` : ''}</span>`
      : '';

    return `<tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 8px 0; font-size: 0.875rem;">${typeBadge}${item.productName}${variantInfo}${downloadInfo}</td>
      <td style="text-align: center; padding: 8px 0; font-size: 0.875rem;">${item.quantity}</td>
      <td style="text-align: right; padding: 8px 0; font-size: 0.875rem;">${totalPriceFormatted}</td>
    </tr>`;
  }

  /**
   * Render a single item as plain text
   */
  private renderItemText(item: ReceiptItem): string {
    const totalPriceFormatted = `$${(item.totalPrice / 100).toFixed(2)}`;
    const typeLabel = this.getTypeLabel(item.productType);
    const variantInfo = item.variantName ? ` (${item.variantName})` : '';
    const downloadInfo = item.downloadUrl ? ` - Download: ${item.downloadUrl}` : '';
    return `- [${typeLabel}] ${item.productName}${variantInfo} x${item.quantity} = ${totalPriceFormatted}${downloadInfo}`;
  }

  /**
   * Get a small HTML badge for product type
   */
  private getTypeBadgeHtml(productType?: string): string {
    const type = productType || 'physical';
    const badges: Record<string, string> = {
      digital: '<span style="display: inline-block; padding: 1px 6px; border-radius: 9999px; font-size: 0.625rem; background: #dbeafe; color: #1e40af; margin-right: 4px;">Digital</span>',
      service: '<span style="display: inline-block; padding: 1px 6px; border-radius: 9999px; font-size: 0.625rem; background: #dcfce7; color: #166534; margin-right: 4px;">Service</span>',
      hybrid: '<span style="display: inline-block; padding: 1px 6px; border-radius: 9999px; font-size: 0.625rem; background: #f3e8ff; color: #6b21a8; margin-right: 4px;">Hybrid</span>',
    };
    return badges[type] || '';
  }

  /**
   * Get plain text label for product type
   */
  private getTypeLabel(productType?: string): string {
    const type = productType || 'physical';
    const labels: Record<string, string> = {
      physical: 'Physical',
      digital: 'Digital',
      service: 'Service',
      hybrid: 'Hybrid',
    };
    return labels[type] || 'Physical';
  }
}

export const orderReceiptEmailService = new OrderReceiptEmailService();
