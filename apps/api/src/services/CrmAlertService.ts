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

  /**
   * Create an abandoned cart recovery alert.
   * Visible to the customer in their CRM support portal.
   * Fire-and-forget — errors are logged, never thrown.
   */
  async createAbandonedCartAlert(params: {
    tenantId: string;
    abandonedCartId: string;
    customerEmail: string;
    customerName?: string;
    cartValueCents: number;
    itemCount: number;
    recoveryUrl?: string;
  }): Promise<void> {
    try {
      const amountFormatted = `$${(params.cartValueCents / 100).toFixed(2)}`;

      await this.create({
        tenant_id: params.tenantId,
        type: 'abandoned_cart',
        title: `Your cart at ${amountFormatted} is waiting for you`,
        body: `You left ${params.itemCount} item${params.itemCount !== 1 ? 's' : ''} in your cart. Complete your purchase before it's gone!`,
        icon: '🛒',
        metadata: {
          abandoned_cart_id: params.abandonedCartId,
          customer_email: params.customerEmail,
          cart_value_cents: params.cartValueCents,
          item_count: params.itemCount,
          recovery_url: params.recoveryUrl,
        },
      });
    } catch (error) {
      console.error('[CrmAlertService] Failed to create abandoned cart alert:', error);
    }
  }

  /**
   * Create a featured placement lifecycle alert.
   * Fire-and-forget from FeaturedPlacementService — errors are logged, never thrown.
   */
  async createFeaturedPlacementAlert(params: {
    tenantId: string;
    placementId: string;
    productName: string;
    planKey: string;
    surface: string;
    expiresAt: Date;
    durationDays: number;
    priceCents: number;
    alertType: 'featured_placement_active' | 'featured_placement_expiring' | 'featured_placement_urgent' | 'featured_placement_expired';
  }): Promise<void> {
    try {
      const expiresStr = params.expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const priceFormatted = `$${(params.priceCents / 100).toFixed(2)}`;

      const titles: Record<string, string> = {
        featured_placement_active: `Featured placement is now live — ${params.productName}`,
        featured_placement_expiring: `Your featured placement expires in 3 days — ${params.productName}`,
        featured_placement_urgent: `Your featured placement expires tomorrow — ${params.productName}`,
        featured_placement_expired: `Featured placement expired — ${params.productName}`,
      };

      const bodies: Record<string, string> = {
        featured_placement_active: `"${params.productName}" is now in the ${params.surface} channel for ${params.durationDays} days. Expires on ${expiresStr}.`,
        featured_placement_expiring: `"${params.productName}" ${params.surface} placement expires on ${expiresStr}. Renew to keep it visible.`,
        featured_placement_urgent: `"${params.productName}" ${params.surface} placement expires tomorrow. Renew now to avoid losing visibility.`,
        featured_placement_expired: `"${params.productName}" ${params.surface} placement has expired. The product is no longer in the spotlight channel.`,
      };

      const icons: Record<string, string> = {
        featured_placement_active: '🎉',
        featured_placement_expiring: '⏰',
        featured_placement_urgent: '⚠️',
        featured_placement_expired: '✅',
      };

      await this.create({
        tenant_id: params.tenantId,
        type: 'featured_placement',
        title: titles[params.alertType],
        body: bodies[params.alertType],
        icon: icons[params.alertType],
        metadata: {
          placement_id: params.placementId,
          product_name: params.productName,
          plan_key: params.planKey,
          surface: params.surface,
          expires_at: params.expiresAt.toISOString(),
          duration_days: params.durationDays,
          price_cents: params.priceCents,
          alert_type: params.alertType,
          price_formatted: priceFormatted,
        },
      });
    } catch (error) {
      console.error('[CrmAlertService] Failed to create featured placement alert:', error);
    }
  }

  /**
   * Create an App Store lifecycle alert.
   * Fire-and-forget from bsaas-purchases.ts — errors are logged, never thrown.
   */
  async createAppStoreAlert(params: {
    tenantId: string;
    featureKey: string;
    featureName: string;
    alertType: 'app_store_purchase' | 'app_store_trial' | 'app_store_cancel' | 'app_store_renewal_failed';
    priceCents?: number;
    billingCycle?: string;
    trialDays?: number;
  }): Promise<void> {
    try {
      const priceFormatted = params.priceCents ? `$${(params.priceCents / 100).toFixed(2)}` : '';
      const cycleLabel = params.billingCycle === 'annual' ? '/yr' : params.billingCycle === 'monthly' ? '/mo' : '';

      const titles: Record<string, string> = {
        app_store_purchase: `Feature purchased — ${params.featureName}`,
        app_store_trial: `Free trial started — ${params.featureName}`,
        app_store_cancel: `Feature cancelled — ${params.featureName}`,
        app_store_renewal_failed: `Renewal failed — ${params.featureName}`,
      };

      const bodies: Record<string, string> = {
        app_store_purchase: `You purchased "${params.featureName}" (${params.featureKey}) from the App Store${priceFormatted ? ` for ${priceFormatted}${cycleLabel}` : ''}. The feature is now active.`,
        app_store_trial: `Your ${params.trialDays}-day free trial of "${params.featureName}" (${params.featureKey}) has started. It will auto-convert to a paid subscription when the trial ends.`,
        app_store_cancel: `You cancelled "${params.featureName}" (${params.featureKey}). Access continues until the current billing period ends.`,
        app_store_renewal_failed: `Renewal payment failed for "${params.featureName}" (${params.featureKey}). The feature will enter a 7-day grace period before suspension.`,
      };

      const icons: Record<string, string> = {
        app_store_purchase: '🛒',
        app_store_trial: '🎁',
        app_store_cancel: '✅',
        app_store_renewal_failed: '⚠️',
      };

      await this.create({
        tenant_id: params.tenantId,
        type: 'app_store',
        title: titles[params.alertType],
        body: bodies[params.alertType],
        icon: icons[params.alertType],
        metadata: {
          feature_key: params.featureKey,
          feature_name: params.featureName,
          alert_type: params.alertType,
          price_cents: params.priceCents,
          billing_cycle: params.billingCycle,
          trial_days: params.trialDays,
          source: 'app_store',
        },
      });
    } catch (error) {
      console.error('[CrmAlertService] Failed to create App Store alert:', error);
    }
  }
}

export default CrmAlertService;
