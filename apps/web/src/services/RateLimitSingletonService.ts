import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface RateLimitConfig {
  route_type: string;
  max_requests: number;
  window_minutes: number;
  enabled: boolean;
}

export interface RateLimitWarning {
  clientId: string;
  pathname: string;
  requestCount: number;
  maxRequests: number;
  windowMs: number;
  ipAddress: string | null;
  userAgent: string | null;
  blocked: boolean;
}

class RateLimitSingletonService extends AuthenticatedApiSingleton {
  private static instance: RateLimitSingletonService;

  private constructor() {
    super('rate-limit-service', {
      ttl: 5 * 60 * 1000 // 5 minutes - rate limit configs don't change often
    });
  }

  public static getInstance(): RateLimitSingletonService {
    if (!RateLimitSingletonService.instance) {
      RateLimitSingletonService.instance = new RateLimitSingletonService();
    }
    return RateLimitSingletonService.instance;
  }

  /**
   * Get rate limit configurations with caching
   * Cached for 5 minutes to reduce database load
   */
  async getRateLimitConfigurations(): Promise<RateLimitConfig[]> {
    try {
      const response = await this.makeDefaultRequest<RateLimitConfig[]>(
        '/api/rate-limit-configs',
        {},
        'rate-limit-configs'
      );
      if (!response.success){
        clientLogger.error('Failed to fetch rate limit configurations, using defaults:', { detail: response.error });
        return this.getDefaultConfigs();
      }

      return response.data || this.getDefaultConfigs();
    } catch (error) {
      clientLogger.error('Failed to fetch rate limit configurations, using defaults:', { detail: error });
      return this.getDefaultConfigs();
    }
  }

  /**
   * Get default configurations
   */
  private getDefaultConfigs(): RateLimitConfig[] {
    return [
      { route_type: 'auth', max_requests: 20, window_minutes: 1, enabled: true },
      { route_type: 'admin', max_requests: 20, window_minutes: 1, enabled: true },
      { route_type: 'strict', max_requests: 20, window_minutes: 1, enabled: true },
      { route_type: 'standard', max_requests: 100, window_minutes: 1, enabled: true },
      { route_type: 'exempt', max_requests: 1000, window_minutes: 1, enabled: false },
    ];
  }

  /**
   * Get rate limit configuration for a specific route type
   * Uses cached configurations
   */
  async getConfigForRouteType(routeType: string): Promise<RateLimitConfig | null> {
    const configs = await this.getRateLimitConfigurations();
    return configs.find(c => c.route_type === routeType) || null;
  }

  /**
   * Check if rate limiting is globally enabled
   * Cached via AuthenticatedApiSingleton
   */
  async isRateLimitingEnabled(): Promise<boolean> {
    try {
      const response = await this.makeDefaultRequest<{ features?: { rateLimitingEnabled?: boolean } }>(
        '/api/platform-settings',
        {},
        'platform-settings-rate-limiting'
      );
      if (!response.success){
        clientLogger.error('Failed to fetch rate limiting enabled status, defaulting to enabled:', { detail: response.error });
        return true;
      }
      
      return response?.data?.features?.rateLimitingEnabled ?? true;
    } catch (error) {
      clientLogger.error('Failed to fetch rate limiting enabled status, defaulting to enabled:', { detail: error });
      // Default to enabled if we can't fetch settings
      return true;
    }
  }

  /**
   * Log rate limit warning (fire and forget)
   * Does not block the request
   */
  async logRateLimitWarning(warning: RateLimitWarning): Promise<void> {
    try {
      // Fire and forget - don't await or block
      this.makeDefaultRequest<void>(
        '/api/rate-limit-warnings',
        {
          method: 'POST',
          body: JSON.stringify(warning)
        },
        `rate-limit-warning-${warning.clientId}`
      ).catch((err: Error) => {
        clientLogger.error('Failed to log rate limit warning:', { detail: err });
      });
    } catch (error) {
      clientLogger.error('Error preparing rate limit warning:', { detail: error });
    }
  }

  /**
   * Invalidate rate limit configuration cache
   * Call this when configurations are updated
   */
  async invalidateConfigCache(): Promise<void> {
    await this.invalidateCache('rate-limit-configs');
    console.log('[RateLimitSingleton] Cache invalidated for rate limit configurations');
  }

  /**
   * Get default configuration for a route type
   * Used as fallback when API is unavailable
   */
  getDefaultConfig(routeType: string): RateLimitConfig {
    const defaults: Record<string, RateLimitConfig> = {
      auth: { route_type: 'auth', max_requests: 20, window_minutes: 1, enabled: true },
      admin: { route_type: 'admin', max_requests: 20, window_minutes: 1, enabled: true },
      strict: { route_type: 'strict', max_requests: 20, window_minutes: 1, enabled: true },
      standard: { route_type: 'standard', max_requests: 100, window_minutes: 1, enabled: true },
      exempt: { route_type: 'exempt', max_requests: 1000, window_minutes: 1, enabled: false },
    };

    return defaults[routeType] || defaults.standard;
  }
}

// Export singleton instance
const rateLimitSingletonService = RateLimitSingletonService.getInstance();
export default rateLimitSingletonService;
