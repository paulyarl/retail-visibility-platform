/**
 * GDPR Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached GDPR operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';
import {
  DataExport,
  AccountDeletionRequest,
  ConsentRecord,
  ConsentHistoryEntry,
  UserPreference,
  ApiResponse,
  ConsentUpdateData,
  BulkConsentUpdateData,
  PreferenceUpdateData,
  DataExportFormData,
  AccountDeletionFormData,
} from '@/types/security';

class GDPRSingletonService extends AuthenticatedApiSingleton {
  private static instance: GDPRSingletonService;

  private constructor() {
    super('gdpr-singleton');
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes for GDPR data (changes moderately)
  }

  public static getInstance(): GDPRSingletonService {
    if (!GDPRSingletonService.instance) {
      GDPRSingletonService.instance = new GDPRSingletonService();
    }
    return GDPRSingletonService.instance;
  }

  // ==================== Phase 1: Basic GDPR ====================

  /**
   * Request a data export
   */
  async requestDataExport(data: DataExportFormData): Promise<DataExport> {
    const result = await this.makeDefaultRequest<DataExport>(
      '/api/gdpr/export',
      { 
        method: 'POST',
        body: JSON.stringify(data)
      },
      'gdpr-request-export'
    );

    if (!result.success) {
      console.error('[GDPRSingleton] Failed to request data export:', result.error);
      throw result.error;
    }

    if (!result.data) {
      throw new Error('No data returned from export request');
    }

    // Invalidate exports cache
    await this.invalidateCache('gdpr-exports*');

    return result.data;
  }

  /**
   * Get export status
   */
  async getExportStatus(exportId: string): Promise<DataExport> {
    const result = await this.makeDefaultRequest<DataExport>(
      `/api/gdpr/export/${exportId}`,
      {},
      `gdpr-export-status-${exportId}`
    );

    if (!result.success) {
      console.error('[GDPRSingleton] Failed to get export status:', result.error);
      return {} as DataExport;
    }

    return result.data || {} as DataExport;
  }

  /**
   * Download export data
   */
  async downloadExport(exportId: string): Promise<Blob> {
    const response = await this.makeDefaultRequest<Response>(
      `/api/gdpr/export/${exportId}/download`,
      {},
      `gdpr-download-export-${exportId}`
    );

    if (!response.success) {
      console.error('[GDPRSingleton] Failed to download export:', response.error);
      throw response.error;
    }

    if (!response.data) {
      throw new Error('No response from export download');
    }

    return await response.data.blob();
  }

  /**
   * Get all exports for the user
   */
  async getExports(): Promise<DataExport[]> {
    const result = await this.makeDefaultRequest<DataExport[]>(
      '/api/gdpr/exports',
      {},
      'gdpr-exports'
    );

    if (!result.success) {
      console.error('[GDPRSingleton] Failed to get exports:', result.error);
      return [];
    }

    return result.data || [];
  }

  /**
   * Request account deletion
   */
  async requestAccountDeletion(data: AccountDeletionFormData): Promise<AccountDeletionRequest> {
    const result = await this.makeDefaultRequest<AccountDeletionRequest>(
      '/api/gdpr/delete',
      { 
        method: 'POST',
        body: JSON.stringify(data)
      },
      'gdpr-request-deletion'
    );

    if (!result.success) {
      console.error('[GDPRSingleton] Failed to request account deletion:', result.error);
      throw result.error;
    }

    if (!result.data) {
      throw new Error('No data returned from deletion request');
    }

    // Invalidate deletion requests cache
    await this.invalidateCache('gdpr-deletion-requests*');

    return result.data;
  }

  /**
   * Get deletion request status
   */
  async getDeletionStatus(): Promise<AccountDeletionRequest> {
    const result = await this.makeDefaultRequest<AccountDeletionRequest>(
      '/api/gdpr/delete/status',
      {},
      'gdpr-deletion-status'
    );

    if (!result.success) {
      console.error('[GDPRSingleton] Failed to get deletion status:', result.error);
      return {} as AccountDeletionRequest;
    }

    return result.data || {} as AccountDeletionRequest;
  }

  // ==================== Phase 2: Full GDPR Compliance ====================

  /**
   * Get user consent records
   */
  async getConsents(): Promise<ConsentRecord[]> {
    const result = await this.makeDefaultRequest<ConsentRecord[]>(
      '/api/gdpr/consents',
      {},
      'gdpr-consents'
    );

    if (!result.success) {
      console.error('[GDPRSingleton] Failed to get consents:', result.error);
      return [];
    }

    return result.data || [];
  }

  /**
   * Get consent history
   */
  async getConsentHistory(): Promise<ConsentHistoryEntry[]> {
    const result = await this.makeDefaultRequest<ConsentHistoryEntry[]>(
      '/api/gdpr/consents/history',
      {},
      'gdpr-consent-history'
    );

    if (!result.success) {
      console.error('[GDPRSingleton] Failed to get consent history:', result.error);
      return [];
    }

    return result.data || [];
  }

  /**
   * Update consent
   */
  async updateConsent(data: ConsentUpdateData): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/gdpr/consents',
        { 
          method: 'PUT',
          body: JSON.stringify(data)
        },
        `gdpr-update-consent-${data.type}`
      );

      // Invalidate consents cache
      await this.invalidateCache('gdpr-consents*');
    } catch (error) {
      console.error('[GDPRSingleton] Failed to update consent:', error);
      throw error;
    }
  }

  /**
   * Bulk update consents
   */
  async bulkUpdateConsents(data: BulkConsentUpdateData): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/gdpr/consents/bulk',
        { 
          method: 'PUT',
          body: JSON.stringify(data)
        },
        'gdpr-bulk-update-consents'
      );

      // Invalidate consents cache
      await this.invalidateCache('gdpr-consents*');
    } catch (error) {
      console.error('[GDPRSingleton] Failed to bulk update consents:', error);
      throw error;
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(): Promise<UserPreference[]> {
    const result = await this.makeDefaultRequest<UserPreference[]>(
      '/api/user/preferences',
      {},
      'gdpr-user-preferences'
    );

    if (!result.success) {
      console.error('[GDPRSingleton] Failed to get user preferences:', result.error);
      return [];
    }

    return result.data || [];
  }

  /**
   * Update user preference
   */
  async updateUserPreference(data: PreferenceUpdateData): Promise<void> {
    try {
      await this.makeDefaultRequest<void>(
        '/api/user/preferences',
        { 
          method: 'PUT',
          body: JSON.stringify(data)
        },
        `gdpr-update-preference-${data.key}`
      );

      // Invalidate preferences cache
      await this.invalidateCache('gdpr-user-preferences*');
    } catch (error) {
      console.error('[GDPRSingleton] Failed to update user preference:', error);
      throw error;
    }
  }

  /**
   * Export user preferences
   */
  async exportUserPreferences(): Promise<Blob> {
    const response = await this.makeDefaultRequest<Response>(
      '/api/user/preferences/export',
      {},
      'gdpr-export-preferences'
    );

    if (!response.success) {
      console.error('[GDPRSingleton] Failed to export user preferences:', response.error);
      throw response.error;
    }

    if (!response.data) {
      throw new Error('No response from preferences export');
    }

    return await response.data.blob();
  }

  /**
   * Invalidate all GDPR cache
   */
  public async invalidateGDPRCache(): Promise<void> {
    await this.invalidateCache('gdpr-*');
  }

  /**
   * Invalidate consents cache specifically
   */
  public async invalidateConsentsCache(): Promise<void> {
    await this.invalidateCache('gdpr-consents*');
  }

  /**
   * Invalidate exports cache specifically
   */
  public async invalidateExportsCache(): Promise<void> {
    await this.invalidateCache('gdpr-exports*');
  }
}

// Export singleton instance
export const gdprService = GDPRSingletonService.getInstance();

// Export cache invalidation helpers for external use
export const invalidateGDPRCache = async (): Promise<void> => {
  const service = GDPRSingletonService.getInstance();
  await service.invalidateGDPRCache();
};

export const invalidateConsentsCache = async (): Promise<void> => {
  const service = GDPRSingletonService.getInstance();
  await service.invalidateConsentsCache();
};

export const invalidateExportsCache = async (): Promise<void> => {
  const service = GDPRSingletonService.getInstance();
  await service.invalidateExportsCache();
};
