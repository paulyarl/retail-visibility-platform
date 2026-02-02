/**
 * Tenant Directory Singleton Service
 * 
 * Extends UniversalSingletonClient to provide cached tenant directory operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { UniversalSingletonClient } from '@/lib/shops/universal-singleton-client';

export interface TenantSlugResponse {
  slug: string;
}

export interface TenantIdentifiers {
  tenantId: string;
  slug?: string;
  autoId: string;
}

class TenantDirectorySingletonService {
  private static instance: TenantDirectorySingletonService;
  private client: UniversalSingletonClient;

  private constructor() {
    // Initialize UniversalSingletonClient with platform defaults
    this.client = UniversalSingletonClient.getInstance({
      baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
      enableCache: true,
      defaultTTL: 10 * 60 * 1000, // 10 minutes for tenant data (longer than regular API)
      enableLogging: true,
      enableMetrics: true
    });
  }

  public static getInstance(): TenantDirectorySingletonService {
    if (!TenantDirectorySingletonService.instance) {
      TenantDirectorySingletonService.instance = new TenantDirectorySingletonService();
    }
    return TenantDirectorySingletonService.instance;
  }

  /**
   * Get tenant slug with caching
   * Uses the /api/directory/tenant/:tenantId endpoint
   */
  async getTenantSlug(tenantId: string): Promise<string | undefined> {
    if (!tenantId) {
      console.error('[TenantDirectorySingleton] getTenantSlug: tenantId is required');
      return undefined;
    }

    try {
      const result = await this.client.makeRequest<TenantSlugResponse>(
        `/api/directory/tenant/${tenantId}`
      );
      
      return result.data?.slug;
    } catch (error) {
      console.error('[TenantDirectorySingleton] Failed to get tenant slug:', error);
      return undefined;
    }
  }

  /**
   * Get tenant identifiers (tenantId, slug, autoId) with caching
   * Uses multiple API calls to build complete tenant identifier object
   */
  async getTenantIdentifiers(tenantId: string): Promise<TenantIdentifiers | undefined> {
    if (!tenantId) {
      console.error('[TenantDirectorySingleton] getTenantIdentifiers: tenantId is required');
      return undefined;
    }

    try {
      // Get slug from directory endpoint
      const slug = await this.getTenantSlug(tenantId);
      
      // Generate autoId deterministically (same logic as backend)
      const autoId = this.generateAutoId(tenantId);

      return {
        tenantId,
        slug,
        autoId
      };
    } catch (error) {
      console.error('[TenantDirectorySingleton] Failed to get tenant identifiers:', error);
      return undefined;
    }
  }

  /**
   * Generate deterministic autoId from tenantId
   * Matches backend logic in TenantSingletonService
   */
  private generateAutoId(tenantId: string): string {
    // Extract the numeric part from tenantId (tid-12345 -> 12345)
    const match = tenantId.match(/tid-(\d+)/);
    if (match && match[1]) {
      return match[1];
    }
    
    // Fallback: use hash of tenantId
    return this.simpleHash(tenantId);
  }

  /**
   * Simple hash function for fallback autoId generation
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
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
export const tenantDirectoryService = TenantDirectorySingletonService.getInstance();
