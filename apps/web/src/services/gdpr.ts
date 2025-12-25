/**
 * GDPR API Service
 * Phase 1 & 2: GDPR Compliance Features
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
import { api } from '@/lib/api';

// ==================== Phase 1: Basic GDPR ====================

/**
 * Request a data export
 */
export async function requestDataExport(data: DataExportFormData): Promise<DataExport> {
  const response = await api.post('/api/gdpr/export', data);

  if (!response.ok) {
    throw new Error('Failed to request data export');
  }

  const result: ApiResponse<DataExport> = await response.json();
  if (!result.data) {
    throw new Error('No data returned from export request');
  }
  return result.data;
}

/**
 * Get export status
 */
export async function getExportStatus(exportId: string): Promise<DataExport> {
  const response = await api.get(`/api/gdpr/export/${exportId}`);

  if (!response.ok) {
    throw new Error('Failed to get export status');
  }

  const result: ApiResponse<DataExport> = await response.json();
  if (!result.data) {
    throw new Error('No data returned from export status');
  }
  return result.data;
}

/**
 * Download exported data
 */
export async function downloadExport(exportId: string): Promise<Blob> {
  const response = await api.get(`/api/gdpr/export/${exportId}/download`);

  if (!response.ok) {
    throw new Error('Failed to download export');
  }

  return await response.blob();
}

/**
 * Get export history
 */
export async function getExportHistory(): Promise<DataExport[]> {
  const response = await api.get('/api/gdpr/exports');

  if (!response.ok) {
    throw new Error('Failed to get export history');
  }

  const result: ApiResponse<DataExport[]> = await response.json();
  return result.data || [];
}

/**
 * Request account deletion
 */
export async function requestAccountDeletion(data: AccountDeletionFormData): Promise<AccountDeletionRequest> {
  const response = await api.post('/api/gdpr/delete', data);

  if (!response.ok) {
    throw new Error('Failed to request account deletion');
  }

  const result: ApiResponse<AccountDeletionRequest> = await response.json();
  if (!result.data) {
    throw new Error('No data returned from deletion request');
  }
  return result.data;
}

/**
 * Get account deletion status
 */
export async function getAccountDeletionStatus(): Promise<AccountDeletionRequest | null> {
  const response = await api.get('/api/gdpr/delete/status');

  if (!response.ok) {
    throw new Error('Failed to get deletion status');
  }

  const result: ApiResponse<AccountDeletionRequest | null> = await response.json();
  return result.data || null;
}

/**
 * Cancel account deletion request
 */
export async function cancelAccountDeletion(): Promise<void> {
  const response = await api.delete('/api/gdpr/delete');

  if (!response.ok) {
    throw new Error('Failed to cancel account deletion');
  }
}

// ==================== Phase 2: Full GDPR Compliance ====================

/**
 * Get user consents
 */
export async function getUserConsents(): Promise<ConsentRecord[]> {
  const response = await api.get('/api/gdpr/consents');

  if (!response.ok) {
    throw new Error('Failed to get user consents');
  }

  const result: ApiResponse<ConsentRecord[]> = await response.json();
  return result.data || [];
}

/**
 * Update a single consent
 */
export async function updateConsent(data: ConsentUpdateData): Promise<ConsentRecord> {
  const response = await api.put(`/api/gdpr/consents/${data.type}`, { consented: data.consented });

  if (!response.ok) {
    throw new Error('Failed to update consent');
  }

  const result: ApiResponse<ConsentRecord> = await response.json();
  if (!result.data) {
    throw new Error('No data returned from consent update');
  }
  return result.data;
}

/**
 * Bulk update consents
 */
export async function bulkUpdateConsents(data: BulkConsentUpdateData): Promise<ConsentRecord[]> {
  const response = await api.put('/api/gdpr/consents/bulk', data);

  if (!response.ok) {
    throw new Error('Failed to bulk update consents');
  }

  const result: ApiResponse<ConsentRecord[]> = await response.json();
  return result.data || [];
}

/**
 * Get consent history
 */
export async function getConsentHistory(): Promise<ConsentHistoryEntry[]> {
  const response = await api.get('/api/gdpr/consents/history');

  if (!response.ok) {
    throw new Error('Failed to get consent history');
  }

  const result: ApiResponse<ConsentHistoryEntry[]> = await response.json();
  return result.data || [];
}

/**
 * Get user preferences
 */
export async function getUserPreferences(): Promise<UserPreference[]> {
  const response = await api.get('/api/user/preferences');

  if (!response.ok) {
    throw new Error('Failed to get user preferences');
  }

  const result: ApiResponse<UserPreference[]> = await response.json();
  return result.data || [];
}

/**
 * Update a single preference
 */
export async function updatePreference(data: PreferenceUpdateData): Promise<UserPreference> {
  const response = await api.put(`/api/user/preferences/${data.key}`, { value: data.value });

  if (!response.ok) {
    throw new Error('Failed to update preference');
  }

  const result: ApiResponse<UserPreference> = await response.json();
  if (!result.data) {
    throw new Error('No data returned from preference update');
  }
  return result.data;
}

/**
 * Bulk update preferences
 */
export async function bulkUpdatePreferences(updates: PreferenceUpdateData[]): Promise<UserPreference[]> {
  const response = await api.put('/api/user/preferences/bulk', { updates });

  if (!response.ok) {
    throw new Error('Failed to bulk update preferences');
  }

  const result: ApiResponse<UserPreference[]> = await response.json();
  return result.data || [];
}

/**
 * Export user preferences
 */
export async function exportPreferences(): Promise<Blob> {
  const response = await api.get('/api/user/preferences/export');

  if (!response.ok) {
    throw new Error('Failed to export preferences');
  }

  return await response.blob();
}

/**
 * Import user preferences
 */
export async function importPreferences(file: File): Promise<UserPreference[]> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/api/user/preferences/import', formData);

  if (!response.ok) {
    throw new Error('Failed to import preferences');
  }

  const result: ApiResponse<UserPreference[]> = await response.json();
  return result.data || [];
}
