/**
 * Rate Limiting Service - API Server Singleton
 * 
 * Handles rate limiting rules, enforcement, and IP management
 * Extends UniversalSingleton for consistent caching and metrics
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { prisma } from '../prisma';
import { logger } from '../logger';

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
  private lastEnabledCheck: number = 0;
  private cachedEnabledStatus: boolean | null = null;
  private logThrottle: Map<string, number> = new Map();

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
   * Uses same priority logic: Environment Variable > Database > Default OFF
   */
  private async loadRateLimitRules(): Promise<void> {
    try {
      // Check if rate limiting is globally enabled using priority logic
      const isGloballyEnabled = await this.isRateLimitingEnabled();

      if (!isGloballyEnabled) {
        // Rate limiting disabled globally - clear all rules
        this.rateLimitRules.clear();
        await this.setCache('rate-limit-rules', []);
        this.throttledLog('Rate limiting disabled - cleared all rules', 'rules-cleared');
        return;
      }

      // Load rate limit configurations from database
      const dbConfigs = await prisma.rate_limit_configurations.findMany({
        where: { enabled: true },
        orderBy: { route_type: 'asc' }
      });

      // Convert database configs to service rules
      const rules: RateLimitRule[] = dbConfigs.map(config => ({
        id: config.id,
        routeType: config.route_type,
        maxRequests: config.max_requests,
        windowMinutes: config.window_minutes,
        enabled: config.enabled,
        priority: 1, // Default priority since DB doesn't have this field
        exemptPaths: [], // Default empty array since DB doesn't have this field
        strictPaths: [], // Default empty array since DB doesn't have this field
        createdAt: (config.created_at || new Date()).toISOString(),
        updatedAt: (config.updated_at || new Date()).toISOString()
      }));

      // Add default rule if no rules found
      if (rules.length === 0) {
        const defaultRule: RateLimitRule = {
          id: 'default',
          routeType: 'standard',
          maxRequests: parseInt(process.env.RATE_LIMIT_STANDARD_MAX || '100'),
          windowMinutes: parseInt(process.env.RATE_LIMIT_STANDARD_WINDOW || '15'),
          enabled: true,
          priority: 1,
          exemptPaths: ['/health', '/api/public/stores', '/api/items'],
          strictPaths: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        rules.push(defaultRule);
        this.throttledLog('Using default rate limit rule (no database rules found)', 'default-rule');
      }

      // Update rules cache
      this.rateLimitRules.clear();
      rules.forEach(rule => {
        this.rateLimitRules.set(rule.routeType, rule);
      });

      // Cache rules with TTL
      await this.setCache('rate-limit-rules', rules, { ttl: 5 * 60 * 1000 }); // 5 minutes
      
      this.throttledLog(`Loaded ${rules.length} rate limit rules from database`, 'rules-loaded');
    } catch (error) {
      logger.error('[RateLimitingService] Error loading rate limit rules:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      
      // Fallback to environment variables only if environment forces rate limiting on
      if (process.env.RATE_LIMITING_ENABLED === 'true') {
        const fallbackRule: RateLimitRule = {
          id: 'fallback',
          routeType: 'standard',
          maxRequests: parseInt(process.env.RATE_LIMIT_STANDARD_MAX || '100'),
          windowMinutes: parseInt(process.env.RATE_LIMIT_STANDARD_WINDOW || '15'),
          enabled: true,
          priority: 1,
          exemptPaths: ['/health'],
          strictPaths: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        this.rateLimitRules.set('standard', fallbackRule);
        await this.setCache('rate-limit-rules', [fallbackRule], { ttl: 5 * 60 * 1000 });
        this.throttledLog('Using fallback rule (environment override enabled)', 'fallback-rule');
      } else {
        // Clear rules if rate limiting is disabled
        this.rateLimitRules.clear();
        await this.setCache('rate-limit-rules', []);
        this.throttledLog('Rate limiting disabled - no rules loaded', 'disabled-no-rules');
      }
    }
  }

  // ====================
  // RATE LIMITING ENFORCEMENT
  // ====================

  /**
   * Throttled logging to reduce performance impact
   */
  private throttledLog(message: string, throttleKey: string = 'default', throttleMs: number = 5000): void {
    // Completely skip logging if performance mode is enabled
    if (process.env.RATE_LIMIT_PERFORMANCE_MODE === 'true') {
      return;
    }
    
    const now = Date.now();
    const lastLog = this.logThrottle.get(throttleKey) || 0;
    
    if (now - lastLog > throttleMs) {
      console.log(`[RateLimitingService] ${message}`);
      this.logThrottle.set(throttleKey, now);
    }
  }

  /**
   * Check if rate limiting is globally enabled
   * Priority: Environment Variable > Database > Default OFF
   * Optimized for performance with caching and reduced logging
   */
  async isRateLimitingEnabled(): Promise<boolean> {
    // Cache the enabled status for 30 seconds to reduce database queries
    const now = Date.now();
    if (this.cachedEnabledStatus !== null && (now - this.lastEnabledCheck) < 30000) {
      return this.cachedEnabledStatus;
    }

    try {
      // 1. Environment Variable takes highest priority
      if (process.env.RATE_LIMITING_ENABLED === 'true') {
        this.throttledLog('Rate limiting ENABLED via environment variable (overrides database)', 'env-enabled');
        this.cachedEnabledStatus = true;
        this.lastEnabledCheck = now;
        return true;
      }
      
      if (process.env.RATE_LIMITING_ENABLED === 'false') {
//        this.throttledLog('Rate limiting DISABLED via environment variable (overrides database)', 'env-disabled');
        this.cachedEnabledStatus = false;
        this.lastEnabledCheck = now;
        return false;
      }

      // 2. Database takes second priority (only if env var not set)
      const platformSettings = await prisma.platform_settings_list.findFirst({
        where: { id: 1 },
        select: { rate_limiting_enabled: true }
      });

      if (platformSettings?.rate_limiting_enabled === true) {
        this.throttledLog('Rate limiting ENABLED via database setting', 'db-enabled');
        this.cachedEnabledStatus = true;
        this.lastEnabledCheck = now;
        return true;
      }
      
      if (platformSettings?.rate_limiting_enabled === false) {
//        this.throttledLog('Rate limiting DISABLED via database setting', 'db-disabled');
        this.cachedEnabledStatus = false;
        this.lastEnabledCheck = now;
        return false;
      }

      // 3. Default to OFF if neither env var nor database is set
//      this.throttledLog('Rate limiting DISABLED (no environment variable or database setting found)', 'default-off');
      this.cachedEnabledStatus = false;
      this.lastEnabledCheck = now;
      return false;
      
    } catch (error) {
      logger.error('[RateLimitingService] Error checking rate limiting status:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      
      // On error, check environment variable first, then default to OFF
      if (process.env.RATE_LIMITING_ENABLED === 'true') {
        this.throttledLog('Rate limiting ENABLED via environment variable (database error fallback)', 'env-fallback');
        this.cachedEnabledStatus = true;
        this.lastEnabledCheck = now;
        return true;
      }
      
//      this.throttledLog('Rate limiting DISABLED (database error, no environment override)', 'error-fallback');
      this.cachedEnabledStatus = false;
      this.lastEnabledCheck = now;
      return false;
    }
  }

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
      logger.error('Error recording blocked request:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
      logger.error('Error cleaning up expired blocks:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
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
      logger.error('Error calculating rate limiting metrics:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      
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

/**
 * Rate limiting middleware using RateLimitingService
 * This replaces the basicRateLimit and aligns with platform standards
 */
export async function createRateLimitingMiddleware(routeType: string = 'standard') {
  return async (req: any, res: any, next: any) => {
    try {
      // Check if rate limiting is globally enabled
      const isEnabled = await rateLimitingService.isRateLimitingEnabled();
      if (!isEnabled) {
        return next(); // Rate limiting disabled globally
      }

      // Get client IP
      const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
      const path = req.path || req.url || '/';

      // Check rate limit
      const result = await rateLimitingService.checkRateLimit(ip, routeType, path);
      
      if (!result.allowed) {
        console.warn(`[RATE LIMIT] Blocked ${ip} - exceeded limit for ${routeType} on ${path}`);
        
        // Store rate limit warning for analytics
        try {
          await prisma.rate_limit_warnings.create({
            data: {
              client_id: `${ip}:${req.get('User-Agent')?.substring(0, 50) || 'unknown'}`,
              pathname: path,
              request_count: result.status?.currentRequests || 0,
              max_requests: result.rule?.maxRequests || 100,
              window_ms: (result.rule?.windowMinutes || 15) * 60,
              ip_address: ip,
              user_agent: req.get('User-Agent'),
              blocked: true
            }
          });
        } catch (warningError) {
          logger.error('Failed to store rate limit warning:', undefined, { error: { name: (warningError as any)?.name || 'Error', message: (warningError as any)?.message || String(warningError), stack: (warningError as any)?.stack } });
        }

        return res.status(429).json({
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Please try again after ${result.rule?.windowMinutes || 15} minutes.`,
          retryAfter: (result.rule?.windowMinutes || 15) * 60,
          rule: {
            maxRequests: result.rule?.maxRequests,
            windowMinutes: result.rule?.windowMinutes,
            resetTime: result.status?.resetTime
          }
        });
      }

      // Add rate limit headers
      if (result.status) {
        res.set({
          'X-RateLimit-Limit': result.status.maxRequests.toString(),
          'X-RateLimit-Remaining': result.status.remainingRequests.toString(),
          'X-RateLimit-Reset': new Date(result.status.resetTime).getTime().toString()
        });
      }

      next();
    } catch (error) {
      logger.error('[RateLimitingService] Middleware error:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      next(); // Allow request on error
    }
  };
}

export default RateLimitingService;
