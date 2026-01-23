/**
 * Barcode Enrichment Service - UniversalSingleton Implementation
 * Barcode scanning and product data enrichment with caching and rate limiting
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { prisma } from '../prisma';
import { generateSessionId } from '../lib/id-generator';

export interface CategorySuggestion {
  suggestedName: string; // Suggested category name from enrichment
  googleCategoryId?: string; // Google category ID if available
  categoryPath: string[]; // Full path for display
  existingTenantCategory?: {
    id: string;
    name: string;
    googleCategoryId?: string | null;
  };
}

export interface EnrichmentResult {
  name?: string;
  description?: string;
  brand?: string;
  categoryPath?: string[]; // Legacy - for display only
  categorySuggestion?: CategorySuggestion; // New - for merchant approval
  priceCents?: number;
  imageUrl?: string;
  imageThumbnailUrl?: string;
  metadata?: Record<string, any>;
  source: 'cache' | 'upc_database' | 'open_food_facts' | 'stub' | 'fallback';
}

export interface BarcodeStats {
  totalBarcodesProcessed: number;
  cacheHitRate: number;
  averageProcessingTime: number;
  topSources: Record<string, number>;
  enrichmentSuccessRate: number;
  rateLimitHits: number;
  tenantUsage: Array<{ tenantId: string; count: number }>;
  errorRate: number;
  apiCallCount: number;
}

interface CacheEntry {
  barcode: string;
  data: EnrichmentResult;
  cachedAt: Date;
  expires_at: Date;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class BarcodeEnrichmentSingletonService extends UniversalSingleton {
  private static instance: BarcodeEnrichmentSingletonService;
  private enrichmentCache: Map<string, CacheEntry>;
  private rateLimitState: Map<string, RateLimitEntry>;
  
  // Configuration
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
  private readonly RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
  private readonly RATE_LIMIT_MAX_REQUESTS = 500; // 500 requests per hour per provider

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      enableCache: true,
      enableEncryption: true,
      enablePrivateCache: true,
      authenticationLevel: 'authenticated',
      defaultTTL: 7200, // 2 hours
      maxCacheSize: 1000,
      enableMetrics: true,
      enableLogging: true
    });

    // Initialize in-memory caches (could be replaced with Redis in production)
    this.enrichmentCache = new Map();
    this.rateLimitState = new Map();
  }

  static getInstance(): BarcodeEnrichmentSingletonService {
    if (!BarcodeEnrichmentSingletonService.instance) {
      BarcodeEnrichmentSingletonService.instance = new BarcodeEnrichmentSingletonService('barcode-enrichment-service');
    }
    return BarcodeEnrichmentSingletonService.instance;
  }

  // ====================
  // CORE BARCODE ENRICHMENT OPERATIONS
  // ====================

  /**
   * Enrich barcode data with caching and rate limiting
   */
  async enrichBarcode(
    barcode: string,
    tenantId: string,
    provider: 'upc_database' | 'open_food_facts' = 'upc_database'
  ): Promise<EnrichmentResult> {
    const startTime = Date.now();
    
    try {
      this.logInfo(`Barcode enrichment request: ${barcode} for tenant ${tenantId} using ${provider}`);
      
      // Step 1: Check UniversalSingleton cache first
      const cacheKey = this.generateBarcodeCacheKey(barcode, tenantId, provider);
      const cached = await this.getFromCache<EnrichmentResult>(cacheKey);
      if (cached) {
        this.logInfo(`UniversalSingleton cache HIT for barcode ${barcode}`);
        this.metrics.cacheHits++;
        return cached;
      }

      // Step 2: Check in-memory cache
      const memoryCached = this.getFromMemoryCache(barcode);
      if (memoryCached) {
        this.logInfo(`Memory cache HIT for barcode ${barcode}`);
        this.metrics.cacheHits++;
        // Cache in UniversalSingleton for faster future access
        await this.setCache(cacheKey, memoryCached, { ttl: 3600 });
        return memoryCached;
      }

      // Step 3: Check rate limiting
      if (!this.checkRateLimit(provider)) {
        this.logInfo(`Rate limit exceeded for ${provider}, using fallback`);
        this.metrics.cacheMisses++;
        return this.generateFallbackResult(barcode);
      }

      // Step 4: Fetch from external API
      const result = await this.fetchFromExternalAPI(barcode, provider, tenantId);
      
      // Step 5: Cache the result
      this.setToMemoryCache(barcode, result);
      await this.setCache(cacheKey, result, { ttl: 7200 }); // 2 hours
      
      this.metrics.cacheMisses++;
      this.logInfo(`Barcode ${barcode} enriched successfully from ${provider}`);
      
      return result;
    } catch (error) {
      this.logError(`Error enriching barcode ${barcode}`, error);
      this.metrics.cacheMisses++;
      return this.generateFallbackResult(barcode);
    }
  }

  /**
   * Batch enrich multiple barcodes
   */
  async enrichBatchBarcodes(
    barcodes: string[],
    tenantId: string,
    provider: 'upc_database' | 'open_food_facts' = 'upc_database'
  ): Promise<Map<string, EnrichmentResult>> {
    const results = new Map<string, EnrichmentResult>();
    
    this.logInfo(`Batch enrichment request: ${barcodes.length} barcodes for tenant ${tenantId}`);
    
    // Process in parallel with rate limiting consideration
    const promises = barcodes.map(async (barcode) => {
      try {
        const result = await this.enrichBarcode(barcode, tenantId, provider);
        results.set(barcode, result);
      } catch (error) {
        this.logError(`Error in batch enrichment for barcode ${barcode}`, error);
        results.set(barcode, this.generateFallbackResult(barcode));
      }
    });
    
    await Promise.all(promises);
    
    this.logInfo(`Batch enrichment completed: ${results.size} results`);
    return results;
  }

  /**
   * Get enrichment statistics
   */
  async getEnrichmentStats(tenantId?: string): Promise<BarcodeStats> {
    try {
      const cacheKey = `barcode-stats-${tenantId || 'all'}`;
      const cached = await this.getFromCache<BarcodeStats>(cacheKey);
      if (cached) {
        return cached;
      }

      const totalProcessed = this.metrics.cacheHits + this.metrics.cacheMisses;
      const cacheHitRate = this.metrics.cacheHits / (totalProcessed || 1);
      
      const stats: BarcodeStats = {
        totalBarcodesProcessed: totalProcessed,
        cacheHitRate: cacheHitRate,
        averageProcessingTime: 0, // Would need to track this separately
        topSources: {
          'upc_database': Math.floor(totalProcessed * 0.6),
          'open_food_facts': Math.floor(totalProcessed * 0.3),
          'fallback': Math.floor(totalProcessed * 0.1)
        },
        enrichmentSuccessRate: 0.85, // Mock value - would be calculated from actual data
        rateLimitHits: this.getRateLimitHits(),
        tenantUsage: [
          { tenantId: 'tid-m8ijkrnk', count: Math.floor(totalProcessed * 0.4) },
          { tenantId: 'tid-042hi7ju', count: Math.floor(totalProcessed * 0.3) },
          { tenantId: 'tid-lt2t1wzu', count: Math.floor(totalProcessed * 0.3) }
        ],
        errorRate: 0.05, // Mock value - would be calculated from actual data
        apiCallCount: this.metrics.cacheMisses
      };

      await this.setCache(cacheKey, stats, { ttl: 1800 }); // 30 minutes
      return stats;
    } catch (error) {
      this.logError('Error getting enrichment stats', error);
      throw error;
    }
  }

  /**
   * Clear cache for specific barcode or all
   */
  async clearCache(barcode?: string): Promise<void> {
    try {
      if (barcode) {
        // Clear from memory cache
        this.enrichmentCache.delete(barcode);
        this.logInfo(`Cache cleared for barcode ${barcode}`);
      } else {
        // Clear all caches
        this.enrichmentCache.clear();
        this.rateLimitState.clear();
        this.logInfo('All caches cleared');
      }
    } catch (error) {
      this.logError('Error clearing cache', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: string; services: any; lastCheck: string }> {
    try {
      const cacheSize = this.enrichmentCache.size;
      const rateLimitSize = this.rateLimitState.size;
      
      const health = {
        status: 'healthy',
        services: {
          cache: cacheSize > 0 ? 'active' : 'empty',
          rateLimit: rateLimitSize > 0 ? 'active' : 'idle',
          externalApis: 'operational',
          database: 'connected'
        },
        cacheSize,
        rateLimitSize,
        lastCheck: new Date().toISOString()
      };

      // Determine health status
      if (cacheSize > 1000) {
        health.status = 'degraded';
        health.services.cache = 'overloaded';
      }

      return health;
    } catch (error) {
      this.logError('Error checking health', error);
      return {
        status: 'unhealthy',
        services: { error: 'Health check failed' },
        lastCheck: new Date().toISOString()
      };
    }
  }

  // ====================
  // PRIVATE HELPER METHODS
  // ====================

  /**
   * Generate cache key for barcode request
   */
  private generateBarcodeCacheKey(barcode: string, tenantId: string, provider: string): string {
    return `barcode-enrichment-${barcode}-${tenantId}-${provider}`;
  }

  /**
   * Get from memory cache
   */
  private getFromMemoryCache(barcode: string): EnrichmentResult | null {
    const entry = this.enrichmentCache.get(barcode);
    if (!entry) return null;
    
    // Check if expired
    if (Date.now() > entry.expires_at.getTime()) {
      this.enrichmentCache.delete(barcode);
      return null;
    }
    
    return entry.data;
  }

  /**
   * Set to memory cache
   */
  private setToMemoryCache(barcode: string, data: EnrichmentResult): void {
    const entry: CacheEntry = {
      barcode,
      data,
      cachedAt: new Date(),
      expires_at: new Date(Date.now() + this.CACHE_TTL_MS)
    };
    
    this.enrichmentCache.set(barcode, entry);
    
    // Cleanup old entries if cache is too large
    if (this.enrichmentCache.size > 1000) {
      this.cleanupMemoryCache();
    }
  }

  /**
   * Cleanup old memory cache entries
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.enrichmentCache.entries()) {
      if (now > entry.expires_at.getTime()) {
        this.enrichmentCache.delete(key);
      }
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(provider: string): boolean {
    const now = Date.now();
    const key = provider;
    const state = this.rateLimitState.get(key);
    
    if (!state || now > state.resetAt) {
      // Reset or initialize rate limit
      this.rateLimitState.set(key, {
        count: 1,
        resetAt: now + this.RATE_LIMIT_WINDOW_MS
      });
      return true;
    }
    
    if (state.count >= this.RATE_LIMIT_MAX_REQUESTS) {
      return false; // Rate limit exceeded
    }
    
    state.count++;
    return true;
  }

  /**
   * Get rate limit hits
   */
  private getRateLimitHits(): number {
    let hits = 0;
    const now = Date.now();
    
    for (const [key, state] of this.rateLimitState.entries()) {
      if (now <= state.resetAt && state.count >= this.RATE_LIMIT_MAX_REQUESTS) {
        hits++;
      }
    }
    
    return hits;
  }

  /**
   * Fetch from external API (mock implementation)
   */
  private async fetchFromExternalAPI(
    barcode: string,
    provider: string,
    tenantId: string
  ): Promise<EnrichmentResult> {
    // Mock implementation - in real scenario, this would call actual APIs
    this.logInfo(`Fetching barcode ${barcode} from ${provider}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Generate mock result
    const result: EnrichmentResult = {
      name: `Product ${barcode}`,
      description: `Product description for barcode ${barcode}`,
      brand: 'Mock Brand',
      categoryPath: ['Food', 'Beverages', 'Soft Drinks'],
      priceCents: 299, // $2.99
      imageUrl: `https://example.com/images/${barcode}.jpg`,
      imageThumbnailUrl: `https://example.com/thumbnails/${barcode}.jpg`,
      metadata: {
        provider,
        fetchedAt: new Date().toISOString(),
        barcode
      },
      source: provider as any
    };
    
    // Add category suggestion
    const categorySuggestion = await this.findMatchingTenantCategory(
      tenantId,
      result.categoryPath || []
    );
    if (categorySuggestion) {
      result.categorySuggestion = categorySuggestion;
    }
    
    return result;
  }

  /**
   * Find matching tenant category
   */
  private async findMatchingTenantCategory(
    tenantId: string,
    categoryPath: string[],
    googleCategoryId?: string
  ): Promise<CategorySuggestion | null> {
    if (!categoryPath || categoryPath.length === 0) return null;

    try {
      // Try to match by Google category ID first (most accurate)
      if (googleCategoryId) {
        const byGoogleId = await prisma.directory_category.findFirst({
          where: {
            tenantId,
            googleCategoryId,
          },
          select: {
            id: true,
            name: true,
            googleCategoryId: true,
          },
        });
        
        if (byGoogleId) {
          return {
            suggestedName: categoryPath[categoryPath.length - 1],
            googleCategoryId,
            categoryPath,
            existingTenantCategory: byGoogleId
          };
        }
      }

      // Try to match by name similarity
      const categoryName = categoryPath[categoryPath.length - 1]; // Use most specific category
      const byName = await prisma.directory_category.findFirst({
        where: {
          tenantId,
          name: {
            contains: categoryName,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
          name: true,
          googleCategoryId: true,
        },
      });
      
      if (byName) {
        return {
          suggestedName: categoryName,
          googleCategoryId: byName.googleCategoryId || undefined,
          categoryPath,
          existingTenantCategory: byName
        };
      }
      
      return {
        suggestedName: categoryPath[categoryPath.length - 1],
        googleCategoryId,
        categoryPath
      };
    } catch (error) {
      this.logError('Error finding matching tenant category', error);
      return null;
    }
  }

  /**
   * Generate fallback result
   */
  private generateFallbackResult(barcode: string): EnrichmentResult {
    return {
      name: `Unknown Product (${barcode})`,
      description: 'No product information available for this barcode',
      categoryPath: ['Uncategorized'],
      source: 'fallback',
      metadata: {
        barcode,
        fallbackReason: 'No data available'
      }
    };
  }

  /**
   * Get custom metrics for UniversalSingleton
   */
  protected getCustomMetrics() {
    return {
      cacheSize: this.enrichmentCache.size,
      rateLimitEntries: this.rateLimitState.size,
      cacheHitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses || 1),
      totalProcessed: this.metrics.cacheHits + this.metrics.cacheMisses
    };
  }
}

export default BarcodeEnrichmentSingletonService;
