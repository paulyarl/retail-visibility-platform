/**
 * Tenant Branding Settings Singleton Service
 *
 * Extends AuthenticatedApiSingleton to provide cached tenant-specific branding settings operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';

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

class TenantBrandingSettingsSingletonService extends AuthenticatedApiSingleton {
  private static instance: TenantBrandingSettingsSingletonService;

  private constructor() {
    super('tenant-branding-settings-singleton', {
      ttl: 10 * 60 * 1000 // 10 minutes for tenant branding (moderate cache)
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
      const result = await this.makeAuthenticatedRequest<TenantBrandingSettings>(
        `/api/branding/${tenantId}`,
        {},
        `tenant-branding-${tenantId}`
      );

      // makeAuthenticatedRequest returns data directly
      return result.data || null;
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
      const result = await this.makeAuthenticatedRequest<TenantBrandingSettings>(
        `/api/branding/${tenantId}`,
        {
          method: 'PUT',
          body: JSON.stringify(settings),
        },
        `tenant-branding-${tenantId}`
      );

      // makeAuthenticatedRequest returns data directly
      return result.data || null;
    } catch (error) {
      console.error('[TenantBrandingSettingsSingleton] Failed to update branding settings:', error);
      return null;
    }
  }
}

// Export singleton instance
export const tenantBrandingSettingsService = TenantBrandingSettingsSingletonService.getInstance();
