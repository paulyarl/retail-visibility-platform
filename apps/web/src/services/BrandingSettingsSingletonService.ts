/**
 * Branding Settings Singleton Service
 *
 * Extends UniversalSingletonClient to provide cached branding settings operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { UniversalSingletonClient } from '@/lib/shops/universal-singleton-client';
import { PlatformSettings } from './PlatformSettingsSingletonService';

export interface BrandingSettings {
  platformName: string;
  platformDescription: string;
  logoUrl: string | null;
  faviconUrl: string | null;
}

class BrandingSettingsSingletonService {
  private static instance: BrandingSettingsSingletonService;
  private client: UniversalSingletonClient;

  private constructor() {
    // Initialize UniversalSingletonClient with platform defaults
    this.client = UniversalSingletonClient.getInstance({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      enableCache: true,
      defaultTTL: 15 * 60 * 1000, // 15 minutes for branding settings (changes rarely)
      enableLogging: true,
      enableMetrics: true
    });
  }

  public static getInstance(): BrandingSettingsSingletonService {
    if (!BrandingSettingsSingletonService.instance) {
      BrandingSettingsSingletonService.instance = new BrandingSettingsSingletonService();
    }
    return BrandingSettingsSingletonService.instance;
  }

  async getBrandingSettings(): Promise<PlatformSettings | null> {
    try {
      const result = await this.client.makeRequest<PlatformSettings>(
        '/api/platform-settings'
      );

      // makeRequest returns ApiResponse<T>, so extract data from response
      return result?.data || null;
    } catch (error) {
      console.error('[BrandingSettingsSingleton] Failed to get branding settings:', error);
      return null;
    }
  }

  async updateBrandingSettings(settings: Partial<PlatformSettings>): Promise<PlatformSettings | null> {
    try {
      const result = await this.client.makeRequest<PlatformSettings>(
        '/api/platform-settings',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settings),
        }
      );

      // makeRequest returns ApiResponse<T>, so extract data from response
      return result?.data || null;
    } catch (error) {
      console.error('[BrandingSettingsSingleton] Failed to update branding settings:', error);
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
export const brandingSettingsService = BrandingSettingsSingletonService.getInstance();
