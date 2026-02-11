/**
 * Organizations Singleton Service
 *
 * Extends UniversalSingletonClient to provide cached organizations operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { UniversalSingletonClient } from '@/lib/shops/universal-singleton-client';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationsResponse {
  organizations: Organization[];
  total: number;
  page: number;
  limit: number;
}

class OrganizationsSingletonService {
  private static instance: OrganizationsSingletonService;
  private client: UniversalSingletonClient;

  private constructor() {
    // Initialize UniversalSingletonClient with platform defaults
    this.client = UniversalSingletonClient.getInstance({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      enableCache: true,
      defaultTTL: 15 * 60 * 1000, // 15 minutes for organizations (changes rarely)
      enableLogging: true,
      enableMetrics: true
    });
  }

  public static getInstance(): OrganizationsSingletonService {
    if (!OrganizationsSingletonService.instance) {
      OrganizationsSingletonService.instance = new OrganizationsSingletonService();
    }
    return OrganizationsSingletonService.instance;
  }

  /**
   * Get all organizations with caching
   * Uses the /organizations endpoint
   */
  async getOrganizations(page: number = 1, limit: number = 50): Promise<Organization[]> {
    try {
      // The API returns organizations directly
      const result = await this.client.makeRequest<any>(
        `/api/organizations?page=${page}&limit=${limit}`
      ) as any;

      return result || [];
    } catch (error) {
      console.error('[OrganizationsSingleton] Failed to get organizations:', error);
      return [];
    }
  }

  /**
   * Get organization by ID with caching
   * Uses the /organizations/:id endpoint
   */
  async getOrganizationById(id: string): Promise<Organization | null> {
    if (!id) {
      console.error('[OrganizationsSingleton] getOrganizationById: id is required');
      return null;
    }

    try {
      // The API returns organization directly
      const result = await this.client.makeRequest<any>(
        `/api/organizations/${id}`
      ) as any;

      return result || null;
    } catch (error) {
      console.error('[OrganizationsSingleton] Failed to get organization by ID:', error);
      return null;
    }
  }

  /**
   * Get organization by slug with caching
   * Uses the /organizations endpoint with slug filter
   */
  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    if (!slug) {
      console.error('[OrganizationsSingleton] getOrganizationBySlug: slug is required');
      return null;
    }

    try {
      // The API returns organization directly
      const result = await this.client.makeRequest<any>(
        `/api/organizations/slug/${slug}`
      ) as any;

      return result || null;
    } catch (error) {
      console.error('[OrganizationsSingleton] Failed to get organization by slug:', error);
      return null;
    }
  }

  /**
   * Search organizations with caching
   * Uses the /organizations/search endpoint
   */
  async searchOrganizations(query: string, page: number = 1, limit: number = 20): Promise<Organization[]> {
    if (!query) {
      console.error('[OrganizationsSingleton] searchOrganizations: query is required');
      return [];
    }

    try {
      const result = await this.client.makeRequest<OrganizationsResponse>(
        `/api/organizations/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`
      );

      if (result.success && result.data?.organizations) {
        return result.data.organizations;
      }

      return [];
    } catch (error) {
      console.error('[OrganizationsSingleton] Failed to search organizations:', error);
      return [];
    }
  }

  /**
   * Get performance metrics
   */
  public getMetrics() {
    return this.client.getMetrics();
  }

  /**
   * Reset metrics
   */
  public resetMetrics(): void {
    this.client.resetMetrics();
  }
}

// Export singleton instance
export const organizationsService = OrganizationsSingletonService.getInstance();
