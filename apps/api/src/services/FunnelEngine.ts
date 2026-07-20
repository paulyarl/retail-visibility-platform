/**
 * Funnel Engine
 *
 * Checkout-time resolution and execution for sales funnels.
 * - Finds the active funnel matching a trigger product or cart value.
 * - Adds order-bump offers to an existing order before payment.
 * - Processes upsell/downsell/OTO steps after an initial payment.
 */

import { BaseService } from './BaseService';
import { prisma } from '../prisma';
import { generateOrderItemId } from '../lib/id-generator';
import { resolveEffectiveCapabilities } from './EffectiveCapabilityResolver';
import FunnelAnalyticsService from './FunnelAnalyticsService';
import type { FunnelStepType } from './resolvers/types';

export interface CheckoutFunnel {
  funnel_id: string;
  name: string;
  entry_item_id: string | null;
  trigger_type: string;
  steps: {
    id: string;
    step_type: FunnelStepType;
    offer_item_id: string;
    display_title: string | null;
    display_description: string | null;
    price_cents: number | null;
    discount_cents: number;
    sort_order: number;
  }[];
}

export interface FunnelStepResult {
  accepted: boolean;
  order_id: string;
  step_id: string;
  next_step_id: string | null;
  next_step: CheckoutFunnel['steps'][number] | null;
  revenue_cents: number;
}

class FunnelEngine extends BaseService {
  private static instance: FunnelEngine;

  private constructor() {
    super();
  }

  static getInstance(): FunnelEngine {
    if (!FunnelEngine.instance) {
      FunnelEngine.instance = new FunnelEngine();
    }
    return FunnelEngine.instance;
  }

  /**
   * Find the active funnel that should run for the given checkout context.
   */
  async getCheckoutFunnel(
    tenantId: string,
    triggerProductId?: string,
    cartValueCents = 0
  ): Promise<CheckoutFunnel | null> {
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps?.effective.funnel.enabled) {
      return null;
    }

    const allowedSteps = caps.effective.funnel.allowed_steps || [];

    const where: any = {
      tenant_id: tenantId,
      is_active: true,
    };

    if (triggerProductId) {
      where.OR = [
        { entry_item_id: triggerProductId },
        { trigger_type: 'always' },
      ];
    } else {
      where.trigger_type = 'always';
    }

    const funnels = await prisma.tenant_sales_funnels.findMany({
      where,
      include: {
        tenant_funnel_steps: {
          where: { is_active: true },
          orderBy: { sort_order: 'asc' },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    for (const funnel of funnels) {
      const steps = funnel.tenant_funnel_steps;
      if (!steps || steps.length === 0) continue;

      if (funnel.trigger_type === 'cart_value' && (funnel.min_cart_value_cents ?? 0) > cartValueCents) {
        continue;
      }

      const filteredSteps = steps.filter((s) => allowedSteps.includes(s.step_type as FunnelStepType));
      if (filteredSteps.length === 0) continue;

      return {
        funnel_id: funnel.id,
        name: funnel.name,
        entry_item_id: funnel.entry_item_id,
        trigger_type: funnel.trigger_type,
        steps: filteredSteps.map((s) => ({
          id: s.id,
          step_type: s.step_type as FunnelStepType,
          offer_item_id: s.offer_item_id,
          display_title: s.display_title,
          display_description: s.display_description,
          price_cents: s.price_cents,
          discount_cents: s.discount_cents,
          sort_order: s.sort_order,
        })),
      };
    }

    return null;
  }

  /**
   * Add a funnel offer item to an existing order as a new order_item.
   */
  async addOfferToOrder(
    tenantId: string,
    orderId: string,
    offerItemId: string,
    priceCents: number | null,
    metadata: Record<string, any> = {}
  ): Promise<{ orderItemId: string; revenueCents: number } | null> {
    const item = await prisma.inventory_items.findFirst({
      where: { id: offerItemId, tenant_id: tenantId },
    });

    if (!item) {
      throw new Error('Offer item not found');
    }

    const unitPrice = priceCents ?? item.price_cents ?? 0;
    const orderItemId = generateOrderItemId(orderId, tenantId);

    const orderItem = await prisma.order_items.create({
      data: {
        id: orderItemId,
        order_id: orderId,
        inventory_item_id: item.id,
        sku: item.sku || 'FUNNEL-OFFER',
        name: item.name || 'Funnel Offer',
        description: item.description,
        image_url: item.image_url,
        quantity: 1,
        unit_price_cents: unitPrice,
        subtotal_cents: unitPrice,
        tax_cents: 0,
        discount_cents: 0,
        total_cents: unitPrice,
        list_price_cents: item.price_cents,
        product_type: item.product_type as any,
        metadata: {
          ...metadata,
          funnel_offer: true,
          source: 'funnel',
        },
      },
    });

    // Update order totals
    await prisma.orders.update({
      where: { id: orderId },
      data: {
        subtotal_cents: { increment: unitPrice },
        total_cents: { increment: unitPrice },
        updated_at: new Date(),
      },
    });

    return { orderItemId: orderItem.id, revenueCents: unitPrice };
  }

  /**
   * Process an order-bump decision before the initial payment.
   * If accepted, the offer is added to the order.
   */
  async processOrderBump(
    tenantId: string,
    funnelId: string,
    stepId: string,
    orderId: string,
    accepted: boolean,
    sessionId?: string,
    customerId?: string
  ): Promise<{ accepted: boolean; revenue_cents: number; orderItemId?: string }> {
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps?.effective.funnel.enabled || !caps.effective.funnel.allowed_steps.includes('order_bump')) {
      throw new Error('Order bump steps are not available for this tenant');
    }

    const step = await prisma.tenant_funnel_steps.findFirst({
      where: { id: stepId, funnel_id: funnelId, tenant_id: tenantId, step_type: 'order_bump', is_active: true },
    });

    if (!step) {
      throw new Error('Order bump step not found');
    }

    const analytics = FunnelAnalyticsService.getInstance();

    if (!accepted) {
      await analytics.trackFunnelEvent({
        tenantId,
        funnelId,
        stepId,
        eventType: 'declined',
        orderId,
        sessionId,
        customerId,
      });
      return { accepted: false, revenue_cents: 0 };
    }

    const added = await this.addOfferToOrder(tenantId, orderId, step.offer_item_id, step.price_cents, {
      funnel_id: funnelId,
      step_id: stepId,
      step_type: 'order_bump',
    });

    if (!added) {
      throw new Error('Failed to add order bump to order');
    }

    await analytics.trackFunnelEvent({
      tenantId,
      funnelId,
      stepId,
      eventType: 'accepted',
      orderId,
      sessionId,
      customerId,
      revenueCents: added.revenueCents,
    });

    return { accepted: true, revenue_cents: added.revenueCents, orderItemId: added.orderItemId };
  }

  /**
   * Determine the next post-payment funnel step for an order.
   * Looks for an active funnel whose entry_item_id matches one of the order's
   * original items, then returns the first upsell/downsell/OTO step.
   */
  async getNextStepForOrder(
    tenantId: string,
    orderId: string
  ): Promise<{ funnelId: string; stepId: string; step: CheckoutFunnel['steps'][number] } | null> {
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps?.effective.funnel.enabled) return null;

    const allowedSteps = caps.effective.funnel.allowed_steps || [];

    const orderItems = await prisma.order_items.findMany({
      where: { order_id: orderId },
      select: { inventory_item_id: true },
    });

    const itemIds = orderItems.map((oi) => oi.inventory_item_id).filter(Boolean) as string[];
    if (itemIds.length === 0) return null;

    const funnel = await prisma.tenant_sales_funnels.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
        entry_item_id: { in: itemIds },
      },
      include: {
        tenant_funnel_steps: {
          where: { is_active: true },
          orderBy: { sort_order: 'asc' },
        },
      },
    });

    if (!funnel || funnel.tenant_funnel_steps.length === 0) return null;

    // Post-payment steps exclude order_bump and must be in allowed_steps
    const step = funnel.tenant_funnel_steps.find(
      (s) => s.step_type !== 'order_bump' && allowedSteps.includes(s.step_type as FunnelStepType)
    );
    if (!step) return null;

    return {
      funnelId: funnel.id,
      stepId: step.id,
      step: {
        id: step.id,
        step_type: step.step_type as FunnelStepType,
        offer_item_id: step.offer_item_id,
        display_title: step.display_title,
        display_description: step.display_description,
        price_cents: step.price_cents,
        discount_cents: step.discount_cents,
        sort_order: step.sort_order,
      },
    };
  }

  /**
   * Process an upsell/downsell/OTO decision after the initial payment.
   * If accepted, the offer is added to the order and an off-session charge should
   * be initiated by the caller.
   */
  async processUpsellStep(
    tenantId: string,
    funnelId: string,
    stepId: string,
    orderId: string,
    accepted: boolean,
    sessionId?: string,
    customerId?: string
  ): Promise<FunnelStepResult> {
    const caps = await resolveEffectiveCapabilities(tenantId);
    if (!caps?.effective.funnel.enabled) {
      throw new Error('Funnel steps are not available for this tenant');
    }

    const allowedSteps = caps.effective.funnel.allowed_steps || [];

    const step = await prisma.tenant_funnel_steps.findFirst({
      where: { id: stepId, funnel_id: funnelId, tenant_id: tenantId, is_active: true },
    });

    if (!step) {
      throw new Error('Funnel step not found');
    }

    if (!allowedSteps.includes(step.step_type as FunnelStepType)) {
      throw new Error(`Funnel step type '${step.step_type}' is not available for this tenant`);
    }

    const analytics = FunnelAnalyticsService.getInstance();
    let revenueCents = 0;
    let orderItemId: string | undefined;

    if (accepted) {
      const added = await this.addOfferToOrder(tenantId, orderId, step.offer_item_id, step.price_cents, {
        funnel_id: funnelId,
        step_id: stepId,
        step_type: step.step_type,
      });

      if (!added) {
        throw new Error('Failed to add upsell offer to order');
      }

      revenueCents = added.revenueCents;
      orderItemId = added.orderItemId;
    }

    await analytics.trackFunnelEvent({
      tenantId,
      funnelId,
      stepId,
      eventType: accepted ? 'accepted' : 'declined',
      orderId,
      sessionId,
      customerId,
      revenueCents,
    });

    // Resolve next step (accept_to_step_id or skip_to_step_id)
    const nextStepId = accepted ? step.accept_to_step_id : step.skip_to_step_id;

    if (!nextStepId) {
      return { accepted, order_id: orderId, step_id: stepId, next_step_id: null, next_step: null, revenue_cents: revenueCents };
    }

    const nextStep = await prisma.tenant_funnel_steps.findFirst({
      where: { id: nextStepId, funnel_id: funnelId, tenant_id: tenantId, is_active: true },
    });

    const nextStepAllowed = nextStep && allowedSteps.includes(nextStep.step_type as FunnelStepType);

    return {
      accepted,
      order_id: orderId,
      step_id: stepId,
      next_step_id: nextStepId,
      next_step: nextStep && nextStepAllowed
        ? {
            id: nextStep.id,
            step_type: nextStep.step_type as FunnelStepType,
            offer_item_id: nextStep.offer_item_id,
            display_title: nextStep.display_title,
            display_description: nextStep.display_description,
            price_cents: nextStep.price_cents,
            discount_cents: nextStep.discount_cents,
            sort_order: nextStep.sort_order,
          }
        : null,
      revenue_cents: revenueCents,
    };
  }
}

export default FunnelEngine;
