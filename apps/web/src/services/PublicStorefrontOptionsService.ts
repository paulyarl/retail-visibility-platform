/**
 * Public Storefront Options Service
 *
 * Extends PublicApiSingleton to provide resolved storefront option flags
 * for public pages (storefront, directory, products).
 * Uses the /api/public/tenant/:tenantId/storefront-options endpoint
 * which returns capability-aware flags (tier features + merchant preferences).
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface StorefrontOptionFlags {
  showHoursDisplay: boolean;
  showAnimatedHours: boolean;
  showHoursStatus: boolean;
  showMapDisplay: boolean;
  showLocationDisplay: boolean;
  showCategoryStore: boolean;
  showCategoryProduct: boolean;
  showRecommendStore: boolean;
  showRecommendProducts: boolean;
  showRecentlyViewed: boolean;
  showSocialMedia: boolean;
  showContact: boolean;
  showInteractiveMaps: boolean;
  showQRCodes: boolean;
  showQRProduct: boolean;
  showQRStore: boolean;
  showQRLogo: boolean;
  showQRDirectory: boolean;
  qrResolution: string;
  qrResolutions: string[];
  galleryLimit: number;
  showEnhancedSEO: boolean;
  showStorefrontActions: boolean;
  /** Selected storefront layout variant — 'classic' (default), 'editorial', or 'immersive' */
  storefrontLayout?: 'classic' | 'editorial' | 'immersive';
}

class PublicStorefrontOptionsService extends PublicApiSingleton {
  private static instance: PublicStorefrontOptionsService;
  protected cacheTTL: number = 15 * 60 * 1000; // 15 minutes

  protected constructor() {
    super('public-storefront-options', {
      ttl: 15 * 60 * 1000,
    });
  }

  public static getInstance(): PublicStorefrontOptionsService {
    if (!PublicStorefrontOptionsService.instance) {
      PublicStorefrontOptionsService.instance = new PublicStorefrontOptionsService();
    }
    return PublicStorefrontOptionsService.instance;
  }

  /**
   * Get resolved storefront option flags for a tenant.
   * Returns capability-aware flags that merge tier features with merchant preferences.
   */
  async getStorefrontOptionFlags(tenantId: string): Promise<StorefrontOptionFlags | null> {
    if (!tenantId) {
      console.error('[PublicStorefrontOptions] getStorefrontOptionFlags: tenantId is required');
      return null;
    }

    try {
      const result = await this.makePublicRequest<{ success: boolean; flags: StorefrontOptionFlags }>(
        `/api/public/tenant/${tenantId}/storefront-options`,
        {},
        `storefront-options-${tenantId}`,
        this.cacheTTL
      );

      if (!result.success) {
        console.error('[PublicStorefrontOptions] Failed to get flags:', result.error);
        return null;
      }

      return result.data?.flags || null;
    } catch (error) {
      console.error('[PublicStorefrontOptions] Failed to get flags:', error);
      return null;
    }
  }

  /**
   * Get QR-specific flags for a tenant (convenience method for TenantQRCode).
   */
  async getQRCapabilityFlags(tenantId: string): Promise<{
    showQRCodes: boolean;
    showQRProduct: boolean;
    showQRStore: boolean;
    showQRLogo: boolean;
    showQRDirectory: boolean;
    qrResolution: string;
    qrResolutions: string[];
  } | null> {
    const flags = await this.getStorefrontOptionFlags(tenantId);
    if (!flags) return null;

    return {
      showQRCodes: flags.showQRCodes,
      showQRProduct: flags.showQRProduct,
      showQRStore: flags.showQRStore,
      showQRLogo: flags.showQRLogo,
      showQRDirectory: flags.showQRDirectory,
      qrResolution: flags.qrResolution,
      qrResolutions: flags.qrResolutions,
    };
  }
}

export const publicStorefrontOptionsService = PublicStorefrontOptionsService.getInstance();
