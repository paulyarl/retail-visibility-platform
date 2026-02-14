/**
 * Photo Service - Authenticated API Pattern
 * 
 * Handles item and variant photo operations including uploads, deletions, and reordering
 * Extends AuthenticatedApiSingleton for consistent authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';

// Photo Data Interfaces
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

export interface PhotoReorderResult {
  success: boolean;
  error?: string;
  message?: string;
  updatedPhotos?: Photo[];
}

class PhotoService extends AuthenticatedApiSingleton {
  private static instance: PhotoService;

  // TTL constants for different data types
  private readonly PHOTOS_TTL = 10 * 60 * 1000; // 10 minutes for photos
  private readonly UPLOAD_TTL = 2 * 60 * 1000; // 2 minutes for upload operations

  private constructor() {
    super('photo-service');
  }

  static getInstance(): PhotoService {
    if (!PhotoService.instance) {
      PhotoService.instance = new PhotoService();
    }
    return PhotoService.instance;
  }

  /**
   * Fetch photos for a specific item
   * Uses the /api/photos/item/:itemId endpoint
   */
  async fetchItemPhotos(itemId: string): Promise<Photo[]> {
    try {
      const response = await this.makeAuthenticatedRequest<{ photos: Photo[] }>(
        `/photos/item/${itemId}`,
        {},
        `item-photos-${itemId}`,
        this.PHOTOS_TTL
      );

      return response?.photos || [];
    } catch (error) {
      console.error('[PhotoService] Failed to fetch item photos:', error);
      throw error;
    }
  }

  /**
   * Fetch photos for a specific variant
   * Uses the /api/photos/variant/:variantId endpoint
   */
  async fetchVariantPhotos(variantId: string): Promise<Photo[]> {
    try {
      const response = await this.makeAuthenticatedRequest<{ photos: Photo[] }>(
        `/photos/variant/${variantId}`,
        {},
        `variant-photos-${variantId}`,
        this.PHOTOS_TTL
      );

      return response?.photos || [];
    } catch (error) {
      console.error('[PhotoService] Failed to fetch variant photos:', error);
      throw error;
    }
  }

  /**
   * Upload a photo for an item
   * Uses the /api/photos/upload/item/:itemId endpoint
   */
  async uploadItemPhoto(itemId: string, file: File, isPrimary: boolean = false): Promise<PhotoUploadResult> {
    try {
      // For file uploads, we need to use FormData and a different approach
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('isPrimary', isPrimary.toString());

      const response = await this.makeAuthenticatedRequest<PhotoUploadResult>(
        `/photos/upload/item/${itemId}`,
        {
          method: 'POST',
          body: formData,
          // Don't set Content-Type header for FormData - browser sets it automatically with boundary
        },
        `upload-item-${itemId}`,
        this.UPLOAD_TTL
      );

      // Invalidate item photos cache after successful upload
      if (response?.success) {
        await this.invalidateCache(`item-photos-${itemId}`);
      }

      return response || { success: false, error: 'Upload failed' };
    } catch (error) {
      console.error('[PhotoService] Failed to upload item photo:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  /**
   * Upload a photo for a variant
   * Uses the /api/photos/upload/variant/:variantId endpoint
   */
  async uploadVariantPhoto(variantId: string, file: File, isPrimary: boolean = false): Promise<PhotoUploadResult> {
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('isPrimary', isPrimary.toString());

      const response = await this.makeAuthenticatedRequest<PhotoUploadResult>(
        `/photos/upload/variant/${variantId}`,
        {
          method: 'POST',
          body: formData,
        },
        `upload-variant-${variantId}`,
        this.UPLOAD_TTL
      );

      // Invalidate variant photos cache after successful upload
      if (response?.success) {
        await this.invalidateCache(`variant-photos-${variantId}`);
      }

      return response || { success: false, error: 'Upload failed' };
    } catch (error) {
      console.error('[PhotoService] Failed to upload variant photo:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
    }
  }

  /**
   * Delete a photo
   * Uses the /api/photos/:photoId endpoint
   */
  async deletePhoto(photoId: string, itemId: string): Promise<PhotoDeleteResult> {
    try {
      const response = await this.makeAuthenticatedRequest<PhotoDeleteResult>(
        `/photos/${photoId}`,
        {
          method: 'DELETE',
        },
        `delete-photo-${photoId}`,
        this.UPLOAD_TTL
      );

      // Invalidate item photos cache after successful deletion
      if (response?.success) {
        await this.invalidateCache(`item-photos-${itemId}`);
      }

      return response || { success: false, error: 'Delete failed' };
    } catch (error) {
      console.error('[PhotoService] Failed to delete photo:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Delete failed' };
    }
  }

  /**
   * Reorder photos for an item
   * Uses the /api/photos/reorder/:itemId endpoint
   */
  async reorderPhotos(itemId: string, photoIds: string[]): Promise<PhotoReorderResult> {
    try {
      const response = await this.makeAuthenticatedRequest<PhotoReorderResult>(
        `/photos/reorder/${itemId}`,
        {
          method: 'POST',
          body: JSON.stringify({ photoIds }),
        },
        `reorder-photos-${itemId}`,
        this.UPLOAD_TTL
      );

      // Invalidate item photos cache after successful reordering
      if (response?.success) {
        await this.invalidateCache(`item-photos-${itemId}`);
      }

      return response || { success: false, error: 'Reorder failed' };
    } catch (error) {
      console.error('[PhotoService] Failed to reorder photos:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Reorder failed' };
    }
  }

  /**
   * Set a photo as primary
   * Uses the /api/photos/:photoId/primary endpoint
   */
  async setPrimaryPhoto(photoId: string, itemId: string): Promise<PhotoReorderResult> {
    try {
      const response = await this.makeAuthenticatedRequest<PhotoReorderResult>(
        `/photos/${photoId}/primary`,
        {
          method: 'PATCH',
        },
        `set-primary-${photoId}`,
        this.UPLOAD_TTL
      );

      // Invalidate item photos cache after successful update
      if (response?.success) {
        await this.invalidateCache(`item-photos-${itemId}`);
      }

      return response || { success: false, error: 'Set primary failed' };
    } catch (error) {
      console.error('[PhotoService] Failed to set primary photo:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Set primary failed' };
    }
  }

  /**
   * Get photo by ID
   * Uses the /api/photos/:photoId endpoint
   */
  async getPhotoById(photoId: string): Promise<Photo | null> {
    try {
      const response = await this.makeAuthenticatedRequest<Photo>(
        `/photos/${photoId}`,
        {},
        `photo-${photoId}`,
        this.PHOTOS_TTL
      );

      return response;
    } catch (error) {
      console.error('[PhotoService] Failed to fetch photo:', error);
      return null;
    }
  }

  /**
   * Invalidate item photos cache
   */
  async invalidateItemCache(itemId: string): Promise<void> {
    await this.invalidateCache(`item-photos-${itemId}`);
  }

  /**
   * Invalidate variant photos cache
   */
  async invalidateVariantCache(variantId: string): Promise<void> {
    await this.invalidateCache(`variant-photos-${variantId}`);
  }

  /**
   * Clear all photo-related cache
   */
  async clearAllCache(): Promise<void> {
    // This would need to be implemented based on cache key patterns
    // For now, we'll clear common patterns
    const patterns = [
      'item-photos-',
      'variant-photos-',
      'photo-',
      'upload-item-',
      'upload-variant-',
      'delete-photo-',
      'reorder-photos-',
      'set-primary-'
    ];

    for (const pattern of patterns) {
      // This is a simplified approach - in practice you'd want to track cache keys
      try {
        await this.invalidateCache(pattern);
      } catch (error) {
        // Ignore cache invalidation errors
      }
    }
  }
}

// Export singleton instance
export const photoService = PhotoService.getInstance();
