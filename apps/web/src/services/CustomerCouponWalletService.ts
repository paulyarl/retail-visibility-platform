/**
 * Customer Coupon Wallet Service
 *
 * Frontend service for customer saved-coupon management.
 * Extends CustomerApiSingleton for automatic customer JWT handling.
 */

import { CustomerApiSingleton } from '@/providers/base/CustomerApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export type SavedCouponStatus = 'saved' | 'redeemed' | 'expired';

export interface SavedCoupon {
  savedCouponId: string;
  couponId: string;
  tenantId: string;
  tenantName: string | null;
  tenantLogo: string | null;
  code: string;
  discountType: string;
  discountValue: number;
  promotionalMessage: string | null;
  termsSummary: string | null;
  expiresAt: string | null;
  status: SavedCouponStatus;
  savedAt: string;
  redeemedAt: string | null;
  expiredAt: string | null;
}

export interface WalletStats {
  totalSaved: number;
  active: number;
  expiringSoon: number;
  redeemed: number;
  totalSavingsCents: number;
}

export interface WalletFilters {
  status?: SavedCouponStatus;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

class CustomerCouponWalletService extends CustomerApiSingleton {
  private static instance: CustomerCouponWalletService;

  private constructor() {
    super('customer-coupon-wallet-service', { ttl: 60000 });
  }

  getServiceCachePatterns(): string[] {
    return [
      'customer-coupon-wallet-list',
      'customer-coupon-wallet-stats',
      'customer-coupon-wallet-expiring',
      'customer-coupon-wallet-tenant-*',
      'customer-coupon-save-*',
    ];
  }

  async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  static getInstance(): CustomerCouponWalletService {
    if (!CustomerCouponWalletService.instance) {
      CustomerCouponWalletService.instance = new CustomerCouponWalletService();
    }
    return CustomerCouponWalletService.instance;
  }

  async saveCoupon(
    tenantId: string,
    couponId: string,
    surface?: string
  ): Promise<{ success: boolean; savedCoupon?: SavedCoupon; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        savedCoupon: SavedCoupon;
      }>(
        '/api/customer-coupons/save',
        {
          method: 'POST',
          credentials: 'include',
          body: JSON.stringify({ tenantId, couponId, surface }),
        },
        `customer-coupon-save-${couponId}`
      );

      if (result.success && result.data?.success) {
        await this.invalidateServiceCaches();
        return { success: true, savedCoupon: result.data.savedCoupon };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      clientLogger.error('[CustomerCouponWallet] Save error:', { detail: error });
      return { success: false, error: 'Failed to save coupon' };
    }
  }

  async unsaveCoupon(savedCouponId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{ success: boolean; message?: string }>(
        `/api/customer-coupons/${encodeURIComponent(savedCouponId)}`,
        {
          method: 'DELETE',
          credentials: 'include',
        },
        `customer-coupon-unsave-${savedCouponId}`
      );

      if (result.success && result.data?.success) {
        await this.invalidateServiceCaches();
        return { success: true };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      clientLogger.error('[CustomerCouponWallet] Unsave error:', { detail: error });
      return { success: false, error: 'Failed to remove coupon' };
    }
  }

  async getWallet(filters: WalletFilters = {}): Promise<{ success: boolean; savedCoupons?: SavedCoupon[]; error?: string }> {
    try {
      const params = new URLSearchParams();
      if (filters.status) params.set('status', filters.status);
      if (filters.tenantId) params.set('tenantId', filters.tenantId);
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.offset) params.set('offset', String(filters.offset));
      const query = params.toString() ? `?${params.toString()}` : '';

      const result = await this.makeDefaultRequest<{
        success: boolean;
        savedCoupons: SavedCoupon[];
      }>(
        `/api/customer-coupons/wallet${query}`,
        {
          method: 'GET',
          credentials: 'include',
        },
        'customer-coupon-wallet-list'
      );

      if (result.success && result.data?.success) {
        return { success: true, savedCoupons: result.data.savedCoupons };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      clientLogger.error('[CustomerCouponWallet] List error:', { detail: error });
      return { success: false, error: 'Failed to load wallet' };
    }
  }

  async getWalletByTenant(
    tenantId: string,
    status?: SavedCouponStatus
  ): Promise<{ success: boolean; savedCoupons?: SavedCoupon[]; error?: string }> {
    try {
      const query = status ? `?status=${encodeURIComponent(status)}` : '';
      const result = await this.makeDefaultRequest<{
        success: boolean;
        savedCoupons: SavedCoupon[];
      }>(
        `/api/customer-coupons/wallet/by-tenant/${encodeURIComponent(tenantId)}${query}`,
        {
          method: 'GET',
          credentials: 'include',
        },
        `customer-coupon-wallet-tenant-${tenantId}`
      );

      if (result.success && result.data?.success) {
        return { success: true, savedCoupons: result.data.savedCoupons };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      clientLogger.error('[CustomerCouponWallet] Tenant wallet error:', { detail: error });
      return { success: false, error: 'Failed to load coupons for merchant' };
    }
  }

  async getStats(): Promise<{ success: boolean; stats?: WalletStats; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        stats: WalletStats;
      }>(
        '/api/customer-coupons/stats',
        {
          method: 'GET',
          credentials: 'include',
        },
        'customer-coupon-wallet-stats'
      );

      if (result.success && result.data?.success) {
        return { success: true, stats: result.data.stats };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      clientLogger.error('[CustomerCouponWallet] Stats error:', { detail: error });
      return { success: false, error: 'Failed to load wallet stats' };
    }
  }

  async getExpiringSoon(daysThreshold: number = 7): Promise<{ success: boolean; savedCoupons?: SavedCoupon[]; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        savedCoupons: SavedCoupon[];
      }>(
        `/api/customer-coupons/expiring?daysThreshold=${encodeURIComponent(daysThreshold)}`,
        {
          method: 'GET',
          credentials: 'include',
        },
        'customer-coupon-wallet-expiring'
      );

      if (result.success && result.data?.success) {
        return { success: true, savedCoupons: result.data.savedCoupons };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      clientLogger.error('[CustomerCouponWallet] Expiring error:', { detail: error });
      return { success: false, error: 'Failed to load expiring coupons' };
    }
  }

  async getSaveableCoupons(
    tenantId: string
  ): Promise<{ success: boolean; coupons?: any[]; error?: string }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        coupons: any[];
      }>(
        `/api/public/tenants/${encodeURIComponent(tenantId)}/coupons/saveable`,
        {
          method: 'GET',
          credentials: 'include',
        },
        `customer-coupon-saveable-${tenantId}`
      );

      if (result.success && result.data?.success) {
        return { success: true, coupons: result.data.coupons };
      }

      return { success: false, error: getErrorMessage(result.error) };
    } catch (error: any) {
      clientLogger.error('[CustomerCouponWallet] Saveable coupons error:', { detail: error });
      return { success: false, error: 'Failed to load saveable coupons' };
    }
  }
}

export default CustomerCouponWalletService.getInstance();
