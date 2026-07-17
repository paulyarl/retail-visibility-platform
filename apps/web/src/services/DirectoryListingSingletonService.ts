/**
 * Public Directory Listing Service
 * 
 * Extends PublicApiSingleton to provide cached public directory listing operations
 * Uses the platform's singleton architecture for automatic caching
 * For public access to directory listings only (no tenant management)
 */

import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { AppContext, CacheIsolation } from '@/utils/contextCacheManager';
import { clientLogger } from '@/lib/client-logger';

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

    protected defaultContext: AppContext = AppContext.DIRECTORY;
    protected defaultIsolation: CacheIsolation = CacheIsolation.DIRECTORY;
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
   * Get public directory listing by listing ID
   */
  async getPublicDirectoryListing(listingId: string): Promise<DirectoryListing | null> {
    if (!listingId) {
      throw new Error('Listing ID is required');
    }

    const result = await this.makeDefaultRequest<DirectoryListing>(
      `/api/directory/${listingId}`,
      {},
      `directory-listing-${listingId}`
    );

    if (!result.success) {
      clientLogger.error('[DirectoryListing] Failed to get public directory listing:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Get public directory listing by tenant ID or slug
   */
  async getDirectoryListingByIdentifier(identifier: string): Promise<DirectoryListing | null> {
    if (!identifier) {
      throw new Error('Identifier (tenant ID or slug) is required');
    }

    const result = await this.makeDefaultRequest<DirectoryListing>(
      `/api/shops/${identifier}`,
      {},
      `directory-resolve-${identifier}`
    );

    if (!result.success) {
      clientLogger.error('[DirectoryListing] Failed to resolve directory listing:', { detail: result.error });
      return null;
    }

    return result.data || null;
  }

  /**
   * Get photos for a public directory listing
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
      clientLogger.error('[DirectoryListing] Failed to get directory photos:', { detail: result.error });
      return [];
    }

    return Array.isArray(result.data) ? result.data : [];
  }

  /**
   * Invalidate directory listing cache for a specific listing
   */
  public async invalidateDirectoryListingCache(listingId: string): Promise<void> {
    await this.invalidateCache(`directory-listing-${listingId}*`);
  }

  /**
   * Invalidate all directory listing cache
   */
  public async invalidateAllDirectoryListingCache(): Promise<void> {
    await this.invalidateCache('directory-listing-*');
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
