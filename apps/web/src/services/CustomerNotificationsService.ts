/**
 * Customer Notifications Service
 * Handles customer notification preferences
 */

import { CustomerApiSingleton } from '@/providers/base/CustomerApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';
import customerAuthService from './CustomerAuthService';
import { clientLogger } from '@/lib/client-logger';

export interface NotificationPreferences {
  // Order notifications
  orderUpdates: boolean;
  shippingUpdates: boolean;
  
  // Engagement notifications (hearts, reviews, lists)
  heartUpdates: boolean;
  reviewReminders: boolean;
  reviewResponses: boolean;
  listUpdates: boolean;
  listReminders: boolean;
  
  // Marketing notifications
  promotionalEmails: boolean;
  recommendedProducts: boolean;
  priceDropAlerts: boolean;
  backInStock: boolean;
  
  // SMS settings
  smsEnabled: boolean;
  smsPhone?: string;
}

class CustomerNotificationsService extends CustomerApiSingleton {
  constructor() {
    super('customer-notifications');
  }

  getServiceCachePatterns(): string[] {
    return ['customer-notifications-get', 'customer-notifications-update'];
  }

  async invalidateServiceCaches(customerId?: string): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  /**
   * Get notification preferences
   */
  async getPreferences(): Promise<{
    success: boolean;
    preferences?: NotificationPreferences;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        preferences: NotificationPreferences;
      }>(
        '/api/customer-notifications/preferences',
        {
          method: 'GET',
          credentials: 'include',
        },
        'customer-notifications-get'
      );

      if (result.success && result.data?.success) {
        return {
          success: true,
          preferences: result.data.preferences,
        };
      }

      return {
        success: false,
        error: getErrorMessage(result.error) || 'Failed to get preferences',
      };
    } catch (error: any) {
      clientLogger.error('[CustomerNotifications] Get preferences error:', { detail: error });
      return {
        success: false,
        error: 'Failed to get notification preferences',
      };
    }
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(
    preferences: Partial<NotificationPreferences>
  ): Promise<{
    success: boolean;
    preferences?: NotificationPreferences;
    error?: string;
  }> {
    try {
      const result = await this.makeDefaultRequest<{
        success: boolean;
        preferences: NotificationPreferences;
        message?: string;
      }>(
        '/api/customer-notifications/preferences',
        {
          method: 'PUT',
          credentials: 'include',
          body: JSON.stringify(preferences),
        },
        'customer-notifications-update'
      );

      if (result.success && result.data?.success) {
        return {
          success: true,
          preferences: result.data.preferences,
        };
      }

      return {
        success: false,
        error: getErrorMessage(result.error) || 'Failed to update preferences',
      };
    } catch (error: any) {
      clientLogger.error('[CustomerNotifications] Update preferences error:', { detail: error });
      return {
        success: false,
        error: 'Failed to update notification preferences',
      };
    }
  }
}

export const customerNotificationsService = new CustomerNotificationsService();
export default customerNotificationsService;
