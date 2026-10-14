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

export interface SlugAvailabilityResult {
  available: boolean;
  valid?: boolean;
  /** 'invalid_subdomain' | 'reserved_subdomain' | 'subdomain_taken' when not available. */
  code?: string;
  ownedByCurrentUser?: boolean;
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
   * Check a free-text slug for availability. Uncached — availability is
   * inherently time-sensitive and both backing endpoints are rate-limited.
   * 'subdomain' hits GET /api/tenants/check-subdomain (full subdomain
   * ruleset); 'directory' hits POST /api/slugs/check-availability.
   */
  async checkSlugAvailability(
    slug: string,
    tenantId?: string,
    namespace: 'directory' | 'subdomain' = 'directory'
  ): Promise<SlugAvailabilityResult> {
    if (namespace === 'subdomain') {
      const response = await this.makeDefaultRequest<any>(
        `/api/tenants/check-subdomain/${encodeURIComponent(slug)}`
      );
      const d = response?.data ?? response;
      return {
        available: !!d?.available,
        valid: d?.valid,
        code: d?.code,
        ownedByCurrentUser: d?.ownedByCurrentUser,
      };
    }

    const response = await this.makeDefaultRequest<any>('/api/slugs/check-availability', {
      method: 'POST',
      body: JSON.stringify({ slug, excludeTenantId: tenantId }),
    });
    const d = response?.data ?? response;
    return { available: !!d?.isAvailable };
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
}

// Export singleton instance
export const tenantSlugService = TenantSlugService.getInstance();
