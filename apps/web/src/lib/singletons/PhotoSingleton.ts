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
  photo: Photo;
  success: boolean;
  message?: string;
}

export interface PhotoDeleteResult {
  success: boolean;
  message?: string;
}

// ====================
// PHOTO SINGLETON
// ====================

class PhotoSingleton extends UniversalSingleton {
  protected static instances: Map<string, PhotoSingleton> = new Map();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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
    const cacheKey = `item-photos-${itemId}`;
    
    try {
      // Use UniversalSingleton's makeApiRequest with automatic caching
      const data = await this.makeApiRequest<{ photos: Photo[] }>(
        `/api/items/${itemId}/photos`,
        { method: 'GET' },
        cacheKey,
        this.CACHE_TTL
      );

      console.log('[PhotoSingleton] Fetched photos for item:', itemId, data.photos?.length || 0);
      return data.photos || [];
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
    const cacheKey = `variant-photos-${variantId}`;
    
    try {
      // Use UniversalSingleton's makeApiRequest with automatic caching
      const data = await this.makeApiRequest<{ photos: Photo[] }>(
        `/api/variants/${variantId}/photos`,
        { method: 'GET' },
        cacheKey,
        this.CACHE_TTL
      );

      console.log('[PhotoSingleton] Fetched photos for variant:', variantId, data.photos?.length || 0);
      return data.photos || [];
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
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('isPrimary', isPrimary.toString());

      this.apiCalls++; // Track API call
      const data = await this.makeApiRequest<{ photo: Photo }>(
        `/api/items/${itemId}/photos`,
        {
          method: 'POST',
          body: formData,
        }
      ) as { photo: Photo };
      
      // Invalidate cache for this item using UniversalSingleton's clearCache
      await this.clearCache(`item-photos-${itemId}`);

      console.log('[PhotoSingleton] Photo uploaded successfully for item:', itemId);
      return {
        photo: data.photo,
        success: true,
        message: 'Photo uploaded successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload photo';
      console.error('[PhotoSingleton] Error uploading photo:', error);
      return {
        photo: {} as Photo,
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Delete a photo
   * Automatically invalidates cache after successful deletion
   */
  async deletePhoto(photoId: string, itemId: string): Promise<PhotoDeleteResult> {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      this.apiCalls++; // Track API call
      await this.makeApiRequest(
        `/api/photos/${photoId}`,
        { method: 'DELETE' }
      );

      // Invalidate cache for this item using UniversalSingleton's clearCache
      await this.clearCache(`item-photos-${itemId}`);

      console.log('[PhotoSingleton] Photo deleted successfully:', photoId);
      return {
        success: true,
        message: 'Photo deleted successfully',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete photo';
      console.error('[PhotoSingleton] Error deleting photo:', error);
      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * Reorder photos for an item
   * Automatically invalidates cache after successful reorder
   */
  async reorderPhotos(itemId: string, photoIds: string[]): Promise<boolean> {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      this.apiCalls++; // Track API call
      await this.makeApiRequest(
        `/api/items/${itemId}/photos/reorder`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ photoIds }),
        }
      );

      // Invalidate cache for this item using UniversalSingleton's clearCache
      await this.clearCache(`item-photos-${itemId}`);

      console.log('[PhotoSingleton] Photos reordered successfully for item:', itemId);
      return true;
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
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      
      this.apiCalls++; // Track API call
      await this.makeApiRequest(
        `/api/photos/${photoId}/primary`,
        { method: 'PUT' }
      );

      // Invalidate cache for this item using UniversalSingleton's clearCache
      await this.clearCache(`item-photos-${itemId}`);

      console.log('[PhotoSingleton] Primary photo set successfully:', photoId);
      return true;
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
   * Uses UniversalSingleton's clearCache method
   */
  async invalidateItemCache(itemId: string): Promise<void> {
    await this.clearCache(`item-photos-${itemId}`);
    console.log('[PhotoSingleton] Cache invalidated for item:', itemId);
  }

  /**
   * Invalidate cache for a specific variant
   * Uses UniversalSingleton's clearCache method
   */
  async invalidateVariantCache(variantId: string): Promise<void> {
    await this.clearCache(`variant-photos-${variantId}`);
    console.log('[PhotoSingleton] Cache invalidated for variant:', variantId);
  }

  /**
   * Clear all cached photos
   * Uses UniversalSingleton's clearCache method
   */
  async clearAllCache(): Promise<void> {
    await this.clearCache();
    console.log('[PhotoSingleton] All cache cleared');
  }

  // ====================
  // METRICS
  // ====================

  /**
   * Get performance metrics
   * Uses UniversalSingleton's built-in metrics tracking
   */
  getMetrics() {
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: this.cacheHits + this.cacheMisses > 0 
        ? (this.cacheHits / (this.cacheHits + this.cacheMisses)) * 100 
        : 0,
      apiCalls: this.apiCalls,
      cacheSize: this.cache.size,
      inMemoryCacheSize: this.cache.size,
      persistentCacheSize: 0, // Managed by CacheManager
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.apiCalls = 0;
    console.log('[PhotoSingleton] Metrics reset');
  }
}

export default PhotoSingleton;
