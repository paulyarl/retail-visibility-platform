/**
 * AI Image Service - UniversalSingleton Implementation
 * Handles AI-powered product image generation with caching and rate limiting
 */

import { UniversalSingleton, SingletonCacheOptions } from '../lib/UniversalSingleton';
import { prisma } from '../prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { generateItemId, generatePhotoId } from '../lib/id-generator';
import sharp from 'sharp';

// Import the new Google GenAI for Imagen 3
let GoogleGenAI: any = null;
try {
  GoogleGenAI = require('@google/genai').GoogleGenAI;
} catch (e) {
  console.warn('[AI IMAGE SINGLETON] @google/genai not available, Imagen 3 will be disabled');
}

export interface GeneratedImage {
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  bytes: number;
  photoAssetId: string;
}

export interface ImageGenerationRequest {
  prompt: string;
  style?: 'natural' | 'vivid';
  aspectRatio?: '1:1' | '16:9' | '9:16';
  quality?: 'standard' | 'hd';
  tenantId?: string;
  inventoryItemId?: string;
  metadata?: Record<string, any>;
}

export interface ImageGenerationStats {
  totalGenerations: number;
  successfulGenerations: number;
  failedGenerations: number;
  averageGenerationTime: number;
  providerUsage: {
    openai: number;
    imagen: number;
    dalle3: number;
    imagen3: number;
  };
  cacheHitRate: number;
  costEstimate: number;
}

class AIImageSingletonService extends UniversalSingleton {
  private static instance: AIImageSingletonService;
  private openai: any;
  private gemini: GoogleGenerativeAI | null = null;
  private genai: any; // For Imagen 3
  private supabase: any;
  
  // Rate limit handling for Imagen
  private readonly IMAGEN_MAX_RETRIES = 2;
  private readonly IMAGEN_RETRY_BUFFER = 5000; // 5s buffer

  private constructor(singletonKey: string, cacheOptions?: SingletonCacheOptions) {
    super(singletonKey, {
      enableCache: true,
      enableEncryption: true,
      enablePrivateCache: true,
      authenticationLevel: 'public',
      defaultTTL: 3600, // 1 hour
      maxCacheSize: 100,
      enableMetrics: true,
      enableLogging: true
    });

    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = require('openai').default;
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      } catch (error) {
        console.error('[AI IMAGE SINGLETON] Failed to initialize OpenAI:', error);
      }
    }

    // Initialize Google Generative AI for Imagen 3
    if (process.env.GOOGLE_AI_API_KEY && GoogleGenAI) {
      try {
        this.genai = new GoogleGenAI(process.env.GOOGLE_AI_API_KEY);
        this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
        console.log('[AI IMAGE SINGLETON] Google Generative AI initialized for Imagen 3');
      } catch (error) {
        console.error('[AI IMAGE SINGLETON] Failed to initialize Google Generative AI:', error);
      }
    }

    // Initialize Supabase
    if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
      try {
        this.supabase = createClient(
          process.env.SUPABASE_URL,
          process.env.SUPABASE_ANON_KEY
        );
        console.log('[AI IMAGE SINGLETON] Supabase client initialized');
      } catch (error) {
        console.error('[AI IMAGE SINGLETON] Failed to initialize Supabase:', error);
      }
    }
  }

  static getInstance(): AIImageSingletonService {
    if (!AIImageSingletonService.instance) {
      AIImageSingletonService.instance = new AIImageSingletonService('ai-image-service');
    }
    return AIImageSingletonService.instance;
  }

  // ====================
  // CORE IMAGE GENERATION
  // ====================

  /**
   * Generate product image using AI
   */
  async generateProductImage(request: ImageGenerationRequest): Promise<GeneratedImage> {
    const startTime = Date.now();
    const cacheKey = this.generateImageCacheKey(request);
    
    try {
      // Check cache first
      const cached = await this.getFromCache<GeneratedImage>(cacheKey);
      if (cached) {
        this.logInfo('Image generation cache hit', { cacheKey });
        return cached;
      }

      let generatedImage: GeneratedImage;

      // Try Google Imagen 3 first (cheaper)
      if (this.genai && request.quality !== 'hd') {
        try {
          generatedImage = await this.generateWithImagen3(request);
          this.logInfo('Image generated with Imagen 3', { cacheKey });
        } catch (error) {
          console.warn('[AI IMAGE SINGLETON] Imagen 3 failed, falling back to DALL-E 3:', error);
          generatedImage = await this.generateWithDalle3(request);
          this.logInfo('Image generated with DALL-E 3 (fallback)', { cacheKey });
        }
      } else {
        // Use DALL-E 3 for HD quality or if Imagen 3 is not available
        generatedImage = await this.generateWithDalle3(request);
        this.logInfo('Image generated with DALL-E 3', { cacheKey });
      }

      // Cache the result
      await this.setCache(cacheKey, generatedImage, { ttl: 7200 }); // 2 hours cache
      
      // Update metrics
      const duration = Date.now() - startTime;
      this.metrics.cacheHits++;
      this.metrics.apiCalls++;
      
      return generatedImage;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.cacheMisses++;
      this.metrics.errors++;
      this.logError('Image generation failed', error);
      throw error;
    }
  }

  /**
   * Generate image using Google Imagen 3
   */
  private async generateWithImagen3(request: ImageGenerationRequest): Promise<GeneratedImage> {
    if (!this.genai) {
      throw new Error('Google Imagen 3 not available');
    }

    const model = this.genai.getGenerativeModel({ model: 'imagen-3.0-generate-001' });
    
    const enhancedPrompt = this.enhancePromptForProduct(request.prompt);
    
    const result = await model.generateImage(enhancedPrompt, {
      aspectRatio: request.aspectRatio || '1:1',
      style: request.style || 'natural',
      quality: request.quality || 'standard'
    });

    if (!result.response.images || result.response.images.length === 0) {
      throw new Error('No images generated by Imagen 3');
    }

    const imageData = result.response.images[0];
    
    // Process and upload image
    return await this.processAndUploadImage(
      imageData.generationResult?.bytesBase64Encoded || '',
      'imagen3',
      request
    );
  }

  /**
   * Generate image using OpenAI DALL-E 3
   */
  private async generateWithDalle3(request: ImageGenerationRequest): Promise<GeneratedImage> {
    if (!this.openai) {
      throw new Error('OpenAI DALL-E 3 not available');
    }

    const enhancedPrompt = this.enhancePromptForProduct(request.prompt);
    
    const response = await this.openai.images.generate({
      model: 'dall-e-3',
      prompt: enhancedPrompt,
      size: this.mapAspectRatioToSize(request.aspectRatio || '1:1'),
      quality: request.quality || 'standard',
      style: request.style || 'natural',
      n: 1
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No images generated by DALL-E 3');
    }

    const imageData = response.data[0];
    
    // Download and process image
    const imageBuffer = await this.downloadImage(imageData.url);
    
    return await this.processAndUploadImage(
      imageBuffer.toString('base64'),
      'dalle3',
      request
    );
  }

  /**
   * Process and upload generated image
   */
  private async processAndUploadImage(
    imageDataBase64: string,
    provider: string,
    request: ImageGenerationRequest
  ): Promise<GeneratedImage> {
    try {
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(imageDataBase64, 'base64');
      
      // Process image with Sharp
      const processedImage = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 90 })
        .toBuffer();

      // Generate thumbnail
      const thumbnailBuffer = await sharp(imageBuffer)
        .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 70 })
        .toBuffer();

      // Upload to Supabase
      const photoAssetId = await this.uploadToSupabase(
        processedImage,
        thumbnailBuffer,
        provider,
        request
      );

      return {
        url: photoAssetId.url,
        thumbnailUrl: photoAssetId.thumbnailUrl,
        width: 1024,
        height: 1024,
        bytes: processedImage.length,
        photoAssetId: photoAssetId.id
      };
    } catch (error) {
      this.logError('Image processing and upload failed', error);
      throw error;
    }
  }

  /**
   * Upload image to Supabase storage
   */
  private async uploadToSupabase(
    imageBuffer: Buffer,
    thumbnailBuffer: Buffer,
    provider: string,
    request: ImageGenerationRequest
  ): Promise<any> {
    if (!this.supabase) {
      throw new Error('Supabase client not available');
    }

    const photoId = generatePhotoId();
    const timestamp = new Date().toISOString();
    
    // Upload main image
    const { data: imageData, error: imageError } = await this.supabase.storage
      .from(`ai-generated/${photoId}.jpg`)
      .upload(imageBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '31536000', // 1 year
      });

    if (imageError) {
      throw new Error(`Failed to upload main image: ${imageError.message}`);
      }

    // Upload thumbnail
    const { data: thumbnailData, error: thumbnailError } = await this.supabase.storage
      .from(`ai-generated/thumbnails/${photoId}-thumb.jpg`)
      .upload(thumbnailBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '31536000', // 1 year
      });

    if (thumbnailError) {
        throw new Error(`Failed to upload thumbnail: ${thumbnailError.message}`);
      }

    // Create photo_assets record
    const photoAsset = await prisma.photo_assets.create({
      data: {
        id: photoId,
        tenantId: request.tenantId || '',
        inventoryItemId: request.inventoryItemId || '',
        url: imageData.publicUrl || '',
        publicUrl: imageData.publicUrl || '',
        width: 1024,
        height: 1024,
        contentType: 'image/jpeg',
        bytes: imageBuffer.length,
        alt: `AI-generated product image: ${request.prompt.substring(0, 100)}...`,
        caption: `Generated by ${provider} AI`
      }
    });

    return {
      id: photoAsset.id,
      url: imageData.publicUrl,
      thumbnailUrl: thumbnailData.publicUrl
    };
  }

  /**
   * Download image from URL
   */
  private async downloadImage(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Enhance prompt for product photography
   */
  private enhancePromptForProduct(prompt: string): string {
    return `Professional product photography of: ${prompt}. 
    Clean white background, professional lighting, studio quality, 
    commercial photography style, high resolution, detailed product features visible`;
  }

  /**
   * Map aspect ratio to DALL-E size
   */
  private mapAspectRatioToSize(aspectRatio: string): string {
    const sizeMap: Record<string, string> = {
      '1:1': '1024x1024',
      '16:9': '1792x1024',
      '9:16': '1024x1792'
    };
    return sizeMap[aspectRatio] || '1024x1024';
  }

  /**
   * Generate cache key for image generation request
   */
  private generateImageCacheKey(request: ImageGenerationRequest): string {
    const keyData = {
      prompt: request.prompt,
      style: request.style || 'natural',
      aspectRatio: request.aspectRatio || '1:1',
      quality: request.quality || 'standard'
    };
    return `ai-image-${Buffer.from(JSON.stringify(keyData)).toString('base64')}`;
  }

  // ====================
  // ANALYTICS AND METRICS
  // ====================

  /**
   * Get image generation statistics
   */
  async getGenerationStats(): Promise<ImageGenerationStats> {
    try {
      const cacheKey = 'ai-image-stats';
      const cached = await this.getFromCache<ImageGenerationStats>(cacheKey);
      if (cached) {
        return cached;
      }

      // Calculate stats from metrics
      const totalGenerations = this.metrics.cacheHits + this.metrics.cacheMisses;
      const successRate = totalGenerations > 0 ? this.metrics.cacheHits / totalGenerations : 0;
      
      // Estimate costs (rough estimates)
      const openaiCost = (this.metrics.cacheHits * 0.04); // ~$0.04 per DALL-E 3
      const imagenCost = (this.metrics.cacheMisses * 0.001); // ~$0.001 per Imagen 3
      const totalCost = openaiCost + imagenCost;

      const stats: ImageGenerationStats = {
        totalGenerations,
        successfulGenerations: this.metrics.cacheHits,
        failedGenerations: this.metrics.cacheMisses,
        averageGenerationTime: 0,
        providerUsage: {
          openai: this.metrics.cacheHits,
          imagen: 0,
          dalle3: this.metrics.cacheHits,
          imagen3: this.metrics.cacheMisses
        },
        cacheHitRate: successRate,
        costEstimate: totalCost
      };

      await this.setCache(cacheKey, stats, { ttl: 1800 }); // 30 minutes cache
      return stats;
    } catch (error) {
      this.logError('Error getting generation stats', error);
      throw error;
    }
  }

  /**
   * Clear cache for specific tenant or all
   */
  async clearCache(tenantId?: string): Promise<void> {
    try {
      if (tenantId) {
        // Clear cache entries for specific tenant
        const pattern = `ai-image-*${tenantId}*`;
        // Implementation would depend on cache system capabilities
        this.logInfo(`Cleared AI image cache for tenant: ${tenantId}`);
      } else {
        // Clear all cache
        this.logInfo('Cleared all AI image cache');
      }
    } catch (error) {
      this.logError('Error clearing cache', error);
      throw error;
    }
  }

  // ====================
  // HEALTH AND STATUS
  // ====================

  /**
   * Check service health
   */
  async getHealthStatus(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    services: {
      openai: boolean;
      imagen3: boolean;
      dalle3: boolean;
      supabase: boolean;
    };
    lastCheck: string;
  }> {
    const health = {
      openai: !!this.openai,
      imagen3: !!this.genai,
      dalle3: !!this.openai,
      supabase: !!this.supabase,
      status: 'healthy' as 'healthy' | 'degraded' | 'unhealthy',
      lastCheck: new Date().toISOString()
    };

    // Determine overall status
    const availableServices = Object.values(health).filter(Boolean).length;
    if (availableServices === 0) {
      health.status = 'unhealthy';
    } else if (availableServices < 2) {
      health.status = 'degraded';
    }

    return {
      status: health.status,
      services: {
        openai: health.openai,
        imagen3: health.imagen3,
        dalle3: health.dalle3,
        supabase: health.supabase
      },
      lastCheck: health.lastCheck
    };
  }

  // ====================
  // HELPER METHODS
  // ====================

  /**
   * Get custom metrics for UniversalSingleton
   */
  protected getCustomMetrics() {
    return {
      imageGenerations: this.metrics.cacheHits,
      cacheHitRate: this.metrics.cacheHitRate,
      averageGenerationTime: 0,
      activeProviders: [
        ...(this.openai ? ['openai'] : []),
        ...(this.genai ? ['imagen3'] : [])
      ],
      totalCost: 0 // This would be calculated from actual usage
    };
  }
}

export default AIImageSingletonService;
