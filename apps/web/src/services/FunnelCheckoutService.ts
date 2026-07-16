/**
 * Funnel Checkout Service
 *
 * Customer-facing service for resolving and interacting with sales funnels
 * during the checkout flow. Extends PublicApiSingleton (no auth required).
 *
 * Backend endpoints (funnel-checkout.ts):
 *   GET  /api/public/funnels/:tenantId/checkout        — resolve active funnel
 *   POST /api/public/funnels/:tenantId/order-bump      — accept/decline order bump
 *   POST /api/public/funnels/:tenantId/step/:stepId    — accept/decline upsell/downsell/OTO
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export type FunnelStepType = 'order_bump' | 'upsell' | 'downsell' | 'oto';

export interface CheckoutFunnelStep {
  id: string;
  step_type: FunnelStepType;
  offer_item_id: string;
  display_title: string | null;
  display_description: string | null;
  price_cents: number | null;
  discount_cents: number;
  sort_order: number;
}

export interface CheckoutFunnel {
  funnel_id: string;
  name: string;
  entry_item_id: string | null;
  trigger_type: string;
  steps: CheckoutFunnelStep[];
}

export interface FunnelStepResult {
  accepted: boolean;
  order_id: string;
  step_id: string;
  next_step_id: string | null;
  next_step: CheckoutFunnelStep | null;
  revenue_cents: number;
}

export interface OrderBumpResult {
  accepted: boolean;
  order_id: string;
  step_id: string;
  revenue_cents: number;
}

class FunnelCheckoutService extends PublicApiSingleton {
  private static instance: FunnelCheckoutService;

  public getServiceCachePatterns(): string[] {
    return ['funnel-checkout*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('funnel-checkout*');
  }

  private constructor() {
    super('funnel-checkout', {
      ttl: 60 * 1000, // 1 minute — short cache for checkout-time resolution
    });
  }

  public static getInstance(): FunnelCheckoutService {
    if (!FunnelCheckoutService.instance) {
      FunnelCheckoutService.instance = new FunnelCheckoutService();
    }
    return FunnelCheckoutService.instance;
  }

  /**
   * Resolve the active funnel for a checkout context.
   * Called before payment to check for order-bump offers.
   */
  async resolveCheckoutFunnel(
    tenantId: string,
    params: { triggerProductId?: string; cartValueCents?: number; sessionId?: string; customerId?: string }
  ): Promise<CheckoutFunnel | null> {
    try {
      const query = new URLSearchParams();
      if (params.triggerProductId) query.set('triggerProductId', params.triggerProductId);
      if (params.cartValueCents) query.set('cartValueCents', String(params.cartValueCents));
      if (params.sessionId) query.set('sessionId', params.sessionId);
      if (params.customerId) query.set('customerId', params.customerId);

      const result = await this.makeDefaultRequest<{
        success: boolean;
        funnel: CheckoutFunnel | null;
      }>(
        `/api/public/funnels/${tenantId}/checkout?${query.toString()}`,
        { method: 'GET' },
        `funnel-checkout-resolve-${tenantId}-${params.triggerProductId || ''}`
      );

      if (!result.success) return null;
      return result.data?.funnel || null;
    } catch (error) {
      console.error('[FunnelCheckoutService] Failed to resolve checkout funnel:', error);
      return null;
    }
  }

  /**
   * Process an order-bump decision (before payment).
   * If accepted, the offer is added to the order.
   */
  async processOrderBump(
    tenantId: string,
    params: {
      funnelId: string;
      stepId: string;
      orderId: string;
      accepted: boolean;
      sessionId?: string;
      customerId?: string;
    }
  ): Promise<OrderBumpResult | null> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        accepted: boolean;
        order_id: string;
        step_id: string;
        revenue_cents: number;
      }>(
        `/api/public/funnels/${tenantId}/order-bump`,
        {
          method: 'POST',
          body: JSON.stringify({
            funnelId: params.funnelId,
            stepId: params.stepId,
            orderId: params.orderId,
            accepted: params.accepted,
            sessionId: params.sessionId,
            customerId: params.customerId,
          }),
        },
        `funnel-order-bump-${tenantId}-${params.orderId}-${params.stepId}`
      );

      if (!result.success) return null;
      return {
        accepted: result.data?.accepted ?? false,
        order_id: result.data?.order_id || params.orderId,
        step_id: result.data?.step_id || params.stepId,
        revenue_cents: result.data?.revenue_cents || 0,
      };
    } catch (error) {
      console.error('[FunnelCheckoutService] Failed to process order bump:', error);
      return null;
    }
  }

  /**
   * Process an upsell/downsell/OTO step decision (after payment).
   * Returns the next step if one exists.
   */
  async processStep(
    tenantId: string,
    stepId: string,
    params: {
      funnelId: string;
      orderId: string;
      accepted: boolean;
      sessionId?: string;
      customerId?: string;
    }
  ): Promise<FunnelStepResult | null> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        accepted: boolean;
        order_id: string;
        step_id: string;
        next_step_id: string | null;
        next_step: CheckoutFunnelStep | null;
        revenue_cents: number;
      }>(
        `/api/public/funnels/${tenantId}/step/${stepId}`,
        {
          method: 'POST',
          body: JSON.stringify({
            funnelId: params.funnelId,
            orderId: params.orderId,
            accepted: params.accepted,
            sessionId: params.sessionId,
            customerId: params.customerId,
          }),
        },
        `funnel-step-${tenantId}-${params.orderId}-${stepId}`
      );

      if (!result.success) return null;
      return {
        accepted: result.data?.accepted ?? false,
        order_id: result.data?.order_id || params.orderId,
        step_id: result.data?.step_id || stepId,
        next_step_id: result.data?.next_step_id || null,
        next_step: result.data?.next_step || null,
        revenue_cents: result.data?.revenue_cents || 0,
      };
    } catch (error) {
      console.error('[FunnelCheckoutService] Failed to process funnel step:', error);
      return null;
    }
  }
}

export const funnelCheckoutService = FunnelCheckoutService.getInstance();
