/**
 * Directory Support Singleton Service
 * 
 * Handles directory support operations with automatic caching and error handling.
 * Extends UniversalSingleton for authenticated requests.
 */

import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';

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
      `/support/directory/tenant/${tenantId}/status`,
      {},
      `directory-status-${tenantId}`,
      this.cacheTTL
    );

    if (!response.success) {
      console.error('[DirectorySupportSingleton] Failed to get directory status:', response.error);
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
      `/support/directory/tenant/${tenantId}/quality-check`,
      {},
      `directory-quality-check-${tenantId}`,
      this.cacheTTL
    );

    if (!response.success) {
      console.error('[DirectorySupportSingleton] Failed to get directory quality check:', response.error);
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
      `/support/directory/tenant/${tenantId}/notes`,
      {},
      `directory-notes-${tenantId}`,
      this.cacheTTL
    );

    if (!response.success) {
      console.error('[DirectorySupportSingleton] Failed to get directory notes:', response.error);
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
      `/support/directory/tenant/${tenantId}/notes`,
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
      console.error('[DirectorySupportSingleton] Failed to add directory note:', response.error);
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
        `/support/directory/search?q=${encodeURIComponent(query)}`,
        {},
        `search-directory-${query}`,
        this.cacheTTL
      );

      return response;
    } catch (error) {
      console.error('[DirectorySupportSingleton] Failed to search directory:', error);
      return null;
    }
  }
}

// Export singleton instance
export const directorySupportService = DirectorySupportSingletonService.getInstance();
