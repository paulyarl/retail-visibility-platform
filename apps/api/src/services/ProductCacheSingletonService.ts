/**
 * Product Cache Service - UniversalSingleton Implementation
 * Intelligent caching system for AI-generated products with performance optimization
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { prisma } from '../prisma';
import { generateItemId } from '../lib/id-generator';
import { aiProviderService } from './AIProviderService';

export interface CachedProduct {
  id: string;
  businessType: string;
  categoryName: string;
  googleCategoryId: string | null;
  productName: string;
  priceCents: number;
  brand: string | null;
  description: string | null;
  skuPattern: string | null;
  // Image data
  imageUrl: string | null;
  thumbnailUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  imageBytes: number | null;
  // Enhanced content
  enhancedDescription: string | null;
  features: any | null;
  specifications: any | null;
  // Metadata
  generationSource: string;
  hasImage: boolean;
  imageQuality: string | null;
  usageCount: number;
  qualityScore: number;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface ProductRequest {
  businessType: string;
  categoryName: string;
  googleCategoryId?: string;
  count: number;
  requireImages?: boolean; // Only return products with images
  textModel?: 'openai' | 'google'; // AI model for text generation
  tenantId?: string; // For tenant-specific caching
}

export interface GeneratedProduct {
  name: string;
  price: number; // in cents
  brand?: string;
  description?: string;
  sku?: string;
  // Image data
  imageUrl?: string;
  thumbnailUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageBytes?: number;
  // Enhanced content
  enhancedDescription?: string;
  features?: string[];
  specifications?: Record<string, string>;
}

export interface ProductCacheStats {
  totalCachedProducts: number;
  cacheHitRate: number;
  averageQualityScore: number;
  totalUsageCount: number;
  generationRequests: number;
  cacheHits: number;
  cacheMisses: number;
  aiGenerationCosts: number;
  topBusinessTypes: Array<{ type: string; count: number }>;
  topCategories: Array<{ category: string; count: number }>;
  imageGenerationRate: number;
}

class ProductCacheSingletonService extends UniversalSingleton {
  private static instance: ProductCacheSingletonService;

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      enableCache: true,
      enableEncryption: true,
      enablePrivateCache: true,
      authenticationLevel: 'public',
      defaultTTL: 7200, // 2 hours
      maxCacheSize: 1000,
      enableMetrics: true,
      enableLogging: true
    });
  }

  static getInstance(): ProductCacheSingletonService {
    if (!ProductCacheSingletonService.instance) {
      ProductCacheSingletonService.instance = new ProductCacheSingletonService('product-cache-service');
    }
    return ProductCacheSingletonService.instance;
  }

  // ====================
  // CORE PRODUCT CACHE OPERATIONS
  // ====================

  /**
   * Get products for a scenario, using cache or AI generation
   */
  async getProductsForScenario(request: ProductRequest): Promise<GeneratedProduct[]> {
    const startTime = Date.now();
    const { businessType, categoryName, googleCategoryId, count, requireImages = false, textModel, tenantId } = request;
    
    this.logInfo(`Product cache request: ${count} products for ${businessType} > ${categoryName}${requireImages ? ' (with images)' : ''}${textModel ? ` [${textModel}]` : ''}`);
    
    try {
      // Generate cache key
      const cacheKey = this.generateProductCacheKey(request);
      
      // Step 1: Check UniversalSingleton cache first
      const cached = await this.getFromCache<GeneratedProduct[]>(cacheKey);
      if (cached && cached.length >= count) {
        this.logInfo(`UniversalSingleton cache HIT: Found ${cached.length} cached products`);
        this.metrics.cacheHits++;
        this.metrics.apiCalls++;
        return cached.slice(0, count);
      }
      
      // Step 2: Check database cache
      const dbCachedProducts = await this.getCachedProducts(businessType, categoryName, count, requireImages, tenantId);
      
      if (dbCachedProducts.length >= count) {
        this.logInfo(`Database cache HIT: Found ${dbCachedProducts.length} cached products`);
        
        // Update usage stats
        await this.incrementUsageCount(dbCachedProducts.map(p => p.id));
        
        // Convert to GeneratedProduct format and cache in UniversalSingleton
        const generatedProducts = dbCachedProducts.slice(0, count).map(p => this.convertToGeneratedProduct(p));
        
        // Cache in UniversalSingleton for faster future access
        await this.setCache(cacheKey, generatedProducts, { ttl: 3600 }); // 1 hour
        
        this.metrics.cacheHits++;
        this.metrics.apiCalls++;
        return generatedProducts;
      }
      
      // Step 3: Generate missing products with AI
      this.logInfo(`Cache MISS: Generating ${count - dbCachedProducts.length} new products with AI`);
      
      const neededCount = count - dbCachedProducts.length;
      const aiGeneratedProducts = await this.generateProductsWithAI({
        businessType,
        categoryName,
        googleCategoryId,
        count: neededCount,
        requireImages,
        textModel,
        tenantId
      });
      
      // Step 4: Save new products to database cache
      await this.saveGeneratedProducts(aiGeneratedProducts, businessType, categoryName, tenantId);
      
      // Step 5: Combine cached and generated products
      const allProducts = [
        ...dbCachedProducts.map(p => this.convertToGeneratedProduct(p)),
        ...aiGeneratedProducts
      ];
      
      // Step 6: Cache in UniversalSingleton
      await this.setCache(cacheKey, allProducts, { ttl: 3600 }); // 1 hour
      
      this.metrics.cacheMisses++;
      this.metrics.apiCalls++;
      return allProducts.slice(0, count);
      
    } catch (error) {
      this.metrics.cacheMisses++;
      this.metrics.errors++;
      this.logError('Error getting products for scenario', error);
      throw error;
    }
  }

  /**
   * Get cached products from database
   */
  private async getCachedProducts(
    businessType: string, 
    categoryName: string, 
    count: number, 
    requireImages: boolean = false,
    tenantId?: string
  ): Promise<CachedProduct[]> {
    try {
      const where: any = {
        business_type: businessType,
        category_name: categoryName,
        quality_score: { gte: 0.7 } // Only get high-quality products
      };
      
      if (requireImages) {
        where.has_image = true;
        where.image_url = { not: null };
      }
      
      // Note: tenantId field doesn't exist in this table, so we'll skip it for now
      
      const products = await prisma.quick_start_product_cache.findMany({
        where,
        orderBy: [
          { quality_score: 'desc' },
          { usage_count: 'desc' },
          { created_at: 'desc' }
        ],
        take: count
      });
      
      return products.map(p => this.mapPrismaProduct(p));
    } catch (error) {
      this.logError('Error getting cached products', error);
      return [];
    }
  }

  /**
   * Generate products using AI
   */
  private async generateProductsWithAI(request: ProductRequest): Promise<GeneratedProduct[]> {
    const { businessType, categoryName, googleCategoryId, count, requireImages, textModel, tenantId } = request;
    
    try {
      // Use AIProviderService for generation
      const aiRequest = {
        businessType,
        categoryName,
        googleCategoryId,
        count,
        requireImages,
        textModel: textModel || 'openai',
        tenantId
      };
      
      const generatedProducts = await aiProviderService.generateProducts(
        businessType,
        categoryName,
        count,
        textModel as 'openai' | 'google'
      );
      
      this.logInfo(`AI generated ${generatedProducts.length} products for ${businessType} > ${categoryName}`);
      
      return generatedProducts;
    } catch (error) {
      this.logError('Error generating products with AI', error);
      throw error;
    }
  }

  /**
   * Save generated products to database cache
   */
  private async saveGeneratedProducts(
    products: GeneratedProduct[], 
    businessType: string, 
    categoryName: string,
    tenantId?: string
  ): Promise<void> {
    try {
      const cacheData = products.map(product => ({
        id: generateItemId(),
        business_type: businessType,
        category_name: categoryName,
        google_category_id: null, // Could be enhanced to store this
        product_name: product.name,
        price_cents: product.price,
        brand: product.brand || null,
        description: product.description || null,
        sku_pattern: product.sku || null,
        // Image data
        image_url: product.imageUrl || null,
        thumbnail_url: product.thumbnailUrl || null,
        image_width: product.imageWidth || null,
        image_height: product.imageHeight || null,
        image_bytes: product.imageBytes || null,
        // Enhanced content
        enhanced_description: product.enhancedDescription || null,
        features: product.features ? product.features as any : null,
        specifications: product.specifications ? product.specifications as any : null,
        // Metadata
        generation_source: 'ai_generated',
        has_image: !!product.imageUrl,
        image_quality: product.imageWidth ? 'high' : null,
        usage_count: 0,
        quality_score: this.calculateQualityScore(product),
        created_at: new Date(),
        last_used_at: new Date()
      }));
      
      await prisma.quick_start_product_cache.createMany({
        data: cacheData
      });
      
      this.logInfo(`Saved ${products.length} generated products to cache`);
    } catch (error) {
      this.logError('Error saving generated products', error);
      throw error;
    }
  }

  /**
   * Increment usage count for cached products
   */
  private async incrementUsageCount(productIds: string[]): Promise<void> {
    try {
      await prisma.quick_start_product_cache.updateMany({
        where: { id: { in: productIds } },
        data: {
          usage_count: { increment: 1 },
          last_used_at: new Date()
        }
      });
    } catch (error) {
      this.logError('Error incrementing usage count', error);
    }
  }

  // ====================
  // CACHE MANAGEMENT
  // ====================

  /**
   * Clear cache for specific criteria or all
   */
  async clearCache(businessType?: string, categoryName?: string, tenantId?: string): Promise<void> {
    try {
      const where: any = {};
      
      if (businessType) where.business_type = businessType;
      if (categoryName) where.category_name = categoryName;
      // Note: tenantId field doesn't exist in this table
      
      const result = await prisma.quick_start_product_cache.deleteMany({ where });
      
      // Also clear UniversalSingleton cache
      const pattern = `product-cache-${businessType || '*'}-${categoryName || '*'}-${tenantId || '*'}`;
      // Note: clearCachePattern would need to be implemented in UniversalSingleton
      this.logInfo(`Cache pattern to clear: ${pattern}`);
      
      this.logInfo(`Cleared ${result.count} cached products`);
    } catch (error) {
      this.logError('Error clearing cache', error);
      throw error;
    }
  }

  /**
   * Cleanup low-quality or unused products
   */
  async cleanupCache(options: {
    minQualityScore?: number;
    maxAge?: number; // days
    minUsageCount?: number;
  } = {}): Promise<{ deleted: number; total: number }> {
    try {
      const { minQualityScore = 0.5, maxAge = 90, minUsageCount = 1 } = options;
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - maxAge);
      
      const where: any = {
        OR: [
          { quality_score: { lt: minQualityScore } },
          { usage_count: { lt: minUsageCount } },
          { created_at: { lt: cutoffDate } }
        ]
      };
      
      const total = await prisma.quick_start_product_cache.count({ where });
      const result = await prisma.quick_start_product_cache.deleteMany({ where });
      
      this.logInfo(`Cache cleanup: deleted ${result.count} of ${total} products`);
      
      return { deleted: result.count, total };
    } catch (error) {
      this.logError('Error during cache cleanup', error);
      throw error;
    }
  }

  // ====================
  // ANALYTICS AND METRICS
  // ====================

  /**
   * Get comprehensive cache statistics
   */
  async getCacheStats(tenantId?: string): Promise<ProductCacheStats> {
    try {
      const cacheKey = `product-cache-stats-${tenantId || 'all'}`;
      const cached = await this.getFromCache<ProductCacheStats>(cacheKey);
      if (cached) {
        return cached;
      }

      const where = {}; // tenantId field doesn't exist in this table
      
      const [
        totalProducts,
        avgQuality,
        totalUsage,
        topBusinessTypes,
        topCategories,
        imageStats
      ] = await Promise.all([
        prisma.quick_start_product_cache.count({ where }),
        prisma.quick_start_product_cache.aggregate({ where, _avg: { quality_score: true } }),
        prisma.quick_start_product_cache.aggregate({ where, _sum: { usage_count: true } }),
        prisma.quick_start_product_cache.groupBy({
          by: ['business_type'],
          where,
          _count: { business_type: true },
          orderBy: { _count: { business_type: 'desc' } },
          take: 5
        }),
        prisma.quick_start_product_cache.groupBy({
          by: ['category_name'],
          where,
          _count: { category_name: true },
          orderBy: { _count: { category_name: 'desc' } },
          take: 5
        }),
        prisma.quick_start_product_cache.aggregate({
          where,
          _count: { id: true },
          _avg: { quality_score: true },
          _sum: { usage_count: true }
        }),
        prisma.quick_start_product_cache.aggregate({
          where: { ...where, has_image: true },
          _count: { id: true }
        })
      ]);

      const stats: ProductCacheStats = {
        totalCachedProducts: totalProducts,
        cacheHitRate: this.metrics.cacheHits / (this.metrics.apiCalls || 1),
        averageQualityScore: avgQuality._avg.quality_score || 0,
        totalUsageCount: totalUsage._sum.usage_count || 0,
        generationRequests: this.metrics.apiCalls,
        cacheHits: this.metrics.cacheHits,
        cacheMisses: this.metrics.cacheMisses,
        aiGenerationCosts: this.estimateAIGenerationCosts(),
        topBusinessTypes: topBusinessTypes.map(item => ({
          type: item.business_type,
          count: item._count.business_type
        })),
        topCategories: topCategories.map(item => ({
          category: item.category_name,
          count: item._count.category_name
        })),
        imageGenerationRate: imageStats._count.id / totalProducts
      };

      await this.setCache(cacheKey, stats, { ttl: 1800 }); // 30 minutes cache
      return stats;
    } catch (error) {
      this.logError('Error getting cache stats', error);
      throw error;
    }
  }

  /**
   * Get product recommendations based on usage and quality
   */
  async getTopProducts(limit: number = 20, tenantId?: string): Promise<CachedProduct[]> {
    try {
      const where = {}; // tenantId field doesn't exist in this table
      
      const products = await prisma.quick_start_product_cache.findMany({
        where,
        orderBy: [
          { quality_score: 'desc' },
          { usage_count: 'desc' }
        ],
        take: limit
      });
      
      return products.map(p => this.mapPrismaProduct(p));
    } catch (error) {
      this.logError('Error getting top products', error);
      return [];
    }
  }

  // ====================
  // HELPER METHODS
  // ====================

  /**
   * Generate cache key for product request
   */
  private generateProductCacheKey(request: ProductRequest): string {
    const keyData = {
      businessType: request.businessType,
      categoryName: request.categoryName,
      googleCategoryId: request.googleCategoryId,
      count: request.count,
      requireImages: request.requireImages,
      textModel: request.textModel,
      tenantId: request.tenantId
    };
    return `product-cache-${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  /**
   * Convert cached product to generated product format
   */
  private convertToGeneratedProduct(cached: CachedProduct): GeneratedProduct {
    return {
      name: cached.productName,
      price: cached.priceCents,
      brand: cached.brand || undefined,
      description: cached.description || undefined,
      sku: cached.skuPattern || undefined,
      imageUrl: cached.imageUrl || undefined,
      thumbnailUrl: cached.thumbnailUrl || undefined,
      imageWidth: cached.imageWidth || undefined,
      imageHeight: cached.imageHeight || undefined,
      imageBytes: cached.imageBytes || undefined,
      enhancedDescription: cached.enhancedDescription || undefined,
      features: cached.features || undefined,
      specifications: cached.specifications || undefined
    };
  }

  /**
   * Map Prisma product to CachedProduct interface
   */
  private mapPrismaProduct(prismaProduct: any): CachedProduct {
    return {
      id: prismaProduct.id,
      businessType: prismaProduct.business_type,
      categoryName: prismaProduct.category_name,
      googleCategoryId: prismaProduct.google_category_id,
      productName: prismaProduct.product_name,
      priceCents: prismaProduct.price_cents,
      brand: prismaProduct.brand,
      description: prismaProduct.description,
      skuPattern: prismaProduct.sku_pattern,
      imageUrl: prismaProduct.image_url,
      thumbnailUrl: prismaProduct.thumbnail_url,
      imageWidth: prismaProduct.image_width,
      imageHeight: prismaProduct.image_height,
      imageBytes: prismaProduct.image_bytes,
      enhancedDescription: prismaProduct.enhanced_description,
      features: prismaProduct.features,
      specifications: prismaProduct.specifications,
      generationSource: prismaProduct.generation_source,
      hasImage: prismaProduct.has_image,
      imageQuality: prismaProduct.image_quality,
      usageCount: prismaProduct.usage_count,
      qualityScore: prismaProduct.quality_score,
      createdAt: prismaProduct.created_at,
      lastUsedAt: prismaProduct.last_used_at
    };
  }

  /**
   * Calculate quality score for generated product
   */
  private calculateQualityScore(product: GeneratedProduct): number {
    let score = 0.5; // Base score
    
    // Name quality
    if (product.name && product.name.length > 5) score += 0.1;
    if (product.name && product.name.length > 10) score += 0.1;
    
    // Description quality
    if (product.description && product.description.length > 20) score += 0.1;
    if (product.description && product.description.length > 50) score += 0.1;
    
    // Brand presence
    if (product.brand) score += 0.05;
    
    // Image presence
    if (product.imageUrl) score += 0.15;
    
    // Enhanced content
    if (product.enhancedDescription) score += 0.05;
    if (product.features && product.features.length > 0) score += 0.05;
    if (product.specifications && Object.keys(product.specifications).length > 0) score += 0.05;
    
    return Math.min(score, 1.0);
  }

  /**
   * Estimate AI generation costs
   */
  private estimateAIGenerationCosts(): number {
    // Rough estimates based on typical AI API costs
    const textGenerationCost = this.metrics.cacheMisses * 0.002; // ~$0.002 per text generation
    const imageGenerationCost = this.metrics.cacheMisses * 0.01; // ~$0.01 per image generation
    return textGenerationCost + imageGenerationCost;
  }

  /**
   * Get custom metrics for UniversalSingleton
   */
  protected getCustomMetrics() {
    return {
      cachedProducts: this.metrics.cacheHits,
      cacheHitRate: this.metrics.cacheHitRate,
      averageQualityScore: 0.8, // This would be calculated from actual data
      totalUsageCount: 0, // This would be calculated from actual data
      aiGenerationCosts: this.estimateAIGenerationCosts()
    };
  }
}

export default ProductCacheSingletonService;
