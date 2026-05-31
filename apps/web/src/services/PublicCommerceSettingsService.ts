/**
 * Public Commerce Settings Service
 *
 * Extends PublicApiSingleton to provide resolved commerce settings
 * for public pages (storefront, checkout).
 * Uses the /api/public/tenant/:tenantId/commerce-settings endpoint.
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface CommerceSettings {
  deposit_enabled?: boolean;
  deposit_percentage?: number;
  deposit_min_cents?: number;
  deposit_max_cents?: number;
  full_payment_enabled?: boolean;
  auto_confirm_orders?: boolean;
  order_confirmation_minutes?: number;
  show_payment_options?: boolean;
  require_payment_upfront?: boolean;
  allow_payment_on_pickup?: boolean;
  notify_on_payment?: boolean;
  notify_on_deposit?: boolean;
  notify_on_fulfillment?: boolean;
}

class PublicCommerceSettingsService extends PublicApiSingleton {
  private static instance: PublicCommerceSettingsService;
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes

  protected constructor() {
    super('public-commerce-settings', {
      ttl: 15 * 60 * 1000,
    });
  }

  public static getInstance(): PublicCommerceSettingsService {
    if (!PublicCommerceSettingsService.instance) {
      PublicCommerceSettingsService.instance = new PublicCommerceSettingsService();
    }
    return PublicCommerceSettingsService.instance;
  }

  /**
   * Get commerce settings for a tenant.
   */
  async getCommerceSettings(tenantId: string): Promise<CommerceSettings | null> {
    if (!tenantId) {
      console.error('[PublicCommerceSettings] getCommerceSettings: tenantId is required');
      return null;
    }

    try {
      const result = await this.makePublicRequest<{ success: boolean; settings: CommerceSettings }>(
        `/api/public/tenant/${tenantId}/commerce-settings`,
        {},
        `commerce-settings-${tenantId}`,
        this.cacheTTL
      );

      if (!result.success) {
        console.error('[PublicCommerceSettings] Failed to get settings:', result.error);
        return null;
      }

      return result.data?.settings || null;
    } catch (error) {
      console.error('[PublicCommerceSettings] Failed to get settings:', error);
      return null;
    }
  }
}

export const publicCommerceSettingsService = PublicCommerceSettingsService.getInstance();
