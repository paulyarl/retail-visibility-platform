/**
 * Abandoned Cart Service (Frontend)
 * Handles abandoned cart data for the merchant dashboard
 * Uses TenantApiSingleton for tenant-specific operations
 */

import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';

export interface AbandonedCart {
  id: string;
  tenant_id: string;
  cart_id: string | null;
  customer_email: string | null;
  customer_name: string | null;
  customer_id: string | null;
  items: CartItemData[];
  cart_value_cents: number;
  item_count: number;
  recovery_email_sent: boolean;
  recovery_email_sent_at: string | null;
  converted: boolean;
  converted_at: string | null;
  converted_order_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CartItemData {
  product_id: string;
  product_name: string;
  quantity: number;
  price_cents: number;
  product_image?: string;
  variant_id?: string;
  variant_name?: string;
}

export interface AbandonedCartSummary {
  totalAbandoned: number;
  totalValueCents: number;
  recoveredCount: number;
  recoveredValueCents: number;
  emailsSentCount: number;
  pendingRecoveryCount: number;
}

class AbandonedCartService extends TenantApiSingleton {
  private static instance: AbandonedCartService;
  protected cacheTTL: number = 5 * 60 * 1000;

  public getServiceCachePatterns(): string[] {
    return ['abandoned-cart-service*', 'abandoned-carts*'];
  }

  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('abandoned-cart-service*');
    await this.invalidateCachePattern('abandoned-carts*');
  }

  protected constructor(singletonKey: string, cacheOptions?: any) {
    super(singletonKey, {
      ttl: 5 * 60 * 1000,
      ...cacheOptions,
    });
  }

  static getInstance(): AbandonedCartService {
    if (!AbandonedCartService.instance) {
      AbandonedCartService.instance = new AbandonedCartService('abandoned-cart-service');
    }
    return AbandonedCartService.instance;
  }

  async getAbandonedCarts(
    tenantId: string,
    filters: { converted?: boolean; recoveryEmailSent?: boolean; limit?: number; offset?: number } = {}
  ): Promise<{ carts: AbandonedCart[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (filters.converted !== undefined) params.set('converted', String(filters.converted));
      if (filters.recoveryEmailSent !== undefined) params.set('recoveryEmailSent', String(filters.recoveryEmailSent));
      if (filters.limit) params.set('limit', String(filters.limit));
      if (filters.offset) params.set('offset', String(filters.offset));

      const queryString = params.toString();
      const endpoint = `/api/tenants/${tenantId}/abandoned-carts${queryString ? `?${queryString}` : ''}`;

      const response = await this.makeDefaultRequest<{
        success: boolean;
        carts: AbandonedCart[];
        total: number;
      }>(endpoint, {}, undefined, undefined, {
        context: this.defaultContext,
        isolation: this.defaultIsolation,
      });

      if (response.data) {
        return { carts: response.data.carts, total: response.data.total };
      }
      return { carts: [], total: 0 };
    } catch (error) {
      console.error('[AbandonedCartService] Error fetching abandoned carts:', error);
      return { carts: [], total: 0 };
    }
  }

  async getSummary(tenantId: string): Promise<AbandonedCartSummary | null> {
    try {
      const endpoint = `/api/tenants/${tenantId}/abandoned-carts/summary`;
      const response = await this.makeDefaultRequest<{
        success: boolean;
        summary: AbandonedCartSummary;
      }>(endpoint, {}, undefined, undefined, {
        context: this.defaultContext,
        isolation: this.defaultIsolation,
      });

      if (response.data) {
        return response.data.summary;
      }
      return null;
    } catch (error) {
      console.error('[AbandonedCartService] Error fetching summary:', error);
      return null;
    }
  }

  async resendRecoveryEmail(tenantId: string, cartId: string): Promise<boolean> {
    try {
      const endpoint = `/api/tenants/${tenantId}/abandoned-carts/${cartId}/resend`;
      const response = await this.makeDefaultRequest<{
        success: boolean;
        message?: string;
      }>(endpoint, { method: 'POST' });

      await this.invalidateServiceCaches(tenantId);
      return response.data?.success ?? false;
    } catch (error) {
      console.error('[AbandonedCartService] Error resending recovery email:', error);
      return false;
    }
  }
}

export const abandonedCartService = AbandonedCartService.getInstance();
