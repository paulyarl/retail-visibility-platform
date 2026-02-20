/**
 * Platform Settings Singleton Service
 * 
 * Extends PublicApiSingleton to provide cached platform settings operations
 * Uses public requests since platform settings should be accessible to all users
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface PlatformSettings {
  platformName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  theme?: {
    mode: 'light' | 'dark';
    customColors?: Record<string, string>;
  };
  // New theme settings fields
  themePreset?: string;
  themeColors?: {
    primary: string;
    secondary: string;
    accent: string;
    neutral: string;
  };
  themeFontFamily?: string;
  themeBorderRadius?: string;
  themeButtonSize?: string;
  themeSpacing?: number;
  branding?: {
    companyName?: string;
    tagline?: string;
    description?: string;
  };
  features?: Record<string, any>;
}

class PlatformSettingsSingletonService extends PublicApiSingleton {
  private static instance: PlatformSettingsSingletonService;

  private constructor() {
    super('platform-settings-service');
    // Override default TTL for platform settings (changes rarely)
    this.cacheTTL = 15 * 60 * 1000; // 15 minutes
  }

  public static getInstance(): PlatformSettingsSingletonService {
    if (!PlatformSettingsSingletonService.instance) {
      PlatformSettingsSingletonService.instance = new PlatformSettingsSingletonService();
    }
    return PlatformSettingsSingletonService.instance;
  }

  /**
   * Get platform settings with caching
   * Uses the /api/platform-settings endpoint
   */
  async getPlatformSettings(): Promise<PlatformSettings> {
    try {
      const result = await this.makeDefaultRequest<PlatformSettings>(
        '/api/platform-settings',
        {},
        'platform-settings'
      );
      
      // The /api/platform-settings endpoint returns data directly, not wrapped in ApiResponse
      // Check if result itself is the data, not result.data
      const settings = result?.data || result;
      
      if (settings && 'platformName' in settings) {
        return settings as PlatformSettings;
      }
      
      // Return default settings if no data
      return {
        platformName: 'Visible Shelf',
        logoUrl: null,
        faviconUrl: null,
        primaryColor: '#3b82f6',
        secondaryColor: '#8b5cf6',
        themePreset: 'default',
        themeColors: {
          primary: '#0066ff',
          secondary: '#6fd58a',
          accent: '#ffdd07',
          neutral: '#64748b'
        },
        themeFontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        themeBorderRadius: 'md',
        themeButtonSize: 'sm',
        themeSpacing: 16,
      };
    } catch (error) {
      console.error('[PlatformSettingsSingleton] Failed to get platform settings:', error);
      
      // Return default settings on error
      return {
        platformName: 'Visible Shelf',
        logoUrl: null,
        faviconUrl: null,
        primaryColor: '#3b82f6',
        secondaryColor: '#8b5cf6',
        themePreset: 'default',
        themeColors: {
          primary: '#0066ff',
          secondary: '#6fd58a',
          accent: '#ffdd07',
          neutral: '#64748b'
        },
        themeFontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        themeBorderRadius: 'md',
        themeButtonSize: 'sm',
        themeSpacing: 16,
      };
    }
  }

  /**
   * Update platform settings
   * Uses the /platform-settings endpoint with POST method
   * Note: This would require admin permissions and appropriate backend endpoints
   */
  async updatePlatformSettings(settings: Partial<PlatformSettings>): Promise<PlatformSettings | null> {
    try {
      const result = await this.makeDefaultRequest<PlatformSettings>(
        '/api/platform-settings',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settings)
        },
        'platform-settings-update'
      );
      
      // The /api/platform-settings endpoint returns data directly, not wrapped in ApiResponse
      // Check if result itself is the data, not result.data
      const updatedSettings = (result as any)?.data || result;
      
      if (updatedSettings) {
        // Clear cache to ensure fresh data on next request
        await this.clearCache();
        return updatedSettings;
      }
      
      return null;
    } catch (error) {
      console.error('[PlatformSettingsSingleton] Failed to update platform settings:', error);
      return null;
    }
  }
}

// Export singleton instance
export const platformSettingsService = PlatformSettingsSingletonService.getInstance();
