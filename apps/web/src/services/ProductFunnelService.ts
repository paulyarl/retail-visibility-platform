'use client';

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

export interface ProductFunnelOfferItem {
  name: string | null;
  image_url: string | null;
  product_type: 'physical' | 'digital' | 'hybrid' | null;
  price_cents: number | null;
  stock: number | null;
  description: string | null;
  status?: string;
  is_active?: boolean;
}

export interface ProductFunnelCoupon {
  code: string;
  discount_type: string;
  discount_value: number;
  is_expired?: boolean;
  is_active?: boolean;
}

export interface ProductFunnelStep {
  id: string;
  step_type: 'order_bump' | 'upsell' | 'downsell' | 'oto' | 'coupon_offer' | string;
  offer_item_id: string | null;
  display_title: string | null;
  display_description: string | null;
  price_cents: number | null;
  discount_cents: number | null;
  sort_order: number | null;
  is_active?: boolean;
  offer_item: ProductFunnelOfferItem | null;
  coupon: ProductFunnelCoupon | null;
}

export interface ProductFunnelPreview {
  funnel_id: string;
  name: string | null;
  trigger_type: string | null;
  metadata: { show_preview?: boolean } | null;
  steps: ProductFunnelStep[];
}

export type PreviewEventType = 'preview_step_clicked' | 'preview_buy_now_clicked';

class ProductFunnelService extends PublicApiSingleton {
  protected defaultContext = AppContext.STORE;
  protected defaultIsolation = CacheIsolation.STORE;
  protected cacheTTL = 60 * 1000; // 60s cache per spec

  private static instance: ProductFunnelService;

  private constructor() {
    super('product-funnel-service', { ttl: 60 * 1000 });
  }

  public static getInstance(): ProductFunnelService {
    if (!ProductFunnelService.instance) {
      ProductFunnelService.instance = new ProductFunnelService();
    }
    return ProductFunnelService.instance;
  }

  async getProductFunnel(
    tenantId: string,
    productId: string,
    sessionId?: string | null,
    customerId?: string | null
  ): Promise<ProductFunnelPreview | null> {
    try {
      const query = new URLSearchParams();
      if (sessionId) query.set('sessionId', sessionId);
      if (customerId) query.set('customerId', customerId);
      const queryString = query.toString();
      const url = `/api/public/funnels/${tenantId}/product/${productId}${queryString ? `?${queryString}` : ''}`;

      const response = await this.makeDefaultRequest<any>(
        url,
        {},
        `product-funnel-${tenantId}-${productId}`,
        this.cacheTTL
      );

      if (!response.success) {
        clientLogger.error('[ProductFunnelService] Failed to load product funnel:', { detail: response.error });
        return null;
      }

      const data = response.data as { funnel?: ProductFunnelPreview | null } | undefined;
      return data?.funnel ?? null;
    } catch (error) {
      clientLogger.error('[ProductFunnelService] Failed to load product funnel:', { detail: error });
      return null;
    }
  }

  async trackPreviewEvent(
    tenantId: string,
    funnelId: string,
    stepId: string | null,
    eventType: PreviewEventType,
    productId: string,
    sessionId?: string | null,
    customerId?: string | null
  ): Promise<boolean> {
    try {
      const response = await this.makeDefaultRequest<any>(
        `/api/public/funnels/${tenantId}/preview-event`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            funnelId,
            stepId,
            eventType,
            productId,
            sessionId,
            customerId,
          }),
        },
        `preview-event-${tenantId}-${funnelId}-${stepId || 'none'}-${eventType}`,
        0 // no cache for tracking events
      );

      return response.success === true;
    } catch (error) {
      clientLogger.error('[ProductFunnelService] Failed to track preview event:', { detail: error });
      return false;
    }
  }
}

export const productFunnelService = ProductFunnelService.getInstance();
export default ProductFunnelService;
