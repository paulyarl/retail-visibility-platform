/**
 * AI Image Service
 * 
 * Handles AI-powered product image generation:
 * - Google Imagen 3 (primary, cheaper)
 * - OpenAI DALL-E 3 (fallback)
 * - Image processing with Sharp
 * - Upload to Supabase storage
 * - Create photo_assets records
 */

import sharp from 'sharp';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';
import { generateItemId } from '../lib/id-generator';

// Import the new Google GenAI for Imagen 3
let GoogleGenAI: any = null;
try {
  GoogleGenAI = require('@google/genai').GoogleGenAI;
} catch (e) {
  console.warn('[AIImage] @google/genai not available, Imagen 3 will be disabled');
}

export interface GeneratedImage {
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  bytes: number;
  photoAssetId: string;
}

export class AIImageService {
  private openai: any;
  private gemini: GoogleGenerativeAI | null;
  private genai: any; // For Imagen 3
  private supabase: any;
  
  // Rate limit handling for Imagen
  private readonly IMAGEN_MAX_RETRIES = 2;
  private readonly IMAGEN_RETRY_BUFFER = 5000; // 5s buffer

  constructor() {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      try {
        const OpenAI = require('openai').default;
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      } catch (error) {
        console.warn('[AIImage] Failed to initialize OpenAI:', error);
      }
    }

    // Initialize Gemini (for legacy)
    if (process.env.GOOGLE_AI_API_KEY) {
      try {
        this.gemini = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);
      } catch (error) {
        console.warn('[AIImage] Failed to initialize Gemini:', error);
        this.gemini = null;
      }
    } else {
      this.gemini = null;
    }
    
    // Initialize Google GenAI for Imagen 3
    if (process.env.GOOGLE_AI_API_KEY && GoogleGenAI) {
      try {
        this.genai = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
        console.log('[AIImage] Google Imagen 3 initialized');
      } catch (error) {
        console.warn('[AIImage] Failed to initialize Google GenAI:', error);
        this.genai = null;
      }
    } else {
      this.genai = null;
    }

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    } else {
      console.warn('[AIImage] Supabase not configured');
    }
  }

  /**
   * Generate product image with AI
   */
  async generateProductImage(
    productName: string,
    tenantId: string,
    inventoryItemId: string,
    provider: 'google' | 'openai' = 'google',
    quality: 'standard' | 'hd' = 'standard'
  ): Promise<GeneratedImage | null> {
    try {
      console.log(`[AIImage] Generating image for: ${productName}`);
      
      // Step 1: Generate image with AI
      let imageUrl: string;
      
      if (provider === 'google' && this.genai) {
        imageUrl = await this.generateWithImagen(productName, quality);
      } else if (this.openai) {
        imageUrl = await this.generateWithDALLE(productName, quality);
      } else {
        throw new Error('No image provider available');
      }
      
      // Step 2: Download image
      const imageBuffer = await this.downloadImage(imageUrl);
      
      // Step 3: Process with Sharp
      const { original, thumbnail } = await this.processImage(imageBuffer);
      
      // Step 4: Upload to Supabase
      const { originalUrl, thumbnailUrl } = await this.uploadToSupabase(
        original,
        thumbnail,
        tenantId,
        inventoryItemId
      );
      
      // Step 5: Create photo_assets record
      const photoAssetId = await this.createPhotoAsset(
        inventoryItemId,
        originalUrl,
        thumbnailUrl,
        original.width,
        original.height,
        original.bytes
      );
      
      console.log(`[AIImage] ✓ Image generated and uploaded: ${productName}`);
      
      return {
        url: originalUrl,
        thumbnailUrl,
        width: original.width,
        height: original.height,
        bytes: original.bytes,
        photoAssetId
      };
      
    } catch (error: any) {
      console.error(`[AIImage] Failed to generate image for "${productName}":`, error.message);
      
      // Try fallback provider
      if (provider === 'google' && this.openai) {
        console.log('[AIImage] Trying DALL-E fallback...');
        try {
          return await this.generateProductImage(productName, tenantId, inventoryItemId, 'openai', quality);
        } catch (fallbackError: any) {
          console.error('[AIImage] Fallback also failed:', fallbackError.message);
        }
      }
      
      return null;
    }
  }

  /**
   * Generate image with Google Imagen 3 (with rate limit retry)
   */
  private async generateWithImagen(
    productName: string, 
    quality: 'standard' | 'hd',
    retryCount: number = 0
  ): Promise<string> {
    if (!this.genai) throw new Error('Google GenAI not initialized');
    
    const prompt = `Professional product photography of ${productName}. 
White background, studio lighting, high quality, e-commerce style, 
centered composition, sharp focus, product clearly visible, 
commercial photography, clean and professional.`;
    
    console.log(`[AIImage] Generating with Imagen 3...`);
    
    try {
      const response = await this.genai.models.generateImages({
        model: 'imagen-3.0-generate-002',
        prompt: prompt,
        config: {
          numberOfImages: 1,
        },
      });
      
      // Get the first generated image
      const generatedImage = response.generatedImages?.[0];
      if (!generatedImage?.image?.imageBytes) {
        throw new Error('No image data in Imagen response');
      }
      
      // Imagen returns base64 image bytes, we need to convert to a data URL
      // that can be "downloaded" by our existing pipeline
      const base64Data = generatedImage.image.imageBytes;
      const dataUrl = `data:image/png;base64,${base64Data}`;
      
      console.log(`[AIImage] ✓ Imagen 3 generated image successfully`);
      return dataUrl;
      
    } catch (error: any) {
      // Check for rate limit error (429)
      if (error.message?.includes('429') || error.message?.includes('Too Many Requests') || error.message?.includes('quota')) {
        // Extract retry delay from error message if available, add buffer
        const retryMatch = error.message.match(/retry in ([\d.]+)s/i) || error.message.match(/retryDelay":"(\d+)s"/i);
        const baseDelay = retryMatch ? Math.ceil(parseFloat(retryMatch[1]) * 1000) : 35000; // Default 35s
        const retryDelay = baseDelay + this.IMAGEN_RETRY_BUFFER; // Add 5s buffer
        
        if (retryCount < this.IMAGEN_MAX_RETRIES) {
          console.log(`[AIImage] Imagen rate limited. Waiting ${Math.ceil(retryDelay / 1000)}s before retry ${retryCount + 1}/${this.IMAGEN_MAX_RETRIES}...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          return this.generateWithImagen(productName, quality, retryCount + 1);
        }
      }
      throw error;
    }
  }

  /**
   * Generate image with OpenAI DALL-E 3
   */
  private async generateWithDALLE(productName: string, quality: 'standard' | 'hd'): Promise<string> {
    if (!this.openai) throw new Error('OpenAI not initialized');
    
    const prompt = `Professional product photography of ${productName}. 
White background, studio lighting, high quality, e-commerce style, 
centered composition, sharp focus, product clearly visible, 
commercial photography, clean and professional.`;
    
    console.log(`[AIImage] Generating with DALL-E (${quality})...`);
    
    const response = await this.openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: "1024x1024",
      quality: quality,
      n: 1,
    });
    
    const imageUrl = response.data[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL in DALL-E response');
    }
    
    return imageUrl;
  }

  /**
   * Download image from URL or decode base64 data URL
   */
  private async downloadImage(url: string): Promise<Buffer> {
    // Handle base64 data URLs (from Imagen 3)
    if (url.startsWith('data:')) {
      console.log('[AIImage] Decoding base64 image data...');
      const base64Data = url.split(',')[1];
      if (!base64Data) {
        throw new Error('Invalid data URL format');
      }
      return Buffer.from(base64Data, 'base64');
    }
    
    // Handle regular URLs (from DALL-E)
    console.log('[AIImage] Downloading image...');
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Process image with Sharp (resize, optimize, create thumbnail)
   */
  private async processImage(buffer: Buffer): Promise<{
    original: { buffer: Buffer; width: number; height: number; bytes: number };
    thumbnail: { buffer: Buffer; width: number; height: number; bytes: number };
  }> {
    console.log('[AIImage] Processing image with Sharp...');
    
    // Original: Resize to max 1200x1200, optimize
    const originalSharp = sharp(buffer)
      .resize(1200, 1200, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85, progressive: true });
    
    const originalBuffer = await originalSharp.toBuffer();
    const originalMetadata = await sharp(originalBuffer).metadata();
    
    // Thumbnail: 300x300
    const thumbnailSharp = sharp(buffer)
      .resize(300, 300, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80, progressive: true });
    
    const thumbnailBuffer = await thumbnailSharp.toBuffer();
    const thumbnailMetadata = await sharp(thumbnailBuffer).metadata();
    
    return {
      original: {
        buffer: originalBuffer,
        width: originalMetadata.width || 1200,
        height: originalMetadata.height || 1200,
        bytes: originalBuffer.length
      },
      thumbnail: {
        buffer: thumbnailBuffer,
        width: thumbnailMetadata.width || 300,
        height: thumbnailMetadata.height || 300,
        bytes: thumbnailBuffer.length
      }
    };
  }

  /**
   * Upload images to Supabase storage
   */
  private async uploadToSupabase(
    original: { buffer: Buffer; width: number; height: number; bytes: number },
    thumbnail: { buffer: Buffer; width: number; height: number; bytes: number },
    tenantId: string,
    inventoryItemId: string
  ): Promise<{ originalUrl: string; thumbnailUrl: string }> {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }
    
    console.log('[AIImage] Uploading to Supabase...');
    
    const timestamp = Date.now();
    const originalPath = `${tenantId}/products/${inventoryItemId}/original-${timestamp}.jpg`;
    const thumbnailPath = `${tenantId}/products/${inventoryItemId}/thumb-${timestamp}.jpg`;
    
    // Upload original
    const { error: originalError } = await this.supabase.storage
      .from('photos')
      .upload(originalPath, original.buffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });
    
    if (originalError) {
      throw new Error(`Failed to upload original: ${originalError.message}`);
    }
    
    // Upload thumbnail
    const { error: thumbnailError } = await this.supabase.storage
      .from('photos')
      .upload(thumbnailPath, thumbnail.buffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
      });
    
    if (thumbnailError) {
      throw new Error(`Failed to upload thumbnail: ${thumbnailError.message}`);
    }
    
    // Get public URLs
    const { data: originalData } = this.supabase.storage
      .from('photos')
      .getPublicUrl(originalPath);
    
    const { data: thumbnailData } = this.supabase.storage
      .from('photos')
      .getPublicUrl(thumbnailPath);
    
    return {
      originalUrl: originalData.publicUrl,
      thumbnailUrl: thumbnailData.publicUrl
    };
  }

  /**
   * Create photo_assets record in database
   * Note: We store the original URL; thumbnail is generated on-demand or stored separately
   */
  private async createPhotoAsset(
    inventoryItemId: string,
    url: string,
    thumbnailUrl: string,
    width: number,
    height: number,
    bytes: number
  ): Promise<string> {
    const { prisma } = await import('../prisma');
    
    // Get tenant_id from inventory_item
    const item = await prisma.inventory_items.findUnique({
      where: { id: inventoryItemId },
      select: { tenant_id: true }
    });
    
    if (!item) {
      throw new Error(`Inventory item not found: ${inventoryItemId}`);
    }
    
    const photoAsset = await prisma.photo_assets.create({
      data: {
        id: generateItemId(),
        tenant_id: item.tenant_id,
        inventory_item_id: inventoryItemId,
        url: url,
        public_url: url, // Store as public URL
        width: width,
        height: height,
        bytes: bytes,
        content_type: 'image/jpeg',
        position: 0, // Primary image
        caption: 'AI-generated product image',
        alt: `Product image`,
      }
    });
    
    return photoAsset.id;
  }
}

// Export singleton instance
export const aiImageService = new AIImageService();
