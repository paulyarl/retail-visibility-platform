/**
 * Directory Listing Singleton Service
 * 
 * Extends PublicApiSingleton to provide cached directory listing operations
 * Uses the platform's singleton architecture for automatic caching
 * Supports both public directory access and authenticated management operations
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';

export interface DirectoryListing {
  id: string;
  tenantId: string;
  isPublished: boolean;
  seoDescription?: string;
  seoKeywords?: string[];
  primaryCategory?: string;
  secondaryCategories?: string[];
  isFeatured: boolean;
  featuredUntil?: string;
  slug?: string;
  createdAt: string;
  updatedAt: string;
  businessProfile?: {
    businessName: string;
    city?: string;
    state?: string;
    logoUrl?: string;
  };
}

export class DirectoryListingSingletonService extends PublicApiSingleton {
  private static instance: DirectoryListingSingletonService;

  private constructor() {
    super('directory-listing-singleton');
    this.cacheTTL = 10 * 60 * 1000; // 10 minutes for directory listing data (changes infrequently)
  }

  public static getInstance(): DirectoryListingSingletonService {
    if (!DirectoryListingSingletonService.instance) {
      DirectoryListingSingletonService.instance = new DirectoryListingSingletonService();
    }
    return DirectoryListingSingletonService.instance;
  }

  /**
   * Get directory listing for a specific tenant
   */
  async getDirectoryListing(tenantId: string): Promise<DirectoryListing | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<DirectoryListing>(
      `/api/tenants/${tenantId}/directory/listing`,
      {},
      `directory-listing-${tenantId}`
    );

    if (!result.success) {
      console.error('[DirectoryListingSingleton] Failed to get directory listing:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Publish directory listing
   */
  async publishDirectoryListing(tenantId: string): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.makeDefaultRequest<void>(
        `/api/tenants/${tenantId}/directory/listing/publish`,
        { method: 'POST' },
        `directory-publish-${tenantId}`
      );

      // Invalidate directory listing cache
      await this.invalidateCache(`directory-listing-${tenantId}*`);
    } catch (error) {
      console.error('[DirectoryListingSingleton] Failed to publish directory listing:', error);
      throw error;
    }
  }

  /**
   * Unpublish directory listing
   */
  async unpublishDirectoryListing(tenantId: string): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.makeDefaultRequest<void>(
        `/api/tenants/${tenantId}/directory/listing/unpublish`,
        { method: 'POST' },
        `directory-unpublish-${tenantId}`
      );

      // Invalidate directory listing cache
      await this.invalidateCache(`directory-listing-${tenantId}*`);
    } catch (error) {
      console.error('[DirectoryListingSingleton] Failed to unpublish directory listing:', error);
      throw error;
    }
  }

  /**
   * Update directory listing settings
   */
  async updateDirectoryListing(tenantId: string, updates: Partial<DirectoryListing>): Promise<DirectoryListing | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<DirectoryListing>(
      `/api/tenants/${tenantId}/directory/listing`,
      { 
        method: 'PUT',
        body: JSON.stringify(updates)
      },
      `directory-update-${tenantId}`
    );

    if (!result.success) {
      console.error('[DirectoryListingSingleton] Failed to update directory listing:', result.error);
      throw result.error;
    }

    // Invalidate directory listing cache
    await this.invalidateCache(`directory-listing-${tenantId}*`);

    return result.data || null;
  }

  /**
   * Invalidate directory listing cache for a specific tenant
   */
  public async invalidateDirectoryListingCache(tenantId: string): Promise<void> {
    await this.invalidateCache(`directory-listing-${tenantId}*`);
  }

  /**
   * Invalidate all directory listing cache
   */
  public async invalidateAllDirectoryListingCache(): Promise<void> {
    await this.invalidateCache('directory-listing-*');
  }

  /**
   * Get directory photos for a listing
   * Uses the /api/directory/:listingId/photos endpoint
   */
  async getDirectoryPhotos(listingId: string): Promise<any[]> {
    try {
      if (!listingId) {
        throw new Error('Listing ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/directory/${listingId}/photos`,
        {},
        `directory-photos-${listingId}`,
        this.cacheTTL
      );

      console.log('[DirectoryListing] Raw photos API response:', result);

      // Handle legitimate API responses (should not be 404 for missing records)
      if (!result || result.error) {
        console.warn('[DirectoryListing] No directory photos found for listing:', listingId, result?.error || 'No data');
        return []; // Return empty array for missing records
      }

      // Ensure we have an array - extract from the API response structure
      const photosArray = Array.isArray(result?.data) ? result.data : [];
      console.log('[DirectoryListing] Extracted photos array:', photosArray);

      return photosArray;
    } catch (error) {
      console.error('[DirectoryListing] Failed to get directory photos:', error);
      return []; // Always return empty array on error to prevent user-facing issues
    }
  }

  /**
   * Upload photo to directory listing
   * Uses the /api/directory/:listingId/photos endpoint
   */
  async uploadDirectoryPhoto(listingId: string, photoData: {
    tenantId: string;
    dataUrl: string;
    contentType: string;
  }): Promise<any> {
    try {
      if (!listingId) {
        throw new Error('Listing ID is required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/directory/${listingId}/photos`,
        {
          method: 'POST',
          body: JSON.stringify(photoData)
        },
        `directory-upload-photo-${listingId}`
      );

      return result;
    } catch (error) {
      console.error('[DirectoryListing] Failed to upload directory photo:', error);
      return null;
    }
  }

  /**
   * Update directory photo
   * Uses the /api/directory/:listingId/photos/:photoId endpoint
   */
  async updateDirectoryPhoto(listingId: string, photoId: string, photoData: {
    position?: number;
    alt?: string | null;
    caption?: string | null;
  }): Promise<any> {
    try {
      if (!listingId || !photoId) {
        throw new Error('Listing ID and Photo ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/directory/${listingId}/photos/${photoId}`,
        {
          method: 'PUT',
          body: JSON.stringify(photoData)
        },
        `directory-update-photo-${listingId}-${photoId}`
      );

      return result;
    } catch (error) {
      console.error('[DirectoryListing] Failed to update directory photo:', error);
      return null;
    }
  }

  /**
   * Delete directory photo
   * Uses the /api/directory/:listingId/photos/:photoId endpoint
   */
  async deleteDirectoryPhoto(listingId: string, photoId: string): Promise<any> {
    try {
      if (!listingId || !photoId) {
        throw new Error('Listing ID and Photo ID are required');
      }

      const result = await this.makeDefaultRequest<any>(
        `/api/directory/${listingId}/photos/${photoId}`,
        {
          method: 'DELETE'
        },
        `directory-delete-photo-${listingId}-${photoId}`
      );

      return result;
    } catch (error) {
      console.error('[DirectoryListing] Failed to delete directory photo:', error);
      return null;
    }
  }
}

// Export singleton instance
export const directoryListingService = DirectoryListingSingletonService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateDirectoryListingCache = async (tenantId: string): Promise<void> => {
  const service = DirectoryListingSingletonService.getInstance();
  await service.invalidateDirectoryListingCache(tenantId);
};

export const invalidateAllDirectoryListingCache = async (): Promise<void> => {
  const service = DirectoryListingSingletonService.getInstance();
  await service.invalidateAllDirectoryListingCache();
};
