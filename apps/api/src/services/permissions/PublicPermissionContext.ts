/**
 * Public Permission Context
 * 
 * Layer 4: Context Permission Layer
 * 
 * Provides public-facing permission checking with:
 * - Read-only permission model
 * - Rate limiting integration
 * - Public data access rules
 * - Security restrictions
 * 
 * Aligned with Platform Singleton Hierarchy:
 * - Extends BasePermissionService (which extends UniversalSingleton)
 * - Follows singleton pattern with getInstance()
 * - Integrates with PublicApiSingleton pattern
 */

import { BasePermissionService, PermissionResult, FeaturePermission, LimitPermission, AccessPermission, PermissionCheckOptions, PermissionCacheEntry } from './BasePermissionService';
import { SingletonCacheOptions } from '../../lib/UniversalSingleton';

// Public features that are always accessible
export interface PublicFeatures {
  browseProducts: boolean;
  viewStorefronts: boolean;
  searchCatalog: boolean;
  viewCategories: boolean;
  viewHours: boolean;
  viewFeatured: boolean;
}

// Public rate limits
export interface PublicRateLimits {
  requestsPerMinute: number;
  requestsPerHour: number;
  requestsPerDay: number;
}

// Public permissions result
export interface PublicPermissions {
  features: Record<string, boolean>;
  rateLimits: PublicRateLimits;
}

// Cache options for public permission context
const PUBLIC_PERMISSION_CACHE_OPTIONS: SingletonCacheOptions = {
  enableCache: true,
  defaultTTL: 60, // 1 minute for public (shorter TTL for security)
  maxCacheSize: 10000,
  enableMetrics: true,
  enableLogging: true,
  enableEncryption: false,
  authenticationLevel: 'public'
};

/**
 * Public Permission Context Service
 * 
 * Singleton service for public-facing permission checking
 */
class PublicPermissionContext extends BasePermissionService {
  private static instance: PublicPermissionContext;

  // Public features that are always accessible
  private publicFeatures: PublicFeatures = {
    browseProducts: true,
    viewStorefronts: true,
    searchCatalog: true,
    viewCategories: true,
    viewHours: true,
    viewFeatured: true
  };

  // Default rate limits for anonymous users
  private defaultRateLimits: PublicRateLimits = {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000
  };

  constructor() {
    super('PublicPermissionContext', PUBLIC_PERMISSION_CACHE_OPTIONS);
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PublicPermissionContext {
    if (!PublicPermissionContext.instance) {
      PublicPermissionContext.instance = new PublicPermissionContext();
    }
    return PublicPermissionContext.instance;
  }

  // ==========================================
  // Abstract Method Implementations
  // ==========================================

  /**
   * Check if a public feature is accessible
   * Note: For public context, clientId is used instead of tenantId
   */
  async hasFeature(clientId: string, feature: string, options?: PermissionCheckOptions): Promise<boolean> {
    const startTime = Date.now();
    
    try {
      // All public features are accessible by default
      const isPublicFeature = this.publicFeatures[feature as keyof PublicFeatures];
      
      if (isPublicFeature) {
        this.logPermissionCheck(clientId, 'public_feature', feature, true, 'default', Date.now() - startTime);
        return true;
      }

      // Non-public features are not accessible
      this.logPermissionCheck(clientId, 'public_feature', feature, false, 'default', Date.now() - startTime);
      return false;
    } catch (error) {
      this.handlePermissionError(clientId, 'public_feature', feature, error);
    }
  }

  /**
   * Get rate limit for public access
   */
  async getLimit(clientId: string, limitType: string, options?: PermissionCheckOptions): Promise<number> {
    const startTime = Date.now();
    
    try {
      // Check cache first
      if (!options?.skipCache) {
        const cached = await this.getCachedPermission(clientId, 'public_limit', limitType);
        if (cached) {
          return (cached as any).limit || this.defaultRateLimits[limitType as keyof PublicRateLimits] || 0;
        }
      }

      // Get rate limit (could be customized per client in the future)
      const limit = this.getRateLimit(limitType);

      // Cache the result
      const cacheEntry: PermissionCacheEntry = {
        granted: limit > 0,
        source: 'default',
        timestamp: Date.now(),
        ttl: this.defaultTTL
      };
      (cacheEntry as any).limit = limit;
      await this.setCachedPermission(clientId, 'public_limit', limitType, cacheEntry);

      return limit;
    } catch (error) {
      this.handlePermissionError(clientId, 'public_limit', limitType, error);
    }
  }

  /**
   * Check if a public resource can be accessed
   */
  async canAccess(clientId: string, resource: string, action: string, options?: PermissionCheckOptions): Promise<boolean> {
    const startTime = Date.now();
    const permissionKey = `${resource}:${action}`;
    
    try {
      // Public access is read-only
      if (action !== 'read') {
        this.logPermissionCheck(clientId, 'public_access', permissionKey, false, 'default', Date.now() - startTime);
        return false;
      }

      // Check if resource is publicly accessible
      const isPublicResource = this.isPublicResource(resource);
      
      // Check rate limit
      const withinRateLimit = await this.checkRateLimit(clientId, resource);

      const canAccess = isPublicResource && withinRateLimit;

      this.logPermissionCheck(clientId, 'public_access', permissionKey, canAccess, 'default', Date.now() - startTime);
      return canAccess;
    } catch (error) {
      this.handlePermissionError(clientId, 'public_access', permissionKey, error);
    }
  }

  /**
   * Get detailed permission result for a public feature
   */
  async getFeaturePermission(clientId: string, feature: string, options?: PermissionCheckOptions): Promise<FeaturePermission> {
    const isPublicFeature = this.publicFeatures[feature as keyof PublicFeatures];

    return {
      feature,
      granted: !!isPublicFeature,
      source: 'default',
      expiresAt: null,
      metadata: options?.includeMetadata ? { type: 'public' } : undefined
    };
  }

  /**
   * Get detailed permission result for a public limit
   */
  async getLimitPermission(clientId: string, limitType: string, options?: PermissionCheckOptions): Promise<LimitPermission> {
    const limit = await this.getLimit(clientId, limitType);

    return {
      limitType,
      limit,
      granted: limit > 0,
      source: 'default',
      expiresAt: null,
      metadata: options?.includeMetadata ? { type: 'public_rate_limit' } : undefined
    };
  }

  // ==========================================
  // Public-Specific Methods
  // ==========================================

  /**
   * Check if a resource is publicly accessible
   */
  private isPublicResource(resource: string): boolean {
    const publicResources = [
      'products',
      'storefronts',
      'catalog',
      'categories',
      'hours',
      'featured',
      'search',
      'directory',
      'recommendations',
      'reviews',
      'ratings'
    ];

    return publicResources.includes(resource);
  }

  /**
   * Get rate limit value
   */
  private getRateLimit(limitType: string): number {
    const limitMapping: Record<string, keyof PublicRateLimits> = {
      'requestsPerMinute': 'requestsPerMinute',
      'requests_per_minute': 'requestsPerMinute',
      'requestsPerHour': 'requestsPerHour',
      'requests_per_hour': 'requestsPerHour',
      'requestsPerDay': 'requestsPerDay',
      'requests_per_day': 'requestsPerDay'
    };

    const limitKey = limitMapping[limitType];
    return this.defaultRateLimits[limitKey] || 0;
  }

  /**
   * Check rate limit for a client
   */
  private async checkRateLimit(clientId: string, resource: string): Promise<boolean> {
    try {
      // Get current request count from cache
      const minuteKey = `rate:${clientId}:minute`;
      const hourKey = `rate:${clientId}:hour`;
      const dayKey = `rate:${clientId}:day`;

      // Check minute limit
      const minuteCount = await this.getCache<number>(minuteKey) || 0;
      if (minuteCount >= this.defaultRateLimits.requestsPerMinute) {
        this.logWarning(`Rate limit exceeded for client ${clientId} (minute)`);
        return false;
      }

      // Check hour limit
      const hourCount = await this.getCache<number>(hourKey) || 0;
      if (hourCount >= this.defaultRateLimits.requestsPerHour) {
        this.logWarning(`Rate limit exceeded for client ${clientId} (hour)`);
        return false;
      }

      // Check day limit
      const dayCount = await this.getCache<number>(dayKey) || 0;
      if (dayCount >= this.defaultRateLimits.requestsPerDay) {
        this.logWarning(`Rate limit exceeded for client ${clientId} (day)`);
        return false;
      }

      // Increment counters
      await this.incrementRateLimitCounters(clientId);

      return true;
    } catch (error) {
      this.logError('Error checking rate limit', error);
      // Allow access on error (fail open for public access)
      return true;
    }
  }

  /**
   * Increment rate limit counters
   */
  private async incrementRateLimitCounters(clientId: string): Promise<void> {
    const minuteKey = `rate:${clientId}:minute`;
    const hourKey = `rate:${clientId}:hour`;
    const dayKey = `rate:${clientId}:day`;

    // Increment minute counter (60 second TTL)
    const minuteCount = await this.getCache<number>(minuteKey) || 0;
    await this.setCache(minuteKey, minuteCount + 1, { ttl: 60 });

    // Increment hour counter (3600 second TTL)
    const hourCount = await this.getCache<number>(hourKey) || 0;
    await this.setCache(hourKey, hourCount + 1, { ttl: 3600 });

    // Increment day counter (86400 second TTL)
    const dayCount = await this.getCache<number>(dayKey) || 0;
    await this.setCache(dayKey, dayCount + 1, { ttl: 86400 });
  }

  /**
   * Get all public features
   */
  async getPublicFeatures(): Promise<Record<string, boolean>> {
    return { ...this.publicFeatures };
  }

  /**
   * Get all public rate limits
   */
  async getPublicRateLimits(): Promise<PublicRateLimits> {
    return { ...this.defaultRateLimits };
  }

  /**
   * Get complete public permissions
   */
  async getPublicPermissions(clientId: string): Promise<PublicPermissions> {
    const [features, rateLimits] = await Promise.all([
      this.getPublicFeatures(),
      this.getPublicRateLimits()
    ]);

    return { features, rateLimits };
  }

  // ==========================================
  // Convenience Methods
  // ==========================================

  /**
   * Check if browsing products is allowed
   */
  async canBrowseProducts(clientId: string): Promise<boolean> {
    return await this.canAccess(clientId, 'products', 'read');
  }

  /**
   * Check if viewing storefronts is allowed
   */
  async canViewStorefronts(clientId: string): Promise<boolean> {
    return await this.canAccess(clientId, 'storefronts', 'read');
  }

  /**
   * Check if searching catalog is allowed
   */
  async canSearchCatalog(clientId: string): Promise<boolean> {
    return await this.canAccess(clientId, 'catalog', 'read');
  }

  /**
   * Check if viewing categories is allowed
   */
  async canViewCategories(clientId: string): Promise<boolean> {
    return await this.canAccess(clientId, 'categories', 'read');
  }

  /**
   * Check if viewing hours is allowed
   */
  async canViewHours(clientId: string): Promise<boolean> {
    return await this.canAccess(clientId, 'hours', 'read');
  }

  /**
   * Check if viewing featured items is allowed
   */
  async canViewFeatured(clientId: string): Promise<boolean> {
    return await this.canAccess(clientId, 'featured', 'read');
  }

  /**
   * Get client identifier from request context
   * Extracts IP, user agent, or session ID for rate limiting
   */
  getClientIdentifier(requestContext: any): string {
    // Use IP address as primary identifier
    if (requestContext.ip) {
      return `ip:${requestContext.ip}`;
    }

    // Fall back to session ID
    if (requestContext.sessionId) {
      return `session:${requestContext.sessionId}`;
    }

    // Fall back to user agent hash
    if (requestContext.userAgent) {
      const hash = this.hashString(requestContext.userAgent);
      return `ua:${hash}`;
    }

    // Anonymous identifier
    return 'anonymous';
  }

  /**
   * Simple string hash for identifiers
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

// Export singleton instance
export const publicPermissionContext = PublicPermissionContext.getInstance();
export default PublicPermissionContext;
