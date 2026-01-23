/**
 * Platform Rate Limiting Controller Singleton - Producer Pattern
 * 
 * Controls and manages platform-wide rate limiting
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../base/UniversalSingleton';

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
class RateLimitingControllerSingleton extends UniversalSingleton {
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
    try {
      const response = await fetch('/api/admin/rate-limiting/rules');
      
      if (response.ok) {
        const rules: RateLimitRule[] = await response.json();
        
        // Update rules cache
        this.rateLimitRules.clear();
        rules.forEach(rule => {
          this.rateLimitRules.set(rule.routeType, rule);
        });

        // Cache rules
        await this.setCache('rate-limit-rules', rules);
      }
    } catch (error) {
      console.error('Error loading rate limit rules:', error);
    }
  }

  // ====================
  // RATE LIMIT RULE MANAGEMENT
  // ====================

  /**
   * Create a new rate limit rule
   */
  async createRateLimitRule(rule: Omit<RateLimitRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<RateLimitRule> {
    try {
      const newRule: RateLimitRule = {
        ...rule,
        id: this.generateRuleId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const response = await fetch('/api/admin/rate-limiting/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      });

      if (!response.ok) {
        throw new Error('Failed to create rate limit rule');
      }

      const createdRule = await response.json();
      
      // Update local cache
      this.rateLimitRules.set(createdRule.routeType, createdRule);
      
      // Clear cache to force refresh
      await this.clearCache('rate-limit-rules');

      return createdRule;
    } catch (error) {
      console.error('Error creating rate limit rule:', error);
      throw error;
    }
  }

  /**
   * Update an existing rate limit rule
   */
  async updateRateLimitRule(routeType: string, updates: Partial<RateLimitRule>): Promise<RateLimitRule> {
    try {
      const existingRule = this.rateLimitRules.get(routeType);
      if (!existingRule) {
        throw new Error('Rate limit rule not found');
      }

      const updatedRule: RateLimitRule = {
        ...existingRule,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const response = await fetch(`/api/admin/rate-limiting/rules/${routeType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedRule)
      });

      if (!response.ok) {
        throw new Error('Failed to update rate limit rule');
      }

      const returnedRule = await response.json();
      
      // Update local cache
      this.rateLimitRules.set(routeType, returnedRule);
      
      // Clear cache to force refresh
      await this.clearCache('rate-limit-rules');

      return returnedRule;
    } catch (error) {
      console.error('Error updating rate limit rule:', error);
      throw error;
    }
  }

  /**
   * Delete a rate limit rule
   */
  async deleteRateLimitRule(routeType: string): Promise<void> {
    try {
      const response = await fetch(`/api/admin/rate-limiting/rules/${routeType}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete rate limit rule');
      }

      // Remove from local cache
      this.rateLimitRules.delete(routeType);
      
      // Clear cache to force refresh
      await this.clearCache('rate-limit-rules');
    } catch (error) {
      console.error('Error deleting rate limit rule:', error);
      throw error;
    }
  }

  /**
   * Get all rate limit rules
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
      
      // Update local cache
      this.rateLimitRules.clear();
      rules.forEach((rule: RateLimitRule) => {
        this.rateLimitRules.set(rule.routeType, rule);
      });

      await this.setCache(cacheKey, rules);
      return rules;
    } catch (error) {
      console.error('Error fetching rate limit rules:', error);
      return Array.from(this.rateLimitRules.values());
    }
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
    const cacheKey = `rate-limit-status-${ip}-${routeType}`;
    
    const cached = await this.getFromCache<RateLimitStatus>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(`/api/admin/rate-limiting/status?ip=${ip}&routeType=${routeType}`);
      
      if (!response.ok) {
        throw new Error('Failed to check rate limit status');
      }

      const status = await response.json();
      
      // Update local cache
      this.rateLimitStatus.set(`${ip}-${routeType}`, status);
      
      await this.setCache(cacheKey, status);
      return status;
    } catch (error) {
      console.error('Error checking rate limit status:', error);
      
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
   * Reset rate limit for an IP
   */
  async resetRateLimit(ip: string, routeType?: string): Promise<void> {
    try {
      const params = new URLSearchParams({ ip });
      if (routeType) {
        params.append('routeType', routeType);
      }

      const response = await fetch(`/api/admin/rate-limiting/reset?${params}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to reset rate limit');
      }

      // Clear relevant cache entries
      if (routeType) {
        await this.clearCache(`rate-limit-status-${ip}-${routeType}`);
      } else {
        // Clear all status entries for this IP
        for (const [key] of this.rateLimitStatus) {
          if (key.startsWith(`${ip}-`)) {
            await this.clearCache(`rate-limit-status-${key}`);
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
      const response = await fetch('/api/admin/rate-limiting/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip, durationMinutes, reason })
      });

      if (!response.ok) {
        throw new Error('Failed to block IP address');
      }

      // Clear all status entries for this IP
      for (const [key] of this.rateLimitStatus) {
        if (key.startsWith(`${ip}-`)) {
          await this.clearCache(`rate-limit-status-${key}`);
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
      const response = await fetch(`/api/admin/rate-limiting/unblock/${ip}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Failed to unblock IP address');
      }

      // Clear all status entries for this IP
      for (const [key] of this.rateLimitStatus) {
        if (key.startsWith(`${ip}-`)) {
          await this.clearCache(`rate-limit-status-${key}`);
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
   * Update rate limiting configuration
   */
  async updateRateLimitConfig(config: Partial<RateLimitConfig>): Promise<RateLimitConfig> {
    try {
      const response = await fetch('/api/admin/rate-limiting/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      if (!response.ok) {
        throw new Error('Failed to update rate limit config');
      }

      const updatedConfig = await response.json();
      
      // Clear cache
      await this.clearCache('rate-limit-config');

      return updatedConfig;
    } catch (error) {
      console.error('Error updating rate limit config:', error);
      throw error;
    }
  }

  // ====================
  // RATE LIMITING METRICS
  // ====================

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
