/**
 * Platform Rate Limiting Controller Singleton - Producer Pattern
 * 
 * Controls and manages platform-wide rate limiting
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { SingletonCacheOptions } from '@/providers/base/FlexibleApiSingleton';

// Rate Limiting Data Interfaces
export interface RateLimitRule {
  id: string;
  routeType: string;
  maxRequests: number;
  windowMinutes: number;
  enabled: boolean;
  priority: number;
  exemptPaths: string[];
  strictPaths: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RateLimitConfig {
  enabled: boolean;
  defaultLimits: {
    maxRequests: number;
    windowMinutes: number;
  };
  strictLimits: {
    maxRequests: number;
    windowMinutes: number;
  };
  exemptPaths: string[];
  strictPaths: string[];
}

export interface RateLimitStatus {
  ip: string;
  currentRequests: number;
  maxRequests: number;
  windowStart: string;
  windowEnd: string;
  isBlocked: boolean;
  remainingRequests: number;
  resetTime: string;
}

export interface RateLimitMetrics {
  totalRequests: number;
  blockedRequests: number;
  uniqueIPs: number;
  topViolators: Array<{
    ip: string;
    violations: number;
  }>;
  routeStats: Record<string, {
    requests: number;
    blocks: number;
  }>;
  timeRange: string;
}

/**
 * Platform Rate Limiting Controller Singleton - Producer Pattern
 * 
 * Produces and manages rate limiting rules and enforcement
 */
class RateLimitingControllerSingleton extends AdminApiSingleton {
  private static instance: RateLimitingControllerSingleton;
  private rateLimitRules: Map<string, RateLimitRule> = new Map();
  private rateLimitStatus: Map<string, RateLimitStatus> = new Map();
  private configUpdateInterval: NodeJS.Timeout | null = null;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
    this.initializeRateLimiting();
  }

  static getInstance(): RateLimitingControllerSingleton {
    if (!RateLimitingControllerSingleton.instance) {
      RateLimitingControllerSingleton.instance = new RateLimitingControllerSingleton('rate-limiting-controller-singleton');
    }
    return RateLimitingControllerSingleton.instance;
  }

  // ====================
  // RATE LIMITING INITIALIZATION
  // ====================

  private async initializeRateLimiting(): Promise<void> {
    // Load existing rate limit rules
    await this.loadRateLimitRules();
    
    // Start configuration updates
    this.configUpdateInterval = setInterval(() => {
      this.loadRateLimitRules();
    }, 5 * 60 * 1000); // Update every 5 minutes
  }

  /**
   * Load rate limit rules from database
   */
  private async loadRateLimitRules(): Promise<void> {
    const result = await this.makeAuthenticatedRequest<RateLimitRule[]>('/api/admin/rate-limiting/rules', {}, 'rate-limit-rules');
    
    if (!result.success) {
      console.error('Error loading rate limit rules:', result.error);
      return;
    }
    
    // Update rules cache
    this.rateLimitRules.clear();
    result.data?.forEach(rule => {
      this.rateLimitRules.set(rule.routeType, rule);
    });

    // Cache is handled automatically
  }

  // ====================
  // RATE LIMIT RULE MANAGEMENT
  // ====================

  /**
   * Create a new rate limit rule
   */
  async createRateLimitRule(rule: Omit<RateLimitRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<RateLimitRule> {
    const newRule: RateLimitRule = {
      ...rule,
      id: this.generateRuleId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const result = await this.makeAuthenticatedRequest<RateLimitRule>('/api/admin/rate-limiting/rules', {
      method: 'POST',
      body: JSON.stringify(newRule)
    });
    
    if (!result.success) {
      console.error('Error creating rate limit rule:', result.error);
      throw new Error(result.error?.message || 'Failed to create rate limit rule');
    }
    
    const createdRule = result.data || (() => { throw new Error('No rule data received'); })();
    
    // Update local cache
    this.rateLimitRules.set(createdRule.routeType, createdRule);
    
    // Clear cache to force refresh
    await this.invalidateCache('rate-limit-rules');

    return createdRule;
  }

  /**
   * Update an existing rate limit rule
   */
  async updateRateLimitRule(routeType: string, updates: Partial<RateLimitRule>): Promise<RateLimitRule> {
    const existingRule = this.rateLimitRules.get(routeType);
    if (!existingRule) {
      throw new Error('Rate limit rule not found');
    }

    const updatedRule: RateLimitRule = {
      ...existingRule,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    const result = await this.makeAuthenticatedRequest<RateLimitRule>(`/api/admin/rate-limiting/rules/${routeType}`, {
      method: 'PUT',
      body: JSON.stringify(updatedRule)
    });
    
    if (!result.success) {
      console.error('Error updating rate limit rule:', result.error);
      throw new Error(result.error?.message || 'Failed to update rate limit rule');
    }
    
    const returnedRule = result.data || (() => { throw new Error('No rule data received'); })();
    
    // Update local cache
    this.rateLimitRules.set(routeType, returnedRule);
    
    // Clear cache to force refresh
    await this.invalidateCache('rate-limit-rules');

    return returnedRule;
  }

  /**
   * Delete a rate limit rule
   */
  async deleteRateLimitRule(routeType: string): Promise<void> {
    const result = await this.makeAuthenticatedRequest<void>(`/api/admin/rate-limiting/rules/${routeType}`, {
      method: 'DELETE'
    });

    if (!result.success) {
      console.error('Error deleting rate limit rule:', result.error);
      throw new Error(result.error?.message || 'Failed to delete rate limit rule');
    }

    // Remove from local cache
    this.rateLimitRules.delete(routeType);
    
    // Clear cache to force refresh
    await this.invalidateCache('rate-limit-rules');
  }

  /**
   * Get all rate limit rules
   */
  async getRateLimitRules(): Promise<RateLimitRule[]> {
    const result = await this.makeAuthenticatedRequest<RateLimitRule[]>('/api/admin/rate-limiting/rules', {}, 'rate-limit-rules');
    
    if (!result.success) {
      console.error('Error fetching rate limit rules:', result.error);
      return Array.from(this.rateLimitRules.values());
    }
    
    // Update local cache
    this.rateLimitRules.clear();
    result.data?.forEach((rule: RateLimitRule) => {
      this.rateLimitRules.set(rule.routeType, rule);
    });

    return result.data || [];
  }

  /**
   * Get rate limit rule by route type
   */
  async getRateLimitRule(routeType: string): Promise<RateLimitRule | null> {
    const rules = await this.getRateLimitRules();
    return rules.find(rule => rule.routeType === routeType) || null;
  }

  // ====================
  // RATE LIMIT STATUS MANAGEMENT
  // ====================

  /**
   * Check rate limit status for an IP
   */
  async checkRateLimitStatus(ip: string, routeType: string): Promise<RateLimitStatus> {
    const result = await this.makeAuthenticatedRequest<RateLimitStatus>(`/api/admin/rate-limiting/status?ip=${ip}&routeType=${routeType}`, {}, `rate-limit-status-${ip}-${routeType}`);
    
    if (!result.success) {
      console.error('Error checking rate limit status:', result.error);
      
      // Return default status
      return {
        ip,
        currentRequests: 0,
        maxRequests: 100,
        windowStart: new Date(Date.now()).toISOString(),
        windowEnd: new Date(Date.now() + 60000).toISOString(),
        isBlocked: false,
        remainingRequests: 100,
        resetTime: new Date(Date.now() + 60000).toISOString()
      };
    }
    
    const status = result.data || (() => { 
      throw new Error('No status data received'); 
    })();
    
    // Update local cache
    this.rateLimitStatus.set(`${ip}-${routeType}`, status);
    
    return status;
  }

  /**
   * Reset rate limit for an IP
   */
  async resetRateLimit(ip: string, routeType?: string): Promise<void> {
    try {
      const params = new URLSearchParams({ ip });
      if (routeType) {
        params.append('routeType', routeType);
      }

      await this.makeAuthenticatedRequest(`/api/admin/rate-limiting/reset?${params}`, {
        method: 'POST'
      });

      // Clear relevant cache entries
      if (routeType) {
        await this.invalidateCache(`rate-limit-status-${ip}-${routeType}`);
      } else {
        // Clear all status entries for this IP
        for (const [key] of this.rateLimitStatus) {
          if (key.startsWith(`${ip}-`)) {
            await this.invalidateCache(`rate-limit-status-${key}`);
          }
        }
      }
    } catch (error) {
      console.error('Error resetting rate limit:', error);
      throw error;
    }
  }

  /**
   * Block an IP address
   */
  async blockIPAddress(ip: string, durationMinutes: number = 60, reason: string = 'Manual block'): Promise<void> {
    try {
      await this.makeAuthenticatedRequest('/api/admin/rate-limiting/block', {
        method: 'POST',
        body: JSON.stringify({ ip, durationMinutes, reason })
      });

      // Clear all status entries for this IP
      for (const [key] of this.rateLimitStatus) {
        if (key.startsWith(`${ip}-`)) {
          await this.invalidateCache(`rate-limit-status-${key}`);
        }
      }
    } catch (error) {
      console.error('Error blocking IP address:', error);
      throw error;
    }
  }

  /**
   * Unblock an IP address
   */
  async unblockIPAddress(ip: string): Promise<void> {
    try {
      await this.makeAuthenticatedRequest(`/api/admin/rate-limiting/unblock/${ip}`, {
        method: 'POST'
      });

      // Clear all status entries for this IP
      for (const [key] of this.rateLimitStatus) {
        if (key.startsWith(`${ip}-`)) {
          await this.invalidateCache(`rate-limit-status-${key}`);
        }
      }
    } catch (error) {
      console.error('Error unblocking IP address:', error);
      throw error;
    }
  }

  // ====================
  // RATE LIMITING CONFIGURATION
  // ====================

  /**
   * Get rate limiting configuration
   */
  async getRateLimitConfig(): Promise<RateLimitConfig> {
    const result = await this.makeAuthenticatedRequest<RateLimitConfig>('/api/admin/rate-limiting/config', {}, 'rate-limit-config');
    
    if (!result.success) {
      console.error('Error fetching rate limit config:', result.error);
      
      // Return default config
      return {
        enabled: true,
        defaultLimits: {} as any,
        strictLimits: {} as any,
        exemptPaths: ['/health', '/metrics'],
        strictPaths: ['/api/admin', '/api/auth']
      };
    }
    
    return result.data || (() => { 
      throw new Error('No config data received'); 
    })();
  }

  /**
   * Update rate limiting configuration
   */
  async updateRateLimitConfig(config: Partial<RateLimitConfig>): Promise<RateLimitConfig> {
    const result = await this.makeAuthenticatedRequest<RateLimitConfig>('/api/admin/rate-limiting/config', {
      method: 'PUT',
      body: JSON.stringify(config)
    });

    if (!result.success) {
      console.error('Error updating rate limit config:', result.error);
      throw new Error(result.error?.message || 'Failed to update rate limit config');
    }

    const updatedConfig = result.data || (() => { 
      throw new Error('No config data received'); 
    })();

    // Clear cache
    await this.invalidateCache('rate-limit-config');

    return updatedConfig;
  }

  // ====================
  // RATE LIMITING METRICS
  // ====================

  /**
   * Get rate limiting metrics
   */
  async getRateLimitMetrics(hours: number = 24): Promise<RateLimitMetrics> {
    const result = await this.makeAuthenticatedRequest<RateLimitMetrics>(`/api/admin/rate-limiting/metrics?hours=${hours}`, {}, `rate-limit-metrics-${hours}`);
    
    if (!result.success) {
      console.error('Error fetching rate limit metrics:', result.error);
      
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

  // ====================
  // RATE LIMITING SPECIFIC METRICS
  // ====================

  protected getCustomMetrics(): Record<string, any> {
    return {
      rulesCount: this.rateLimitRules.size,
      activeStatusChecks: this.rateLimitStatus.size,
      configUpdates: 0,
      lastConfigUpdate: new Date().toISOString(),
      blockedIPsCount: 0
    };
  }

  // ====================
  // UTILITY METHODS
  // ====================

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ====================
  // CLEANUP
  // ====================

  /**
   * Cleanup rate limiting resources
   */
  async cleanup(): Promise<void> {
    if (this.configUpdateInterval) {
      clearInterval(this.configUpdateInterval);
      this.configUpdateInterval = null;
    }
    
    // Clear cache
    await this.clearCache();
  }
}

// Export singleton instance
export const rateLimitingControllerSingleton = RateLimitingControllerSingleton.getInstance();

export default RateLimitingControllerSingleton;
