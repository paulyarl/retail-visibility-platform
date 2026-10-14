/**
 * Tenant Slug Service
 * 
 * Handles tenant URL slug generation and validation
 * Extends UniversalSingleton for proper caching and error handling
 */

import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface SlugPattern {
  pattern: string;
  slug: string;
  isAvailable: boolean;
  isOwnSlug: boolean;
  description: string;
  /** Populated when unavailable — e.g. 'invalid_subdomain', 'reserved_subdomain', 'subdomain_taken'. */
  unavailableReason?: string;
}

export interface SlugPatternParams {
  businessName: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  tenantId?: string;
  /**
   * 'subdomain' applies the platform subdomain ruleset (the same check
   * PUT /api/tenants/:id/subdomain runs) so pickers that feed that route
   * never offer an unassignable candidate. Default 'directory'.
   */
  namespace?: 'directory' | 'subdomain';
}

export interface TenantSlug {
  slug: string;
  tenantId: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

class TenantSlugService extends TenantApiSingleton {
  private static instance: TenantSlugService;

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'tenant-slug-service*',
      'tenant-slugs*',
      'slug-operations*',
      'slug-patterns*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('tenant-slug-service*');
    await this.invalidateCachePattern('tenant-slugs*');
    await this.invalidateCachePattern('slug-operations*');
    // Pattern availability/ownership goes stale on every slug write.
    await this.invalidateCachePattern('slug-patterns*');
  }

  protected constructor() {
    super('tenant-slug-service');
  }

  static getInstance(): TenantSlugService {
    if (!TenantSlugService.instance) {
      TenantSlugService.instance = new TenantSlugService();
    }
    return TenantSlugService.instance;
  }

  /**
   * Generate slug patterns for tenant URL
   * Uses the /api/slugs/patterns endpoint
   */
  async getSlugPatterns(params: SlugPatternParams): Promise<SlugPattern[]> {
    try {
      if (!params.businessName) {
        throw new Error('Business name is required');
      }

      const response = await this.makeDefaultRequest<any>(
        '/api/slugs/patterns',
        {
          method: 'POST',
          body: JSON.stringify({
            businessName: params.businessName,
            location: params.location || {},
            tenantId: params.tenantId,
            namespace: params.namespace,
          }),
        },
        `slug-patterns:${params.businessName}:${params.location?.city || ''}:${params.location?.state || ''}:${params.tenantId || ''}:${params.namespace || 'directory'}`
      );

      // console.log('[TenantSlugService] Slug patterns API response:', response);

      // Handle case where response is not in expected format
      if (!response || typeof response !== 'object') {
        clientLogger.error('[TenantSlugService] Invalid API response format:', { detail: response });
        throw new Error('Invalid API response format');
      }

      // Handle API server response format: { patterns: [...] }
      if (response.data?.patterns && Array.isArray(response.data.patterns)) {
        return response.data.patterns;
      }

      // Handle array response (original frontend format)
      if (Array.isArray(response.data)) {
        return response.data;
      }

      // Handle nested response
      if (response.data && Array.isArray(response.data)) {
        return response.data;
      }

      // Handle single object response
      if (response.data?.slug) {
        return [response.data];
      }

      throw new Error('Unexpected response format');
    } catch (error) {
      clientLogger.error('[TenantSlugService] Failed to get slug patterns:', { detail: error });
      throw error;
    }
  }

  /**
   * Generate slug patterns for tenant URL
   * Uses the /api/slugs/patterns endpoint
   */
  async getTenantSlug(params: SlugPatternParams): Promise<TenantSlug[]> {
    try {
      if (!params.tenantId) {
        throw new Error('Tenant ID is required');
      }

      const response = await this.makeDefaultRequest<any>(
        `/api/slugs/tenant/${params.tenantId}`,
        {
        },
        `slug-patterns:${params.tenantId}`
      );

      // console.log('[TenantSlugService] Slug patterns API response:', response);

      // Handle case where response is not in expected format
      if (!response || typeof response !== 'object') {
        clientLogger.error('[TenantSlugService] Invalid API response format:', { detail: response });
        throw new Error('Invalid API response format');
      }

      // Handle API server response format: { patterns: [...] }
      if (response.data?.slug) {
        return [response.data];
      }

      // Handle array response (original frontend format)
      if (Array.isArray(response.data)) {
        return response.data;
      }

      // Handle nested response
      if (response.data && Array.isArray(response.data)) {
        return response.data;
      }

      // Handle single object response
      if (response.data?.slug) {
        return [response.data];
      }

      throw new Error('Unexpected response format');
    } catch (error) {
      clientLogger.error('[TenantSlugService] Failed to get slug patterns:', { detail: error });
      throw error;
    }
  }

  /**
   * Check if a specific slug is available
   */
  async checkSlugAvailability(slug: string): Promise<boolean> {
    try {
      const patterns = await this.getSlugPatterns({
        businessName: slug,
        location: {}
      });

      const pattern = patterns.find(p => p.slug === slug);
      return pattern ? pattern.isAvailable : false;
    } catch (error) {
      clientLogger.error('[TenantSlugService] Failed to check slug availability:', { detail: error });
      return false;
    }
  }
}

// Export singleton instance
export const tenantSlugService = TenantSlugService.getInstance();
