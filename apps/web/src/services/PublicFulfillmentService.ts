/**
 * Public Fulfillment Service
 *
 * Extends PublicApiSingleton to provide public fulfillment settings operations
 * Uses the platform's singleton architecture for automatic caching
 * Provides public access to fulfillment settings for checkout processes
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface FulfillmentSettings {
  pickup_enabled: boolean;
  pickup_instructions: string | null;
  pickup_ready_time_minutes: number;
  delivery_enabled: boolean;
  delivery_radius_miles: number | null;
  delivery_fee_cents: number;
  delivery_min_free_cents: number | null;
  delivery_time_hours: number;
  shipping_enabled: boolean;
  shipping_flat_rate_cents: number | null;
  shipping_handling_days: number;
}

class PublicFulfillmentService extends PublicApiSingleton {
  private static instance: PublicFulfillmentService;
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes for fulfillment settings

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'public-fulfillment*',
      'fulfillment-settings*',
      'checkout-fulfillment*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('public-fulfillment*');
    await this.invalidateCachePattern('fulfillment-settings*');
    await this.invalidateCachePattern('checkout-fulfillment*');
  }

  protected constructor() {
    super('public-fulfillment', {
      ttl: 15 * 60 * 1000 // 15 minutes for fulfillment settings
    });
  }

  public static getInstance(): PublicFulfillmentService {
    if (!PublicFulfillmentService.instance) {
      PublicFulfillmentService.instance = new PublicFulfillmentService();
    }
    return PublicFulfillmentService.instance;
  }

  /**
   * Get fulfillment settings for a tenant
   * Uses the /public/tenant/{tenantId}/fulfillment-settings endpoint
   */
  async getFulfillmentSettings(tenantId: string): Promise<FulfillmentSettings | null> {
    if (!tenantId) {
      console.error('[PublicFulfillment] getFulfillmentSettings: tenantId is required');
      return null;
    }

    try {
      const result = await this.makePublicRequest<{ success: boolean; settings: FulfillmentSettings }>(
        `/public/tenant/${tenantId}/fulfillment-settings`,
        {},
        `fulfillment-settings-${tenantId}`,
        this.cacheTTL
      );
      
      if (!result.success) {
        console.error('[PublicFulfillment] Failed to get fulfillment settings:', result.error);
        return null;
      }

      return result.data?.settings || null;
    } catch (error) {
      console.error('[PublicFulfillment] Failed to get fulfillment settings:', error);
      return null;
    }
  }

  /**
   * Check if a specific fulfillment method is available
   */
  async isFulfillmentMethodAvailable(tenantId: string, method: 'pickup' | 'delivery' | 'shipping'): Promise<boolean> {
    try {
      const settings = await this.getFulfillmentSettings(tenantId);
      if (!settings) return false;

      switch (method) {
        case 'pickup':
          return settings.pickup_enabled;
        case 'delivery':
          return settings.delivery_enabled;
        case 'shipping':
          return settings.shipping_enabled;
        default:
          return false;
      }
    } catch (error) {
      console.error('[PublicFulfillment] Failed to check fulfillment method availability:', error);
      return false;
    }
  }

  /**
   * Get available fulfillment methods for a tenant
   */
  async getAvailableFulfillmentMethods(tenantId: string): Promise<Array<'pickup' | 'delivery' | 'shipping'>> {
    try {
      const settings = await this.getFulfillmentSettings(tenantId);
      if (!settings) return [];

      const methods: Array<'pickup' | 'delivery' | 'shipping'> = [];
      
      if (settings.pickup_enabled) methods.push('pickup');
      if (settings.delivery_enabled) methods.push('delivery');
      if (settings.shipping_enabled) methods.push('shipping');

      return methods;
    } catch (error) {
      console.error('[PublicFulfillment] Failed to get available fulfillment methods:', error);
      return [];
    }
  }

  /**
   * Calculate delivery fee based on settings and subtotal
   */
  calculateDeliveryFee(settings: FulfillmentSettings, subtotalCents: number): number {
    if (!settings.delivery_enabled) return 0;
    
    // Check if order qualifies for free delivery
    if (settings.delivery_min_free_cents && subtotalCents >= settings.delivery_min_free_cents) {
      return 0;
    }
    
    return settings.delivery_fee_cents;
  }

  /**
   * Calculate shipping fee based on settings
   */
  calculateShippingFee(settings: FulfillmentSettings): number {
    if (!settings.shipping_enabled) return 0;
    return settings.shipping_flat_rate_cents || 0;
  }

  /**
   * Get fulfillment method details for display
   */
  getFulfillmentMethodDetails(settings: FulfillmentSettings, method: 'pickup' | 'delivery' | 'shipping', subtotalCents?: number) {
    const baseDetails = {
      enabled: false,
      fee: 0,
      time: '',
      instructions: '',
    };

    switch (method) {
      case 'pickup':
        return {
          ...baseDetails,
          enabled: settings.pickup_enabled,
          instructions: settings.pickup_instructions || '',
          time: this.formatTime(settings.pickup_ready_time_minutes),
        };
      
      case 'delivery':
        return {
          ...baseDetails,
          enabled: settings.delivery_enabled,
          fee: subtotalCents ? this.calculateDeliveryFee(settings, subtotalCents) : settings.delivery_fee_cents,
          time: this.formatHours(settings.delivery_time_hours),
        };
      
      case 'shipping':
        return {
          ...baseDetails,
          enabled: settings.shipping_enabled,
          fee: this.calculateShippingFee(settings),
          time: this.formatDays(settings.shipping_handling_days),
        };
      
      default:
        return baseDetails;
    }
  }

  /**
   * Format minutes into human readable time
   */
  private formatTime(minutes: number): string {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  /**
   * Format hours into human readable time
   */
  private formatHours(hours: number): string {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  /**
   * Format days into human readable time
   */
  private formatDays(days: number): string {
    return days === 1 ? '1 day' : `${days} days`;
  }
}

// Export singleton instance
export const publicFulfillmentService = PublicFulfillmentService.getInstance();
