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
  generationSource: string;
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
}

export interface GeneratedProduct {
  name: string;
  price: number;
  brand?: string;
  description?: string;
  sku?: string;
}

export class ProductCacheService {
  
  /**
   * Get products for a scenario, using cache or AI generation
   */
  async getProductsForScenario(request: ProductRequest): Promise<GeneratedProduct[]> {
    const { businessType, categoryName, googleCategoryId, count } = request;
    
    console.log(`[ProductCache] Requesting ${count} products for ${businessType} > ${categoryName}`);
    
    // Step 1: Check cache
    const cachedProducts = await this.getCachedProducts(businessType, categoryName, count);
    
    if (cachedProducts.length >= count) {
      console.log(`[ProductCache] Cache HIT: Found ${cachedProducts.length} cached products`);
      
      // Update usage stats
      await this.incrementUsageCount(cachedProducts.map(p => p.id));
      
      // Convert to GeneratedProduct format
      return cachedProducts.slice(0, count).map(p => ({
        name: p.productName,
        price: p.priceCents,
        brand: p.brand || undefined,
        description: p.description || undefined,
        sku: p.skuPattern || undefined,
      }));
    }
    
    // Step 2: Partial cache - use what we have
    const needed = count - cachedProducts.length;
    console.log(`[ProductCache] Cache PARTIAL: ${cachedProducts.length}/${count} products found`);
    
    // Step 3: Try AI generation for missing products
    let aiProducts: GeneratedProduct[] = [];
    try {
      aiProducts = await this.generateWithAI(businessType, categoryName, needed);
      console.log(`[ProductCache] AI generated ${aiProducts.length} products`);
      
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
    
    // Step 5: Combine cached + AI products
    const cachedConverted = cachedProducts.map(p => ({
      name: p.productName,
      price: p.priceCents,
      brand: p.brand || undefined,
      description: p.description || undefined,
      sku: p.skuPattern || undefined,
    }));
    
    return [...cachedConverted, ...aiProducts];
  }
  
  /**
   * Get cached products for a scenario
   */
  private async getCachedProducts(
    businessType: string,
    categoryName: string,
    limit: number
  ): Promise<CachedProduct[]> {
    const products = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        business_type as "businessType",
        category_name as "categoryName",
        google_category_id as "googleCategoryId",
        product_name as "productName",
        price_cents as "priceCents",
        brand,
        description,
        sku_pattern as "skuPattern",
        generation_source as "generationSource",
        usage_count as "usageCount",
        quality_score as "qualityScore",
        created_at as "createdAt",
        last_used_at as "lastUsedAt"
      FROM quick_start_product_cache
      WHERE business_type = ${businessType}
        AND category_name = ${categoryName}
        AND quality_score >= 0.0  -- Filter out negatively rated products
      ORDER BY 
        usage_count DESC,  -- Prefer frequently used products
        quality_score DESC,  -- Then by quality
        created_at DESC  -- Then by recency
      LIMIT ${limit}
    `;
    
    return products;
  }
  
  /**
   * Generate products using AI (OpenAI)
   */
  private async generateWithAI(
    businessType: string,
    categoryName: string,
    count: number
  ): Promise<GeneratedProduct[]> {
    // Check if OpenAI is configured
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      console.warn('[ProductCache] OpenAI API key not configured, using fallback');
      return this.getFallbackProducts(businessType, categoryName, count);
    }
    
    try {
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: openaiKey });
      
      const prompt = `Generate ${count} realistic products for a ${businessType} business in the category "${categoryName}".

For each product, provide:
1. name: Realistic product name (include size/quantity if relevant)
2. price: Realistic price in cents (integer)
3. brand: Real or realistic brand name
4. description: 1-2 sentence description
5. sku: Generate a realistic SKU format

Requirements:
- Products must be realistic and commonly sold
- Prices should reflect actual market prices (in cents)
- Use real brand names when appropriate
- Vary the products within the category
- Include size/quantity in product names when relevant

Return ONLY a JSON object with a "products" array. No additional text.`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: [
          {
            role: 'system',
            content: 'You are a product data expert. Return only valid JSON with a products array.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.8,
        max_tokens: 2000
      });
      
      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }
      
      const data = JSON.parse(content);
      const products = data.products || [];
      
      console.log(`[ProductCache] AI generated ${products.length} products`);
      
      // Validate products
      return products
        .filter((p: any) => this.validateProduct(p))
        .slice(0, count);
      
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
        await prisma.$executeRaw`
          INSERT INTO quick_start_product_cache (
            id,
            business_type,
            category_name,
            google_category_id,
            product_name,
            price_cents,
            brand,
            description,
            sku_pattern,
            generation_source,
            usage_count,
            created_at
          ) VALUES (
            ${generateItemId()},
            ${businessType},
            ${categoryName},
            ${googleCategoryId || null},
            ${product.name},
            ${product.price},
            ${product.brand || null},
            ${product.description || null},
            ${product.sku || null},
            'ai',
            1,
            CURRENT_TIMESTAMP
          )
          ON CONFLICT (business_type, category_name, product_name) 
          DO UPDATE SET
            usage_count = quick_start_product_cache.usage_count + 1,
            last_used_at = CURRENT_TIMESTAMP
        `;
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
    
    await prisma.$executeRaw`
      UPDATE quick_start_product_cache
      SET 
        usage_count = usage_count + 1,
        last_used_at = CURRENT_TIMESTAMP
      WHERE id = ANY(${productIds}::text[])
    `;
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
    // Generic fallback products
    const fallbacks: GeneratedProduct[] = [
      { name: `${categoryName} Item 1`, price: 999, brand: 'Generic' },
      { name: `${categoryName} Item 2`, price: 1499, brand: 'Generic' },
      { name: `${categoryName} Item 3`, price: 1999, brand: 'Generic' },
      { name: `${categoryName} Item 4`, price: 2499, brand: 'Generic' },
      { name: `${categoryName} Item 5`, price: 2999, brand: 'Generic' },
    ];
    
    return fallbacks.slice(0, count);
  }
  
  /**
   * Record user feedback on a product (for quality scoring)
   */
  async recordFeedback(productId: string, isPositive: boolean): Promise<void> {
    const delta = isPositive ? 0.1 : -0.1;
    
    await prisma.$executeRaw`
      UPDATE quick_start_product_cache
      SET quality_score = GREATEST(-1.0, LEAST(1.0, quality_score + ${delta}))
      WHERE id = ${productId}
    `;
  }
  
  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    totalProducts: number;
    byBusinessType: Record<string, number>;
    topProducts: Array<{ name: string; usageCount: number }>;
  }> {
    const total = await prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM quick_start_product_cache
    `;
    
    const byType = await prisma.$queryRaw<Array<{ businessType: string; count: bigint }>>`
      SELECT business_type as "businessType", COUNT(*) as count
      FROM quick_start_product_cache
      GROUP BY business_type
      ORDER BY count DESC
    `;
    
    const topProducts = await prisma.$queryRaw<Array<{ name: string; usageCount: number }>>`
      SELECT product_name as name, usage_count as "usageCount"
      FROM quick_start_product_cache
      ORDER BY usage_count DESC
      LIMIT 10
    `;
    
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
