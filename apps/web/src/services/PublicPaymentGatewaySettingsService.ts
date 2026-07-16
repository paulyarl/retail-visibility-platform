/**
 * Public Payment Gateway Settings Service
 *
 * Extends PublicApiSingleton to provide resolved payment gateway settings
 * for public pages (storefront, checkout).
 * Uses the /api/public/tenant/:tenantId/payment-gateway-settings endpoint.
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface PaymentGatewaySettings {
  gateway_enabled: boolean;
  stripe_enabled: boolean;
  paypal_enabled: boolean;
  square_enabled: boolean;
  clover_enabled: boolean;
}

class PublicPaymentGatewaySettingsService extends PublicApiSingleton {
  private static instance: PublicPaymentGatewaySettingsService;
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes

  protected constructor() {
    super('public-payment-gateway-settings', {
      ttl: 15 * 60 * 1000,
    });
  }

  public static getInstance(): PublicPaymentGatewaySettingsService {
    if (!PublicPaymentGatewaySettingsService.instance) {
      PublicPaymentGatewaySettingsService.instance = new PublicPaymentGatewaySettingsService();
    }
    return PublicPaymentGatewaySettingsService.instance;
  }

  /**
   * Get payment gateway settings for a tenant.
   */
  async getPaymentGatewaySettings(tenantId: string): Promise<PaymentGatewaySettings | null> {
    if (!tenantId) {
      clientLogger.error('[PublicPaymentGatewaySettings] getPaymentGatewaySettings: tenantId is required');
      return null;
    }

    try {
      const result = await this.makeDefaultRequest<{ success: boolean; settings: PaymentGatewaySettings }>(
        `/api/public/tenant/${tenantId}/payment-gateway-settings`,
        {},
        `payment-gateway-settings-${tenantId}`,
        this.cacheTTL
      );

      if (!result.success) {
        clientLogger.error('[PublicPaymentGatewaySettings] Failed to get settings:', { detail: result.error });
        return null;
      }

      return result.data?.settings || null;
    } catch (error) {
      clientLogger.error('[PublicPaymentGatewaySettings] Failed to get settings:', { detail: error });
      return null;
    }
  }
}

export const publicPaymentGatewaySettingsService = PublicPaymentGatewaySettingsService.getInstance();
