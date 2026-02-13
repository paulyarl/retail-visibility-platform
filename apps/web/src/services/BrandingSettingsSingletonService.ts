/**
 * Branding Settings Singleton Service
 *
 * Extends AuthenticatedApiSingleton to provide cached branding settings operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';
import { PlatformSettings } from './PlatformSettingsSingletonService';

export interface BrandingSettings {
  platformName: string;
  platformDescription: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

class BrandingSettingsSingletonService extends AuthenticatedApiSingleton {
  private static instance: BrandingSettingsSingletonService;

  private constructor() {
    super('branding-settings-service');
    this.cacheTTL = 15 * 60 * 1000; // 15 minutes for branding settings (changes rarely)
  }

  public static getInstance(): BrandingSettingsSingletonService {
    if (!BrandingSettingsSingletonService.instance) {
      BrandingSettingsSingletonService.instance = new BrandingSettingsSingletonService();
    }
    return BrandingSettingsSingletonService.instance;
  }

  async getBrandingSettings(): Promise<PlatformSettings | null> {
    try {
      const result = await this.makeAuthenticatedRequest<PlatformSettings>(
        '/api/platform-settings',
        {},
        'branding-settings'
      );

      return result;
    } catch (error) {
      console.error('[BrandingSettingsSingleton] Failed to get branding settings:', error);
      return null;
    }
  }

  async updateBrandingSettings(settings: Partial<PlatformSettings>): Promise<PlatformSettings | null> {
    try {
      const result = await this.makeAuthenticatedRequest<PlatformSettings>(
        '/api/platform-settings',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settings),
        },
        'branding-settings'
      );

      return result;
    } catch (error) {
      console.error('[BrandingSettingsSingleton] Failed to update branding settings:', error);
      return null;
    }
  }
}

// Export singleton instance
export const brandingSettingsService = BrandingSettingsSingletonService.getInstance();
