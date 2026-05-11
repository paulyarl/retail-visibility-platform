/**
 * Customer Notifications Service
 * Handles customer notification preferences
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

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

class CustomerNotificationsService extends PublicApiSingleton {
  constructor() {
    super('customer-notifications');
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
      const result = await this.makePublicRequest<{
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
      console.error('[CustomerNotifications] Get preferences error:', error);
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
      const result = await this.makePublicRequest<{
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
      console.error('[CustomerNotifications] Update preferences error:', error);
      return {
        success: false,
        error: 'Failed to update notification preferences',
      };
    }
  }
}

export const customerNotificationsService = new CustomerNotificationsService();
export default customerNotificationsService;
