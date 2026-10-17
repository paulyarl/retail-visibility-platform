/**
 * Public Flyer Service — Frontend Singleton
 *
 * Unauthenticated flyer reads for storefront/directory/place surfaces and the
 * standalone /flyer/[code] page. Extends PublicApiSingleton — no direct fetch().
 *
 * Spec: docs/LocalBiz/FLYER_SURFACE_SPEC.md §5.
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

export type FlyerSurface = 'storefront' | 'directory' | 'place';

export interface PublicFlyerItem {
  id: string;
  kind: 'variant' | 'item';
  /** Parent inventory item id — the product_id cart/checkout expects. */
  productId: string | null;
  sku: string | null;
  name: string | null;
  priceCents: number | null;
  salePriceCents: number | null;
  imageUrl: string | null;
  note: string | null;
  orderable: boolean;
  inStock: boolean;
}

export interface PublicFlyer {
  id: string;
  title: string;
  summary: string | null;
  heroImageUrl: string | null;
  window: { startsAt: string; endsAt: string };
  shareCode: string;
  shareUrl: string;
  items: PublicFlyerItem[];
  cta: { orderEnabled: boolean; pickupEnabled: boolean; pickupReadyMinutes: number | null };
}

export interface PublicFlyerFrozenItem {
  variantId: string;
  sku: string;
  name: string;
  priceCents: number | null;
  salePriceCents: number | null;
  inStock: number;
  imageUrl: string | null;
  sourceVariantId: string | null;
  orderable: boolean;
}

export interface PublicFlyerPayload {
  enabled: boolean;
  surfaces?: { storefront: boolean; directory: boolean; place: boolean };
  flyers?: PublicFlyer[];
  frozen?: PublicFlyerFrozenItem[];
  ended?: boolean;
}

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

class PublicFlyerService extends PublicApiSingleton {
  private static instance: PublicFlyerService;

  private constructor() {
    super('public-flyer-service', { ttl: 2 * 60 * 1000 });
  }

  getServiceCachePatterns(): string[] {
    return ['public-flyer-*'];
  }

  async invalidateServiceCaches(_tenantId?: string): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  static getInstance(): PublicFlyerService {
    if (!PublicFlyerService.instance) PublicFlyerService.instance = new PublicFlyerService();
    return PublicFlyerService.instance;
  }

  /** Flyers for a surface-scoped read (directory/place/storefront pages). */
  async getFlyers(slug: string, surface?: FlyerSurface, src?: string): Promise<PublicFlyerPayload> {
    const params = new URLSearchParams();
    if (surface) params.set('surface', surface);
    if (src) params.set('src', src);
    const qs = params.size ? `?${params.toString()}` : '';
    const result = await this.makeDefaultRequest<ApiEnvelope<PublicFlyerPayload>>(
      `/api/public/directory/${slug}/flyers${qs}`,
      { method: 'GET' },
      `public-flyer-${slug}-${surface ?? 'any'}-${src ?? 'direct'}`,
      this.cacheTTL,
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data.data ?? { enabled: false };
  }

  /** Standalone /flyer/[code] page — share_code or tenant slug. */
  async getFlyerByCode(code: string, src?: string): Promise<PublicFlyerPayload> {
    const qs = src ? `?src=${encodeURIComponent(src)}` : '';
    const result = await this.makeDefaultRequest<ApiEnvelope<PublicFlyerPayload>>(
      `/api/public/flyer/${code}${qs}`,
      { method: 'GET' },
      `public-flyer-code-${code}`,
      this.cacheTTL,
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data.data ?? { enabled: false };
  }

  async reportFlyer(code: string, reason: string, detail?: string): Promise<void> {
    const result = await this.makeDefaultRequest<ApiEnvelope<null>>(
      `/api/public/flyer/${code}/report`,
      { method: 'POST', body: JSON.stringify({ reason, detail }) },
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
  }

  /** Event write — directional only, never demand (spec §10). */
  async trackEvent(
    code: string,
    event: { type: 'click' | 'add_to_cart'; itemId?: string; surface?: FlyerSurface | 'standalone'; src?: string },
  ): Promise<void> {
    await this.makeDefaultRequest<ApiEnvelope<null>>(
      `/api/public/flyer/${code}/events`,
      { method: 'POST', body: JSON.stringify(event) },
    ).catch(() => {});
  }
}

export const publicFlyerService = PublicFlyerService.getInstance();
export default PublicFlyerService;
