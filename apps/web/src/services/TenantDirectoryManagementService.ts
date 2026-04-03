/**
 * Tenant Directory Management Service
 * 
 * Extends TenantApiSingleton to provide authenticated tenant directory listing operations
 * Uses the platform's singleton architecture for automatic caching and tenant context
 * For tenant owners to manage their own directory listings
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { RequestTarget } from '@/providers/base/FlexibleApiSingleton';
import { DirectoryListing } from './DirectoryListingSingletonService';

export class TenantDirectoryManagementService extends TenantApiSingleton {
  private static instance: TenantDirectoryManagementService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-directory-management*',
      'directory-listings*',
      'directory-operations*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('tenant-directory-management*');
    await this.invalidateCachePattern('directory-listings*');
    await this.invalidateCachePattern('directory-operations*');
  }

  private constructor() {
    super('tenant-directory-management');
    this.cacheTTL = 10 * 60 * 1000; // 10 minutes for directory listing data
  }

  public static getInstance(): TenantDirectoryManagementService {
    if (!TenantDirectoryManagementService.instance) {
      TenantDirectoryManagementService.instance = new TenantDirectoryManagementService();
    }
    return TenantDirectoryManagementService.instance;
  }

  /**
   * Get directory listing for the current tenant
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
      console.error('[TenantDirectoryManagement] Failed to get directory listing:', result.error);
      return null;
    }

    return result.data || null;
  }

  /**
   * Create or update directory listing for the current tenant
   */
  async updateDirectoryListing(tenantId: string, listingData: any): Promise<DirectoryListing | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/tenants/${tenantId}/directory/listing`,
      { 
        method: 'PATCH',
        body: JSON.stringify(listingData)
      },
      `directory-update-${tenantId}`
    );

    if (!result.success) {
      console.error('[TenantDirectoryManagement] Failed to update directory listing:', result.error);
      return null;
    }

    // Transform snake_case to camelCase for frontend
    const transformed = result.data ? {
      id: result.data.id,
      tenantId: result.data.tenant_id,
      isPublished: result.data.is_published,
      seoDescription: result.data.seo_description,
      seoKeywords: result.data.seo_keywords,
      primaryCategory: result.data.primary_category,
      secondaryCategories: result.data.secondary_categories,
      slug: result.data.slug,
      createdAt: result.data.created_at,
      updatedAt: result.data.updated_at,
      isFeatured: result.data.is_featured,
      featuredUntil: result.data.featured_until,
    } : null;

    // Invalidate directory listing cache
    await this.invalidateCache(`directory-listing-${tenantId}`);

    return transformed;
  }

  /**
   * Publish directory listing for the current tenant
   */
  async publishDirectoryListing(tenantId: string): Promise<{ success: boolean; error?: string }> {
    if (!tenantId) {
      return { success: false, error: 'Tenant ID is required' };
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/tenants/${tenantId}/directory/publish`,
      { method: 'POST' },
      `directory-publish-${tenantId}`
    );

    if (!result.success) {
      let errorMessage = 'Failed to publish directory listing';
      
      if (typeof result.error === 'string') {
        errorMessage = result.error;
      } else if (result.error && typeof result.error === 'object' && 'message' in result.error) {
        errorMessage = (result.error as { message: string }).message;
      }
      
      // Return error instead of throwing to treat as validation, not system error
      return { success: false, error: errorMessage };
    }

    // Invalidate directory listing cache
    await this.invalidateCache(`directory-listing-${tenantId}`);

    return { success: true };
  }

  /**
   * Unpublish directory listing for the current tenant
   */
  async unpublishDirectoryListing(tenantId: string): Promise<boolean> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const result = await this.makeDefaultRequest<void>(
      `/api/tenants/${tenantId}/directory/listing/unpublish`,
      { method: 'POST' },
      `directory-unpublish-${tenantId}`
    );

    if (!result.success) {
      console.error('[TenantDirectoryManagement] Failed to unpublish directory listing:', result.error);
      return false;
    }

    // Invalidate directory listing cache
    await this.invalidateCache(`directory-listing-${tenantId}`);

    return true;
  }

  /**
   * Get photos for tenant directory listing
   */
  async getDirectoryListingPhotos(listingId: string): Promise<any[]> {
    if (!listingId) {
      throw new Error('Listing ID is required');
    }

    const result = await this.makeDefaultRequest<any>(
      `/api/directory/${listingId}/photos`,
      {},
      `directory-photos-${listingId}`,
      this.cacheTTL
    );

    if (!result.success) {
      console.log('[TenantDirectoryManagement] Failed to get directory photos:', result.error);
      return [];
    }
    
    return Array.isArray(result.data) ? result.data : [];
  }

  /**
   * Upload photo to directory listing
   */
  async uploadListingPhoto(listingId: string, photoData: { dataUrl: string; contentType?: string }): Promise<any> {
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
    if (!result.success) {
      console.error('[TenantDirectoryManagement] Failed to upload directory photo:', result.error);
      return null;
    }

    // Invalidate photos cache after successful upload
    await this.invalidateCache(`directory-photos-${listingId}`);

    return result.data;
  }

  /**
   * Update photo in directory listing
   */
  async updateListingPhoto(listingId: string, photoId: string, photoData: any): Promise<any> {
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
    if (!result.success) {
      console.error('[TenantDirectoryManagement] Failed to update directory photo:', result.error);
      return null;
    }

    return result.data;
  }

  /**
   * Delete photo from directory listing
   */
  async deleteListingPhoto(listingId: string, photoId: string): Promise<any> {
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
    
    // DELETE returns 204 No Content, so we handle it specially
    if (result.success || (result.status === 204)) {
      // Invalidate photos cache after successful delete
      await this.invalidateCache(`directory-photos-${listingId}`);
      return true;
    }
    
    console.error('[TenantDirectoryManagement] Failed to delete directory photo:', result.error);
    return null;
  }
}

// Export singleton instance
export const tenantDirectoryManagementService = TenantDirectoryManagementService.getInstance();
