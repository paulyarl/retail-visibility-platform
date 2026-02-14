/**
 * Photo Singleton Service
 * 
 * Manages item and variant photo operations with automatic caching.
 * Extends UniversalSingleton for built-in caching, TTL, and metrics.
 * 
 * Features:
 * - Fetch item photos with 10-minute cache
 * - Upload photos
 * - Delete photos
 * - Reorder photos
 * - Support for both item and variant photos
 * - Automatic cache invalidation on mutations
 */

import { UniversalSingleton } from '@/providers/base/UniversalSingleton';
import { photoService } from '@/services/PhotoService';

// ====================
// TYPES
// ====================

export interface Photo {
  id: string;
  itemId: string;
  variantId?: string | null;
  url: string;
  thumbnailUrl?: string;
  displayOrder: number;
  position: number;
  isPrimary: boolean;
  altText?: string;
  alt?: string | null;
  caption?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoUploadResult {
  success: boolean;
  photo?: Photo;
  error?: string;
  message?: string;
}

export interface PhotoDeleteResult {
  success: boolean;
  error?: string;
  message?: string;
}

// ====================
// PHOTO SINGLETON
// ====================

class PhotoSingleton extends UniversalSingleton {
  protected static instances: Map<string, PhotoSingleton> = new Map();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private lastUpdated: number = Date.now();

  private constructor(tenantId: string) {
    super(`photo-singleton-${tenantId}`);
    this.cacheTTL = this.CACHE_TTL;
  }

  static getInstance(tenantId: string): PhotoSingleton {
    if (!this.instances.has(tenantId)) {
      this.instances.set(tenantId, new PhotoSingleton(tenantId));
    }
    return this.instances.get(tenantId)!;
  }

  static destroyInstance(tenantId: string): void {
    this.instances.delete(tenantId);
  }

  // ====================
  // FETCH METHODS
  // ====================

  /**
   * Fetch photos for a specific item
   * Uses UniversalSingleton's built-in caching with automatic TTL
   */
  async fetchItemPhotos(itemId: string): Promise<Photo[]> {
    try {
      return await photoService.fetchItemPhotos(itemId);
    } catch (error) {
      console.error('[PhotoSingleton] Error fetching item photos:', error);
      throw error;
    }
  }

  /**
   * Fetch photos for a specific variant
   * Uses UniversalSingleton's built-in caching with automatic TTL
   */
  async fetchVariantPhotos(variantId: string): Promise<Photo[]> {
    try {
      return await photoService.fetchVariantPhotos(variantId);
    } catch (error) {
      console.error('[PhotoSingleton] Error fetching variant photos:', error);
      throw error;
    }
  }

  // ====================
  // MUTATION METHODS
  // ====================

  /**
   * Upload a photo for an item
   * Automatically invalidates cache after successful upload
   */
  async uploadItemPhoto(itemId: string, file: File, isPrimary: boolean = false): Promise<PhotoUploadResult> {
    try {
      const result = await photoService.uploadItemPhoto(itemId, file, isPrimary);
      
      console.log('[PhotoSingleton] Photo uploaded successfully for item:', itemId);
      return result;
    } catch (error) {
      console.error('[PhotoSingleton] Error uploading item photo:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed',
      };
    }
  }

  /**
   * Delete a photo
   * Automatically invalidates cache after successful deletion
   */
  async deletePhoto(photoId: string, itemId: string): Promise<PhotoDeleteResult> {
    try {
      const result = await photoService.deletePhoto(photoId, itemId);
      
      console.log('[PhotoSingleton] Photo deleted successfully:', photoId);
      return result;
    } catch (error) {
      console.error('[PhotoSingleton] Error deleting photo:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete failed',
      };
    }
  }

  /**
   * Reorder photos for an item
   * Automatically invalidates cache after successful reorder
   */
  async reorderPhotos(itemId: string, photoIds: string[]): Promise<boolean> {
    try {
      const result = await photoService.reorderPhotos(itemId, photoIds);
      
      console.log('[PhotoSingleton] Photos reordered successfully for item:', itemId);
      return result.success;
    } catch (error) {
      console.error('[PhotoSingleton] Error reordering photos:', error);
      return false;
    }
  }

  /**
   * Set a photo as primary
   * Automatically invalidates cache after successful update
   */
  async setPrimaryPhoto(photoId: string, itemId: string): Promise<boolean> {
    try {
      const result = await photoService.setPrimaryPhoto(photoId, itemId);
      
      console.log('[PhotoSingleton] Primary photo set successfully:', photoId);
      return result.success;
    } catch (error) {
      console.error('[PhotoSingleton] Error setting primary photo:', error);
      return false;
    }
  }

  // ====================
  // CACHE MANAGEMENT
  // ====================

  /**
   * Invalidate cache for a specific item
   */
  async invalidateItemCache(itemId: string): Promise<void> {
    try {
      await photoService.invalidateItemCache(itemId);
      console.log('[PhotoSingleton] Cache invalidated for item:', itemId);
    } catch (error) {
      console.error('[PhotoSingleton] Error invalidating item cache:', error);
    }
  }

  /**
   * Invalidate cache for a specific variant
   */
  async invalidateVariantCache(variantId: string): Promise<void> {
    try {
      await photoService.invalidateVariantCache(variantId);
      console.log('[PhotoSingleton] Cache invalidated for variant:', variantId);
    } catch (error) {
      console.error('[PhotoSingleton] Error invalidating variant cache:', error);
    }
  }

  /**
   * Clear all photo cache
   */
  async clearAllCache(): Promise<void> {
    try {
      await photoService.clearAllCache();
      console.log('[PhotoSingleton] All photo cache cleared');
    } catch (error) {
      console.error('[PhotoSingleton] Error clearing all cache:', error);
    }
  }

  // ====================
  // METRICS
  // ====================

  /**
   * Get performance metrics
   */
  getMetrics(): any {
    return {
      apiCalls: this.apiCalls,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * Reset performance metrics
   */
  resetMetrics(): void {
    this.apiCalls = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.lastUpdated = Date.now();
    console.log('[PhotoSingleton] Metrics reset');
  }
}

export default PhotoSingleton;
