/**
 * AI Provider Service
 * 
 * Multi-provider AI service supporting:
 * - Google Gemini 2.0 Flash (text generation)
 * - Google Imagen 3 (image generation)
 * - OpenAI GPT-4 (text generation fallback)
 * - OpenAI DALL-E 3 (image generation fallback)
 * 
 * Automatically falls back to alternate provider if primary fails.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../prisma';

export type AIProvider = 'google' | 'openai';
export type ImageQuality = 'standard' | 'hd';

export interface AIConfig {
  textProvider: AIProvider;
  imageProvider: AIProvider;
  fallbackEnabled: boolean;
  imageQuality: ImageQuality;
}

export interface GeneratedProductData {
  name: string;
  price: number; // in cents
  brand?: string;
  description?: string;
  enhancedDescription?: string;
  features?: string[];
  specifications?: Record<string, string>;
  sku?: string;
}

export class AIProviderService {
  private openai: any;
  private gemini: GoogleGenerativeAI | null;
  private lastGeminiCall: number = 0;
  private geminiCallCount: number = 0;
  private readonly GEMINI_RATE_LIMIT = 10; // Max calls per minute (conservative)
  private readonly GEMINI_RETRY_DELAY = 2000; // 2 seconds between calls

  constructor() {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = require('openai').default;
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        console.log('[AI] OpenAI initialized');
      } catch (error) {
        console.warn('[AI] Failed to initialize OpenAI:', error);
      }
    }

    // Initialize Gemini
    if (process.env.GOOGLE_AI_API_KEY) {
      try {
        this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
        console.log('[AI] Google Gemini initialized');
      } catch (error) {
        console.warn('[AI] Failed to initialize Gemini:', error);
        this.gemini = null;
      }
    } else {
      this.gemini = null;
    }
  }

  /**
   * Get AI configuration from platform settings
   * TODO: Add ai_text_provider, ai_image_provider columns to platform_settings_list table
   */
  async getConfig(): Promise<AIConfig> {
    try {
      // For now, use defaults until we add AI columns to platform_settings_list
      // In future: const settings = await prisma.platform_settings_list.findFirst();
      
      return {
        textProvider: 'openai', // TEMPORARY: Using OpenAI to avoid Gemini rate limits
        imageProvider: 'openai', // TEMPORARY: Using OpenAI
        fallbackEnabled: true, // Always enable fallback for reliability
        imageQuality: 'standard', // Standard quality by default
      };
    } catch (error) {
      console.warn('[AI] Failed to get config, using defaults');
      return {
        textProvider: 'openai',
        imageProvider: 'openai',
        fallbackEnabled: true,
        imageQuality: 'standard',
      };
    }
  }

  /**
   * Generate product data with configured provider
   */
  async generateProducts(
    businessType: string,
    categoryName: string,
    count: number
  ): Promise<GeneratedProductData[]> {
    const config = await this.getConfig();
    
    console.log(`[AI] Generating ${count} products with ${config.textProvider}`);
    
    try {
      if (config.textProvider === 'google' && this.gemini) {
        return await this.generateWithGemini(businessType, categoryName, count);
      } else if (this.openai) {
        return await this.generateWithOpenAI(businessType, categoryName, count);
      }
      throw new Error('No AI provider available');
    } catch (error: any) {
      console.error(`[AI] ${config.textProvider} failed:`, error.message);
      
      // Try fallback if enabled
      if (config.fallbackEnabled) {
        console.log('[AI] Attempting fallback provider...');
        try {
          if (config.textProvider === 'google' && this.openai) {
            return await this.generateWithOpenAI(businessType, categoryName, count);
          } else if (config.textProvider === 'openai' && this.gemini) {
            return await this.generateWithGemini(businessType, categoryName, count);
          }
        } catch (fallbackError: any) {
          console.error('[AI] Fallback also failed:', fallbackError.message);
        }
      }
      
      throw error;
    }
  }

  /**
   * Wait if needed to respect rate limits
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastGeminiCall;
    
    // Reset counter every minute
    if (timeSinceLastCall > 60000) {
      this.geminiCallCount = 0;
    }
    
    // If we've hit the rate limit, wait
    if (this.geminiCallCount >= this.GEMINI_RATE_LIMIT) {
      const waitTime = 60000 - timeSinceLastCall;
      console.log(`[AI] Rate limit reached, waiting ${Math.ceil(waitTime / 1000)}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.geminiCallCount = 0;
    }
    
    // Add delay between calls to be respectful
    if (timeSinceLastCall < this.GEMINI_RETRY_DELAY) {
      const delay = this.GEMINI_RETRY_DELAY - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastGeminiCall = Date.now();
    this.geminiCallCount++;
  }

  /**
   * Generate products with Google Gemini 2.0 Flash
   */
  private async generateWithGemini(
    businessType: string,
    categoryName: string,
    count: number
  ): Promise<GeneratedProductData[]> {
    if (!this.gemini) throw new Error('Gemini not initialized');
    
    // Wait if needed to respect rate limits
    await this.waitForRateLimit();
    
    const model = this.gemini.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2000,
      }
    });

    const prompt = `Generate ${count} realistic products for a ${businessType} business in the category "${categoryName}".

For each product, provide:
1. name: Realistic product name (include size/quantity if relevant)
2. price: Realistic price in cents (integer, e.g., 1299 for $12.99)
3. brand: Real or realistic brand name
4. description: 1-2 sentence product description
5. enhancedDescription: 2-3 paragraph detailed description (SEO-friendly)
6. features: Array of 3-5 key features/benefits
7. specifications: Object with technical specs (size, quantity, ingredients, etc.)
8. sku: Generate a realistic SKU format

Requirements:
- Products must be realistic and commonly sold
- Prices should reflect actual market prices (in cents)
- Use real brand names when appropriate
- Vary the products within the category
- Include size/quantity in product names when relevant
- Enhanced descriptions should be detailed and SEO-friendly
- Features should highlight benefits
- Specifications should be product-specific

Return ONLY a JSON object with a "products" array. No markdown, no code blocks, just pure JSON.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Parse JSON from response (Gemini sometimes wraps in markdown)
    let jsonText = text.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }
    
    const data = JSON.parse(jsonText);
    const products = data.products || [];
    
    console.log(`[AI] Gemini generated ${products.length} products`);
    
    return products
      .filter((p: any) => this.validateProduct(p))
      .slice(0, count);
  }

  /**
   * Generate products with OpenAI GPT-4
   */
  private async generateWithOpenAI(
    businessType: string,
    categoryName: string,
    count: number
  ): Promise<GeneratedProductData[]> {
    if (!this.openai) throw new Error('OpenAI not initialized');

    const prompt = `Generate ${count} realistic products for a ${businessType} business in the category "${categoryName}".

For each product, provide:
1. name: Realistic product name (include size/quantity if relevant)
2. price: Realistic price in cents (integer, e.g., 1299 for $12.99)
3. brand: Real or realistic brand name
4. description: 1-2 sentence product description
5. enhancedDescription: 2-3 paragraph detailed description (SEO-friendly)
6. features: Array of 3-5 key features/benefits
7. specifications: Object with technical specs (size, quantity, ingredients, etc.)
8. sku: Generate a realistic SKU format

Requirements:
- Products must be realistic and commonly sold
- Prices should reflect actual market prices (in cents)
- Use real brand names when appropriate
- Vary the products within the category
- Include size/quantity in product names when relevant
- Enhanced descriptions should be detailed and SEO-friendly
- Features should highlight benefits
- Specifications should be product-specific

Return ONLY a JSON object with a "products" array.`;

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: [
        {
          role: 'system',
          content: 'You are a product data expert. Return only valid JSON with a products array containing detailed product information.'
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

    console.log(`[AI] OpenAI generated ${products.length} products`);

    return products
      .filter((p: any) => this.validateProduct(p))
      .slice(0, count);
  }

  /**
   * Validate product data
   */
  private validateProduct(product: any): boolean {
    return (
      typeof product.name === 'string' &&
      product.name.length > 0 &&
      typeof product.price === 'number' &&
      product.price > 0
    );
  }

  /**
   * Generate product image URL (placeholder for now)
   * Will be implemented in Phase 2
   */
  async generateProductImage(
    productName: string
  ): Promise<{
    url: string;
    thumbnailUrl: string;
    width: number;
    height: number;
    bytes: number;
  } | null> {
    const config = await this.getConfig();
    
    console.log(`[AI] Image generation with ${config.imageProvider} (not yet implemented)`);
    
    // TODO: Implement in Phase 2
    // - Download image from DALL-E or Imagen
    // - Process with Sharp
    // - Upload to Supabase
    // - Return URLs
    
    return null;
  }
}

// Export singleton instance
export const aiProviderService = new AIProviderService();
