/**
 * Tenant Slug Service
 * 
 * Handles tenant URL slug generation and validation
 * Extends UniversalSingleton for proper caching and error handling
 */

import { TenantApiSingleton } from '../providers/base/TenantApiSingleton';

export interface SlugPattern {
  pattern: string;
  slug: string;
  isAvailable: boolean;
  isOwnSlug: boolean;
  description: string;
}

export interface SlugPatternParams {
  businessName: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  tenantId?: string;
}

class TenantSlugService extends TenantApiSingleton {
  private static instance: TenantSlugService;

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
          }),
        },
        `slug-patterns:${params.businessName}:${params.location?.city || ''}:${params.location?.state || ''}:${params.tenantId || ''}`
      );

      console.log('[TenantSlugService] Slug patterns API response:', response);

      // Handle case where response is not in expected format
      if (!response || typeof response !== 'object') {
        console.error('[TenantSlugService] Invalid API response format:', response);
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
      console.error('[TenantSlugService] Failed to get slug patterns:', error);
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
      console.error('[TenantSlugService] Failed to check slug availability:', error);
      return false;
    }
  }
}

// Export singleton instance
export const tenantSlugService = TenantSlugService.getInstance();
