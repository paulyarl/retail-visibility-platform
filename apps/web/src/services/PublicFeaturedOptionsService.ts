/**
 * Public Featured Options Service
 *
 * Extends PublicApiSingleton to provide resolved featured options settings
 * for public pages (storefront, product pages).
 * Uses the /api/public/tenant/:tenantId/featured-options endpoint.
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface FeaturedOptionsSettings {
  featured_enabled: boolean;
  featured_store_selection: boolean;
  featured_new_arrival: boolean;
  featured_seasonal: boolean;
  featured_sale: boolean;
  featured_staff_pick: boolean;
  featured_clearance: boolean;
  featured_featured: boolean;
  featured_bestseller: boolean;
  featured_trending: boolean;
  featured_recommended: boolean;
  featured_random_featured: boolean;
}

class PublicFeaturedOptionsService extends PublicApiSingleton {
  private static instance: PublicFeaturedOptionsService;
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes

  protected constructor() {
    super('public-featured-options', {
      ttl: 15 * 60 * 1000,
    });
  }

  public static getInstance(): PublicFeaturedOptionsService {
    if (!PublicFeaturedOptionsService.instance) {
      PublicFeaturedOptionsService.instance = new PublicFeaturedOptionsService();
    }
    return PublicFeaturedOptionsService.instance;
  }

  /**
   * Get featured options settings for a tenant.
   */
  async getFeaturedOptionsSettings(tenantId: string): Promise<FeaturedOptionsSettings | null> {
    if (!tenantId) {
      console.error('[PublicFeaturedOptions] getFeaturedOptionsSettings: tenantId is required');
      return null;
    }

    try {
      const result = await this.makePublicRequest<{ success: boolean; settings: FeaturedOptionsSettings }>(
        `/api/public/tenant/${tenantId}/featured-options`,
        {},
        `featured-options-${tenantId}`,
        this.cacheTTL
      );

      if (!result.success) {
        console.error('[PublicFeaturedOptions] Failed to get settings:', result.error);
        return null;
      }

      return result.data?.settings || null;
    } catch (error) {
      console.error('[PublicFeaturedOptions] Failed to get settings:', error);
      return null;
    }
  }
}

export const publicFeaturedOptionsService = PublicFeaturedOptionsService.getInstance();
