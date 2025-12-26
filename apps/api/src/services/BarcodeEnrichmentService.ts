import { prisma } from '../prisma';
import { generateSessionId } from '../lib/id-generator';
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

interface CacheEntry {
  barcode: string;
  data: EnrichmentResult;
  cachedAt: Date;
  expires_at: Date;
}

// In-memory cache (consider Redis for production)
const enrichmentCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Rate limits
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 500; // 500 requests per hour per provider

export class BarcodeEnrichmentService {
  /**
   * Check if tenant has a category matching the enrichment data
   */
  private async findMatchingTenantCategory(
    tenantId: string,
    categoryPath: string[],
    googleCategoryId?: string
  ) {
    if (!categoryPath || categoryPath.length === 0) return null;

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
      if (byGoogleId) return byGoogleId;
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
    
    return byName;
  }

  /**
   * Enrich with category suggestion for merchant approval
   * This wraps the main enrich method and adds category matching
   */
  async enrichWithCategorySuggestion(barcode: string, tenantId: string): Promise<EnrichmentResult> {
    // Get base enrichment data
    const enrichmentResult = await this.enrich(barcode, tenantId);
    
    // If enrichment has category data, check for tenant category match
    if (enrichmentResult.categoryPath && enrichmentResult.categoryPath.length > 0) {
      const existingCategory = await this.findMatchingTenantCategory(
        tenantId,
        enrichmentResult.categoryPath
      );
      
      // Build category suggestion
      const suggestedName = enrichmentResult.categoryPath[enrichmentResult.categoryPath.length - 1];
      enrichmentResult.categorySuggestion = {
        suggestedName,
        categoryPath: enrichmentResult.categoryPath,
        existingTenantCategory: existingCategory || undefined,
      };
    }
    
    return enrichmentResult;
  }

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

    const data = await response.json() as {
      success: boolean;
      title?: string;
      description?: string;
      brand?: string;
      category?: string;
      msrp?: string;
      images?: string[];
      ean?: string;
      asin?: string;
      isbn?: string;
      mpn?: string;
      model?: string;
      elid?: string;
      weight?: string;
      length?: string;
      width?: string;
      height?: string;
      color?: string;
      size?: string;
      material?: string;
      currency?: string;
      lowest_recorded_price?: string;
      highest_recorded_price?: string;
      offers?: any[];
      features?: string[];
      warranty?: string;
      manufacturer?: string;
    };

    if (!data.success || !data.title) {
      return null;
    }

    return {
      name: data.title || 'Unknown Product',
      description: data.description || undefined,
      brand: data.brand || 'Unknown',
      categoryPath: data.category ? [data.category] : [], 
      priceCents: data.msrp ? Math.round(parseFloat(data.msrp) * 100) : undefined,
      imageUrl: data.images?.[0] || undefined,
      imageThumbnailUrl: data.images?.[0] || undefined,
      metadata: {
        // Identifiers
        upc: barcode,
        ean: data.ean,
        asin: data.asin,
        isbn: data.isbn,
        mpn: data.mpn,
        model: data.model,
        elid: data.elid,
        
        // Product Specifications
        specifications: {
          weight: data.weight,
          length: data.length,
          width: data.width,
          height: data.height,
          color: data.color,
          size: data.size,
          material: data.material,
        },
        
        // Pricing & Retail
        pricing: {
          msrp: data.msrp,
          currency: data.currency,
          lowestRecordedPrice: data.lowest_recorded_price,
          highestRecordedPrice: data.highest_recorded_price,
        },
        
        // Offers from retailers
        offers: data.offers,
        
        // Additional Details
        features: data.features,
        warranty: data.warranty,
        manufacturer: data.manufacturer,
        
        // All Available Images
        images: data.images || [],
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
        'User-Agent': 'VisibleShell-Scanner/1.0',
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

    const data = await response.json() as {
      status: number;
      product?: any;
    };

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
        
        // Ingredients & Composition
        ingredients: product.ingredients_text_en || product.ingredients_text,
        ingredients_tags: product.ingredients_tags,
        
        // Nutrition Facts (Complete)
        nutrition: {
          grade: product.nutrition_grade_fr,
          score: product.nutrition_score_fr,
          per_100g: product.nutriments ? {
            energy_kj: product.nutriments['energy-kj_100g'],
            energy_kcal: product.nutriments['energy-kcal_100g'],
            fat: product.nutriments.fat_100g,
            saturated_fat: product.nutriments['saturated-fat_100g'],
            trans_fat: product.nutriments['trans-fat_100g'],
            carbohydrates: product.nutriments.carbohydrates_100g,
            sugars: product.nutriments.sugars_100g,
            fiber: product.nutriments.fiber_100g,
            proteins: product.nutriments.proteins_100g,
            salt: product.nutriments.salt_100g,
            sodium: product.nutriments.sodium_100g,
            // Vitamins
            vitamin_a: product.nutriments['vitamin-a_100g'],
            vitamin_c: product.nutriments['vitamin-c_100g'],
            vitamin_d: product.nutriments['vitamin-d_100g'],
            // Minerals
            calcium: product.nutriments.calcium_100g,
            iron: product.nutriments.iron_100g,
          } : null,
          servingSize: product.serving_size,
          servingQuantity: product.serving_quantity,
        },
        
        // Allergens & Dietary
        allergens: product.allergens,
        allergens_tags: product.allergens_tags,
        traces: product.traces,
        traces_tags: product.traces_tags,
        additives_tags: product.additives_tags,
        ingredients_analysis: {
          vegan: product.ingredients_analysis_tags?.includes('en:vegan'),
          vegetarian: product.ingredients_analysis_tags?.includes('en:vegetarian'),
          palm_oil_free: product.ingredients_analysis_tags?.includes('en:palm-oil-free'),
        },
        
        // Labels & Certifications
        labels: product.labels,
        labels_tags: product.labels_tags,
        
        // Environmental Data
        environmental: {
          ecoscore_grade: product.ecoscore_grade,
          ecoscore_score: product.ecoscore_score,
          carbon_footprint: product.carbon_footprint_100g,
          packaging_materials: product.packaging_materials_tags,
        },
        
        // Nova Score (Food Processing Level: 1-4)
        nova_group: product.nova_group,
        
        // Store & Purchase Info
        stores: product.stores,
        stores_tags: product.stores_tags,
        purchase_places: product.purchase_places,
        origins: product.origins,
        manufacturing_places: product.manufacturing_places,
        
        // Product Lifecycle
        created_t: product.created_t,
        last_modified_t: product.last_modified_t,
        completeness: product.completeness,
        
        // All Available Images
        images: {
          front: product.image_front_url,
          ingredients: product.image_ingredients_url,
          nutrition: product.image_nutrition_url,
          packaging: product.image_packaging_url,
          other: product.image_other_url,
          small_front: product.image_front_small_url,
          thumb_front: product.image_front_thumb_url,
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
    if (new Date() > entry.expires_at) {
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
      expires_at: expiresAt,
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
      const cached = await prisma.barcode_enrichment.findUnique({
        where: { barcode },
      });

      if (!cached) {
        return null;
      }

      // Update fetch count and last fetched timestamp
      await prisma.barcode_enrichment.update({
        where: { barcode },
        data: {
          fetch_count: { increment: 1 },
          last_fetched_at: new Date(),
        },
      });

      // Convert database record to EnrichmentResult
      return {
        name: cached.name || undefined,
        brand: cached.brand || undefined,
        description: cached.description || undefined,
        categoryPath: cached.category_path || undefined,
        priceCents: cached.price_cents || undefined,
        imageUrl: cached.image_url || undefined,
        imageThumbnailUrl: cached.image_thumbnail_url || undefined,
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
      await prisma.barcode_enrichment.upsert({
        where: { barcode },
        create: {
          id: generateSessionId(), // Generate ID for new records
          barcode,
          name: data.name || null,
          brand: data.brand || null,
          description: data.description || null,
          category_path: data.categoryPath || [],
          price_cents: data.priceCents || null,
          image_url: data.imageUrl || null,
          image_thumbnail_url: data.imageThumbnailUrl || null,
          metadata: data.metadata ? data.metadata : undefined,
          source: data.source,
          last_fetched_at: new Date(),
          fetch_count: 1,
          updated_at: new Date(), // Required field for create
        } as any,
        update: {
          name: data.name || null,
          brand: data.brand || null,
          description: data.description || null,
          category_path: data.categoryPath || [],
          price_cents: data.priceCents || null,
          image_url: data.imageUrl || null,
          image_thumbnail_url: data.imageThumbnailUrl || null,
          metadata: data.metadata ? data.metadata : undefined,
          source: data.source,
          last_fetched_at: new Date(),
          fetch_count: { increment: 1 },
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
      await prisma.barcode_lookup_log.create({
        data: {
          id: generateSessionId(tenantId), // Generate ID for new records
          tenant_id: tenantId, // Correct field name
          barcode,
          provider: provider || 'unknown',
          status,
          response: response || undefined,
          latency_ms: Math.round(latencyMs), // Correct field name
          error: error || undefined,
        } as any,
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
    
    Array.from(rateLimitState.entries()).forEach(([provider, state]) => {
      stats[provider] = {
        count: state.count,
        remaining: RATE_LIMIT_MAX_REQUESTS - state.count,
        resetAt: new Date(state.resetAt).toISOString(),
      };
    });

    return stats;
  }
}

// Singleton instance
export const barcodeEnrichmentService = new BarcodeEnrichmentService();
