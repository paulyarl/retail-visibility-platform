/**
 * CouponService — Frontend tenant-scoped coupon service
 * Extends TenantApiSingleton for authenticated tenant operations
 */
import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';

export interface Coupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  isActive: boolean;
  redemptionCount: number;
  expiresAt: string | null;
}

export class CouponService extends TenantApiSingleton {
  private static instance: CouponService;

  private constructor() {
    super('coupon-service', { ttl: 5 * 60 * 1000 });
  }

  public static getInstance(): CouponService {
    if (!CouponService.instance) {
      CouponService.instance = new CouponService();
    }
    return CouponService.instance;
  }

  public getServiceCachePatterns(): string[] {
    return ['coupons-*', 'coupon-analytics-*'];
  }

  public async invalidateServiceCaches(tenantId?: string, ...params: any[]): Promise<void> {
    if (tenantId) {
      this.invalidateCache(`coupons-${tenantId}`);
      this.invalidateCache(`coupon-analytics-${tenantId}`);
    }
  }

  async listCoupons(tenantId: string): Promise<{ coupons: Coupon[]; total: number }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/coupons`,
      {},
      `coupons-${tenantId}`,
      this.cacheTTL,
      { tenantId }
    );
    const responseData = result.data?.data || result.data;
    return responseData || { coupons: [], total: 0 };
  }

  async createCoupon(tenantId: string, input: any): Promise<Coupon> {
    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/coupons`,
      { method: 'POST', body: JSON.stringify(input) },
      undefined,
      0,
      { tenantId }
    );
    const responseData = result.data?.data || result.data;
    return responseData;
  }

  async updateCoupon(tenantId: string, couponId: string, updates: any): Promise<Coupon> {
    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/coupons/${couponId}`,
      { method: 'PUT', body: JSON.stringify(updates) },
      undefined,
      0,
      { tenantId }
    );
    const responseData = result.data?.data || result.data;
    return responseData;
  }

  async deactivateCoupon(tenantId: string, couponId: string): Promise<void> {
    await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/coupons/${couponId}`,
      { method: 'DELETE' },
      undefined,
      0,
      { tenantId }
    );
    await this.invalidateServiceCaches(tenantId);
  }

  async getCouponQR(tenantId: string, couponId: string): Promise<{
    id: string;
    code: string;
    discountType: string;
    discountValue: number;
    shortCodeUrl: string;
    fullUrl: string;
    autoId: string;
  }> {
    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/coupons/${couponId}/qr`,
      {},
      undefined,
      0,
      { tenantId }
    );
    const responseData = result.data?.data || result.data;
    return responseData;
  }
}
