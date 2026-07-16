/**
 * Image Fetch Service
 * 
 * Handles external image fetching with caching
 * Uses PublicApiSingleton for external resource caching
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface ImageFetchResult {
  blob: Blob;
  url: string;
  contentType: string;
  size: number;
}

class ImageFetchService extends PublicApiSingleton {
  private static instance: ImageFetchService;

  private constructor() {
    super('image-fetch-service', {
      ttl: 30 * 60 * 1000 // 30 minutes for external images (they rarely change)
    });
  }

  public static getInstance(): ImageFetchService {
    if (!ImageFetchService.instance) {
      ImageFetchService.instance = new ImageFetchService();
    }
    return ImageFetchService.instance;
  }

  /**
   * Fetch external image with caching
   * Uses direct fetch for external URLs but caches the result
   */
  async fetchExternalImage(url: string): Promise<ImageFetchResult | null> {
    if (!url) {
      clientLogger.error('[ImageFetchService] fetchExternalImage: URL is required');
      return null;
    }

    // Generate cache key from URL
    const cacheKey = `external-image-${Buffer.from(url).toString('base64').slice(0, 50)}`;

    try {
      // Check cache first
      const cached = this.cache.get(cacheKey);
      if (cached && cached.data) {
        console.log('[ImageFetchService] Returning cached image for:', url);
        return cached.data;
      }

      // Fetch external image directly
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'VisibleShelf-ImageFetch/1.0',
          'Accept': 'image/*',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const contentType = blob.type || 'image/jpeg';
      const size = blob.size;

      const result: ImageFetchResult = {
        blob,
        url,
        contentType,
        size,
      };

      // Cache the result
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
        ttl: this.cacheTTL,
      });

      console.log('[ImageFetchService] Cached external image for:', url);
      return result;
    } catch (error) {
      clientLogger.error('[ImageFetchService] Failed to fetch external image:', { detail: error });
      return null;
    }
  }

  /**
   * Convert external image to File object
   * Useful for form uploads and image processing
   */
  async fetchExternalImageAsFile(url: string, filename?: string): Promise<File | null> {
    const result = await this.fetchExternalImage(url);
    
    if (!result) {
      return null;
    }

    // Extract filename from URL or use default
    const finalFilename = filename || this.extractFilenameFromUrl(url) || 'image';
    
    return new File([result.blob], finalFilename, {
      type: result.contentType,
    });
  }

  /**
   * Extract filename from URL
   */
  private extractFilenameFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();
      
      if (filename && filename.includes('.')) {
        return filename;
      }
      
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Clear cached image
   */
  clearCachedImage(url: string): void {
    const cacheKey = `external-image-${Buffer.from(url).toString('base64').slice(0, 50)}`;
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all cached images
   */
  clearAllCachedImages(): void {
    const keys = Array.from(this.cache.keys());
    const imageKeys = keys.filter(key => key.startsWith('external-image-'));
    
    imageKeys.forEach(key => this.cache.delete(key));
    console.log(`[ImageFetchService] Cleared ${imageKeys.length} cached images`);
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { total: number; images: number; size: number } {
    const keys = Array.from(this.cache.keys());
    const imageKeys = keys.filter(key => key.startsWith('external-image-'));
    
    let totalSize = 0;
    imageKeys.forEach(key => {
      const cached = this.cache.get(key);
      if (cached?.data?.size) {
        totalSize += cached.data.size;
      }
    });

    return {
      total: keys.length,
      images: imageKeys.length,
      size: totalSize,
    };
  }
}

// Export singleton instance
export const imageFetchService = ImageFetchService.getInstance();
