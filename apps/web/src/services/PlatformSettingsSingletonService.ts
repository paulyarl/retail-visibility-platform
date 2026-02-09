/**
 * Platform Settings Singleton Service
 * 
 * Extends UniversalSingletonClient to provide cached platform settings operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { UniversalSingletonClient } from '@/lib/shops/universal-singleton-client';

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
  branding?: {
    companyName?: string;
    tagline?: string;
    description?: string;
  };
  features?: Record<string, any>;
}

class PlatformSettingsSingletonService {
  private static instance: PlatformSettingsSingletonService;
  private client: UniversalSingletonClient;

  private constructor() {
    // Initialize UniversalSingletonClient with platform defaults
    this.client = UniversalSingletonClient.getInstance({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      enableCache: true,
      defaultTTL: 15 * 60 * 1000, // 15 minutes for platform settings (changes rarely)
      enableLogging: true,
      enableMetrics: true
    });
  }

  public static getInstance(): PlatformSettingsSingletonService {
    if (!PlatformSettingsSingletonService.instance) {
      PlatformSettingsSingletonService.instance = new PlatformSettingsSingletonService();
    }
    return PlatformSettingsSingletonService.instance;
  }

  /**
   * Get platform settings with caching
   * Uses the /platform-settings endpoint
   */
  async getPlatformSettings(): Promise<PlatformSettings> {
    try {
      const result = await this.client.makeRequest<PlatformSettings>(
        '/api/platform-settings'
      );
      
      return result.data || {
        platformName: 'Visible Shelf',
        logoUrl: null,
        faviconUrl: null,
        primaryColor: '#3b82f6',
        secondaryColor: '#8b5cf6',
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
      const result = await this.client.makeRequest<PlatformSettings>(
        '/api/platform-settings',
        {
          method: 'POST',
          body: JSON.stringify(settings)
        }
      );
      
      // Clear cache after update to ensure fresh data on next fetch
      // Note: Since clearCache is private, the cache will expire naturally based on TTL
      
      // The API returns the settings directly, not wrapped in a data property
      // But makeRequest returns ApiResponse<PlatformSettings>, so we need to handle both cases
      return (result as any)?.data || result || null;
    } catch (error) {
      console.error('[PlatformSettingsSingleton] Failed to update platform settings:', error);
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
export const platformSettingsService = PlatformSettingsSingletonService.getInstance();
