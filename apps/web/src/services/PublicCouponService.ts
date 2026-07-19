/**
 * PublicCouponService — Public-facing coupon validation + spotlight
 * Extends PublicApiSingleton for unauthenticated storefront access
 */
import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export class PublicCouponService extends PublicApiSingleton {
  private static instance: PublicCouponService;

  private constructor() {
    super('public-coupon-service', { ttl: 5 * 60 * 1000 });
  }

  public static getInstance(): PublicCouponService {
    if (!PublicCouponService.instance) {
      PublicCouponService.instance = new PublicCouponService();
    }
    return PublicCouponService.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['public-coupons-*'];
  }

  public async invalidateServiceCaches(tenantId?: string, ...params: any[]): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`public-coupons-${tenantId}`);
    }
  }

  async validateCoupon(tenantId: string, code: string, cartData?: any): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/public/tenants/${tenantId}/coupons/validate`,
      {
        method: 'POST',
        body: JSON.stringify({ code, ...cartData }),
      },
      `public-coupons-validate-${tenantId}-${code}`,
      this.cacheTTL
    );
    const responseData = result.data?.data || result.data;
    return responseData;
  }

  async getSpotlightCoupon(tenantId: string): Promise<any> {
    const result = await this.makeDefaultRequest<any>(
      `/api/public/tenants/${tenantId}/coupons/spotlight`,
      {},
      `public-coupons-spotlight-${tenantId}`,
      this.cacheTTL
    );
    const responseData = result.data?.data || result.data;
    return responseData;
  }

  async trackEvent(tenantId: string, event: { couponId?: string; couponCode?: string; eventType: string; surface: string; source?: string; sessionId?: string }): Promise<void> {
    try {
      await this.makeDefaultRequest<any>(
        `/api/public/coupon-events`,
        { method: 'POST', body: JSON.stringify({ tenantId, ...event }) },
        undefined,
        0
      );
    } catch {
      // non-critical — event tracking should not block UX
    }
  }
}
