/**
 * Google Taxonomy Service
 * Handles Google taxonomy operations for tenant scope with proper caching
 * Used for category assignment within tenant context
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';

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
   * Browse Google taxonomy categories
   * Uses the /api/google/taxonomy/browse endpoint (original endpoint)
   */
  async browseGoogleTaxonomy(parentPath?: string): Promise<GoogleTaxonomyCategory[] | null> {
    const url = parentPath 
      ? `/api/google/taxonomy/browse?parent=${encodeURIComponent(parentPath)}`
      : '/api/google/taxonomy/browse';
    
    const response = await this.makeAuthenticatedRequest<{
      success: boolean;
      categories: GoogleTaxonomyCategory[];
    }>(
      url,
      {},
      `google-taxonomy-browse-${parentPath || 'root'}`,
      this.TAXONOMY_TTL
    );

    if (!response.success) {
      console.error('[GoogleTaxonomyService] Failed to browse Google taxonomy:', response.error);
      return null;
    }

    return response.data?.categories || null;
  }

  /**
   * Search Google taxonomy
   * Uses the /api/google/taxonomy/search endpoint (original endpoint)
   */
  async searchGoogleTaxonomy(query: string, limit: number = 20): Promise<GoogleTaxonomyCategory[] | null> {
    if (!query) {
      console.error('[GoogleTaxonomyService] Search query is required');
      return null;
    }

    const response = await this.makeAuthenticatedRequest<{
      success: boolean;
      categories: GoogleTaxonomyCategory[];
    }>(
      `/api/google/taxonomy/search?q=${encodeURIComponent(query)}&limit=${limit}`,
      {},
      `google-taxonomy-search-${query}`,
      this.TAXONOMY_TTL
    );

    if (!response.success) {
      console.error('[GoogleTaxonomyService] Failed to search Google taxonomy:', response.error);
      return null;
    }

    return response.data?.categories || null;
  }
}

// Export singleton instance
export const googleTaxonomyService = GoogleTaxonomyService.getInstance();
