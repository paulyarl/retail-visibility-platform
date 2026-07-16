import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { clientLogger } from '@/lib/client-logger';

interface MinimumPaymentAmount {
  amount: number; // in cents
  currency: string;
  displayAmount: string; // formatted for display
}

interface PaymentSettings {
  minimumPaymentAmount: MinimumPaymentAmount;
  platformFeePercentage?: number;
}

interface PaymentSettingsResponse {
  minimumPaymentAmount: MinimumPaymentAmount;
  platformFeePercentage?: number;
  updatedAt?: string;
  updatedBy?: string;
}

class AdminSettingsService extends AdminApiSingleton {
  private static instance: AdminSettingsService;

  private constructor() {
    super('admin-settings-service');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes cache for admin settings
  }

  public static getInstance(): AdminSettingsService {
    if (!AdminSettingsService.instance) {
      AdminSettingsService.instance = new AdminSettingsService();
    }
    return AdminSettingsService.instance;
  }

  /**
   * Get payment settings for the platform
   */
  async getPaymentSettings(): Promise<PaymentSettings | null> {
    try {
      const response = await this.makeDefaultRequest(
        '/api/admin/platform-settings/payment',
        {},
        'payment-settings',
        this.cacheTTL
      );

      if (!response.success) {
        clientLogger.error('[AdminSettingsService] Failed to get payment settings:', { detail: response.error });
        return null;
      }

      const data = response.data;
      if (!data || typeof data !== 'object' || !('minimumPaymentAmount' in data)) {
        return null;
      }

      return data as PaymentSettings;
    } catch (error) {
      clientLogger.error('[AdminSettingsService] Error getting payment settings:', { detail: error });
      return null;
    }
  }

  /**
   * Update payment settings for the platform
   */
  async updatePaymentSettings(settings: PaymentSettings): Promise<PaymentSettingsResponse | null> {
    try {
      // Clear cache to ensure fresh data
      this.invalidateCache('payment-settings');
      
      const response = await this.makeDefaultRequest('/api/admin/platform-settings/payment', {
        method: 'PUT',
        body: JSON.stringify(settings),
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.success) {
        clientLogger.error('[AdminSettingsService] Failed to update payment settings:', { detail: response.error });
        return null;
      }

      const data = response.data;
      if (!data || typeof data !== 'object' || !('minimumPaymentAmount' in data)) {
        return null;
      }

      return data as PaymentSettingsResponse;
    } catch (error) {
      clientLogger.error('[AdminSettingsService] Error updating payment settings:', { detail: error });
      return null;
    }
  }
}

// Export singleton instance
export const adminSettingsService = AdminSettingsService.getInstance();
