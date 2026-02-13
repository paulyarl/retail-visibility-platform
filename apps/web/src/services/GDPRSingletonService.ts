/**
 * GDPR Singleton Service
 * 
 * Extends AuthenticatedApiSingleton to provide cached GDPR operations
 * Uses the platform's singleton architecture for automatic authentication and caching
 */

import { AuthenticatedApiSingleton } from '@/providers/base/UniversalSingleton';
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
    try {
      const result = await this.makeAuthenticatedRequest<DataExport>(
        '/api/gdpr/export',
        { 
          method: 'POST',
          body: JSON.stringify(data)
        },
        'gdpr-request-export'
      );

      if (!result) {
        throw new Error('No data returned from export request');
      }

      // Invalidate exports cache
      await this.invalidateCache('gdpr-exports*');

      return result;
    } catch (error) {
      console.error('[GDPRSingleton] Failed to request data export:', error);
      throw error;
    }
  }

  /**
   * Get export status
   */
  async getExportStatus(exportId: string): Promise<DataExport> {
    try {
      const result = await this.makeAuthenticatedRequest<DataExport>(
        `/api/gdpr/export/${exportId}`,
        {},
        `gdpr-export-status-${exportId}`
      );

      return result || {} as DataExport;
    } catch (error) {
      console.error('[GDPRSingleton] Failed to get export status:', error);
      return {} as DataExport;
    }
  }

  /**
   * Download export data
   */
  async downloadExport(exportId: string): Promise<Blob> {
    try {
      const response = await this.makeAuthenticatedRequest<Response>(
        `/api/gdpr/export/${exportId}/download`,
        {},
        `gdpr-download-export-${exportId}`
      );

      if (!response) {
        throw new Error('No response from export download');
      }

      return await response.blob();
    } catch (error) {
      console.error('[GDPRSingleton] Failed to download export:', error);
      throw error;
    }
  }

  /**
   * Get all exports for the user
   */
  async getExports(): Promise<DataExport[]> {
    try {
      const result = await this.makeAuthenticatedRequest<DataExport[]>(
        '/api/gdpr/exports',
        {},
        'gdpr-exports'
      );

      return result || [];
    } catch (error) {
      console.error('[GDPRSingleton] Failed to get exports:', error);
      return [];
    }
  }

  /**
   * Request account deletion
   */
  async requestAccountDeletion(data: AccountDeletionFormData): Promise<AccountDeletionRequest> {
    try {
      const result = await this.makeAuthenticatedRequest<AccountDeletionRequest>(
        '/api/gdpr/delete',
        { 
          method: 'POST',
          body: JSON.stringify(data)
        },
        'gdpr-request-deletion'
      );

      if (!result) {
        throw new Error('No data returned from deletion request');
      }

      // Invalidate deletion requests cache
      await this.invalidateCache('gdpr-deletion-requests*');

      return result;
    } catch (error) {
      console.error('[GDPRSingleton] Failed to request account deletion:', error);
      throw error;
    }
  }

  /**
   * Get deletion request status
   */
  async getDeletionStatus(): Promise<AccountDeletionRequest> {
    try {
      const result = await this.makeAuthenticatedRequest<AccountDeletionRequest>(
        '/api/gdpr/delete/status',
        {},
        'gdpr-deletion-status'
      );

      return result || {} as AccountDeletionRequest;
    } catch (error) {
      console.error('[GDPRSingleton] Failed to get deletion status:', error);
      return {} as AccountDeletionRequest;
    }
  }

  // ==================== Phase 2: Full GDPR Compliance ====================

  /**
   * Get user consent records
   */
  async getConsents(): Promise<ConsentRecord[]> {
    try {
      const result = await this.makeAuthenticatedRequest<ConsentRecord[]>(
        '/api/gdpr/consents',
        {},
        'gdpr-consents'
      );

      return result || [];
    } catch (error) {
      console.error('[GDPRSingleton] Failed to get consents:', error);
      return [];
    }
  }

  /**
   * Get consent history
   */
  async getConsentHistory(): Promise<ConsentHistoryEntry[]> {
    try {
      const result = await this.makeAuthenticatedRequest<ConsentHistoryEntry[]>(
        '/api/gdpr/consents/history',
        {},
        'gdpr-consent-history'
      );

      return result || [];
    } catch (error) {
      console.error('[GDPRSingleton] Failed to get consent history:', error);
      return [];
    }
  }

  /**
   * Update consent
   */
  async updateConsent(data: ConsentUpdateData): Promise<void> {
    try {
      await this.makeAuthenticatedRequest<void>(
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
      await this.makeAuthenticatedRequest<void>(
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
    try {
      const result = await this.makeAuthenticatedRequest<UserPreference[]>(
        '/api/user/preferences',
        {},
        'gdpr-user-preferences'
      );

      return result || [];
    } catch (error) {
      console.error('[GDPRSingleton] Failed to get user preferences:', error);
      return [];
    }
  }

  /**
   * Update user preference
   */
  async updateUserPreference(data: PreferenceUpdateData): Promise<void> {
    try {
      await this.makeAuthenticatedRequest<void>(
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
    try {
      const response = await this.makeAuthenticatedRequest<Response>(
        '/api/user/preferences/export',
        {},
        'gdpr-export-preferences'
      );

      if (!response) {
        throw new Error('No response from preferences export');
      }

      return await response.blob();
    } catch (error) {
      console.error('[GDPRSingleton] Failed to export user preferences:', error);
      throw error;
    }
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
