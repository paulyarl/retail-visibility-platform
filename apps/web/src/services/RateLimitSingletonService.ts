import { UniversalSingletonClient } from '@/lib/shops/universal-singleton-client';

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

class RateLimitSingletonService {
  private static instance: RateLimitSingletonService;
  private client: UniversalSingletonClient;

  private constructor() {
    // Initialize UniversalSingletonClient with rate limiting defaults
    this.client = UniversalSingletonClient.getInstance({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      enableCache: true,
      defaultTTL: 5 * 60 * 1000, // 5 minutes - rate limit configs don't change often
      enableLogging: false, // Reduce noise in logs
      enableMetrics: true
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
      const response = await this.client.makeRequest<{ configs?: RateLimitConfig[] } | RateLimitConfig[]>(
        '/api/rate-limit-configs'
      );

      // Handle both direct array and nested data.configs format
      const data = response.data;
      if (!data) return this.getDefaultConfigs();
      const configs = Array.isArray(data) ? data : ((data as any).configs || []);
      
      return configs.map((config: any) => ({
        route_type: config.route_type,
        max_requests: config.max_requests,
        window_minutes: config.window_minutes,
        enabled: config.enabled ?? true,
      }));
    } catch (error) {
      console.error('Failed to fetch rate limit configurations, using defaults:', error);
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
   * Cached via UniversalSingletonClient
   */
  async isRateLimitingEnabled(): Promise<boolean> {
    try {
      const response = await this.client.makeRequest<{ features?: { rateLimitingEnabled?: boolean } }>(
        '/api/platform-settings'
      );
      
      const settings = response.data;
      return settings?.features?.rateLimitingEnabled ?? true;
    } catch (error) {
      console.error('Failed to fetch rate limiting enabled status, defaulting to enabled:', error);
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
      this.client.makeRequest('/api/rate-limit-warnings', {
        method: 'POST',
        body: JSON.stringify(warning)
      }).catch((err: Error) => {
        console.error('Failed to log rate limit warning:', err);
      });
    } catch (error) {
      console.error('Error preparing rate limit warning:', error);
    }
  }

  /**
   * Invalidate rate limit configuration cache
   * Call this when configurations are updated
   * Note: Cache will expire naturally based on TTL (5 minutes)
   */
  invalidateConfigCache(): void {
    // Cache invalidation happens automatically via TTL
    // Manual cache clearing is not exposed in UniversalSingletonClient
    console.log('[RateLimitSingleton] Cache will refresh on next request (TTL: 5 minutes)');
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
