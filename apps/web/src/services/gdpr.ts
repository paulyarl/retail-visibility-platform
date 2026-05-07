/**
 * GDPR API Service
 * Phase 1 & 2: GDPR Compliance Features
 * 
 * Legacy service - use GDPRSingletonService instead
 * This file is kept for backward compatibility
 */

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
import { gdprService } from './GDPRSingletonService';

// ==================== Phase 1: Basic GDPR ====================

/**
 * Request a data export
 * @deprecated Use gdprService.requestDataExport() instead
 */
export async function requestDataExport(data: DataExportFormData): Promise<DataExport> {
  return await gdprService.requestDataExport(data);
}

/**
 * Get export status
 * @deprecated Use gdprService.getExportStatus() instead
 */
export async function getExportStatus(exportId: string): Promise<DataExport> {
  return await gdprService.getExportStatus(exportId);
}

/**
 * Download exported data
 * @deprecated Use gdprService.downloadExport() instead
 */
export async function downloadExport(exportId: string): Promise<Blob> {
  return await gdprService.downloadExport(exportId);
}

/**
 * Get all exports for the user
 * @deprecated Use gdprService.getExports() instead
 */
export async function getExports(): Promise<DataExport[]> {
  return await gdprService.getExports();
}

/**
 * Request account deletion
 * @deprecated Use gdprService.requestAccountDeletion() instead
 */
export async function requestAccountDeletion(data: AccountDeletionFormData): Promise<AccountDeletionRequest> {
  return await gdprService.requestAccountDeletion(data);
}

/**
 * Get deletion request status
 * @deprecated Use gdprService.getDeletionStatus() instead
 */
export async function getDeletionStatus(): Promise<AccountDeletionRequest> {
  return await gdprService.getDeletionStatus();
}

// ==================== Phase 2: Full GDPR Compliance ====================

/**
 * Get user consent records
 * @deprecated Use gdprService.getConsents() instead
 */
export async function getConsents(): Promise<ConsentRecord[]> {
  return await gdprService.getConsents();
}

/**
 * Get consent history
 * @deprecated Use gdprService.getConsentHistory() instead
 */
export async function getConsentHistory(): Promise<ConsentHistoryEntry[]> {
  return await gdprService.getConsentHistory();
}

/**
 * Update consent
 * @deprecated Use gdprService.updateConsent() instead
 */
export async function updateConsent(data: ConsentUpdateData): Promise<void> {
  return await gdprService.updateConsent(data);
}

/**
 * Bulk update consents
 * @deprecated Use gdprService.bulkUpdateConsents() instead
 */
export async function bulkUpdateConsents(data: BulkConsentUpdateData): Promise<void> {
  return await gdprService.bulkUpdateConsents(data);
}

/**
 * Get user preferences
 * @deprecated Use gdprService.getUserPreferences() instead
 */
export async function getUserPreferences(): Promise<UserPreference[]> {
  return await gdprService.getUserPreferences();
}

/**
 * Update user preference
 * @deprecated Use gdprService.updateUserPreference() instead
 */
export async function updateUserPreference(data: PreferenceUpdateData): Promise<void> {
  return await gdprService.updateUserPreference(data);
}

/**
 * Export user preferences
 * @deprecated Use gdprService.exportUserPreferences() instead
 */
export async function getUserPreferencesExport(): Promise<Blob> {
  return await gdprService.exportUserPreferences();
}

/**
 * Get export history (alias for getExports)
 * @deprecated Use gdprService.getExports() instead
 */
export async function getExportHistory(): Promise<DataExport[]> {
  return await gdprService.getExports();
}

/**
 * Get account deletion status (alias for getDeletionStatus)
 * @deprecated Use gdprService.getDeletionStatus() instead
 */
export async function getAccountDeletionStatus(): Promise<AccountDeletionRequest> {
  return await gdprService.getDeletionStatus();
}

/**
 * Get user consents (alias for getConsents)
 * @deprecated Use gdprService.getConsents() instead
 */
export async function getUserConsents(): Promise<ConsentRecord[]> {
  return await gdprService.getConsents();
}

/**
 * Cancel account deletion
 * @deprecated This functionality is not implemented in the singleton yet
 */
export async function cancelAccountDeletion(): Promise<void> {
  // This would need to be implemented in the singleton service
  // For now, throw an error to indicate it's not available
  throw new Error('cancelAccountDeletion is not implemented in the singleton service');
}

/**
 * Update preference (alias for updateUserPreference)
 * @deprecated Use gdprService.updateUserPreference() instead
 */
export async function updatePreference(data: PreferenceUpdateData): Promise<void> {
  return await gdprService.updateUserPreference(data);
}

/**
 * Export user preferences
 */
export async function exportPreferences(): Promise<Blob> {
  return await gdprService.exportUserPreferences();
}

/**
 * Import user preferences
 * Note: This functionality is not yet implemented in the singleton service
 */
export async function importPreferences(file: File): Promise<void> {
  // This would need to be implemented in the singleton service
  // For now, throw an error to indicate it's not available
  throw new Error('importPreferences is not implemented in the singleton service');
}
