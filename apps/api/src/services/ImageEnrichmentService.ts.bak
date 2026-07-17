import { createClient } from "@supabase/supabase-js";
import { prisma } from "../prisma";
import { StorageBuckets } from "../storage-config";
import { generatePhotoId } from "../lib/id-generator";
const sharp = require("sharp");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    : null;

interface ImageDownloadResult {
  url: string;
  width?: number;
  height?: number;
  bytes?: number;
  contentType?: string;
}

export class ImageEnrichmentService {
  /**
   * Compress and optimize image buffer for better quality and smaller file size
   * Uses Sharp for image processing with appropriate settings for product photos
   */
  async compressImage(
    imageBuffer: Buffer,
    contentType: string,
    isPrimary: boolean = false
  ): Promise<{ buffer: Buffer; width?: number; height?: number; contentType: string }> {
    try {
      let sharpInstance = sharp(imageBuffer);

      // Get original dimensions
      const metadata = await sharpInstance.metadata();
      const originalWidth = metadata.width || 0;
      const originalHeight = metadata.height || 0;

      // Resize logic: primary images get higher quality, secondary images are smaller
      let targetWidth: number | null = null;
      let targetHeight: number | null = null;
      let quality = isPrimary ? 85 : 75; // Higher quality for primary images

      if (originalWidth > 1200) {
        // Resize large images down to max 1200px width while maintaining aspect ratio
        targetWidth = 1200;
        targetHeight = null; // Maintain aspect ratio
      } else if (originalWidth < 400) {
        // Don't resize small images up, just compress
        targetWidth = null;
        targetHeight = null;
      }

      // Apply resizing if needed
      if (targetWidth) {
        sharpInstance = sharpInstance.resize(targetWidth, targetHeight, {
          withoutEnlargement: true, // Don't enlarge images
          fit: 'inside', // Fit within dimensions
        });
      }

      // Compress based on format
      let outputBuffer: Buffer;
      let finalContentType = contentType;

      if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
        outputBuffer = await sharpInstance
          .jpeg({
            quality: quality,
            progressive: true,
            mozjpeg: true
          })
          .toBuffer();
        finalContentType = 'image/jpeg';
      } else if (contentType === 'image/png') {
        outputBuffer = await sharpInstance
          .png({
            quality: quality,
            progressive: true,
            compressionLevel: 6 // Good balance of size vs speed
          })
          .toBuffer();
      } else if (contentType === 'image/webp') {
        outputBuffer = await sharpInstance
          .webp({
            quality: quality,
            effort: 4 // Good balance of quality vs speed
          })
          .toBuffer();
        finalContentType = 'image/webp';
      } else {
        // For other formats, convert to JPEG
        outputBuffer = await sharpInstance
          .jpeg({
            quality: quality,
            progressive: true,
            mozjpeg: true
          })
          .toBuffer();
        finalContentType = 'image/jpeg';
      }

      // Get final dimensions
      const finalMetadata = await sharp(outputBuffer).metadata();

      console.log(`[ImageCompression] Original: ${originalWidth}x${originalHeight} (${(imageBuffer.length / 1024).toFixed(1)}KB) -> Optimized: ${finalMetadata.width}x${finalMetadata.height} (${(outputBuffer.length / 1024).toFixed(1)}KB)`);

      return {
        buffer: outputBuffer,
        width: finalMetadata.width,
        height: finalMetadata.height,
        contentType: finalContentType
      };
    } catch (error) {
      console.error('[ImageCompression] Error compressing image:', error);
      // Return original buffer if compression fails
      return {
        buffer: imageBuffer,
        contentType: contentType
      };
    }
  }
  /**
   * Download, compress, and store product image from external URL
   * Uses Sharp for image optimization and Supabase storage infrastructure
   */
  async downloadAndStoreImage(
    image_url: string,
    tenantId: string,
    item_id: string,
    sku: string,
    isPrimary: boolean = false
  ): Promise<ImageDownloadResult | null> {
    if (!supabase) {
      console.warn('[ImageEnrichment] Supabase not configured');
      return null;
    }

    try {
      // Download image from external URL
      const response = await fetch(image_url, {
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        console.warn(`[ImageEnrichment] Failed to download image: ${response.status}`);
        return null;
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const originalBuffer = Buffer.from(await response.arrayBuffer());

      // Validate it's an image
      if (!contentType.startsWith('image/')) {
        console.warn(`[ImageEnrichment] Invalid content type: ${contentType}`);
        return null;
      }

      // Compress and optimize the image
      const compressedImage = await this.compressImage(originalBuffer, contentType, isPrimary);
      
      // Generate storage path
      const ext = this.getExtensionFromContentType(compressedImage.contentType);
      const filename = `${Date.now()}.${ext}`;
      const path = `${tenantId}/${sku || item_id}/${filename}`;

      // Upload compressed image to Supabase Storage
      const { error, data } = await supabase.storage
        .from(StorageBuckets.PHOTOS.name)
        .upload(path, compressedImage.buffer, {
          cacheControl: "3600",
          contentType: compressedImage.contentType,
          upsert: false,
        });

      if (error) {
        console.error('[ImageEnrichment] Upload error:', error);
        return null;
      }

      // Get public URL
      const pub = supabase.storage
        .from(StorageBuckets.PHOTOS.name)
        .getPublicUrl(data.path);

      return {
        url: pub.data.publicUrl,
        width: compressedImage.width,
        height: compressedImage.height,
        bytes: compressedImage.buffer.length,
        contentType: compressedImage.contentType,
      };
    } catch (error: any) {
      console.error('[ImageEnrichment] Error downloading/storing image:', error);
      return null;
    }
  }

  /**
   * Create PhotoAsset record for scanned product
   * Integrates with existing photo infrastructure
   */
  async createPhotoAsset(
    tenantId: string,
    item_id: string,
    imageData: ImageDownloadResult,
    position: number = 0,
    alt?: string
  ): Promise<void> {
    try {
      await prisma.photo_assets.create({
        data: {
          id:generatePhotoId(tenantId,item_id),
          tenantId:tenantId,
          inventoryItemId: item_id,
          url: imageData.url,
          width: imageData.width ?? null,
          height: imageData.height ?? null,
          contentType: imageData.contentType ?? null,
          bytes: imageData.bytes ?? null,
          exifRemoved: true,
          position,
          alt: alt ?? null,
          caption: null,
        },
      });

      // Update item's imageUrl to primary photo (position 0)
      if (position === 0) {
        await prisma.inventory_items.update({
          where: { id: item_id },
          data: { image_url: imageData.url },
        });
      }
    } catch (error: any) {
      console.error('[ImageEnrichment] Error creating PhotoAsset:', error);
      throw error;
    }
  }

  /**
   * Process multiple images for a scanned product
   * Supports up to 11 images (1 primary + 10 additional) per Google Merchant Center requirements
   * Starts positioning after existing photo assets to avoid conflicts
   */
  async processProductImages(
    tenantId: string,
    item_id: string,
    sku: string,
    imageUrls: string[],
    productName?: string
  ): Promise<number> {
    if (!imageUrls || imageUrls.length === 0) {
      return 0;
    }

    // Find the highest existing position to start from there
    const existingPositions = await prisma.photo_assets.findMany({
      where: { inventoryItemId: item_id },
      select: { position: true },
      orderBy: { position: 'desc' },
      take: 1,
    });

    const startPosition = existingPositions.length > 0 ? existingPositions[0].position + 1 : 0;

    // Limit to 11 images total (Google Merchant Center max), starting from startPosition
    const maxImages = 11 - startPosition;
    const urlsToProcess = imageUrls.slice(0, maxImages);

    if (urlsToProcess.length === 0) {
      console.log(`[ImageEnrichment] Skipping ${imageUrls.length} images - already at max capacity for item ${item_id}`);
      return 0;
    }

    let successCount = 0;

    for (let i = 0; i < urlsToProcess.length; i++) {
      const imageUrl = urlsToProcess[i];
      const position = startPosition + i;
      
      try {
        // Download and store image
        const imageData = await this.downloadAndStoreImage(
          imageUrl,
          tenantId,
          item_id,
          sku,
          position === startPosition // First image in this batch is primary if no existing images
        );

        if (!imageData) {
          console.warn(`[ImageEnrichment] Failed to process image ${i + 1}/${urlsToProcess.length}`);
          continue;
        }

        // Create PhotoAsset record
        const alt = position === 0 ? productName : `${productName} - Image ${position + 1}`;
        await this.createPhotoAsset(tenantId, item_id, imageData, position, alt);
        
        successCount++;
      } catch (error) {
        console.error(`[ImageEnrichment] Error processing image ${i + 1}:`, error);
        // Continue with next image
      }
    }

    return successCount;
  }

  /**
   * Get file extension from content type
   */
  private getExtensionFromContentType(contentType: string): string {
    const map: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'image/svg+xml': 'svg',
    };

    return map[contentType.toLowerCase()] || 'jpg';
  }

  /**
   * Extract image URLs from enrichment data
   * Handles different API response formats
   */
  extractImageUrls(enrichment: any): string[] {
    const urls: string[] = [];

    // Open Food Facts format
    if (enrichment.metadata?.images) {
      const images = enrichment.metadata.images;
      if (images.front) urls.push(images.front);
      if (images.ingredients) urls.push(images.ingredients);
      if (images.nutrition) urls.push(images.nutrition);
    }

    // Direct image URL
    if (enrichment.image_url) {
      urls.push(enrichment.image_url);
    }

    // Thumbnail URL
    if (enrichment.imageThumbnailUrl && !urls.includes(enrichment.imageThumbnailUrl)) {
      urls.push(enrichment.imageThumbnailUrl);
    }

    // UPC Database format
    if (enrichment.metadata?.image_url) {
      urls.push(enrichment.metadata.image_url);
    }

    // Remove duplicates and invalid URLs
    return Array.from(new Set(urls)).filter(url => 
      url && typeof url === 'string' && url.startsWith('http')
    );
  }
}

// Singleton instance
export const imageEnrichmentService = new ImageEnrichmentService();
