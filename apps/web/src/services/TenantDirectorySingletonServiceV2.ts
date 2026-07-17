/**
 * Tenant Directory Singleton Service V2 - Migrated to FlexibleApiSingletonV2
 * 
 * Provides cached tenant directory operations with delegation pattern
 * Uses the new clean architecture for consistent execution
 */

import { FlexibleApiSingletonV2, RequestType, RequestTarget } from '@/providers/base/FlexibleApiSingletonV2';
import { clientLogger } from '@/lib/client-logger';

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

/**
 * Tenant Directory Singleton Service V2
 * 
 * Migrated to use FlexibleApiSingletonV2 with delegation pattern
 * Maintains all existing functionality while using clean architecture
 */
class TenantDirectorySingletonServiceV2 extends FlexibleApiSingletonV2 {
  private static instance: TenantDirectorySingletonServiceV2;

  // Define defaults for this service
  protected defaultRequestType = RequestType.PUBLIC;
  protected defaultRequestTarget = RequestTarget.API;

  protected constructor() {
    super('tenant-directory-singleton-v2', {
      ttl: 10 * 60 * 1000 // 10 minutes for tenant data (longer than regular API)
    });
  }

  public static getInstance(): TenantDirectorySingletonServiceV2 {
    if (!TenantDirectorySingletonServiceV2.instance) {
      TenantDirectorySingletonServiceV2.instance = new TenantDirectorySingletonServiceV2();
    }
    return TenantDirectorySingletonServiceV2.instance;
  }

  /**
   * Get tenant slug with caching
   * Delegates to TenantDirectorySingletonService for a single canonical implementation.
   */
  async getTenantSlug(tenantId: string): Promise<string | undefined> {
    const { tenantDirectoryService } = await import('./TenantDirectorySingletonService');
    return tenantDirectoryService.getTenantSlug(tenantId);
  }

  /**
   * Get tenant directory listing
   * Uses delegation pattern for directory operations
   */
  async getTenantDirectoryListing(tenantId: string): Promise<TenantDirectoryListing | null> {
    if (!tenantId) {
      clientLogger.error('[TenantDirectorySingletonV2] getTenantDirectoryListing: tenantId is required');
      return null;
    }

    try {
      // Using makeDefaultRequest with delegation pattern
      const result = await this.makeDefaultRequest<TenantDirectoryListing>(
        `/api/directory/tenant/${tenantId}/listing`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        },
        `tenant-directory-${tenantId}`,
        this.cacheTTL,
        { requestTarget: RequestTarget.API }
      );
      
      if (!result.success){
        clientLogger.error('[TenantDirectorySingletonV2] Failed to get tenant directory listing:', { detail: result.error });
        return null;
      }

      return result.data || null;
    } catch (error) {
      clientLogger.error('[TenantDirectorySingletonV2] Failed to get tenant directory listing:', { detail: error });
      return null;
    }
  }

  /**
   * Search tenant directory
   * Uses delegation pattern for search operations
   */
  async searchTenantDirectory(query: string, filters?: {
    city?: string;
    state?: string;
    category?: string;
    isVerified?: boolean;
    isFeatured?: boolean;
  }): Promise<TenantDirectoryListing[]> {
    try {
      // Build query parameters
      const params = new URLSearchParams();
      if (query) params.append('q', query);
      if (filters?.city) params.append('city', filters.city);
      if (filters?.state) params.append('state', filters.state);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.isVerified !== undefined) params.append('isVerified', filters.isVerified.toString());
      if (filters?.isFeatured !== undefined) params.append('isFeatured', filters.isFeatured.toString());

      const url = `/api/directory/search${params.toString() ? '?' + params.toString() : ''}`;
      
      // Using makeDefaultRequest with delegation pattern
      const result = await this.makeDefaultRequest<TenantDirectoryListing[]>(
        url,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        },
        `directory-search-${JSON.stringify({ query, filters })}`,
        this.cacheTTL,
        { requestTarget: RequestTarget.API }
      );
      
      if (!result.success){
        clientLogger.error('[TenantDirectorySingletonV2] Failed to search tenant directory:', { detail: result.error });
        return [];
      }

      return result.data || [];
    } catch (error) {
      clientLogger.error('[TenantDirectorySingletonV2] Failed to search tenant directory:', { detail: error });
      return [];
    }
  }

  /**
   * Get featured tenants
   * Uses delegation pattern for featured listings
   */
  async getFeaturedTenants(limit: number = 10): Promise<TenantDirectoryListing[]> {
    try {
      // Using makeDefaultRequest with delegation pattern
      const result = await this.makeDefaultRequest<TenantDirectoryListing[]>(
        `/api/directory/featured?limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        },
        `featured-tenants-${limit}`,
        this.cacheTTL,
        { requestTarget: RequestTarget.API }
      );
      
      if (!result.success){
        clientLogger.error('[TenantDirectorySingletonV2] Failed to get featured tenants:', { detail: result.error });
        return [];
      }

      return result.data || [];
    } catch (error) {
      clientLogger.error('[TenantDirectorySingletonV2] Failed to get featured tenants:', { detail: error });
      return [];
    }
  }

  /**
   * Test hook customization for directory requests
   * Demonstrates how to customize request behavior in V2
   */
  protected async onPublicRequest<T>(
    url: string,
    options: any,
    cacheKey?: string,
    ttl?: number
  ): Promise<any> {
    console.log(`[TenantDirectorySingletonV2] Customizing public request for: ${url}`);
    
    // Add custom headers for directory requests
    return {
      ...options,
      headers: {
        ...options.headers,
        'X-Directory-Version': 'v2',
        'X-Request-Timestamp': Date.now().toString(),
        'X-Service': 'TenantDirectorySingletonServiceV2'
      }
    };
  }
}

// Export singleton instance
export const tenantDirectoryServiceV2 = TenantDirectorySingletonServiceV2.getInstance();

// Also export the class for testing
export { TenantDirectorySingletonServiceV2 };
