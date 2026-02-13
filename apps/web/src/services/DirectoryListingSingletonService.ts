/**
 * Directory Listing Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached directory listing operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';

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

class DirectoryListingSingletonService extends AuthenticatedApiSingleton {
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
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<DirectoryListing>(
        `/api/tenants/${tenantId}/directory/listing`,
        {},
        `directory-listing-${tenantId}`
      );

      return result || null;
    } catch (error) {
      console.error('[DirectoryListingSingleton] Failed to get directory listing:', error);
      return null;
    }
  }

  /**
   * Publish directory listing
   */
  async publishDirectoryListing(tenantId: string): Promise<void> {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      await this.makeAuthenticatedRequest<void>(
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

      await this.makeAuthenticatedRequest<void>(
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
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      const result = await this.makeAuthenticatedRequest<DirectoryListing>(
        `/api/tenants/${tenantId}/directory/listing`,
        { 
          method: 'PUT',
          body: JSON.stringify(updates)
        },
        `directory-update-${tenantId}`
      );

      // Invalidate directory listing cache
      await this.invalidateCache(`directory-listing-${tenantId}*`);

      return result || null;
    } catch (error) {
      console.error('[DirectoryListingSingleton] Failed to update directory listing:', error);
      throw error;
    }
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

      const result = await this.makeAuthenticatedRequest<any[]>(
        `/api/directory/${listingId}/photos`,
        {},
        `directory-photos-${listingId}`,
        this.cacheTTL
      );

      return result || [];
    } catch (error) {
      console.error('[DirectoryListing] Failed to get directory photos:', error);
      return [];
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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

      const result = await this.makeAuthenticatedRequest<any>(
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
