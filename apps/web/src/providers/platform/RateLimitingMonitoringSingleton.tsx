/**
 * Platform Rate Limiting Monitoring Singleton - Consumer Pattern
 * 
 * Consumes and displays rate limiting monitoring data
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';
import { RateLimitRule, RateLimitConfig, RateLimitStatus, RateLimitMetrics } from './RateLimitingControllerSingleton';

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
class RateLimitingMonitoringSingleton extends UniversalSingleton {
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
    const cacheKey = `rate-limiting-dashboard-${JSON.stringify(filters || {})}`;
    
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
      console.error('Error fetching rate limiting dashboard data:', error);
      throw error;
    }
  }

  /**
   * Get rate limiting configuration
   */
  async getRateLimitConfig(): Promise<RateLimitConfig> {
    const cacheKey = 'rate-limit-config';
    
    const cached = await this.getFromCache<RateLimitConfig>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch('/api/admin/rate-limiting/config');
      
      if (!response.ok) {
        throw new Error('Failed to fetch rate limit config');
      }

      const config = await response.json();
      
      await this.setCache(cacheKey, config);
      return config;
    } catch (error) {
      console.error('Error fetching rate limit config:', error);
      
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
        strictPaths: ['/api/tenants']
      };
    }
  }

  /**
   * Get rate limiting rules
   */
  async getRateLimitRules(): Promise<RateLimitRule[]> {
    const cacheKey = 'rate-limit-rules';
    
    const cached = await this.getFromCache<RateLimitRule[]>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch('/api/admin/rate-limiting/rules');
      
      if (!response.ok) {
        throw new Error('Failed to fetch rate limit rules');
      }

      const rules = await response.json();
      
      await this.setCache(cacheKey, rules);
      return rules;
    } catch (error) {
      console.error('Error fetching rate limit rules:', error);
      return [];
    }
  }

  /**
   * Get rate limiting metrics
   */
  async getRateLimitMetrics(hours: number = 24): Promise<RateLimitMetrics> {
    const cacheKey = `rate-limit-metrics-${hours}`;
    
    const cached = await this.getFromCache<RateLimitMetrics>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/admin/rate-limiting/metrics?hours=${hours}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch rate limit metrics');
      }

      const metrics = await response.json();
      
      await this.setCache(cacheKey, metrics);
      return metrics;
    } catch (error) {
      console.error('Error fetching rate limit metrics:', error);
      
      // Return default metrics
      return {
        totalRequests: 0,
        blockedRequests: 0,
        uniqueIPs: 0,
        topViolators: [],
        routeStats: {},
        timeRange: `${hours} hours`
      };
    }
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
    const cacheKey = 'active-blocks';
    
    const cached = await this.getFromCache<Array<{
      ip: string;
      reason: string;
      blockedAt: string;
      expiresAt: string;
    }>>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch('/api/admin/rate-limiting/blocks');
      
      if (!response.ok) {
        throw new Error('Failed to fetch active blocks');
      }

      const blocks = await response.json();
      
      await this.setCache(cacheKey, blocks);
      return blocks;
    } catch (error) {
      console.error('Error fetching active blocks:', error);
      return [];
    }
  }

  /**
   * Get top violators
   */
  async getTopViolators(hours: number = 24): Promise<Array<{
    ip: string;
    violations: number;
    lastViolation: string;
  }>> {
    const cacheKey = `top-violators-${hours}`;
    
    const cached = await this.getFromCache<Array<{
      ip: string;
      violations: number;
      lastViolation: string;
    }>>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/admin/rate-limiting/violators?hours=${hours}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch top violators');
      }

      const violators = await response.json();
      
      await this.setCache(cacheKey, violators);
      return violators;
    } catch (error) {
      console.error('Error fetching top violators:', error);
      return [];
    }
  }

  // ====================
  // IP STATUS MONITORING
  // ====================

  /**
   * Get rate limit status for a specific IP
   */
  async getIPStatus(ip: string): Promise<RateLimitStatus> {
    const cacheKey = `ip-status-${ip}`;
    
    const cached = await this.getFromCache<RateLimitStatus>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/admin/rate-limiting/status?ip=${ip}`);
      
      if (!response.ok) {
        throw new Error('Failed to get IP status');
      }

      const status = await response.json();
      
      await this.setCache(cacheKey, status);
      return status;
    } catch (error) {
      console.error('Error getting IP status:', error);
      
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
  }

  /**
   * Get IP history
   */
  async getIPHistory(ip: string, hours: number = 24): Promise<Array<{
    timestamp: string;
    action: string;
    details: Record<string, any>;
  }>> {
    const cacheKey = `ip-history-${ip}-${hours}`;
    
    const cached = await this.getFromCache<Array<{
      timestamp: string;
      action: string;
      details: Record<string, any>;
    }>>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/admin/rate-limiting/history/${ip}?hours=${hours}`);
      
      if (!response.ok) {
        throw new Error('Failed to get IP history');
      }

      const history = await response.json();
      
      await this.setCache(cacheKey, history);
      return history;
    } catch (error) {
      console.error('Error getting IP history:', error);
      return [];
    }
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
    const cacheKey = `route-analytics-${routeType}-${hours}`;
    
    const cached = await this.getFromCache<{
      requests: number;
      blocks: number;
      uniqueIPs: number;
      averageRequestsPerIP: number;
      topIPs: Array<{
        ip: string;
        requests: number;
        blocks: number;
      }>;
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/admin/rate-limiting/analytics/${routeType}?hours=${hours}`);
      
      if (!response.ok) {
        throw new Error('Failed to get route analytics');
      }

      const analytics = await response.json();
      
      await this.setCache(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error('Error getting route analytics:', error);
      
      // Return default analytics
      return {
        requests: 0,
        blocks: 0,
        uniqueIPs: 0,
        averageRequestsPerIP: 0,
        topIPs: []
      };
    }
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
    const cacheKey = `all-route-analytics-${hours}`;
    
    const cached = await this.getFromCache<Record<string, {
      requests: number;
      blocks: number;
      uniqueIPs: number;
      averageRequestsPerIP: number;
      topIPs: Array<{
        ip: string;
        requests: number;
        blocks: number;
      }>;
    }>>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/admin/rate-limiting/analytics?hours=${hours}`);
      
      if (!response.ok) {
        throw new Error('Failed to get all route analytics');
      }

      const analytics = await response.json();
      
      await this.setCache(cacheKey, analytics);
      return analytics;
    } catch (error) {
      console.error('Error getting all route analytics:', error);
      return {};
    }
  }

  // ====================
  // MONITORING ACTIONS
  // ====================

  /**
   * Block an IP address
   */
  async blockIP(ip: string, durationMinutes: number = 60, reason: string = 'Manual block'): Promise<void> {
    try {
      const response = await fetch('/api/admin/rate-limiting/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, durationMinutes, reason })
      });

      if (!response.ok) {
        throw new Error('Failed to block IP');
      }

      // Clear relevant cache
      await this.clearCache('active-blocks');
      await this.clearCache(`ip-status-${ip}`);
    } catch (error) {
      console.error('Error blocking IP:', error);
      throw error;
    }
  }

  /**
   * Unblock an IP address
   */
  async unblockIP(ip: string): Promise<void> {
    try {
      const response = await fetch(`/api/admin/rate-limiting/unblock/${ip}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to unblock IP');
      }

      // Clear relevant cache
      await this.clearCache('active-blocks');
      await this.clearCache(`ip-status-${ip}`);
    } catch (error) {
      console.error('Error unblocking IP:', error);
      throw error;
    }
  }

  /**
   * Reset rate limit for an IP
   */
  async resetIPLimit(ip: string): Promise<void> {
    try {
      const response = await fetch(`/api/admin/rate-limiting/reset?ip=${ip}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to reset IP limit');
      }

      // Clear relevant cache
      await this.clearCache(`ip-status-${ip}`);
    } catch (error) {
      console.error('Error resetting IP limit:', error);
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
    const cacheKey = 'rate-limiting-health-status';
    
    const cached = await this.getFromCache<{
      status: 'healthy' | 'warning' | 'critical';
      score: number;
      issues: string[];
      recommendations: string[];
    }>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch('/api/admin/rate-limiting/health');
      
      if (!response.ok) {
        throw new Error('Failed to fetch rate limiting health status');
      }

      const healthStatus = await response.json();
      
      await this.setCache(cacheKey, healthStatus);
      return healthStatus;
    } catch (error) {
      console.error('Error fetching rate limiting health status:', error);
      return {
        status: 'warning',
        score: 75,
        issues: ['Unable to fetch complete rate limiting status'],
        recommendations: ['Check rate limiting service connectivity']
      };
    }
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
    const cacheKey = `rate-limiting-trends-${days}`;
    
    const cached = await this.getFromCache<Array<{
      date: string;
      requests: number;
      blocks: number;
      uniqueIPs: number;
      blockRate: number;
    }>>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/admin/rate-limiting/trends?days=${days}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch rate limiting trends');
      }

      const trends = await response.json();
      
      await this.setCache(cacheKey, trends);
      return trends;
    } catch (error) {
      console.error('Error fetching rate limiting trends:', error);
      return [];
    }
  }
}

// Export singleton instance
export const rateLimitingMonitoringSingleton = RateLimitingMonitoringSingleton.getInstance();

export default RateLimitingMonitoringSingleton;
