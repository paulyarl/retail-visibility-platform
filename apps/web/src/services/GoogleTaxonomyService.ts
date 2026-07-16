/**
 * Google Taxonomy Service
 * Handles Google taxonomy operations for tenant scope with proper caching
 * Used for category assignment within tenant context
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface GoogleTaxonomyCategory {
  id: string;
  name: string;
  path: string[];
  level: number;
  parent_id?: string;
}

/**
 * Google Taxonomy Service
 * Extends AuthenticatedApiSingleton for tenant Google taxonomy operations
 */
class GoogleTaxonomyService extends AuthenticatedApiSingleton {
  private static instance: GoogleTaxonomyService;

  // TTL for Google taxonomy data (changes very infrequently)
  private readonly TAXONOMY_TTL = 24 * 60 * 1000; // 24 hours for taxonomy data

  private constructor() {
    super('google-taxonomy-service');
  }

  public static getInstance(): GoogleTaxonomyService {
    if (!GoogleTaxonomyService.instance) {
      GoogleTaxonomyService.instance = new GoogleTaxonomyService();
    }
    return GoogleTaxonomyService.instance;
  }

  /**
   * Get a single Google taxonomy category by ID
   * Uses the /api/taxonomy/:id endpoint
   */
  async getGoogleTaxonomyById(googleCategoryId: string): Promise<GoogleTaxonomyCategory | null> {
    const response = await this.makeDefaultRequest<{
      success: boolean;
      data: GoogleTaxonomyCategory;
    }>(
      `/api/taxonomy/${googleCategoryId}`,
      {},
      `google-taxonomy-${googleCategoryId}`,
      this.TAXONOMY_TTL
    );

    if (!response.success) {
      clientLogger.error('[GoogleTaxonomyService] Failed to get Google taxonomy:', { detail: response.error });
      return null;
    }

    return response.data?.data || null;
  }

  /**
   * Browse Google taxonomy categories
   * Uses the /api/taxonomy/browse endpoint
   */
  async browseGoogleTaxonomy(parentPath?: string): Promise<GoogleTaxonomyCategory[] | null> {
    const url = parentPath 
      ? `/api/taxonomy/browse?path=${encodeURIComponent(parentPath)}`
      : '/api/taxonomy/browse';
    
    const response = await this.makeDefaultRequest<{
      success: boolean;
      categories: GoogleTaxonomyCategory[];
    }>(
      url,
      {},
      `google-taxonomy-browse-${parentPath || 'root'}`,
      this.TAXONOMY_TTL
    );

    if (!response.success) {
      clientLogger.error('[GoogleTaxonomyService] Failed to browse Google taxonomy:', { detail: response.error });
      return null;
    }

    return response.data?.categories || null;
  }

  /**
   * Search Google taxonomy
   * Uses the /api/taxonomy/search endpoint
   */
  async searchGoogleTaxonomy(query: string, limit: number = 20): Promise<GoogleTaxonomyCategory[] | null> {
    if (!query) {
      clientLogger.error('[GoogleTaxonomyService] Search query is required');
      return null;
    }

    const response = await this.makeDefaultRequest<{
      success: boolean;
      results: GoogleTaxonomyCategory[];
    }>(
      `/api/taxonomy/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      {},
      `google-taxonomy-search-${query}`,
      this.TAXONOMY_TTL
    );

    if (!response.success) {
      clientLogger.error('[GoogleTaxonomyService] Failed to search Google taxonomy:', { detail: response.error });
      return null;
    }

    return response.data?.results || null;
  }
}

// Export singleton instance
export const googleTaxonomyService = GoogleTaxonomyService.getInstance();
