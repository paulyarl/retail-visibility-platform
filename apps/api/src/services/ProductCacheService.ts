/**
 * Product Cache Service
 * 
 * Intelligent caching system that:
 * 1. Checks cache for existing products (scenario + category)
 * 2. Uses AI to generate if cache miss
 * 3. Saves AI-generated products to cache for future use
 * 4. Tracks usage and quality for organic growth
 * 
 * This creates a self-improving product knowledge base that grows over time.
 */

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
  requireImages?: boolean; // NEW: Only return products with images
  textModel?: 'openai' | 'google'; // NEW: AI model for text generation
}

export interface GeneratedProduct {
  name: string;
  price: number; // in cents
  brand?: string;
  description?: string;
  sku?: string;
  // Image data (NEW)
  imageUrl?: string;
  thumbnailUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
  imageBytes?: number;
  // Enhanced content (NEW)
  enhancedDescription?: string;
  features?: string[];
  specifications?: Record<string, string>;
}

export class ProductCacheService {
  
  /**
   * Get products for a scenario, using cache or AI generation
   */
  async getProductsForScenario(request: ProductRequest): Promise<GeneratedProduct[]> {
    const { businessType, categoryName, googleCategoryId, count, requireImages = false, textModel } = request;
    
    console.log(`[ProductCache] Requesting ${count} products for ${businessType} > ${categoryName}${requireImages ? ' (with images)' : ''}${textModel ? ` [${textModel}]` : ''}`);
    
    // Step 1: Check cache
    const cachedProducts = await this.getCachedProducts(businessType, categoryName, count, requireImages);
    
    if (cachedProducts.length >= count) {
      console.log(`[ProductCache] Cache HIT: Found ${cachedProducts.length} cached products`);
      
      // Update usage stats
      await this.incrementUsageCount(cachedProducts.map(p => p.id));
      
      // Convert to GeneratedProduct format (include image data)
      return cachedProducts.slice(0, count).map(p => ({
        name: p.productName,
        price: p.priceCents,
        brand: p.brand || undefined,
        description: p.description || undefined,
        sku: p.skuPattern || undefined,
        // Include image data if available
        imageUrl: p.imageUrl || undefined,
        thumbnailUrl: p.thumbnailUrl || undefined,
        imageWidth: p.imageWidth || undefined,
        imageHeight: p.imageHeight || undefined,
        imageBytes: p.imageBytes || undefined,
      }));
    }
    
    // Step 2: Partial cache - use what we have
    const needed = count - cachedProducts.length;
    console.log(`[ProductCache] Cache PARTIAL: ${cachedProducts.length}/${count} products found`);
    
    // Step 3: Try AI generation for missing products
    let aiProducts: GeneratedProduct[] = [];
    try {
      aiProducts = await this.generateWithAI(businessType, categoryName, needed, textModel);
      console.log(`[ProductCache] AI generated ${aiProducts.length} products`);
      
      // Debug: Log first product to see what fields AI is returning
      if (aiProducts.length > 0) {
        console.log(`[ProductCache] Sample AI product:`, JSON.stringify(aiProducts[0], null, 2));
      }
      
      // Save AI-generated products to cache
      await this.saveToCache(businessType, categoryName, googleCategoryId, aiProducts);
    } catch (error: any) {
      console.warn(`[ProductCache] AI generation failed, will use variations: ${error.message}`);
    }
    
    // Step 4: If still need more products, create variations of cached products
    const totalSoFar = cachedProducts.length + aiProducts.length;
    if (totalSoFar < count) {
      const stillNeeded = count - totalSoFar;
      console.log(`[ProductCache] Creating ${stillNeeded} product variations to reach ${count} total`);
      
      const variations = this.createProductVariations(cachedProducts, aiProducts, stillNeeded);
      aiProducts.push(...variations);
    }
    
    // Step 5: Combine cached + AI products (with complete data)
    const cachedConverted = cachedProducts.map(p => ({
      name: p.productName,
      price: p.priceCents,
      brand: p.brand || undefined,
      description: p.description || undefined,
      sku: p.skuPattern || undefined,
      // Include image data if available
      imageUrl: p.imageUrl || undefined,
      thumbnailUrl: p.thumbnailUrl || undefined,
      imageWidth: p.imageWidth || undefined,
      imageHeight: p.imageHeight || undefined,
      imageBytes: p.imageBytes || undefined,
      // Include enhanced content if available
      enhancedDescription: p.enhancedDescription || undefined,
      features: p.features ? JSON.parse(JSON.stringify(p.features)) : undefined,
      specifications: p.specifications ? JSON.parse(JSON.stringify(p.specifications)) : undefined,
    }));
    
    return [...cachedConverted, ...aiProducts];
  }
  
  /**
   * Get cached products for a scenario
   */
  private async getCachedProducts(
    businessType: string,
    categoryName: string,
    limit: number,
    requireImages: boolean = false
  ): Promise<CachedProduct[]> {
    try {
      // Use Prisma client to query cache
      const whereClause: any = {
        business_type: businessType,
        category_name: categoryName,
        quality_score: { gte: 0.0 }
      };
      
      // Filter by images if required
      if (requireImages) {
        whereClause.has_image = true;
      }
      
      const products = await prisma.quick_start_product_cache.findMany({
        where: whereClause,
        orderBy: [
          { usage_count: 'desc' },
          { quality_score: 'desc' },
          { created_at: 'desc' }
        ],
        take: limit
      });
      
      if (products.length > 0) {
        const imageInfo = requireImages ? ' (all with images)' : '';
        console.log(`[ProductCache] Cache HIT: Found ${products.length} products for ${businessType} > ${categoryName}${imageInfo}`);
      } else {
        const imageInfo = requireImages ? ' (with images)' : '';
        console.log(`[ProductCache] Cache MISS: No products for ${businessType} > ${categoryName}${imageInfo}`);
      }
      
      // Convert to CachedProduct format
      return products.map((p: any) => ({
        id: p.id,
        businessType: p.business_type,
        categoryName: p.category_name,
        googleCategoryId: p.google_category_id,
        productName: p.product_name,
        priceCents: p.price_cents,
        brand: p.brand,
        description: p.description,
        skuPattern: p.sku_pattern,
        imageUrl: p.image_url,
        thumbnailUrl: p.thumbnail_url,
        imageWidth: p.image_width,
        imageHeight: p.image_height,
        imageBytes: p.image_bytes,
        enhancedDescription: p.enhanced_description,
        features: p.features,
        specifications: p.specifications,
        generationSource: p.generation_source,
        hasImage: !!p.has_image,
        imageQuality: p.image_quality,
        usageCount: p.usage_count,
        qualityScore: p.quality_score || 0,
        createdAt: p.created_at,
        lastUsedAt: p.last_used_at,
      }));
    } catch (error: any) {
      console.error('[ProductCache] Cache lookup failed:', error.message);
      return [];
    }
  }
  
  /**
   * Generate products using AI (Multi-provider: Gemini or OpenAI)
   */
  private async generateWithAI(
    businessType: string,
    categoryName: string,
    count: number,
    textModel?: 'openai' | 'google'
  ): Promise<GeneratedProduct[]> {
    try {
      // Use the multi-provider service with optional provider override
      const products = await aiProviderService.generateProducts(
        businessType,
        categoryName,
        count,
        textModel
      );
      
      console.log(`[ProductCache] AI generated ${products.length} products`);
      
      // Convert to GeneratedProduct format (includes enhanced fields)
      return products.map(p => ({
        name: p.name,
        price: p.price,
        brand: p.brand,
        description: p.description,
        enhancedDescription: p.enhancedDescription,
        features: p.features,
        specifications: p.specifications,
        sku: p.sku,
      }));
      
    } catch (error: any) {
      console.error('[ProductCache] AI generation failed:', error.message);
      return this.getFallbackProducts(businessType, categoryName, count);
    }
  }
  
  /**
   * Validate AI-generated product
   */
  private validateProduct(product: any): boolean {
    return (
      typeof product.name === 'string' &&
      product.name.length > 0 &&
      typeof product.price === 'number' &&
      product.price > 0 &&
      product.price < 1000000 // Max $10,000
    );
  }
  
  /**
   * Save AI-generated products to cache
   */
  private async saveToCache(
    businessType: string,
    categoryName: string,
    googleCategoryId: string | undefined,
    products: GeneratedProduct[]
  ): Promise<void> {
    console.log(`[ProductCache] Saving ${products.length} products to cache`);
    
    for (const product of products) {
      try {
        await prisma.quick_start_product_cache.upsert({
          where: {
            business_type_category_name_product_name: {
              business_type: businessType,
              category_name: categoryName,
              product_name: product.name
            }
          },
          create: {
            id: generateItemId(),
            business_type: businessType,
            category_name: categoryName,
            google_category_id: googleCategoryId || null,
            product_name: product.name,
            price_cents: product.price,
            brand: product.brand || null,
            description: product.description || null,
            sku_pattern: product.sku || null,
            // Enhanced content
            enhanced_description: product.enhancedDescription || undefined,
            features: product.features || undefined,
            specifications: product.specifications || undefined,
            // Image data (will be null for now, added in Phase 2)
            image_url: product.imageUrl || null,
            thumbnail_url: product.thumbnailUrl || null,
            image_width: product.imageWidth || null,
            image_height: product.imageHeight || null,
            image_bytes: product.imageBytes || null,
            has_image: !!product.imageUrl,
            // Metadata
            generation_source: 'ai',
            usage_count: 1,
            quality_score: 0.0,
          },
          update: {
            usage_count: { increment: 1 },
            last_used_at: new Date(),
          }
        });
        console.log(`[ProductCache] ✓ Saved: ${product.name}`);
      } catch (error: any) {
        console.error(`[ProductCache] Failed to save product "${product.name}":`, error.message);
      }
    }
  }
  
  /**
   * Increment usage count for cached products
   */
  private async incrementUsageCount(productIds: string[]): Promise<void> {
    if (productIds.length === 0) return;
    
    // Update usage count for cached products
    for (const id of productIds) {
      try {
        await prisma.quick_start_product_cache.update({
          where: { id },
          data: {
            usage_count: { increment: 1 },
            last_used_at: new Date()
          }
        });
      } catch (error: any) {
        console.error(`[ProductCache] Failed to increment usage for ${id}:`, error.message);
      }
    }
  }
  
  /**
   * Create product variations by appending numbers to existing products
   * Used when cache and AI are exhausted - these are sample products anyway
   */
  private createProductVariations(
    cachedProducts: CachedProduct[],
    aiProducts: GeneratedProduct[],
    count: number
  ): GeneratedProduct[] {
    const variations: GeneratedProduct[] = [];
    const allProducts = [
      ...cachedProducts.map(p => ({
        name: p.productName,
        price: p.priceCents,
        brand: p.brand || undefined,
      })),
      ...aiProducts
    ];
    
    if (allProducts.length === 0) {
      // No products at all, use generic fallback
      return this.getFallbackProducts('', '', count);
    }
    
    let variationIndex = 1;
    while (variations.length < count) {
      for (const product of allProducts) {
        if (variations.length >= count) break;
        
        // Append variation number to product name
        variations.push({
          name: `${product.name} (Sample ${variationIndex})`,
          price: product.price,
          brand: product.brand,
          description: `Sample variation of ${product.name}. Update before publishing.`,
        });
      }
      variationIndex++;
    }
    
    console.log(`[ProductCache] Created ${variations.length} product variations`);
    return variations;
  }
  
  /**
   * Fallback products when AI is unavailable
   */
  private getFallbackProducts(
    businessType: string,
    categoryName: string,
    count: number
  ): GeneratedProduct[] {
    // Generic fallback products with descriptions to pass validation
    const fallbacks: GeneratedProduct[] = [
      { name: `${categoryName} Item 1`, price: 999, brand: 'Generic', description: `Quality ${categoryName.toLowerCase()} product for everyday use.` },
      { name: `${categoryName} Item 2`, price: 1499, brand: 'Generic', description: `Premium ${categoryName.toLowerCase()} product with enhanced features.` },
      { name: `${categoryName} Item 3`, price: 1999, brand: 'Generic', description: `Professional-grade ${categoryName.toLowerCase()} product.` },
      { name: `${categoryName} Item 4`, price: 2499, brand: 'Generic', description: `Deluxe ${categoryName.toLowerCase()} product for discerning customers.` },
      { name: `${categoryName} Item 5`, price: 2999, brand: 'Generic', description: `Top-tier ${categoryName.toLowerCase()} product with all the bells and whistles.` },
    ];
    
    return fallbacks.slice(0, count);
  }
  
  /**
   * Record user feedback on a product (for quality scoring)
   */
  async recordFeedback(productId: string, isPositive: boolean): Promise<void> {
    const delta = isPositive ? 0.1 : -0.1;
    
    await prisma.$executeRawUnsafe(`
      UPDATE quick_start_product_cache
      SET quality_score = GREATEST(-1.0, LEAST(1.0, quality_score + $1))
      WHERE id = $2
    `, delta, productId);
  }
  
  /**
   * Update cache entry with photo metadata
   */
  async updateCacheWithPhoto(
    businessType: string,
    productName: string,
    photoData: {
      imageUrl: string;
      thumbnailUrl: string;
      imageWidth: number;
      imageHeight: number;
      imageBytes: number;
      imageQuality: string;
    },
    categoryName?: string
  ): Promise<void> {
    try {
      // Find the cache entry by business type and product name
      // If category provided, match that too for precision
      const whereClause: any = {
        business_type: businessType,
        product_name: productName,
      };
      
      if (categoryName) {
        whereClause.category_name = categoryName;
      }
      
      const cacheEntry = await prisma.quick_start_product_cache.findFirst({
        where: whereClause
      });
      
      if (!cacheEntry) {
        console.warn(`[ProductCache] No cache entry found for ${businessType} > ${categoryName || '?'} > ${productName}`);
        return;
      }
      
      // Update with photo data
      await prisma.quick_start_product_cache.update({
        where: { id: cacheEntry.id },
        data: {
          image_url: photoData.imageUrl,
          thumbnail_url: photoData.thumbnailUrl,
          image_width: photoData.imageWidth,
          image_height: photoData.imageHeight,
          image_bytes: photoData.imageBytes,
          has_image: true,
          image_quality: photoData.imageQuality,
        }
      });
      
      console.log(`[ProductCache] ✓ Updated cache with photo for: ${productName}`);
    } catch (error: any) {
      console.error(`[ProductCache] Failed to update cache with photo for "${productName}":`, error.message);
    }
  }
  
  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalProducts: number;
    byBusinessType: Record<string, number>;
    topProducts: Array<{ name: string; usageCount: number }>;
  }> {
    const total = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
      SELECT COUNT(*) as count
      FROM quick_start_product_cache
    `);
    
    const byType = await prisma.$queryRawUnsafe<Array<{ businessType: string; count: bigint }>>(`
      SELECT business_type as "businessType", COUNT(*) as count
      FROM quick_start_product_cache
      GROUP BY business_type
      ORDER BY count DESC
    `);
    
    const topProducts = await prisma.$queryRawUnsafe<Array<{ name: string; usageCount: number }>>(`
      SELECT product_name as name, usage_count as "usageCount"
      FROM quick_start_product_cache
      ORDER BY usage_count DESC
      LIMIT 10
    `);
    
    return {
      totalProducts: Number(total[0].count),
      byBusinessType: Object.fromEntries(
        byType.map(t => [t.businessType, Number(t.count)])
      ),
      topProducts,
    };
  }
}

export const productCacheService = new ProductCacheService();
