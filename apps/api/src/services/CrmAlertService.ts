/**
 * CrmAlertService — CRUD + read/dismiss for crm_alerts
 * Platform-generated alerts (milestones, subscription changes, welcome, etc.)
 */
import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateCrmAlertId } from '../lib/id-generator';

export class CrmAlertService extends BaseService {
  private static instance: CrmAlertService;

  private constructor() { super(); }

  static getInstance(): CrmAlertService {
    if (!CrmAlertService.instance) {
      CrmAlertService.instance = new CrmAlertService();
    }
    return CrmAlertService.instance;
  }

  async listByTenant(tenantId: string, filters: { type?: string; unreadOnly?: boolean } = {}) {
    const where: any = { tenant_id: tenantId, is_dismissed: false };
    if (filters.type) where.type = filters.type;
    if (filters.unreadOnly) where.is_read = false;
    return prisma.crm_alerts.findMany({ where, orderBy: { created_at: 'desc' } });
  }

  async getById(alertId: string) {
    return prisma.crm_alerts.findUnique({ where: { id: alertId } });
  }

  async create(data: {
    tenant_id: string;
    type: string;
    title: string;
    body?: string;
    icon?: string;
    metadata?: Record<string, any>;
  }) {
    return prisma.crm_alerts.create({
      data: {
        id: generateCrmAlertId(data.tenant_id),
        ...data,
        metadata: data.metadata ?? undefined,
      },
    });
  }

  /**
   * Create an order-related CRM alert.
   * Fire-and-forget from order routes/services — errors are logged, never thrown.
   */
  async createOrderAlert(params: {
    tenantId: string;
    orderId: string;
    orderNumber?: string;
    eventType: string;
    customerName?: string;
    amount?: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const orderRef = params.orderNumber || params.orderId;
      const amountFormatted = params.amount ? `$${(params.amount / 100).toFixed(2)}` : undefined;

      const titles: Record<string, string> = {
        order_placed: `New order received — ${orderRef}`,
        order_cancelled: `Order cancelled — ${orderRef}`,
        order_shipped: `Order shipped — ${orderRef}`,
        order_picked_up: `Order picked up — ${orderRef}`,
        order_out_for_delivery: `Out for delivery — ${orderRef}`,
        order_delivered: `Order delivered — ${orderRef}`,
        order_fulfilled: `Order fulfilled — ${orderRef}`,
        deposit_forfeited: `Deposit forfeited — ${orderRef}`,
        refund_processed: `Refund processed — ${orderRef}`,
        confirmed: `Order confirmed — ${orderRef}`,
        paid: `Order paid — ${orderRef}`,
        delivered: `Order delivered — ${orderRef}`,
        processing: `Order processing — ${orderRef}`,
        completed: `Order completed — ${orderRef}`,
      };

      const bodies: Record<string, string> = {
        order_placed: `New order from ${params.customerName || 'a customer'}${amountFormatted ? ` for ${amountFormatted}` : ''}.`,
        order_cancelled: `Order ${orderRef} has been cancelled.`,
        order_shipped: `Order ${orderRef} has been shipped.`,
        order_picked_up: `Order ${orderRef} has been picked up by the customer.`,
        order_out_for_delivery: `Order ${orderRef} is out for delivery and will arrive today.`,
        order_delivered: `Order ${orderRef} has been delivered.`,
        order_fulfilled: `Order ${orderRef} has been fulfilled and is ready.`,
        deposit_forfeited: `The deposit for order ${orderRef} has been forfeited.`,
        refund_processed: `A refund has been processed for order ${orderRef}${amountFormatted ? ` (${amountFormatted})` : ''}.`,
        confirmed: `Order ${orderRef} has been confirmed.`,
        paid: `Order ${orderRef} payment received${amountFormatted ? ` (${amountFormatted})` : ''}.`,
        delivered: `Order ${orderRef} has been delivered.`,
        processing: `Order ${orderRef} is being processed.`,
        completed: `Order ${orderRef} has been completed.`,
      };

      const icons: Record<string, string> = {
        order_placed: '🛒',
        order_cancelled: '❌',
        order_shipped: '🚚',
        order_picked_up: '✅',
        order_out_for_delivery: '🚚',
        order_delivered: '📦',
        order_fulfilled: '📦',
        deposit_forfeited: '💸',
        refund_processed: '💰',
        confirmed: '✅',
        paid: '💳',
        delivered: '📦',
        processing: '⏳',
        completed: '✅',
      };

      const title = titles[params.eventType] || `Order update — ${orderRef}`;
      const body = bodies[params.eventType] || `Order ${orderRef} status: ${params.eventType}`;
      const icon = icons[params.eventType] || '📋';

      await this.create({
        tenant_id: params.tenantId,
        type: 'order',
        title,
        body,
        icon,
        metadata: {
          order_id: params.orderId,
          order_number: params.orderNumber,
          event_type: params.eventType,
          ...(params.metadata || {}),
        },
      });
    } catch (error) {
      console.error('[CrmAlertService] Failed to create order alert:', error);
    }
  }

  async markRead(alertId: string) {
    return prisma.crm_alerts.update({
      where: { id: alertId },
      data: { is_read: true, read_at: new Date() },
    });
  }

  async markAllRead(tenantId: string) {
    return prisma.crm_alerts.updateMany({
      where: { tenant_id: tenantId, is_read: false, is_dismissed: false },
      data: { is_read: true, read_at: new Date() },
    });
  }

  async dismiss(alertId: string) {
    return prisma.crm_alerts.update({
      where: { id: alertId },
      data: { is_dismissed: true },
    });
  }

  async countUnread(tenantId: string) {
    return prisma.crm_alerts.count({
      where: { tenant_id: tenantId, is_read: false, is_dismissed: false },
    });
  }
}

export default CrmAlertService;
