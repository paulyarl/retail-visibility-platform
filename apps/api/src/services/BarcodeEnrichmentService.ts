import { prisma } from '../prisma';
import {
  enrichmentCacheHit,
  enrichmentCacheMiss,
  enrichmentApiSuccess,
  enrichmentApiFail,
  enrichmentDurationMs,
  enrichmentFallback,
} from '../metrics';

// Rate limiting state (in-memory, consider Redis for production)
const rateLimitState = new Map<string, { count: number; resetAt: number }>();

interface EnrichmentResult {
  name?: string;
  description?: string;
  brand?: string;
  categoryPath?: string[];
  priceCents?: number;
  imageUrl?: string;
  imageThumbnailUrl?: string;
  metadata?: Record<string, any>;
  source: 'cache' | 'upc_database' | 'open_food_facts' | 'stub' | 'fallback';
}

interface CacheEntry {
  barcode: string;
  data: EnrichmentResult;
  cachedAt: Date;
  expiresAt: Date;
}

// In-memory cache (consider Redis for production)
const enrichmentCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Rate limits
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 500; // 500 requests per hour per provider

export class BarcodeEnrichmentService {
  /**
   * Main enrichment method with fallback chain
   */
  async enrich(barcode: string, tenantId: string): Promise<EnrichmentResult> {
    const startTime = Date.now();
    
    try {
      // 1. Check in-memory cache first (fastest)
      const memCached = this.getFromCache(barcode);
      if (memCached) {
        enrichmentCacheHit.inc({ tenant: tenantId });
        enrichmentDurationMs.observe(Date.now() - startTime, { tenant: tenantId, source: 'memory_cache' });
        await this.logLookup(tenantId, barcode, 'memory_cache', 'success', memCached, Date.now() - startTime);
        return memCached;
      }

      // 2. Check database cache (persistent, cross-tenant)
      const dbCached = await this.getFromDatabase(barcode);
      if (dbCached) {
        // Save to memory cache for faster subsequent access
        this.saveToCache(barcode, dbCached);
        enrichmentCacheHit.inc({ tenant: tenantId });
        enrichmentDurationMs.observe(Date.now() - startTime, { tenant: tenantId, source: 'database_cache' });
        await this.logLookup(tenantId, barcode, 'database_cache', 'success', dbCached, Date.now() - startTime);
        return dbCached;
      }

      enrichmentCacheMiss.inc({ tenant: tenantId });

      // 3. Try UPC Database API
      if (this.checkRateLimit('upc_database')) {
        try {
          const result = await this.enrichFromUPCDatabase(barcode);
          if (result) {
            await this.saveToDatabase(barcode, result);
            this.saveToCache(barcode, result);
            enrichmentApiSuccess.inc({ tenant: tenantId, provider: 'upc_database' });
            enrichmentDurationMs.observe(Date.now() - startTime, { tenant: tenantId, source: 'upc_database' });
            await this.logLookup(tenantId, barcode, 'upc_database', 'success', result, Date.now() - startTime);
            return result;
          }
        } catch (error) {
          enrichmentApiFail.inc({ tenant: tenantId, provider: 'upc_database' });
          console.warn('[Enrichment] UPC Database failed:', error);
        }
      }

      // 4. Try Open Food Facts API
      if (this.checkRateLimit('open_food_facts')) {
        try {
          const result = await this.enrichFromOpenFoodFacts(barcode);
          if (result) {
            await this.saveToDatabase(barcode, result);
            this.saveToCache(barcode, result);
            enrichmentApiSuccess.inc({ tenant: tenantId, provider: 'open_food_facts' });
            enrichmentDurationMs.observe(Date.now() - startTime, { tenant: tenantId, source: 'open_food_facts' });
            await this.logLookup(tenantId, barcode, 'open_food_facts', 'success', result, Date.now() - startTime);
            return result;
          }
        } catch (error) {
          enrichmentApiFail.inc({ tenant: tenantId, provider: 'open_food_facts' });
          console.warn('[Enrichment] Open Food Facts failed:', error);
        }
      }

      // 5. Fallback to stub data
      const fallback = this.createFallbackData(barcode);
      await this.saveToDatabase(barcode, fallback);
      this.saveToCache(barcode, fallback);
      enrichmentFallback.inc({ tenant: tenantId });
      enrichmentDurationMs.observe(Date.now() - startTime, { tenant: tenantId, source: 'fallback' });
      await this.logLookup(tenantId, barcode, 'fallback', 'success', fallback, Date.now() - startTime);
      return fallback;

    } catch (error: any) {
      console.error('[Enrichment] All providers failed:', error);
      await this.logLookup(tenantId, barcode, 'fallback', 'error', null, Date.now() - startTime, error.message);
      
      // Return minimal fallback
      return this.createFallbackData(barcode);
    }
  }

  /**
   * UPC Database API integration
   * https://upcdatabase.org/api
   */
  private async enrichFromUPCDatabase(barcode: string): Promise<EnrichmentResult | null> {
    const apiKey = process.env.UPC_DATABASE_API_KEY;
    
    if (!apiKey) {
      console.warn('[Enrichment] UPC_DATABASE_API_KEY not configured');
      return null;
    }

    const response = await fetch(`https://api.upcdatabase.org/product/${barcode}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Product not found
      }
      throw new Error(`UPC Database API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.title) {
      return null;
    }

    return {
      name: data.title,
      description: data.description || null,
      brand: data.brand || 'Unknown',
      categoryPath: data.category ? [data.category] : [],
      priceCents: data.msrp ? Math.round(parseFloat(data.msrp) * 100) : undefined,
      metadata: {
        upc: barcode,
        ean: data.ean,
        asin: data.asin,
        model: data.model,
      },
      source: 'upc_database',
    };
  }

  /**
   * Open Food Facts API integration
   * https://world.openfoodfacts.org/api
   */
  private async enrichFromOpenFoodFacts(barcode: string): Promise<EnrichmentResult | null> {
    const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
      headers: {
        'User-Agent': 'RVP-Scanner/1.0',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null; // Product not found
      }
      throw new Error(`Open Food Facts API error: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      return null; // Product not found or incomplete
    }

    const product = data.product;

    return {
      name: product.product_name || product.product_name_en || 'Unknown Product',
      description: product.generic_name || null,
      brand: product.brands || 'Unknown',
      categoryPath: product.categories_tags?.slice(0, 3) || [],
      imageUrl: product.image_url || product.image_front_url || null,
      imageThumbnailUrl: product.image_small_url || product.image_thumb_url || null,
      metadata: {
        barcode: product.code,
        quantity: product.quantity,
        packaging: product.packaging,
        countries: product.countries,
        ingredients: product.ingredients_text_en,
        nutrition_grade: product.nutrition_grade_fr,
        images: {
          front: product.image_front_url,
          ingredients: product.image_ingredients_url,
          nutrition: product.image_nutrition_url,
        },
      },
      source: 'open_food_facts',
    };
  }

  /**
   * Create fallback data when all APIs fail
   */
  private createFallbackData(barcode: string): EnrichmentResult {
    return {
      name: `Product ${barcode}`,
      description: 'Product information not available',
      brand: 'Unknown',
      categoryPath: [],
      metadata: {
        barcode,
        note: 'Please update product information manually',
      },
      source: 'fallback',
    };
  }

  /**
   * Cache management
   */
  private getFromCache(barcode: string): EnrichmentResult | null {
    const entry = enrichmentCache.get(barcode);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (new Date() > entry.expiresAt) {
      enrichmentCache.delete(barcode);
      return null;
    }

    return entry.data;
  }

  private saveToCache(barcode: string, data: EnrichmentResult): void {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CACHE_TTL_MS);

    enrichmentCache.set(barcode, {
      barcode,
      data,
      cachedAt: now,
      expiresAt,
    });

    // Cleanup old entries (simple LRU)
    if (enrichmentCache.size > 10000) {
      const oldestKey = enrichmentCache.keys().next().value;
      if (oldestKey) {
        enrichmentCache.delete(oldestKey);
      }
    }
  }

  /**
   * Database cache management (persistent, cross-tenant)
   */
  private async getFromDatabase(barcode: string): Promise<EnrichmentResult | null> {
    try {
      const cached = await prisma.barcodeEnrichment.findUnique({
        where: { barcode },
      });

      if (!cached) {
        return null;
      }

      // Update fetch count and last fetched timestamp
      await prisma.barcodeEnrichment.update({
        where: { barcode },
        data: {
          fetchCount: { increment: 1 },
          lastFetchedAt: new Date(),
        },
      });

      // Convert database record to EnrichmentResult
      return {
        name: cached.name || undefined,
        brand: cached.brand || undefined,
        description: cached.description || undefined,
        categoryPath: cached.categoryPath || undefined,
        priceCents: cached.priceCents || undefined,
        imageUrl: cached.imageUrl || undefined,
        imageThumbnailUrl: cached.imageThumbnailUrl || undefined,
        metadata: (cached.metadata as Record<string, any>) || undefined,
        source: cached.source as any,
      };
    } catch (error) {
      console.error('[Enrichment] Database cache read error:', error);
      return null;
    }
  }

  private async saveToDatabase(barcode: string, data: EnrichmentResult): Promise<void> {
    try {
      await prisma.barcodeEnrichment.upsert({
        where: { barcode },
        create: {
          barcode,
          name: data.name || null,
          brand: data.brand || null,
          description: data.description || null,
          categoryPath: data.categoryPath || [],
          priceCents: data.priceCents || null,
          imageUrl: data.imageUrl || null,
          imageThumbnailUrl: data.imageThumbnailUrl || null,
          metadata: data.metadata || null,
          source: data.source,
          lastFetchedAt: new Date(),
          fetchCount: 1,
        },
        update: {
          name: data.name || null,
          brand: data.brand || null,
          description: data.description || null,
          categoryPath: data.categoryPath || [],
          priceCents: data.priceCents || null,
          imageUrl: data.imageUrl || null,
          imageThumbnailUrl: data.imageThumbnailUrl || null,
          metadata: data.metadata || null,
          source: data.source,
          lastFetchedAt: new Date(),
          fetchCount: { increment: 1 },
        },
      });
    } catch (error) {
      // Don't fail enrichment if database save fails
      console.error('[Enrichment] Database cache write error:', error);
    }
  }

  /**
   * Rate limiting
   */
  private checkRateLimit(provider: string): boolean {
    const now = Date.now();
    const state = rateLimitState.get(provider);

    if (!state || now > state.resetAt) {
      // Reset or initialize
      rateLimitState.set(provider, {
        count: 1,
        resetAt: now + RATE_LIMIT_WINDOW_MS,
      });
      return true;
    }

    if (state.count >= RATE_LIMIT_MAX_REQUESTS) {
      console.warn(`[Enrichment] Rate limit exceeded for ${provider}`);
      return false;
    }

    state.count++;
    return true;
  }

  /**
   * Log lookup to database
   */
  private async logLookup(
    tenantId: string,
    barcode: string,
    provider: string,
    status: string,
    response: any,
    latencyMs: number,
    error?: string
  ): Promise<void> {
    try {
      await prisma.barcodeLookupLog.create({
        data: {
          tenantId,
          barcode,
          provider: provider || 'unknown',
          status,
          response: response || undefined,
          latencyMs: Math.round(latencyMs),
          error: error || undefined,
        },
      });
    } catch (err) {
      console.error('[Enrichment] Failed to log lookup:', err);
    }
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  clearCache(barcode?: string): void {
    if (barcode) {
      enrichmentCache.delete(barcode);
    } else {
      enrichmentCache.clear();
    }
  }

  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: enrichmentCache.size,
      maxSize: 10000,
      ttlMs: CACHE_TTL_MS,
    };
  }

  /**
   * Get rate limit stats
   */
  getRateLimitStats() {
    const stats: Record<string, any> = {};
    
    for (const [provider, state] of rateLimitState.entries()) {
      stats[provider] = {
        count: state.count,
        remaining: RATE_LIMIT_MAX_REQUESTS - state.count,
        resetAt: new Date(state.resetAt).toISOString(),
      };
    }

    return stats;
  }
}

// Singleton instance
export const barcodeEnrichmentService = new BarcodeEnrichmentService();
