/**
 * Admin BSaaS Promotions Service
 *
 * Service for managing Stripe Coupons and Promotion Codes via admin API.
 */

import { AdminApiSingleton } from '../providers/base/AdminApiSingleton';

export interface BsaasCoupon {
  id: string;
  name: string;
  percent_off: number | null;
  amount_off: number | null;
  duration: 'once' | 'repeating' | 'forever';
  duration_in_months: number | null;
  valid: boolean;
  created: number;
}

export interface BsaasPromotionCode {
  id: string;
  code: string;
  coupon_id: string;
  max_redemptions: number | null;
  times_redeemed: number;
  active: boolean;
  expires_at: number | null;
  created: number;
}

export interface BsaasPromotionsData {
  coupons: BsaasCoupon[];
  promotionCodes: BsaasPromotionCode[];
}

export interface CreateCouponRequest {
  percent_off?: number;
  amount_off?: number;
  duration: 'once' | 'repeating' | 'forever';
  duration_in_months?: number;
  name: string;
}

export interface CreatePromotionCodeRequest {
  coupon_id: string;
  code?: string;
  max_redemptions?: number;
  expires_at?: string;
}

class AdminBsaasPromotionsService extends AdminApiSingleton {
  private static instance: AdminBsaasPromotionsService;

  private constructor() {
    super('AdminBsaasPromotionsService');
  }

  static getInstance(): AdminBsaasPromotionsService {
    if (!AdminBsaasPromotionsService.instance) {
      AdminBsaasPromotionsService.instance = new AdminBsaasPromotionsService();
    }
    return AdminBsaasPromotionsService.instance;
  }

  async getPromotions(): Promise<BsaasPromotionsData> {
    const result = await this.makeDefaultRequest<BsaasPromotionsData>(
      '/api/admin/bsaas-promotions',
      {},
      'admin-bsaas-promotions',
      this.cacheTTL,
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to fetch BSaaS promotions');
    }
    const data = (result.data as any)?.data || result.data;
    return data;
  }

  async createCoupon(req: CreateCouponRequest): Promise<BsaasCoupon> {
    const result = await this.makeDefaultRequest<BsaasCoupon>(
      '/api/admin/bsaas-promotions/coupon',
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create coupon');
    }
    return (result.data as any)?.data || result.data;
  }

  async createPromotionCode(req: CreatePromotionCodeRequest): Promise<BsaasPromotionCode> {
    const result = await this.makeDefaultRequest<BsaasPromotionCode>(
      '/api/admin/bsaas-promotions/promotion',
      {
        method: 'POST',
        body: JSON.stringify(req),
      },
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to create promotion code');
    }
    return (result.data as any)?.data || result.data;
  }

  async deactivatePromotionCode(id: string): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      `/api/admin/bsaas-promotions/promotion/${id}`,
      {
        method: 'DELETE',
      },
    );
    if (!result.success) {
      throw new Error(typeof result.error === 'string' ? result.error : 'Failed to deactivate promotion code');
    }
  }
}

export const adminBsaasPromotionsService = AdminBsaasPromotionsService.getInstance();
