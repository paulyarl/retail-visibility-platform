/**
 * Google Product Taxonomy Service (Frontend)
 *
 * Provides search/select for Google's product category taxonomy
 * and category mapping coverage stats.
 */

import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';

export interface GoogleTaxonomyCategory {
  id: string;
  path: string;
  parts: string[];
}

export interface GoogleCategoryCoverage {
  mapped: number;
  total: number;
  unmapped: number;
  coveragePercent: number;
}

export class GoogleProductTaxonomyService extends AdminApiSingleton {
  private static instance: GoogleProductTaxonomyService;

  private constructor() {
    super('google-product-taxonomy-service', {
      ttl: 60 * 60 * 1000, // 1 hour cache
    });
  }

  static getInstance(): GoogleProductTaxonomyService {
    if (!GoogleProductTaxonomyService.instance) {
      GoogleProductTaxonomyService.instance = new GoogleProductTaxonomyService();
    }
    return GoogleProductTaxonomyService.instance;
  }

  /**
   * Search Google product taxonomy
   */
  async searchGoogleCategories(query: string, limit = 50): Promise<GoogleTaxonomyCategory[]> {
    const response = await this.makeDefaultRequest<any>(
      `/api/admin/google-product-taxonomy?q=${encodeURIComponent(query)}&limit=${limit}`,
      {},
      `google-taxonomy-search-${query}`,
      60 * 60 * 1000
    );
    return response?.data?.categories || [];
  }

  /**
   * Get mapping coverage stats
   */
  async getCoverage(): Promise<GoogleCategoryCoverage | null> {
    const response = await this.makeDefaultRequest<any>(
      '/api/admin/google-product-taxonomy/coverage',
      {},
      'google-taxonomy-coverage',
      5 * 60 * 1000 // 5 min cache
    );
    return response?.data?.data || response?.data || null;
  }

  /**
   * Batch update category mappings
   */
  async batchMapCategories(
    mappings: Array<{ platformCategoryId: string; googleCategoryId: string }>
  ): Promise<{ updated: number; total: number } | null> {
    const response = await this.makeDefaultRequest<any>(
      '/api/admin/google-product-taxonomy/batch-map',
      {
        method: 'POST',
        body: JSON.stringify({ mappings }),
      },
      'google-taxonomy-batch-map',
      0
    );

    this.invalidateCache('google-taxonomy-coverage');
    this.invalidateCache('platform-categories');

    return response?.data?.data || response?.data || null;
  }

  /**
   * Update a single platform category's Google category mapping
   */
  async updateCategoryMapping(
    platformCategoryId: string,
    googleCategoryId: string
  ): Promise<void> {
    await this.batchMapCategories([{ platformCategoryId, googleCategoryId }]);
  }
}

export const googleProductTaxonomyService = GoogleProductTaxonomyService.getInstance();
