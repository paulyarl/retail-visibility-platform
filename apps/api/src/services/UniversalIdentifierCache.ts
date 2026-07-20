/**
 * Universal Identifier Cache Service
 * 
 * Provides encrypted, high-performance tenant identifier resolution
 * using UniversalSingleton's built-in encryption and caching.
 */

import { prisma } from '../prisma';
import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { getLocationStatusInfo, LocationStatusInfo } from '../utils/location-status';
import { logger } from '../logger';

export interface ResolvedTenant {
  id: string;
  slug: string | null;
  name: string;
  subscriptionStatus: string;
  subscriptionTier?: string | null;
  trialEndsAt?: string | null;
  locationStatus?: string | null;
  statusInfo?: LocationStatusInfo;
  metadata: any;
  type: 'tenant_id' | 'slug' | 'auto_id';
}

/**
 * Universal Identifier Cache extending UniversalSingleton
 * Leverages built-in encryption and caching capabilities
 */
export class UniversalIdentifierCache extends UniversalSingleton {
  private static instance: UniversalIdentifierCache;
  private operationQueue: Map<string, Promise<any>> = new Map(); // Prevent concurrent operations on same key

  private constructor() {
    const options: SingletonCacheOptions = {
      enableCache: true,
      defaultTTL: 900, // 15 minutes in seconds
      maxCacheSize: 1000,
      enableMetrics: true,
      enableLogging: true,
      enableEncryption: true, // Use built-in encryption
      enablePrivateCache: false,
      authenticationLevel: 'public'
    };
    
    super('universal-identifier-cache', options);
    console.log('[UniversalIdentifierCache] Initialized with UniversalSingleton encryption');
  }

  static getInstance(): UniversalIdentifierCache {
    if (!UniversalIdentifierCache.instance) {
      UniversalIdentifierCache.instance = new UniversalIdentifierCache();
    }
    return UniversalIdentifierCache.instance;
  }

  /**
   * Synchronize cache operations to prevent corruption under concurrent load
   */
  private async synchronizeOperation<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // Check if there's already an operation running for this key
    const existingOperation = this.operationQueue.get(key);
    if (existingOperation) {
      console.log(`[Cache SYNC] Waiting for existing operation for key: ${key}`);
      // Wait for the existing operation to complete and return its result
      try {
        return await existingOperation;
      } catch (error) {
        logger.error(`[Cache SYNC] Existing operation failed for key: ${key}`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
        // If existing operation fails, remove it and try again
        this.operationQueue.delete(key);
        // Continue to create new operation
      }
    }

    console.log(`[Cache SYNC] Starting new operation for key: ${key}`);
    
    // Create a new operation and add it to the queue
    const operationPromise = operation();
    
    // Store the promise in the queue
    this.operationQueue.set(key, operationPromise);
    
    try {
      const result = await operationPromise;
      console.log(`[Cache SYNC] Operation completed for key: ${key}`);
      return result;
    } finally {
      // Always remove from queue when done, regardless of success/failure
      this.operationQueue.delete(key);
    }
  }

  /**
   * Resolve identifier using UniversalSingleton's built-in caching and encryption
   */
  async resolveIdentifier(identifier: string): Promise<ResolvedTenant | null> {
    const startTime = Date.now();
    //console.log(`[Cache RESOLVE] Starting resolve for: ${identifier}`);

    try {
      // Use UniversalSingleton's built-in caching with synchronization
      //console.log(`[Cache RESOLVE] Checking cache for: ${identifier}`);
      
      const resolvedTenant = await this.synchronizeOperation(identifier, async () => {
        // First try to get from UniversalSingleton cache
        const cached = await this.getCache<ResolvedTenant>(`identifier:${identifier}`);
        if (cached) {
          //console.log(`[Cache HIT] ${identifier} -> ${cached.id}`);
          this.metrics.cacheHits++;
          return cached;
        }

        // Cache miss - resolve from database
        //console.log(`[Cache MISS] Resolving from database for: ${identifier}`);
        this.metrics.cacheMisses++;
        
        const dbResult = await this.resolveFromDatabase(identifier);
        
        if (dbResult) {
          // Cache the result using UniversalSingleton's encryption
          await this.setCache(`identifier:${identifier}`, dbResult);
          //console.log(`[Cache SET] ${identifier} -> ${dbResult.id}`);
        }
        
        return dbResult;
      });

      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);

     /*  if (resolvedTenant) {
        console.log(`[Cache RESOLVE] ${identifier} -> ${resolvedTenant.id} (${responseTime}ms)`);
      } else {
        console.log(`[Cache RESOLVE] ${identifier} -> NOT FOUND (${responseTime}ms)`);
      }
 */
      return resolvedTenant;
    } catch (error) {
      logger.error(`[Cache ERROR] ${identifier}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return null;
    }
  }

  /**
   * Resolve identifier from database
   */
  private async resolveFromDatabase(identifier: string): Promise<ResolvedTenant | null> {
    //console.log(`[Cache DB LOOKUP] ${identifier}`);

    try {
      // Try tenant_id first
      //console.log(`[Cache DB LOOKUP] Trying tenant_id lookup for: ${identifier}`);
      const tenantIdStart = Date.now();
      let tenant = await prisma.tenants.findFirst({
        where: { id: identifier },
        select: {
          id: true,
          slug: true,
          name: true,
          subscription_status: true,
          subscription_tier: true,
          trial_ends_at: true,
          location_status: true,
          metadata: true
        }
      });
      const tenantIdTime = Date.now() - tenantIdStart;
      //console.log(`[Cache DB LOOKUP] Tenant ID lookup completed in ${tenantIdTime}ms`);

      if (tenant) {
        //console.log(`[Cache DB LOOKUP] Found by tenant_id: ${identifier} -> ${tenant.id}`);
        return {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          subscriptionStatus: tenant.subscription_status || 'unknown',
          subscriptionTier: tenant.subscription_tier,
          trialEndsAt: tenant.trial_ends_at?.toISOString() || null,
          locationStatus: tenant.location_status,
          statusInfo: tenant.location_status ? getLocationStatusInfo(tenant.location_status as any) : undefined,
          metadata: tenant.metadata,
          type: 'tenant_id'
        };
      }

      // Try slug
      //console.log(`[Cache DB LOOKUP] Trying slug lookup for: ${identifier}`);
      const slugStart = Date.now();
      tenant = await prisma.tenants.findFirst({
        where: { slug: identifier },
        select: {
          id: true,
          slug: true,
          name: true,
          subscription_status: true,
          subscription_tier: true,
          trial_ends_at: true,
          location_status: true,
          metadata: true
        }
      });
      const slugTime = Date.now() - slugStart;
      //console.log(`[Cache DB LOOKUP] Slug lookup completed in ${slugTime}ms`);

      if (tenant) {
        //console.log(`[Cache DB LOOKUP] Found by slug: ${identifier} -> ${tenant.id}`);
        return {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          subscriptionStatus: tenant.subscription_status || 'unknown',
          subscriptionTier: tenant.subscription_tier,
          trialEndsAt: tenant.trial_ends_at?.toISOString() || null,
          locationStatus: tenant.location_status,
          statusInfo: tenant.location_status ? getLocationStatusInfo(tenant.location_status as any) : undefined,
          metadata: tenant.metadata,
          type: 'slug'
        };
      }

      // Try auto_id from metadata
      console.log(`[Cache DB LOOKUP] Trying auto_id lookup for: ${identifier}`);
      const autoIdStart = Date.now();
      const tenantsWithAutoId = await prisma.tenants.findMany({
        where: {
          metadata: {
            path: ['autoId'],
            equals: identifier
          }
        },
        select: {
          id: true,
          slug: true,
          name: true,
          subscription_status: true,
          subscription_tier: true,
          trial_ends_at: true,
          location_status: true,
          metadata: true
        }
      });
      const autoIdTime = Date.now() - autoIdStart;
      console.log(`[Cache DB LOOKUP] Auto ID lookup completed in ${autoIdTime}ms`);

      if (tenantsWithAutoId.length > 0) {
        const tenant = tenantsWithAutoId[0];
        console.log(`[Cache DB LOOKUP] Found by auto_id: ${identifier} -> ${tenant.id}`);
        return {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          subscriptionStatus: tenant.subscription_status || 'unknown',
          subscriptionTier: tenant.subscription_tier,
          trialEndsAt: tenant.trial_ends_at?.toISOString() || null,
          locationStatus: tenant.location_status,
          statusInfo: tenant.location_status ? getLocationStatusInfo(tenant.location_status as any) : undefined,
          metadata: tenant.metadata,
          type: 'auto_id'
        };
      }

      console.log(`[Cache DB LOOKUP] Not found: ${identifier}`);
      return null;
    } catch (error) {
      logger.error(`[Cache DB ERROR] ${identifier}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
      return null;
    }
  }

  /**
   * Update response time metrics (using UniversalSingleton's built-in metrics)
   */
  private updateResponseTime(responseTime: number): void {
    // UniversalSingleton handles its own metrics, we just log for debugging
    console.log(`[Cache METRICS] Response time: ${responseTime}ms`);
  }

  /**
   * Get cache metrics (using UniversalSingleton's built-in metrics)
   */
  getMetrics() {
    return super.getMetrics(); // Use UniversalSingleton's built-in metrics
  }

  /**
   * Warm cache with multiple tenants
   */
  async warmCache(tenantIds: string[]): Promise<void> {
    console.log(`[Cache WARM] Starting warm-up for ${tenantIds.length} tenants`);
    
    try {
      const tenants = await prisma.tenants.findMany({
        where: { id: { in: tenantIds } },
        select: {
          id: true,
          slug: true,
          name: true,
          subscription_status: true,
          metadata: true,
          auto_id: true
        }
      });

      await Promise.all(tenants.map(async (tenant) => {
        const resolvedTenant: ResolvedTenant = {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          subscriptionStatus: tenant.subscription_status || 'unknown',
          metadata: tenant.metadata,
          type: 'tenant_id'
        };

        await this.setCache(`identifier:${tenant.id}`, resolvedTenant);
        
        if (tenant.slug) {
          const slugTenant = { ...resolvedTenant, type: 'slug' as const };
          await this.setCache(`identifier:${tenant.slug}`, slugTenant);
        }

        // Use auto_id column (deterministic 4-char hash stored on tenant record)
        const autoId = tenant.auto_id;
        if (autoId) {
          const autoIdTenant = { ...resolvedTenant, type: 'auto_id' as const };
          await this.setCache(`identifier:${autoId}`, autoIdTenant);
        }
      }));

      console.log(`[Cache WARM] Completed warm-up for ${tenants.length} tenants`);
    } catch (error) {
      logger.error(`[Cache WARM ERROR]:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    }
  }

  /**
   * Clear all cache (public method for cache monitoring)
   */
  public async clearAllCache(): Promise<void> {
    await this.clearCache(); // Use UniversalSingleton's protected clearCache method
    console.log('[Cache CLEAR] All entries cleared via public method');
  }

  /**
   * Invalidate tenant from cache
   */
  async invalidateTenant(tenantId: string): Promise<void> {
    // Get all identifiers that need to be invalidated
    const cacheKeys = [`identifier:${tenantId}`];
    
    // Also invalidate by slug if we can find it
    try {
      const tenant = await prisma.tenants.findUnique({
        where: { id: tenantId },
        select: { slug: true }
      });
      
      if (tenant?.slug) {
        cacheKeys.push(`identifier:${tenant.slug}`);
      }
    } catch (error) {
      logger.error('[Cache] Error finding tenant slug for invalidation:', undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } });
    }

    // Invalidate all related cache entries
    const invalidationPromises = cacheKeys.map(key =>
      this.clearCache(key).catch(error => 
        logger.error(`[Cache] Error invalidating ${key}:`, undefined, { error: { name: (error as any)?.name || 'Error', message: (error as any)?.message || String(error), stack: (error as any)?.stack } })
      )
    );

    await Promise.all(invalidationPromises);
    console.log(`[Cache] Invalidated ${cacheKeys.length} cache entries for tenant: ${tenantId}`);
  }
}
