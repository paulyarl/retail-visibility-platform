/**
 * Directory Support Singleton Service
 * 
 * Handles directory support operations with automatic caching and error handling.
 * Extends UniversalSingleton for authenticated requests.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { clientLogger } from '@/lib/client-logger';

export interface DirectoryStatus {
  tenant: {
    id: string;
    name: string;
    subscriptionTier: string;
    subscriptionStatus: string;
  };
  settings: {
    isPublished: boolean;
  };
  profile: {
    businessName?: string;
    city?: string;
    state?: string;
    phoneNumber?: string;
    email?: string;
    website?: string;
    description?: string;
  };
  itemCount: number;
  isFeatured: boolean;
}

export interface DirectoryQualityCheck {
  completenessPercent: number;
  checks: Record<string, boolean>;
  recommendations: string[];
  itemCount: number;
  canPublish: boolean;
}

export interface DirectoryNote {
  id: string;
  note: string;
  createdAt: string;
  createdByUser: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
}

class DirectorySupportSingletonService extends TenantApiSingleton {
  protected cacheTTL = 5 * 60 * 1000; // 5 minutes for support data

  /**
   * PILOT: Get all cache patterns for this service
   */
  public getServiceCachePatterns(): string[] {
    return [
      'directory-support*',
      'support-tickets*',
      'directory-issues*'
    ];
  }

  /**
   * PILOT: Public cache invalidation method for this service
   */
  public async invalidateServiceCaches(tenantId?: string): Promise<void> {
    await this.invalidateCachePattern('directory-support*');
    await this.invalidateCachePattern('support-tickets*');
    await this.invalidateCachePattern('directory-issues*');
  }

  private static instance: DirectorySupportSingletonService;

  static getInstance(): DirectorySupportSingletonService {
    if (!DirectorySupportSingletonService.instance) {
      DirectorySupportSingletonService.instance = new DirectorySupportSingletonService();
    }
    return DirectorySupportSingletonService.instance;
  }

  constructor() {
    super('DirectorySupportSingletonService');
  }

  /**
   * Get directory status for a tenant
   * Authenticated endpoint for support operations
   */
  async getDirectoryStatus(tenantId: string): Promise<DirectoryStatus | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await this.makeDefaultRequest<DirectoryStatus>(
      `/api/support/directory/tenant/${tenantId}/status`,
      {},
      `directory-status-${tenantId}`,
      this.cacheTTL
    );

    if (!response.success) {
      clientLogger.error('[DirectorySupportSingleton] Failed to get directory status:', { detail: response.error });
      return null;
    }

    return response.data || null;
  }

  /**
   * Get directory quality check for a tenant
   * Authenticated endpoint for support operations
   */
  async getDirectoryQualityCheck(tenantId: string): Promise<DirectoryQualityCheck | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await this.makeDefaultRequest<DirectoryQualityCheck>(
      `/api/support/directory/tenant/${tenantId}/quality-check`,
      {},
      `directory-quality-check-${tenantId}`,
      this.cacheTTL
    );

    if (!response.success) {
      clientLogger.error('[DirectorySupportSingleton] Failed to get directory quality check:', { detail: response.error });
      return null;
    }

    return response.data || null;
  }

  /**
   * Get directory notes for a tenant
   * Authenticated endpoint for support operations
   */
  async getDirectoryNotes(tenantId: string): Promise<DirectoryNote[] | null> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }

    const response = await this.makeDefaultRequest<DirectoryNote[]>(
      `/api/support/directory/tenant/${tenantId}/notes`,
      {},
      `directory-notes-${tenantId}`,
      this.cacheTTL
    );

    if (!response.success) {
      clientLogger.error('[DirectorySupportSingleton] Failed to get directory notes:', { detail: response.error });
      return null;
    }

    return response.data || null;
  }

  /**
   * Add directory note for a tenant
   * Authenticated endpoint for support operations
   */
  async addDirectoryNote(tenantId: string, note: string): Promise<DirectoryNote | null> {
    if (!tenantId || !note) {
      throw new Error('Tenant ID and note are required');
    }

    const response = await this.makeDefaultRequest<DirectoryNote>(
      `/api/support/directory/tenant/${tenantId}/notes`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note })
      },
      `add-directory-note-${tenantId}`,
      this.cacheTTL
    );

    if (!response.success) {
      clientLogger.error('[DirectorySupportSingleton] Failed to add directory note:', { detail: response.error });
      return null;
    }

    // Invalidate cache for notes after adding a new one
    this.invalidateCache(`directory-notes-${tenantId}`);

    return response.data || null;
  }

  /**
   * Search directory for support operations
   * Authenticated endpoint for support operations
   */
  async searchDirectory(query: string): Promise<any> {
    try {
      if (!query) {
        throw new Error('Query is required');
      }

      const response = await this.makeDefaultRequest<any>(
        `/api/support/directory/search?q=${encodeURIComponent(query)}`,
        {},
        `search-directory-${query}`,
        this.cacheTTL
      );

      return response;
    } catch (error) {
      clientLogger.error('[DirectorySupportSingleton] Failed to search directory:', { detail: error });
      return null;
    }
  }
}

// Export singleton instance
export const directorySupportService = DirectorySupportSingletonService.getInstance();
