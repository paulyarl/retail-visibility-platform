/**
 * Tenant Directory Singleton Service
 * 
 * Extends UniversalSingletonClient to provide cached tenant directory operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';

export interface TenantSlugResponse {
  slug: string;
}

export interface TenantIdentifiers {
  tenantId: string;
  slug?: string;
  autoId: string;
}

export interface TenantDirectoryListing {
  id: string;
  tenantId: string;
  businessName: string;
  slug: string;
  description?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  email?: string;
  website?: string;
  logo?: string;
  coverImage?: string;
  rating?: number;
  reviewCount?: number;
  categories?: string[];
  isVerified?: boolean;
  isFeatured?: boolean;
  coordinates?: {
    lat: number;
    lng: number;
  };
  businessHours?: any;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'published';
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
}

class TenantDirectorySingletonService extends AuthenticatedApiSingleton {
  private static instance: TenantDirectorySingletonService;

  private constructor() {
    super('tenant-directory-singleton');
    this.cacheTTL = 10 * 60 * 1000; // 10 minutes for tenant data (longer than regular API)
  }

  public static getInstance(): TenantDirectorySingletonService {
    if (!TenantDirectorySingletonService.instance) {
      TenantDirectorySingletonService.instance = new TenantDirectorySingletonService();
    }
    return TenantDirectorySingletonService.instance;
  }

  /**
   * Get tenant slug with caching
   * Uses the /api/directory/tenant/:tenantId endpoint
   */
  async getTenantSlug(tenantId: string): Promise<string | undefined> {
    if (!tenantId) {
      console.error('[TenantDirectorySingleton] getTenantSlug: tenantId is required');
      return undefined;
    }

    try {
      const result = await this.makeAuthenticatedRequest<TenantSlugResponse>(
        `/api/directory/tenant/${tenantId}`,
        {},
        `tenant-slug-${tenantId}`
      );
      
      // Handle legitimate API responses (should not be 404 for missing records)
      if (!result) {
        console.warn('[TenantDirectorySingleton] No directory listing found for tenant:', tenantId, 'No data');
        return undefined;
      }
      
      // Check if response looks like an error response (has error property instead of slug)
      if (!result.data || 'error' in result.data || !result.data.slug) {
        console.warn('[TenantDirectorySingleton] No directory listing found for tenant:', tenantId, (result.data as any)?.error || 'Missing slug');
        return undefined;
      }
      
      return result.data.slug;
    } catch (error) {
      console.error('[TenantDirectorySingleton] Failed to get tenant slug:', error);
      return undefined;
    }
  }

  /**
   * Get tenant identifiers (tenantId, slug, autoId) with caching
   * Uses multiple API calls to build complete tenant identifier object
   */
  async getTenantIdentifiers(tenantId: string): Promise<TenantIdentifiers | undefined> {
    if (!tenantId) {
      console.error('[TenantDirectorySingleton] getTenantIdentifiers: tenantId is required');
      return undefined;
    }

    try {
      // Get slug from directory endpoint
      const slug = await this.getTenantSlug(tenantId);
      
      // Generate autoId deterministically (same logic as backend)
      const autoId = this.generateAutoId(tenantId);

      return {
        tenantId,
        slug,
        autoId
      };
    } catch (error) {
      console.error('[TenantDirectorySingleton] Failed to get tenant identifiers:', error);
      return undefined;
    }
  }

  /**
   * Generate deterministic autoId from tenantId
   * Matches backend logic in TenantSingletonService
   */
  private generateAutoId(tenantId: string): string {
    // Extract the numeric part from tenantId (tid-12345 -> 12345)
    const match = tenantId.match(/tid-(\d+)/);
    if (match && match[1]) {
      return match[1];
    }
    
    // Fallback: use hash of tenantId
    return this.simpleHash(tenantId);
  }

  /**
   * Simple hash function for fallback autoId generation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }

  /**
   * Get tenant directory listing
   * Authenticated endpoint for tenant directory management
   */
  async getDirectoryListing(tenantId: string): Promise<TenantDirectoryListing | null> {
    try {
      if (!tenantId) {
        console.error('[TenantDirectorySingleton] getDirectoryListing: tenantId is required');
        return null;
      }

      const result = await this.makeAuthenticatedRequest<TenantDirectoryListing>(
        `/api/tenants/${tenantId}/directory/listing`,
        {},
        `directory-listing-${tenantId}`
      );
      
      return result.data || null;
    } catch (error) {
      console.error('[TenantDirectorySingleton] Failed to get directory listing:', error);
      return null;
    }
  }

  /**
   * Create tenant directory listing
   * Authenticated endpoint for tenant directory creation
   */
  async createDirectoryListing(tenantId: string, listingData: Partial<TenantDirectoryListing>): Promise<TenantDirectoryListing | null> {
    try {
      if (!tenantId || !listingData) {
        console.error('[TenantDirectorySingleton] createDirectoryListing: tenantId and listingData are required');
        return null;
      }

      const result = await this.makeAuthenticatedRequest<TenantDirectoryListing>(
        `/api/tenants/${tenantId}/directory/listing`,
        {
          method: 'POST',
          body: JSON.stringify(listingData)
        },
        `create-directory-listing-${tenantId}`
      );

      // Invalidate cache after creation
      this.invalidateCache(`directory-listing-${tenantId}`);
      
      return result.data || null;
    } catch (error) {
      console.error('[TenantDirectorySingleton] Failed to create directory listing:', error);
      return null;
    }
  }

  /**
   * Update tenant directory listing
   * Authenticated endpoint for tenant directory updates
   */
  async updateDirectoryListing(tenantId: string, listingData: Partial<TenantDirectoryListing>): Promise<TenantDirectoryListing | null> {
    try {
      if (!tenantId || !listingData) {
        console.error('[TenantDirectorySingleton] updateDirectoryListing: tenantId and listingData are required');
        return null;
      }

      const result = await this.makeAuthenticatedRequest<TenantDirectoryListing>(
        `/api/tenants/${tenantId}/directory/listing`,
        {
          method: 'PUT',
          body: JSON.stringify(listingData)
        },
        `update-directory-listing-${tenantId}`
      );

      // Invalidate cache for this tenant's listing
      this.invalidateCache(`directory-listing-${tenantId}`);
      
      return result.data || null;
    } catch (error) {
      console.error('[TenantDirectorySingleton] Failed to update directory listing:', error);
      return null;
    }
  }

  /**
   * Patch tenant directory listing
   * Authenticated endpoint for partial updates
   */
  async patchDirectoryListing(tenantId: string, listingData: Partial<TenantDirectoryListing>): Promise<TenantDirectoryListing | null> {
    try {
      if (!tenantId || !listingData) {
        console.error('[TenantDirectorySingleton] patchDirectoryListing: tenantId and listingData are required');
        return null;
      }

      const result = await this.makeAuthenticatedRequest<TenantDirectoryListing>(
        `/api/tenants/${tenantId}/directory/listing`,
        {
          method: 'PATCH',
          body: JSON.stringify(listingData)
        },
        `patch-directory-listing-${tenantId}`
      );

      // Invalidate cache after patch
      this.invalidateCache(`directory-listing-${tenantId}`);
      
      return result.data || null;
    } catch (error) {
      console.error('[TenantDirectorySingleton] Failed to patch directory listing:', error);
      return null;
    }
  }

  /**
   * Delete tenant directory listing
   * Authenticated endpoint for tenant directory deletion
   */
  async deleteDirectoryListing(tenantId: string): Promise<boolean> {
    try {
      if (!tenantId) {
        console.error('[TenantDirectorySingleton] deleteDirectoryListing: tenantId is required');
        return false;
      }

      const result = await this.makeAuthenticatedRequest<any>(
        `/api/tenants/${tenantId}/directory/listing`,
        {
          method: 'DELETE'
        },
        `delete-directory-listing-${tenantId}`
      );

      // Invalidate cache for this tenant's listing
      this.invalidateCache(`directory-listing-${tenantId}`);
      
      return !!result;
    } catch (error) {
      console.error('[TenantDirectorySingleton] Failed to delete directory listing:', error);
      return false;
    }
  }
}

// Export singleton instance
export const tenantDirectoryService = TenantDirectorySingletonService.getInstance();
