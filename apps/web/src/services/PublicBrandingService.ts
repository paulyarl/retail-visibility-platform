/**
 * Public Branding Service
 * 
 * Extends PublicApiSingleton to provide cached public branding operations
 * Used for public platform branding that doesn't require authentication
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface PublicBrandingSettings {
  platformName: string;
  platformDescription?: string; // Make optional for compatibility
  logoUrl: string | null;
  faviconUrl: string | null;
  bannerUrl: string | null;
  themePreset: string;
  themeColors: {
    primary: string;
    accent: string;
    neutral: string;
    [key: string]: string;
  };
  themeFontFamily: string;
  themeBorderRadius: string;
  themeButtonSize: string;
  themeSpacing: number;
  // Contact information
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
  contactWebsite: string;
  // Social media
  socialFacebook: string;
  socialTwitter: string;
  socialInstagram: string;
  socialLinkedIn: string;
  socialYoutube: string;
}

class PublicBrandingService extends PublicApiSingleton {
  private static instance: PublicBrandingService;

  private constructor() {
    super('public-branding-service');
    this.cacheTTL = 30 * 60 * 1000; // 30 minutes for public branding (changes rarely)
  }

  public static getInstance(): PublicBrandingService {
    if (!PublicBrandingService.instance) {
      PublicBrandingService.instance = new PublicBrandingService();
    }
    return PublicBrandingService.instance;
  }

  /**
   * Get public platform branding settings
   * Uses the /api/platform-settings endpoint
   */
  async getPublicBrandingSettings(): Promise<PublicBrandingSettings | null> {
    try {
      const response = await super.makeDefaultRequest<PublicBrandingSettings>(
        '/api/platform-settings',
        {},
        'public-platform-branding'
      );

      if (!response.success) {
        console.error('[PublicBrandingService] Failed to get public branding:', response.error);
        return null;
      }

      return response.data || null;
    } catch (error) {
      console.error('[PublicBrandingService] Error getting public branding:', error);
      return null;
    }
  }
}

// Export singleton instance
export const publicBrandingService = PublicBrandingService.getInstance();
