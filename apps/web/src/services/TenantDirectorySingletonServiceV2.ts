/**
 * Tenant Directory Singleton Service V2 - Migrated to FlexibleApiSingletonV2
 * 
 * Provides cached tenant directory operations with delegation pattern
 * Uses the new clean architecture for consistent execution
 */

import { FlexibleApiSingletonV2, RequestType, RequestTarget } from '@/providers/base/FlexibleApiSingletonV2';

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
   * Uses delegation pattern: setup → execution
   */
  async getTenantSlug(tenantId: string): Promise<string | undefined> {
    if (!tenantId) {
      console.error('[TenantDirectorySingletonV2] getTenantSlug: tenantId is required');
      return undefined;
    }

    // Check if we're in a server environment where auth might not be available
    const isServer = typeof window === 'undefined';
    
    // During SSR, we should not make authenticated requests at all
    // The tenant slug will be fetched client-side
    if (isServer) {
      console.log('[TenantDirectorySingletonV2] Skipping tenant slug fetch during SSR');
      return undefined;
    }
    
    // Add retry logic for connection issues during startup
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Using makeDefaultRequest with delegation pattern
        const result = await this.makeDefaultRequest<TenantSlugResponse>(
          `/api/directory/tenant/${tenantId}`,
          {},
          `tenant-slug-${tenantId}`,
          this.cacheTTL,
          {
            requestType: RequestType.PUBLIC,
            requestTarget: RequestTarget.API
          }
        );
        
        // Handle legitimate API responses (should not be 404 for missing records)
        if (result.success && result.data) {
          return result.data.slug;
        } else {
          console.error(`[TenantDirectorySingletonV2] Failed to get tenant slug (attempt ${attempt}):`, result.error);
          if (attempt === maxRetries) {
            return undefined;
          }
        }
      } catch (error) {
        console.error(`[TenantDirectorySingletonV2] Error getting tenant slug (attempt ${attempt}):`, error);
        if (attempt === maxRetries) {
          return undefined;
        }
      }
      
      // Wait before retry
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
    
    return undefined;
  }

  /**
   * Get tenant directory listing
   * Uses delegation pattern for directory operations
   */
  async getTenantDirectoryListing(tenantId: string): Promise<TenantDirectoryListing | null> {
    if (!tenantId) {
      console.error('[TenantDirectorySingletonV2] getTenantDirectoryListing: tenantId is required');
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
        console.error('[TenantDirectorySingletonV2] Failed to get tenant directory listing:', result.error);
        return null;
      }

      return result.data || null;
    } catch (error) {
      console.error('[TenantDirectorySingletonV2] Failed to get tenant directory listing:', error);
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
        console.error('[TenantDirectorySingletonV2] Failed to search tenant directory:', result.error);
        return [];
      }

      return result.data || [];
    } catch (error) {
      console.error('[TenantDirectorySingletonV2] Failed to search tenant directory:', error);
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
        console.error('[TenantDirectorySingletonV2] Failed to get featured tenants:', result.error);
        return [];
      }

      return result.data || [];
    } catch (error) {
      console.error('[TenantDirectorySingletonV2] Failed to get featured tenants:', error);
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
