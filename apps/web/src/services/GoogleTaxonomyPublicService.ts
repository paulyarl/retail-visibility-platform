/**
 * Google Taxonomy Public Service
 * Handles public Google taxonomy operations with proper caching
 * Used for Google taxonomy lookups that don't require authentication
 */

import { PublicApiSingleton } from '../providers/base/PublicApiSingleton';

export interface GoogleTaxonomyPath {
  id: string;
  name: string;
  path: string[];
  level: number;
  parent_id?: string;
}

/**
 * Google Taxonomy Public Service
 * Extends PublicApiSingleton for public Google taxonomy operations
 */
class GoogleTaxonomyPublicService extends PublicApiSingleton {
  private static instance: GoogleTaxonomyPublicService;

  // TTL for Google taxonomy data (changes very infrequently)
  private readonly TAXONOMY_TTL = 24 * 60 * 60 * 1000; // 24 hours for taxonomy data

  protected constructor() {
    super('google-taxonomy-public-singleton');
  }

  public static getInstance(): GoogleTaxonomyPublicService {
    if (!GoogleTaxonomyPublicService.instance) {
      GoogleTaxonomyPublicService.instance = new GoogleTaxonomyPublicService();
    }
    return GoogleTaxonomyPublicService.instance;
  }

  /**
   * Get Google taxonomy path for a category ID
   * Uses the /public/google-taxonomy/:googleCategoryId endpoint
   */
  async getGoogleTaxonomyPath(googleCategoryId: string): Promise<GoogleTaxonomyPath | null> {
    if (!googleCategoryId) {
      console.error('[GoogleTaxonomyPublicService] Google category ID is required');
      return null;
    }

    const response = await this.makeDefaultRequest<GoogleTaxonomyPath>(
      `/api/public/google-taxonomy/${googleCategoryId}`,
      {},
      `google-taxonomy-${googleCategoryId}`,
      this.TAXONOMY_TTL
    );

    if (!response.success) {
      console.error('[GoogleTaxonomyPublicService] Failed to get Google taxonomy path:', response.error);
      return null;
    }

    return response.data || null;
  }

  /**
   * Get popular Google categories
   * Uses the /public/google-taxonomy/popular endpoint
   */
  async getPopularGoogleCategories(limit: number = 50): Promise<GoogleTaxonomyPath[] | null> {
    const response = await this.makeDefaultRequest<GoogleTaxonomyPath[]>(
      `/api/public/google-taxonomy/popular`,
      {},
      `google-taxonomy-popular`,
      this.TAXONOMY_TTL
    );

    if (!response.success) {
      console.error('[GoogleTaxonomyPublicService] Failed to get popular Google categories:', response.error);
      return null;
    }

    return response.data || null;
  }

  /**
   * Search Google taxonomy
   * Uses the /public/google-taxonomy/search endpoint
   */
  async searchGoogleTaxonomy(query: string, limit: number = 20): Promise<GoogleTaxonomyPath[] | null> {
    if (!query) {
      console.error('[GoogleTaxonomyPublicService] Search query is required');
      return null;
    }

    const response = await this.makeDefaultRequest<GoogleTaxonomyPath[]>(
      `/api/public/google-taxonomy/search`,
      { method: 'POST', body: JSON.stringify({ query }) },
      `google-taxonomy-search-${query}`,
      this.TAXONOMY_TTL
    );

    if (!response.success) {
      console.error('[GoogleTaxonomyPublicService] Failed to search Google taxonomy:', response.error);
      return null;
    }

    return response.data || null;
  }
}

// Export singleton instance
export const googleTaxonomyPublicService = GoogleTaxonomyPublicService.getInstance();
