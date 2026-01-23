/**
 * Rate Limiting Service - API Server Singleton
 * 
 * Handles rate limiting rules, enforcement, and IP management
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';

// Rate Limiting Types
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

export interface BlockedIP {
  id: string;
  ipAddress: string;
  reason: string;
  blockedAt: Date;
  expiresAt: Date;
  permanent: boolean;
  attempts?: number;
  metadata?: Record<string, any>;
}

/**
 * Rate Limiting Service - API Server Singleton
 * 
 * Manages rate limiting rules, enforcement, and IP blocking
 */
class RateLimitingService extends UniversalSingleton {
  private static instance: RateLimitingService;
  private rateLimitRules: Map<string, RateLimitRule> = new Map();
  private rateLimitStatus: Map<string, RateLimitStatus> = new Map();
  private configUpdateInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, cacheOptions);
    this.initializeRateLimiting();
  }

  static getInstance(): RateLimitingService {
    if (!RateLimitingService.instance) {
      RateLimitingService.instance = new RateLimitingService('rate-limiting-service');
    }
    return RateLimitingService.instance;
  }

  // ====================
  // INITIALIZATION
  // ====================

  private async initializeRateLimiting(): Promise<void> {
    // Load existing rate limit rules
    await this.loadRateLimitRules();
    
    // Start configuration updates
    this.configUpdateInterval = setInterval(() => {
      this.loadRateLimitRules();
    }, 5 * 60 * 1000); // Update every 5 minutes

    // Start cleanup of expired blocks
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredBlocks();
    }, 60 * 1000); // Check every minute
  }

  /**
   * Load rate limit rules from database
   */
  private async loadRateLimitRules(): Promise<void> {
    try {
      // This would query the database for rate limit rules
      // For now, use default rules
      const defaultRules: RateLimitRule[] = [
        {
          id: 'default',
          routeType: 'default',
          maxRequests: 100,
          windowMinutes: 1,
          enabled: true,
          priority: 1,
          exemptPaths: ['/api/directory', '/api/items', '/api/storefront', '/api/products'],
          strictPaths: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'strict',
          routeType: 'strict',
          maxRequests: 10,
          windowMinutes: 1,
          enabled: true,
          priority: 2,
          exemptPaths: [],
          strictPaths: ['/api/tenants'],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      // Update rules cache
      this.rateLimitRules.clear();
      defaultRules.forEach(rule => {
        this.rateLimitRules.set(rule.routeType, rule);
      });

      // Cache rules
      await this.setCache('rate-limit-rules', defaultRules);
    } catch (error) {
      console.error('Error loading rate limit rules:', error);
    }
  }

  // ====================
  // RATE LIMITING ENFORCEMENT
  // ====================

  /**
   * Check if request should be allowed
   */
  async checkRateLimit(
    ip: string,
    routeType: string,
    path: string
  ): Promise<{
    allowed: boolean;
    status?: RateLimitStatus;
    rule?: RateLimitRule;
  }> {
    const rule = this.getRuleForRoute(routeType, path);
    
    if (!rule || !rule.enabled) {
      return { allowed: true };
    }

    const status = await this.getRateLimitStatus(ip, rule);
    
    // Update request count
    status.currentRequests++;
    status.remainingRequests = Math.max(0, status.maxRequests - status.currentRequests);
    
    // Check if blocked
    const isBlocked = status.currentRequests > status.maxRequests;
    status.isBlocked = isBlocked;

    if (isBlocked) {
      // Record blocked request
      await this.recordBlockedRequest(ip, routeType, rule);
    }

    // Update cache
    const cacheKey = `rate-limit-status-${ip}-${routeType}`;
    await this.setCache(cacheKey, status);

    return {
      allowed: !isBlocked,
      status,
      rule
    };
  }

  /**
   * Get rate limit rule for a route
   */
  private getRuleForRoute(routeType: string, path: string): RateLimitRule | null {
    // Check for exact match first
    const exactRule = this.rateLimitRules.get(routeType);
    if (exactRule && exactRule.enabled) {
      return exactRule;
    }

    // Check for strict paths
    const strictRule = this.rateLimitRules.get('strict');
    if (strictRule && strictRule.enabled && strictRule.strictPaths.some(strictPath => path.startsWith(strictPath))) {
      return strictRule;
    }

    // Check for exempt paths
    const defaultRule = this.rateLimitRules.get('default');
    if (defaultRule && defaultRule.enabled && !defaultRule.exemptPaths.some(exemptPath => path.startsWith(exemptPath))) {
      return defaultRule;
    }

    return null;
  }

  /**
   * Get rate limit status for IP
   */
  private async getRateLimitStatus(ip: string, rule: RateLimitRule): Promise<RateLimitStatus> {
    const cacheKey = `rate-limit-status-${ip}-${rule.routeType}`;
    
    const cached = await this.getFromCache<RateLimitStatus>(cacheKey);
    if (cached) {
      // Check if window has expired
      const now = new Date();
      const windowEnd = new Date(cached.windowEnd);
      
      if (now < windowEnd) {
        return cached;
      }
    }

    // Create new status window
    const now = new Date();
    const windowStart = new Date(now.getTime() - (rule.windowMinutes * 60 * 1000));
    const windowEnd = new Date(now.getTime() + (rule.windowMinutes * 60 * 1000));

    const status: RateLimitStatus = {
      ip,
      currentRequests: 0,
      maxRequests: rule.maxRequests,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      isBlocked: false,
      remainingRequests: rule.maxRequests,
      resetTime: windowEnd.toISOString()
    };

    // Update cache
    await this.setCache(cacheKey, status);

    return status;
  }

  /**
   * Record blocked request
   */
  private async recordBlockedRequest(ip: string, routeType: string, rule: RateLimitRule): Promise<void> {
    try {
      // This would record the blocked request in the database
      console.log(`Blocked request from ${ip} for route ${routeType}`);
    } catch (error) {
      console.error('Error recording blocked request:', error);
    }
  }

  // ====================
  // RULE MANAGEMENT
  // ====================

  /**
   * Add a rate limit rule (alias for createRule)
   */
  async addRule(rule: Omit<RateLimitRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<RateLimitRule> {
    return this.createRule(rule);
  }

  /**
   * Create rate limit rule
   */
  async createRule(rule: Omit<RateLimitRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<RateLimitRule> {
    const newRule: RateLimitRule = {
      ...rule,
      id: this.generateRuleId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Store in database
    await this.storeRule(newRule);

    // Update local cache
    this.rateLimitRules.set(newRule.routeType, newRule);
    
    // Clear cache to force refresh
    await this.clearCache('rate-limit-rules');

    return newRule;
  }

  /**
   * Update rate limit rule
   */
  async updateRule(routeType: string, updates: Partial<RateLimitRule>): Promise<RateLimitRule> {
    const existingRule = this.rateLimitRules.get(routeType);
    if (!existingRule) {
      throw new Error('Rate limit rule not found');
    }

    const updatedRule: RateLimitRule = {
      ...existingRule,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // Update in database
    await this.updateRuleInDatabase(updatedRule);

    // Update local cache
    this.rateLimitRules.set(routeType, updatedRule);
    
    // Clear cache to force refresh
    await this.clearCache('rate-limit-rules');

    return updatedRule;
  }

  /**
   * Remove a rate limit rule (alias for deleteRule)
   */
  async removeRule(routeType: string): Promise<void> {
    return this.deleteRule(routeType);
  }

  /**
   * Delete rate limit rule
   */
  async deleteRule(routeType: string): Promise<void> {
    // Delete from database
    await this.deleteRuleFromDatabase(routeType);

    // Remove from local cache
    this.rateLimitRules.delete(routeType);
    
    // Clear cache to force refresh
    await this.clearCache('rate-limit-rules');
  }

  /**
   * Get all rate limit rules
   */
  async getRules(): Promise<RateLimitRule[]> {
    const cacheKey = 'rate-limit-rules';
    
    const cached = await this.getFromCache<RateLimitRule[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const rules = Array.from(this.rateLimitRules.values());
    await this.setCache(cacheKey, rules);
    return rules;
  }

  // ====================
  // IP MANAGEMENT
  // ====================

  /**
   * Block IP address
   */
  async blockIP(
    ip: string,
    durationMinutes: number = 60,
    reason: string = 'Manual block'
  ): Promise<BlockedIP> {
    const blockedIP: BlockedIP = {
      id: this.generateBlockId(),
      ipAddress: ip,
      reason,
      blockedAt: new Date(),
      expiresAt: new Date(Date.now() + durationMinutes * 60 * 1000),
      permanent: false,
      attempts: 1
    };

    // Store in database
    await this.storeBlockedIP(blockedIP);

    // Clear rate limit status for this IP
    await this.clearIPRateLimitStatus(ip);

    return blockedIP;
  }

  /**
   * Unblock IP address
   */
  async unblockIP(ip: string): Promise<void> {
    // Remove from database
    await this.removeBlockedIP(ip);

    // Clear rate limit status for this IP
    await this.clearIPRateLimitStatus(ip);
  }

  /**
   * Get blocked IPs
   */
  async getBlockedIPs(): Promise<BlockedIP[]> {
    // This would query the database for blocked IPs
    return [];
  }

  /**
   * Clear IP rate limit status
   */
  private async clearIPRateLimitStatus(ip: string): Promise<void> {
    // Clear all status entries for this IP
    for (const [key] of this.rateLimitStatus) {
      if (key.startsWith(`${ip}-`)) {
        this.rateLimitStatus.delete(key);
        await this.clearCache(key);
      }
    }
  }

  /**
   * Cleanup expired blocks
   */
  private async cleanupExpiredBlocks(): Promise<void> {
    try {
      const now = new Date();
      const blockedIPs = await this.getBlockedIPs();
      
      for (const blockedIP of blockedIPs) {
        if (!blockedIP.permanent && blockedIP.expiresAt < now) {
          await this.unblockIP(blockedIP.ipAddress);
        }
      }
    } catch (error) {
      console.error('Error cleaning up expired blocks:', error);
    }
  }

  // ====================
  // METRICS AND ANALYTICS
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
      // Calculate metrics from database
      const metrics = await this.calculateMetrics(hours);
      
      await this.setCache(cacheKey, metrics);
      return metrics;
    } catch (error) {
      console.error('Error calculating rate limiting metrics:', error);
      
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
   * Calculate metrics from database
   */
  private async calculateMetrics(hours: number): Promise<RateLimitMetrics> {
    // This would query the database for actual metrics
    return {
      totalRequests: await this.getTotalRequests(hours),
      blockedRequests: await this.getBlockedRequests(hours),
      uniqueIPs: await this.getUniqueIPs(hours),
      topViolators: await this.getTopViolators(hours),
      routeStats: await this.getRouteStats(hours),
      timeRange: `${hours} hours`
    };
  }

  // ====================
  // DATABASE OPERATIONS
  // ====================

  private async storeRule(rule: RateLimitRule): Promise<void> {
    // Store rule in database
    console.log('Storing rate limit rule:', rule.id);
  }

  private async updateRuleInDatabase(rule: RateLimitRule): Promise<void> {
    // Update rule in database
    console.log('Updating rate limit rule:', rule.id);
  }

  private async deleteRuleFromDatabase(routeType: string): Promise<void> {
    // Delete rule from database
    console.log('Deleting rate limit rule:', routeType);
  }

  private async storeBlockedIP(blockedIP: BlockedIP): Promise<void> {
    // Store blocked IP in database
    console.log('Storing blocked IP:', blockedIP.id);
  }

  private async removeBlockedIP(ip: string): Promise<void> {
    // Remove blocked IP from database
    console.log('Removing blocked IP:', ip);
  }

  private async getTotalRequests(hours: number): Promise<number> {
    // Query database for total requests
    return 0;
  }

  private async getBlockedRequests(hours: number): Promise<number> {
    // Query database for blocked requests
    return 0;
  }

  private async getUniqueIPs(hours: number): Promise<number> {
    // Query database for unique IPs
    return 0;
  }

  private async getTopViolators(hours: number): Promise<Array<{ ip: string; violations: number }>> {
    // Query database for top violators
    return [];
  }

  private async getRouteStats(hours: number): Promise<Record<string, { requests: number; blocks: number }>> {
    // Query database for route statistics
    return {};
  }

  // ====================
  // UTILITY METHODS
  // ====================

  private generateRuleId(): string {
    return `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBlockId(): string {
    return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      blockedIPsCount: 0,
      cleanupActive: !!this.cleanupInterval
    };
  }

  // ====================
  // CLEANUP
  // ====================

  /**
   * Cleanup rate limiting resources
   */
  async cleanup(): Promise<void> {
    // Clear intervals
    if (this.configUpdateInterval) {
      clearInterval(this.configUpdateInterval);
      this.configUpdateInterval = null;
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    // Clear cache
    await this.clearCache();
  }
}

// Export singleton instance
export const rateLimitingService = RateLimitingService.getInstance();

export default RateLimitingService;
