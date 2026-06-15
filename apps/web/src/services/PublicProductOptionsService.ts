/**
 * Public Product Options Service
 *
 * Extends PublicApiSingleton to provide resolved product option flags
 * for public product pages, decoupled from storefront options.
 * Uses the /api/public/tenant/:tenantId/product-options endpoint
 * which returns capability-aware flags (tier features + merchant preferences).
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface ProductOptionFlags {
  enabled: boolean;
  allowedTypes: string[];
  showsVariants: boolean;
  showsGallery: boolean;
  showsVideo: boolean;
  layoutEnabled: boolean;
  allowedLayouts: string[];
  effectiveLayout: string;
  showsRecentlyViewed: boolean;
  showsQRCodes: boolean;
  showsRecommended: boolean;
  showsMapDisplay: boolean;
  showsLocationDisplay: boolean;
  showsHoursDisplay: boolean;
  showsEnhancedSEO: boolean;
  showsReviews: boolean;
  showsFulfillment: boolean;
  showsCategories: boolean;
  showsLocationAvailability: boolean;
}

class PublicProductOptionsService extends PublicApiSingleton {
  private static instance: PublicProductOptionsService;
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  protected constructor() {
    super('public-product-options', {
      ttl: 5 * 60 * 1000,
    });
  }

  public static getInstance(): PublicProductOptionsService {
    if (!PublicProductOptionsService.instance) {
      PublicProductOptionsService.instance = new PublicProductOptionsService();
    }
    return PublicProductOptionsService.instance;
  }

  /**
   * Get resolved product option flags for a tenant.
   * Returns capability-aware flags that merge tier features with merchant preferences.
   */
  async getProductOptionFlags(tenantId: string): Promise<ProductOptionFlags | null> {
    if (!tenantId) {
      console.error('[PublicProductOptions] getProductOptionFlags: tenantId is required');
      return null;
    }

    try {
      const result = await this.makePublicRequest<{ success: boolean; flags: ProductOptionFlags }>(
        `/api/public/tenant/${tenantId}/product-options`,
        {},
        `product-options-${tenantId}`,
        this.cacheTTL
      );

      if (!result.success) {
        console.error('[PublicProductOptions] Failed to get flags:', result.error);
        return null;
      }

      return result.data?.flags || null;
    } catch (error) {
      console.error('[PublicProductOptions] Error fetching product option flags:', error);
      return null;
    }
  }
}

export const publicProductOptionsService = PublicProductOptionsService.getInstance();
