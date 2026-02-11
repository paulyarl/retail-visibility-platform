import { UniversalSingletonClient } from '@/lib/shops/universal-singleton-client';

export interface RateLimitConfiguration {
  route_type: string;
  max_requests: number;
  window_minutes: number;
  enabled: boolean;
}

export interface RateLimitSettings {
  rateLimitingEnabled: boolean;
  rateLimitConfigurations: RateLimitConfiguration[];
  updatedAt: string;
  updatedBy: string;
}

class RateLimitSettingsSingletonService {
  private static instance: RateLimitSettingsSingletonService;
  private client: UniversalSingletonClient;

  private constructor() {
    // Initialize UniversalSingletonClient with rate limiting defaults
    this.client = UniversalSingletonClient.getInstance({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      enableCache: true,
      defaultTTL: 5 * 60 * 1000, // 5 minutes - rate limit settings change infrequently
      enableLogging: false, // Reduce noise in logs
      enableMetrics: true
    });
  }

  public static getInstance(): RateLimitSettingsSingletonService {
    if (!RateLimitSettingsSingletonService.instance) {
      RateLimitSettingsSingletonService.instance = new RateLimitSettingsSingletonService();
    }
    return RateLimitSettingsSingletonService.instance;
  }

  /**
   * Get rate limiting settings with caching
   */
  async getRateLimitSettings(): Promise<RateLimitSettings | null> {
    try {
      const response = await this.client.makeRequest<RateLimitSettings>(
        '/api/admin/platform-settings',
        { method: 'GET' }
      );

      return response as unknown as RateLimitSettings;
    } catch (error) {
      console.error('[RateLimitSettingsSingleton] Failed to fetch rate limit settings:', error);
      return null;
    }
  }

  /**
   * Update rate limiting settings
   * Automatically invalidates cache
   */
  async updateRateLimitSettings(settings: Partial<RateLimitSettings>): Promise<RateLimitSettings | null> {
    try {
      const response = await this.client.makeRequest<RateLimitSettings>(
        '/api/admin/platform-settings',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settings),
        }
      );

      // Clear cache to ensure fresh data on next request
      this.clearCache();

      return response as unknown as RateLimitSettings;
    } catch (error) {
      console.error('[RateLimitSettingsSingleton] Failed to update rate limit settings:', error);
      return null;
    }
  }

  /**
   * Get rate limit configuration for a specific route type
   */
  async getConfigForRouteType(routeType: string): Promise<RateLimitConfiguration | null> {
    const settings = await this.getRateLimitSettings();
    if (!settings) return null;

    return settings.rateLimitConfigurations.find(c => c.route_type === routeType) || null;
  }

  /**
   * Check if rate limiting is globally enabled
   */
  async isRateLimitingEnabled(): Promise<boolean> {
    const settings = await this.getRateLimitSettings();
    return settings?.rateLimitingEnabled ?? true;
  }

  /**
   * Clear the cache to force fresh data on next request
   */
  public clearCache(): void {
    // Access the private clearCache method of the client
    (this.client as any).clearCache();
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
export const rateLimitSettingsService = RateLimitSettingsSingletonService.getInstance();
