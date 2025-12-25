/**
 * MFA Hook
 * Phase 3: Multi-Factor Authentication
 */

import { useState, useEffect, useCallback } from 'react';
import { MFAStatus, MFASetupData, MFASetupFormData } from '@/types/security';
import * as mfaService from '@/services/mfa';

export function useMFA() {
  const [status, setStatus] = useState<MFAStatus | null>(null);
  const [setupData, setSetupData] = useState<MFASetupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      const data = await mfaService.getMFAStatus();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch MFA status');
    } finally {
      setLoading(false);
    }
  }, []);

  const initializeSetup = useCallback(async () => {
    try {
      setLoading(true);
      const data = await mfaService.setupMFA();
      setSetupData(data);
      setError(null);
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to setup MFA';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const verifySetup = useCallback(async (formData: MFASetupFormData) => {
    try {
      const verified = await mfaService.verifyMFASetup(formData);
      if (verified) {
        await fetchStatus();
        setSetupData(null);
      }
      return verified;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to verify MFA setup');
    }
  }, [fetchStatus]);

  const disable = useCallback(async () => {
    try {
      await mfaService.disableMFA();
      await fetchStatus();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to disable MFA');
    }
  }, [fetchStatus]);

  const regenerateCodes = useCallback(async (verificationCode: string) => {
    try {
      const codes = await mfaService.regenerateBackupCodes(verificationCode);
      await fetchStatus();
      return codes;
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to regenerate backup codes');
    }
  }, [fetchStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Wrapper methods for component compatibility
  const setupMFA = useCallback(async () => {
    const data = await initializeSetup();
    return {
      qrCode: data.qrCodeUrl,
      secret: data.secret,
    };
  }, [initializeSetup]);

  const verifyLogin = useCallback(async (code: string) => {
    // Note: userId should be obtained from auth context in real implementation
    return await mfaService.verifyMFALogin(code, '');
  }, []);

  const disableMFA = useCallback(async () => {
    return await disable();
  }, [disable]);

  const regenerateBackupCodes = useCallback(async () => {
    // For regeneration, we may need to prompt for verification code
    // For now, using empty string - should be updated based on your flow
    return await regenerateCodes('');
  }, [regenerateCodes]);

  return {
    status,
    setupData,
    loading,
    error,
    // Original methods
    initializeSetup,
    verifySetup,
    disable,
    regenerateCodes,
    refresh: fetchStatus,
    // Component-compatible aliases
    setupMFA,
    verifyLogin,
    mfaStatus: status,
    disableMFA,
    regenerateBackupCodes,
  };
}
