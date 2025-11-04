import { createClient } from "@supabase/supabase-js";
import { prisma } from "../prisma";
import { StorageBuckets } from "../storage-config";

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
   * Download and store product image from external URL
   * Uses existing Supabase storage infrastructure
   */
  async downloadAndStoreImage(
    imageUrl: string,
    tenantId: string,
    itemId: string,
    sku: string
  ): Promise<ImageDownloadResult | null> {
    if (!supabase) {
      console.warn('[ImageEnrichment] Supabase not configured');
      return null;
    }

    try {
      // Download image from external URL
      const response = await fetch(imageUrl, {
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        console.warn(`[ImageEnrichment] Failed to download image: ${response.status}`);
        return null;
      }

      const contentType = response.headers.get('content-type') || 'image/jpeg';
      const buffer = Buffer.from(await response.arrayBuffer());
      const bytes = buffer.length;

      // Validate it's an image
      if (!contentType.startsWith('image/')) {
        console.warn(`[ImageEnrichment] Invalid content type: ${contentType}`);
        return null;
      }

      // Generate storage path
      const ext = this.getExtensionFromContentType(contentType);
      const filename = `${Date.now()}.${ext}`;
      const path = `${tenantId}/${sku || itemId}/${filename}`;

      // Upload to Supabase Storage
      const { error, data } = await supabase.storage
        .from(StorageBuckets.PHOTOS.name)
        .upload(path, buffer, {
          cacheControl: "3600",
          contentType,
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
        bytes,
        contentType,
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
    itemId: string,
    imageData: ImageDownloadResult,
    position: number = 0,
    alt?: string
  ): Promise<void> {
    try {
      await prisma.photoAsset.create({
        data: {
          tenantId,
          inventoryItemId: itemId,
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
        await prisma.inventoryItem.update({
          where: { id: itemId },
          data: { imageUrl: imageData.url },
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
   */
  async processProductImages(
    tenantId: string,
    itemId: string,
    sku: string,
    imageUrls: string[],
    productName?: string
  ): Promise<number> {
    if (!imageUrls || imageUrls.length === 0) {
      return 0;
    }

    // Limit to 11 images (Google Merchant Center max)
    const urlsToProcess = imageUrls.slice(0, 11);
    let successCount = 0;

    for (let i = 0; i < urlsToProcess.length; i++) {
      const imageUrl = urlsToProcess[i];
      
      try {
        // Download and store image
        const imageData = await this.downloadAndStoreImage(
          imageUrl,
          tenantId,
          itemId,
          sku
        );

        if (!imageData) {
          console.warn(`[ImageEnrichment] Failed to process image ${i + 1}/${urlsToProcess.length}`);
          continue;
        }

        // Create PhotoAsset record
        const alt = i === 0 ? productName : `${productName} - Image ${i + 1}`;
        await this.createPhotoAsset(tenantId, itemId, imageData, i, alt);
        
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
    if (enrichment.imageUrl) {
      urls.push(enrichment.imageUrl);
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
    return [...new Set(urls)].filter(url => 
      url && typeof url === 'string' && url.startsWith('http')
    );
  }
}

// Singleton instance
export const imageEnrichmentService = new ImageEnrichmentService();
