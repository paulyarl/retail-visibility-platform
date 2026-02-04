/**
 * Universal Identifier Cache Service
 * 
 * Provides encrypted, high-performance tenant identifier resolution
 * with military-grade security and singleton pattern.
 */

import crypto from 'crypto';
import { prisma } from '../prisma';
import { CacheEncryption } from '../security/CacheEncryption';

export interface ResolvedTenant {
  id: string;
  slug: string | null;
  name: string;
  subscriptionStatus: string;
  metadata: any;
  type: 'tenant_id' | 'slug' | 'auto_id';
}

interface EncryptedCacheEntry {
  data: Buffer;           // Encrypted tenant data
  timestamp: number;      // When cached
  ttl: number;           // Time to live in ms
  accessCount: number;   // Access frequency
  lastAccessed: number;  // Last access time
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  avgResponseTime: number;
  encryptedEntries: number;
  totalMemoryUsage: number;
  lastReset: number;
}

/**
 * Universal Identifier Cache with Encryption
 * Extends UniversalSingleton pattern for global consistency
 */
export class UniversalIdentifierCache {
  private static instance: UniversalIdentifierCache;
  private encryptedCache: Map<string, EncryptedCacheEntry> = new Map();
  private readonly cacheEncryption: CacheEncryption;
  private metrics: CacheMetrics;
  private operationQueue: Map<string, Promise<any>> = new Map(); // Prevent concurrent operations on same key
  private readonly defaultTTL = 15 * 60 * 1000; // 15 minutes

  private constructor() {
    // Initialize encryption service
    const keyMaterial = process.env.IDENTIFIER_CACHE_KEY || 'default-cache-key-change-in-production';
    this.cacheEncryption = new CacheEncryption(keyMaterial);
    
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      avgResponseTime: 0,
      encryptedEntries: 0,
      totalMemoryUsage: 0,
      lastReset: Date.now()
    };

    console.log('[UniversalIdentifierCache] Initialized with encrypted cache');
    this.startCacheMaintenance();
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
      // Wait for the existing operation to complete
      await existingOperation;
    }

    // Create a new operation and add it to the queue
    const operationPromise = operation().finally(() => {
      // Remove from queue when done
      this.operationQueue.delete(key);
    });

    this.operationQueue.set(key, operationPromise);
    return operationPromise;
  }

  /**
   * Resolve identifier with encrypted cache lookup and synchronized database operations
   */
  async resolveIdentifier(identifier: string): Promise<ResolvedTenant | null> {
    const startTime = Date.now();

    try {
      // Try encrypted cache first with synchronization
      const cached = await this.synchronizeOperation(identifier, () => this.getFromEncryptedCache(identifier));
      if (cached && !this.isExpired(cached)) {
        this.metrics.hits++;
        this.updateAccessMetrics(identifier, cached);

        const responseTime = Date.now() - startTime;
        this.updateResponseTime(responseTime);

        // cached.data is now the decrypted ResolvedTenant
        const resolvedTenant = cached.data as unknown as ResolvedTenant;
        console.log(`[Cache HIT] ${identifier} -> ${resolvedTenant.id} (${responseTime}ms)`);
        return resolvedTenant;
      }

      // Cache miss - resolve from database with synchronization
      this.metrics.misses++;
      const resolvedTenant = await this.synchronizeOperation(identifier, () => this.resolveFromDatabaseAndCache(identifier));

      const responseTime = Date.now() - startTime;
      this.updateResponseTime(responseTime);

      if (resolvedTenant) {
        console.log(`[Cache MISS->SET] ${identifier} -> ${resolvedTenant.id} (${responseTime}ms)`);
      } else {
        console.log(`[Cache MISS] ${identifier} -> NOT FOUND (${responseTime}ms)`);
      }

      return resolvedTenant;
    } catch (error) {
      console.error(`[Cache ERROR] ${identifier}:`, error);
      this.metrics.misses++;
      return null;
    }
  }

  /**
   * Resolve from database and cache the result with synchronization
   */
  private async resolveFromDatabaseAndCache(identifier: string): Promise<ResolvedTenant | null> {
    // Check cache again in case another operation already set it
    const existing = await this.getFromEncryptedCache(identifier);
    if (existing && !this.isExpired(existing)) {
      return existing.data as unknown as ResolvedTenant;
    }

    // Resolve from database
    const resolvedTenant = await this.resolveFromDatabase(identifier);
    if (resolvedTenant) {
      // Cache the result (this will also be synchronized)
      await this.setEncryptedCache(identifier, resolvedTenant);
    }

    return resolvedTenant;
  }

  /**
   * Get from encrypted cache
   */
  private async getFromEncryptedCache(identifier: string): Promise<EncryptedCacheEntry | null> {
    const entry = this.encryptedCache.get(identifier);
    if (!entry) return null;

    try {
      // Decrypt the data
      const decrypted = await this.decrypt(entry.data);
      return { ...entry, data: decrypted };
    } catch (error) {
      console.error(`[Cache DECRYPT ERROR] ${identifier}:`, error);
      // Remove corrupted entry
      this.encryptedCache.delete(identifier);
      return null;
    }
  }

  /**
   * Set encrypted cache entry with synchronization
   */
  private async setEncryptedCache(identifier: string, tenant: ResolvedTenant): Promise<void> {
    return this.synchronizeOperation(identifier, async () => {
      try {
        const encrypted = await this.encrypt(tenant);

        const entry: EncryptedCacheEntry = {
          data: encrypted,
          timestamp: Date.now(),
          ttl: this.defaultTTL,
          accessCount: 0,
          lastAccessed: Date.now()
        };

        this.encryptedCache.set(identifier, entry);
        this.updateMemoryMetrics();

      } catch (error) {
        console.error(`[Cache ENCRYPT ERROR] ${identifier}:`, error);
      }
    });
  }

  /**
   * Resolve identifier from database
   */
  private async resolveFromDatabase(identifier: string): Promise<ResolvedTenant | null> {
    console.log(`[Cache DB LOOKUP] ${identifier}`);
    
    try {
      // Try tenant_id first
      let tenant = await prisma.tenants.findFirst({
        where: { id: identifier },
        select: {
          id: true,
          slug: true,
          name: true,
          subscription_status: true,
          metadata: true
        }
      });

      if (tenant) {
        return {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          subscriptionStatus: tenant.subscription_status || 'unknown',
          metadata: tenant.metadata,
          type: 'tenant_id'
        };
      }

      // Try slug
      tenant = await prisma.tenants.findFirst({
        where: { slug: identifier },
        select: {
          id: true,
          slug: true,
          name: true,
          subscription_status: true,
          metadata: true
        }
      });

      if (tenant) {
        return {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          subscriptionStatus: tenant.subscription_status || 'unknown',
          metadata: tenant.metadata,
          type: 'slug'
        };
      }

      // Try auto_id from metadata
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
          metadata: true
        }
      });

      if (tenantsWithAutoId.length > 0) {
        const tenant = tenantsWithAutoId[0];
        return {
          id: tenant.id,
          slug: tenant.slug,
          name: tenant.name,
          subscriptionStatus: tenant.subscription_status || 'unknown',
          metadata: tenant.metadata,
          type: 'auto_id'
        };
      }

      return null;
    } catch (error) {
      console.error(`[Cache DB ERROR] ${identifier}:`, error);
      return null;
    }
  }

  /**
   * Encrypt data using CacheEncryption service
   */
  private async encrypt(data: any): Promise<Buffer> {
    try {
      const result = this.cacheEncryption.encrypt(data);
      return result.encrypted;
    } catch (error) {
      console.error('[Cache ENCRYPT ERROR]:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Cache encryption failed');
    }
  }

  /**
   * Decrypt data using CacheEncryption service
   */
  private async decrypt(encryptedData: Buffer): Promise<any> {
    try {
      // Handle legacy data or invalid data
      if (!Buffer.isBuffer(encryptedData)) {
        console.log('[Cache] Invalid encrypted data format, clearing cache entry');
        throw new Error('Invalid encrypted data format');
      }
      
      const result = this.cacheEncryption.decrypt(encryptedData);
      return result.data;
    } catch (error) {
      console.error('[Cache DECRYPT ERROR]:', error instanceof Error ? error.message : 'Unknown error');
      throw new Error('Cache decryption failed');
    }
  }

  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: EncryptedCacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Update access metrics for cache entry
   */
  private updateAccessMetrics(identifier: string, entry: EncryptedCacheEntry): void {
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    // Update the entry in cache
    this.encryptedCache.set(identifier, entry);
  }

  /**
   * Update response time metrics
   */
  private updateResponseTime(responseTime: number): void {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
    this.metrics.hitRate = this.metrics.hits / totalRequests;
  }

  /**
   * Update memory usage metrics
   */
  private updateMemoryMetrics(): void {
    this.metrics.encryptedEntries = this.encryptedCache.size;
    
    let totalSize = 0;
    for (const entry of this.encryptedCache.values()) {
      totalSize += entry.data.length + 64; // Data + overhead
    }
    this.metrics.totalMemoryUsage = totalSize;
  }

  /**
   * Invalidate tenant from cache (all identifiers) with synchronization
   */
  async invalidateTenant(tenantId: string): Promise<void> {
    // Get all identifiers that need to be invalidated
    const identifiersToCheck: string[] = [];
    for (const identifier of this.encryptedCache.keys()) {
      identifiersToCheck.push(identifier);
    }

    // Process each identifier with synchronization
    const invalidationPromises = identifiersToCheck.map(identifier =>
      this.synchronizeOperation(identifier, async () => {
        try {
          const entry = this.encryptedCache.get(identifier);
          if (!entry) return;

          const decrypted = await this.decrypt(entry.data);
          if (decrypted.id === tenantId) {
            this.encryptedCache.delete(identifier);
          }
        } catch (error) {
          // Remove corrupted entries
          this.encryptedCache.delete(identifier);
        }
      })
    );

    await Promise.all(invalidationPromises);

    console.log(`[Cache INVALIDATE] Removed entries for tenant ${tenantId}`);
    this.updateMemoryMetrics();
  }

  /**
   * Warm cache with tenant data
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
          metadata: true
        }
      });

      await Promise.all(tenants.map(async (tenant) => {
        const resolvedTenant: ResolvedTenant = {
          id: tenant.id,
          slug: tenant.slug || '',
          name: tenant.name,
          subscriptionStatus: tenant.subscription_status || '',
          metadata: tenant.metadata,
          type: 'tenant_id'
        };

        await this.setEncryptedCache(tenant.id, resolvedTenant);
        
        if (tenant.slug) {
          const slugTenant = { ...resolvedTenant, type: 'slug' as const };
          await this.setEncryptedCache(tenant.slug, slugTenant);
        }

        // Check for autoId in metadata
        const metadata = tenant.metadata as any || {};
        const autoId = metadata.autoId;
        if (autoId) {
          const autoIdTenant = { ...resolvedTenant, type: 'auto_id' as const };
          await this.setEncryptedCache(autoId, autoIdTenant);
        }
      }));

      console.log(`[Cache WARM] Completed warm-up for ${tenants.length} tenants`);
    } catch (error) {
      console.error(`[Cache WARM ERROR]:`, error);
    }
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics {
    this.updateMemoryMetrics();
    return { ...this.metrics };
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.encryptedCache.clear();
    this.metrics = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      avgResponseTime: 0,
      encryptedEntries: 0,
      totalMemoryUsage: 0,
      lastReset: Date.now()
    };
    console.log('[Cache CLEAR] All entries cleared');
  }

  /**
   * Start cache maintenance (cleanup expired entries)
   */
  private startCacheMaintenance(): void {
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const expiredEntries: string[] = [];
    
    for (const [identifier, entry] of this.encryptedCache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        expiredEntries.push(identifier);
      }
    }
    
    if (expiredEntries.length > 0) {
      expiredEntries.forEach(identifier => {
        this.encryptedCache.delete(identifier);
      });
      
      console.log(`[Cache CLEANUP] Removed ${expiredEntries.length} expired entries`);
      this.updateMemoryMetrics();
    }
  }
}
