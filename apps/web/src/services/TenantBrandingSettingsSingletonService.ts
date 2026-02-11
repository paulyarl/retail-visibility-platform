/**
 * Tenant Branding Settings Singleton Service
 *
 * Extends UniversalSingletonClient to provide cached tenant-specific branding settings operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { UniversalSingletonClient } from '@/lib/shops/universal-singleton-client';

export interface TenantBrandingSettings {
  shopName: string;
  shopSlug: string;
  logo: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  customCSS: string;
  theme: string;
  favicon: string | null;
  bannerImage: string | null;
  contactInfo: {
    email: string;
    phone: string;
    address: string;
    website: string;
  };
  socialLinks: {
    facebook: string;
    twitter: string;
    instagram: string;
    linkedin: string;
  };
  description: string;
}

class TenantBrandingSettingsSingletonService {
  private static instance: TenantBrandingSettingsSingletonService;
  private client: UniversalSingletonClient;

  private constructor() {
    // Initialize UniversalSingletonClient with platform defaults
    this.client = UniversalSingletonClient.getInstance({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      enableCache: true,
      defaultTTL: 10 * 60 * 1000, // 10 minutes for tenant branding (moderate cache)
      enableLogging: true,
      enableMetrics: true
    });
  }

  public static getInstance(): TenantBrandingSettingsSingletonService {
    if (!TenantBrandingSettingsSingletonService.instance) {
      TenantBrandingSettingsSingletonService.instance = new TenantBrandingSettingsSingletonService();
    }
    return TenantBrandingSettingsSingletonService.instance;
  }

  /**
   * Get tenant branding settings with caching
   * Uses the /api/branding/:tenantId endpoint
   */
  async getTenantBrandingSettings(tenantId: string): Promise<TenantBrandingSettings | null> {
    try {
      const result = await this.client.makeRequest<TenantBrandingSettings>(
        `/api/branding/${tenantId}`
      );

      // makeRequest returns ApiResponse<T>, so extract data from response
      return result?.data || null;
    } catch (error) {
      console.error('[TenantBrandingSettingsSingleton] Failed to get branding settings:', error);
      return null;
    }
  }

  /**
   * Update tenant branding settings
   * Uses the /api/branding/:tenantId endpoint with PUT method
   */
  async updateTenantBrandingSettings(tenantId: string, settings: Partial<TenantBrandingSettings>): Promise<TenantBrandingSettings | null> {
    try {
      const result = await this.client.makeRequest<TenantBrandingSettings>(
        `/api/branding/${tenantId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settings),
        }
      );

      // makeRequest returns ApiResponse<T>, so extract data from response
      return result?.data || null;
    } catch (error) {
      console.error('[TenantBrandingSettingsSingleton] Failed to update branding settings:', error);
      return null;
    }
  }

  /**
   * Get performance metrics
   */
  public getMetrics() {
    return this.client.getMetrics();
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.client.resetMetrics();
  }
}

// Export singleton instance
export const tenantBrandingSettingsService = TenantBrandingSettingsSingletonService.getInstance();
