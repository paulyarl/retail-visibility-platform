import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';

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

class RateLimitSettingsSingletonService extends AuthenticatedApiSingleton {
  private static instance: RateLimitSettingsSingletonService;

  private constructor() {
    super('rate-limit-settings-service');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes - rate limit settings change infrequently
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
      const response = await this.makeAuthenticatedRequest<RateLimitSettings>(
        '/api/admin/platform-settings',
        { method: 'GET' },
        'rate_limit_settings'
      );
      if (!response.success) {
        console.error('[RateLimitSettingsSingleton] Failed to fetch rate limit settings:', response.error);
        return null;
      }

      return response.data||null;
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
      const response = await this.makeAuthenticatedRequest<RateLimitSettings>(
        '/api/admin/platform-settings',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(settings),
        },
        'rate_limit_settings'
      );
      if (!response.success) {
        console.error('[RateLimitSettingsSingleton] Failed to update rate limit settings:', response.error);
        return null;
      }

      return response.data||null;
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
    if (!settings) return true;
    return settings.rateLimitingEnabled ?? true;
  }

  /**
   * Clear the cache to force fresh data on next request
   */
  public async clearCache(): Promise<void> {
    await this.invalidateCache('rate_limit_settings');
  }
}

// Export singleton instance
export const rateLimitSettingsService = RateLimitSettingsSingletonService.getInstance();
