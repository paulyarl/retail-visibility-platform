/**
 * Branding Settings Singleton Service
 *
 * Extends AuthenticatedApiSingleton to provide cached branding settings operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';
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
    const result = await this.makeDefaultRequest<PlatformSettings>(
      '/api/platform-settings',
      {},
      'branding-settings'
    );

    if (!result.success) {
      console.error('[BrandingSettingsSingleton] Failed to get branding settings:', result.error);
      return null;
    }

    return result.data || null;
  }

  async updateBrandingSettings(settings: Partial<PlatformSettings>): Promise<PlatformSettings | null> {
    const result = await this.makeDefaultRequest<PlatformSettings>(
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

    if (!result.success) {
      console.error('[BrandingSettingsSingleton] Failed to update branding settings:', result.error);
      return null;
    }

    return result.data || null;
  }
}

// Export singleton instance
export const brandingSettingsService = BrandingSettingsSingletonService.getInstance();
