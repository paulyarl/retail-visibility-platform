/**
 * Platform Rate Limiting Monitoring Singleton - Consumer Pattern
 * 
 * Consumes and displays rate limiting monitoring data
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { SingletonCacheOptions } from '@/providers/base/FlexibleApiSingleton';
import { RateLimitRule, RateLimitConfig, RateLimitStatus, RateLimitMetrics } from './RateLimitingControllerSingleton';
import { clientLogger } from '@/lib/client-logger';

// Rate Limiting Monitoring Data Interfaces
export interface RateLimitingDashboardData {
  config: RateLimitConfig;
  rules: RateLimitRule[];
  metrics: RateLimitMetrics;
  activeBlocks: Array<{
    ip: string;
    reason: string;
    blockedAt: string;
    expiresAt: string;
  }>;
  topViolators: Array<{
    ip: string;
    violations: number;
    lastViolation: string;
  }>;
  lastUpdated: string;
}

export interface RateLimitingFilters {
  timeRange?: number; // hours
  ruleType?: string;
  ipStatus?: 'blocked' | 'active' | 'all';
  sortBy?: 'violations' | 'requests' | 'blocks';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Platform Rate Limiting Monitoring Singleton - Consumer Pattern
 * 
 * Consumes rate limiting data for monitoring and dashboard display
 */
class RateLimitingMonitoringSingleton extends AdminApiSingleton {
  private static instance: RateLimitingMonitoringSingleton;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
  }

  static getInstance(): RateLimitingMonitoringSingleton {
    if (!RateLimitingMonitoringSingleton.instance) {
      RateLimitingMonitoringSingleton.instance = new RateLimitingMonitoringSingleton('rate-limiting-monitoring-singleton');
    }
    return RateLimitingMonitoringSingleton.instance;
  }

  // ====================
  // RATE LIMITING DASHBOARD METHODS
  // ====================

  /**
   * Get comprehensive rate limiting dashboard data
   */
  async getRateLimitingDashboardData(filters?: RateLimitingFilters): Promise<RateLimitingDashboardData> {
    const cacheKey = `rate-limiting-dashboard-${filters?.timeRange || 24}-${filters?.ruleType || 'all'}-${filters?.ipStatus || 'all'}`;
    
    // Check cache first
    const cached = await this.getFromCache<RateLimitingDashboardData>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Fetch all rate limiting data in parallel
      const [
        config,
        rules,
        metrics,
        activeBlocks,
        topViolators
      ] = await Promise.all([
        this.getRateLimitConfig(),
        this.getRateLimitRules(),
        this.getRateLimitMetrics(filters?.timeRange),
        this.getActiveBlocks(),
        this.getTopViolators(filters?.timeRange)
      ]);

      const dashboardData: RateLimitingDashboardData = {
        config,
        rules,
        metrics,
        activeBlocks,
        topViolators,
        lastUpdated: new Date().toISOString()
      };

      // Cache the dashboard data
      await this.setCache(cacheKey, dashboardData);

      return dashboardData;
    } catch (error) {
      clientLogger.error('Error fetching rate limiting dashboard data:', { detail: error });
      throw error;
    }
  }

  /**
   * Get rate limiting configuration
   */
  async getRateLimitConfig(): Promise<RateLimitConfig> {
    const result = await this.makeDefaultRequest<RateLimitConfig>('/api/admin/rate-limiting/config', {}, 'rate-limit-config');
    
    if (!result.success) {
      clientLogger.error('Error fetching rate limit config:', { detail: result.error });
      
      // Return default config
      return {
        enabled: true,
        defaultLimits: {
          maxRequests: 100,
          windowMinutes: 1
        },
        strictLimits: {
          maxRequests: 10,
          windowMinutes: 1
        },
        exemptPaths: ['/api/directory', '/api/items', '/api/storefront', '/api/products'],
        strictPaths: ['/api/admin', '/api/auth']
      };
    }
    
    return result.data || (() => { 
      throw new Error('No config data received'); 
    })();
  }

  /**
   * Get rate limiting rules
   */
  async getRateLimitRules(): Promise<RateLimitRule[]> {
    const result = await this.makeDefaultRequest<RateLimitRule[]>('/api/admin/rate-limiting/rules', {}, 'rate-limit-rules');
    
    if (!result.success) {
      clientLogger.error('Error fetching rate limit rules:', { detail: result.error });
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get rate limiting metrics
   */
  async getRateLimitMetrics(hours: number = 24): Promise<RateLimitMetrics> {
    const result = await this.makeDefaultRequest<RateLimitMetrics>(`/api/admin/rate-limiting/metrics?hours=${hours}`, {}, `rate-limit-metrics-${hours}`);
    
    if (!result.success) {
      clientLogger.error('Error fetching rate limit metrics:', { detail: result.error });
      
      // Return default metrics
      return {
        totalRequests: 0,
        blockedRequests: 0,
        uniqueIPs: 0,
        topViolators: [],
        routeStats: {},
        timeRange: `${hours}h`
      } as RateLimitMetrics;
    }
    
    return result.data || {
      totalRequests: 0,
      blockedRequests: 0,
      uniqueIPs: 0,
      topViolators: [],
      routeStats: {},
      timeRange: `${hours}h`
    } as RateLimitMetrics;
  }

  /**
   * Get active IP blocks
   */
  async getActiveBlocks(): Promise<Array<{
    ip: string;
    reason: string;
    blockedAt: string;
    expiresAt: string;
  }>> {
    const result = await this.makeDefaultRequest<Array<{
      ip: string;
      reason: string;
      blockedAt: string;
      expiresAt: string;
    }>>('/api/admin/rate-limiting/blocks', {}, 'active-blocks');
    
    if (!result.success) {
      clientLogger.error('Error fetching active blocks:', { detail: result.error });
      return [];
    }
    
    return result.data || [];
  }

  /**
   * Get top violators
   */
  async getTopViolators(hours: number = 24): Promise<Array<{
    ip: string;
    violations: number;
    lastViolation: string;
  }>> {
    const result = await this.makeDefaultRequest<Array<{
      ip: string;
      violations: number;
      lastViolation: string;
    }>>(`/api/admin/rate-limiting/violators?hours=${hours}`, {}, `top-violators-${hours}`);
    
    if (!result.success) {
      clientLogger.error('Error fetching top violators:', { detail: result.error });
      return [];
    }
    
    return result.data || [];
  }

  // ====================
  // IP STATUS MONITORING
  // ====================

  /**
   * Get rate limit status for a specific IP
   */
  async getIPStatus(ip: string): Promise<RateLimitStatus> {
    const result = await this.makeDefaultRequest<RateLimitStatus>(`/api/admin/rate-limiting/status?ip=${ip}`, {}, `ip-status-${ip}`);
    
    if (!result.success) {
      clientLogger.error('Error getting IP status:', { detail: result.error });
      
      // Return default status
      return {
        ip,
        currentRequests: 0,
        maxRequests: 100,
        windowStart: new Date().toISOString(),
        windowEnd: new Date(Date.now() + 60 * 1000).toISOString(),
        isBlocked: false,
        remainingRequests: 100,
        resetTime: new Date(Date.now() + 60 * 1000).toISOString()
      };
    }
    
    return result.data || (() => { 
      throw new Error('No status data received'); 
    })();
  }

  /**
   * Get IP history
   */
  async getIPHistory(ip: string, hours: number = 24): Promise<Array<{
    timestamp: string;
    action: string;
    details: Record<string, any>;
  }>> {
    const result = await this.makeDefaultRequest<Array<{
      timestamp: string;
      action: string;
      details: Record<string, any>;
    }>>(`/api/admin/rate-limiting/history/${ip}?hours=${hours}`, {}, `ip-history-${ip}-${hours}`);
    
    if (!result.success) {
      clientLogger.error('Error getting IP history:', { detail: result.error });
      return [];
    }
    
    return result.data || [];
  }

  // ====================
  // ROUTE ANALYTICS
  // ====================

  /**
   * Get route-specific analytics
   */
  async getRouteAnalytics(routeType: string, hours: number = 24): Promise<{
    requests: number;
    blocks: number;
    uniqueIPs: number;
    averageRequestsPerIP: number;
    topIPs: Array<{
      ip: string;
      requests: number;
      blocks: number;
    }>;
  }> {
    const result = await this.makeDefaultRequest<{
      requests: number;
      blocks: number;
      uniqueIPs: number;
      averageRequestsPerIP: number;
      topIPs: Array<{
        ip: string;
        requests: number;
        blocks: number;
      }>;
    }>(`/api/admin/rate-limiting/analytics/${routeType}?hours=${hours}`, {}, `route-analytics-${routeType}-${hours}`);
    
    if (!result.success) {
      clientLogger.error('Error getting route analytics:', { detail: result.error });
      
      // Return default analytics
      return {
        requests: 0,
        blocks: 0,
        uniqueIPs: 0,
        averageRequestsPerIP: 0,
        topIPs: []
      };
    }
    
    return result.data || {
      requests: 0,
      blocks: 0,
      uniqueIPs: 0,
      averageRequestsPerIP: 0,
      topIPs: []
    };
  }

  /**
   * Get all route analytics
   */
  async getAllRouteAnalytics(hours: number = 24): Promise<Record<string, {
    requests: number;
    blocks: number;
    uniqueIPs: number;
    averageRequestsPerIP: number;
    topIPs: Array<{
      ip: string;
      requests: number;
      blocks: number;
    }>;
  }>> {
    const result = await this.makeDefaultRequest<Record<string, {
      requests: number;
      blocks: number;
      uniqueIPs: number;
      averageRequestsPerIP: number;
      topIPs: Array<{
        ip: string;
        requests: number;
        blocks: number;
      }>;
    }>>(`/api/admin/rate-limiting/analytics?hours=${hours}`, {}, `all-route-analytics-${hours}`);
    
    if (!result.success) {
      clientLogger.error('Error getting all route analytics:', { detail: result.error });
      return {};
    }
    
    return result.data || {};
  }

  // ====================
  // MONITORING ACTIONS
  // ====================

  /**
   * Block an IP address
   */
  async blockIP(ip: string, durationMinutes: number = 60, reason: string = 'Manual block'): Promise<void> {
    try {
      await this.makeDefaultRequest('/api/admin/rate-limiting/block', {
        method: 'POST',
        body: JSON.stringify({ ip, durationMinutes, reason })
      });

      // Clear relevant cache
      await this.invalidateCache('active-blocks');
      await this.invalidateCache(`ip-status-${ip}`);
    } catch (error) {
      clientLogger.error('Error blocking IP:', { detail: error });
      throw error;
    }
  }

  /**
   * Unblock an IP address
   */
  async unblockIP(ip: string): Promise<void> {
    try {
      await this.makeDefaultRequest(`/api/admin/rate-limiting/unblock/${ip}`, {
        method: 'POST'
      });

      // Clear relevant cache
      await this.invalidateCache('active-blocks');
      await this.invalidateCache(`ip-status-${ip}`);
    } catch (error) {
      clientLogger.error('Error unblocking IP:', { detail: error });
      throw error;
    }
  }

  /**
   * Reset rate limit for an IP
   */
  async resetIPLimit(ip: string): Promise<void> {
    try {
      await this.makeDefaultRequest(`/api/admin/rate-limiting/reset?ip=${ip}`, {
        method: 'POST'
      });

      // Clear relevant cache
      await this.invalidateCache(`ip-status-${ip}`);
    } catch (error) {
      clientLogger.error('Error resetting IP limit:', { detail: error });
      throw error;
    }
  }

  // ====================
  // MONITORING SPECIFIC METRICS
  // ====================

  protected getCustomMetrics(): Record<string, any> {
    return {
      dashboardRefreshes: 0,
      lastDataFetch: null,
      activeBlocksCount: 0,
      topViolatorsCount: 0,
      routeAnalyticsCount: 0
    };
  }

  /**
   * Refresh all monitoring data
   */
  async refreshMonitoringData(filters?: RateLimitingFilters): Promise<RateLimitingDashboardData> {
    // Clear cache first
    await this.clearCache();
    
    // Fetch fresh data
    return this.getRateLimitingDashboardData(filters);
  }

  /**
   * Get rate limiting health status
   */
  async getRateLimitingHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    score: number;
    issues: string[];
    recommendations: string[];
  }> {
    const result = await this.makeDefaultRequest<{
      status: 'healthy' | 'warning' | 'critical';
      score: number;
      issues: string[];
      recommendations: string[];
    }>('/api/admin/rate-limiting/health', {}, 'rate-limiting-health-status');
    
    if (!result.success) {
      clientLogger.error('Error fetching rate limiting health status:', { detail: result.error });
      return {
        status: 'warning',
        score: 75,
        issues: ['Unable to fetch complete rate limiting status'],
        recommendations: ['Check rate limiting service connectivity']
      };
    }
    
    return result.data || {
      status: 'warning',
      score: 75,
      issues: ['No health data received'],
      recommendations: ['Check rate limiting service connectivity']
    };
  }

  /**
   * Get rate limiting trends
   */
  async getRateLimitingTrends(days: number = 7): Promise<Array<{
    date: string;
    requests: number;
    blocks: number;
    uniqueIPs: number;
    blockRate: number;
  }>> {
    const result = await this.makeDefaultRequest<Array<{
      date: string;
      requests: number;
      blocks: number;
      uniqueIPs: number;
      blockRate: number;
    }>>(`/api/admin/rate-limiting/trends?days=${days}`, {}, `rate-limiting-trends-${days}`);
    
    if (!result.success) {
      clientLogger.error('Error fetching rate limiting trends:', { detail: result.error });
      return [];
    }
    
    return result.data || [];
  }
}

// Export singleton instance
export const rateLimitingMonitoringSingleton = RateLimitingMonitoringSingleton.getInstance();

export default RateLimitingMonitoringSingleton;
