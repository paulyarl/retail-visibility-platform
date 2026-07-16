/**
 * GDPR Hook
 * Phase 1 & 2: GDPR Compliance Features
 */

import { useState, useEffect, useCallback } from 'react';
import {
  DataExport,
  AccountDeletionRequest,
  ConsentRecord,
  UserPreference,
  DataExportFormData,
  AccountDeletionFormData,
  ConsentUpdateData,
  PreferenceUpdateData,
} from '@/types/security';
import * as gdprService from '@/services/gdpr';
import { clientLogger } from '@/lib/client-logger';

export function useGDPR() {
  const [exports, setExports] = useState<DataExport[]>([]);
  const [deletionRequest, setDeletionRequest] = useState<AccountDeletionRequest | null>(null);
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [preferences, setPreferences] = useState<UserPreference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExports = useCallback(async () => {
    try {
      const data = await gdprService.getExports();
      setExports(data);
    } catch (err) {
      clientLogger.error('Failed to fetch exports:', { detail: err });
    }
  }, []);

  const fetchDeletionStatus = useCallback(async () => {
    try {
      const data = await gdprService.getDeletionStatus();
      setDeletionRequest(data);
    } catch (err) {
      clientLogger.error('Failed to fetch deletion status:', { detail: err });
    }
  }, []);

  const fetchConsents = useCallback(async () => {
    try {
      const data = await gdprService.getConsents();
      setConsents(data);
    } catch (err) {
      clientLogger.error('Failed to fetch consents:', { detail: err });
    }
  }, []);

  const fetchPreferences = useCallback(async () => {
    try {
      const data = await gdprService.getUserPreferences();
      setPreferences(data);
    } catch (err) {
      clientLogger.error('Failed to fetch preferences:', { detail: err });
    }
  }, []);

  const requestExport = useCallback(async (data: DataExportFormData) => {
    try {
      const result = await gdprService.requestDataExport(data);
      setExports(prev => [result, ...prev]);
      return result;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to request export');
    }
  }, []);

  const downloadExport = useCallback(async (exportId: string) => {
    try {
      const blob = await gdprService.downloadExport(exportId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-export-${exportId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to download export');
    }
  }, []);

  const requestDeletion = useCallback(async (data: AccountDeletionFormData) => {
    try {
      const result = await gdprService.requestAccountDeletion(data);
      setDeletionRequest(result);
      return result;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to request deletion');
    }
  }, []);

  const cancelDeletion = useCallback(async () => {
    try {
      await gdprService.cancelAccountDeletion();
      setDeletionRequest(null);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to cancel deletion');
    }
  }, []);

  const updateConsent = useCallback(async (data: ConsentUpdateData) => {
    try {
      await gdprService.updateConsent(data);
      // After updating, refetch consents to get the latest state
      await fetchConsents();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update consent');
    }
  }, [fetchConsents]);

  const updatePreference = useCallback(async (data: PreferenceUpdateData) => {
    try {
      await gdprService.updatePreference(data);
      // After updating, refetch preferences to get the latest state
      await fetchPreferences();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update preference');
    }
  }, [fetchPreferences]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchExports(),
          fetchDeletionStatus(),
          fetchConsents(),
          fetchPreferences(),
        ]);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load GDPR data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchExports, fetchDeletionStatus, fetchConsents, fetchPreferences]);

  return {
    exports,
    deletionRequest,
    consents,
    preferences,
    loading,
    error,
    requestExport,
    downloadExport,
    requestDeletion,
    cancelDeletion,
    updateConsent,
    updatePreference,
    refresh: () => {
      fetchExports();
      fetchDeletionStatus();
      fetchConsents();
      fetchPreferences();
    },
  };
}
