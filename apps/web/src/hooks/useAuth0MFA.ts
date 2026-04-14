/**
 * Auth0 MFA Hook
 * React hook for Auth0 MFA operations
 */

import { useState, useEffect } from 'react';
import { 
  auth0MFAService, 
  Auth0MFAStatus, 
  Auth0TOTPEnrollmentData,
  Auth0SMSEnrollmentData 
} from '@/services/auth0-mfa';

export function useAuth0MFA() {
  const [mfaStatus, setMfaStatus] = useState<Auth0MFAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load MFA status on mount
  useEffect(() => {
    loadMFAStatus();
  }, []);

  const loadMFAStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const status = await auth0MFAService.getMFAStatus();
      setMfaStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MFA status');
    } finally {
      setLoading(false);
    }
  };

  const initiateTOTPEnrollment = async (): Promise<Auth0TOTPEnrollmentData> => {
    try {
      setError(null);
      const enrollmentData = await auth0MFAService.initiateTOTPEnrollment();
      return enrollmentData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start TOTP enrollment';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const verifyTOTPEnrollment = async (factorId: string, code: string): Promise<boolean> => {
    try {
      setError(null);
      const success = await auth0MFAService.verifyTOTPEnrollment(factorId, code);
      await loadMFAStatus(); // Refresh status
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify TOTP enrollment';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const initiateSMSEnrollment = async (phoneNumber: string): Promise<Auth0SMSEnrollmentData> => {
    try {
      setError(null);
      const enrollmentData = await auth0MFAService.initiateSMSEnrollment(phoneNumber);
      return enrollmentData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start SMS enrollment';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const verifySMSEnrollment = async (factorId: string, code: string): Promise<boolean> => {
    try {
      setError(null);
      const success = await auth0MFAService.verifySMSEnrollment(factorId, code);
      await loadMFAStatus(); // Refresh status
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify SMS enrollment';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const deleteMFAFactor = async (factorId: string): Promise<void> => {
    try {
      setError(null);
      await auth0MFAService.deleteMFAFactor(factorId);
      await loadMFAStatus(); // Refresh status
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove MFA factor';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const generateBackupCodes = async (): Promise<string[]> => {
    try {
      setError(null);
      const backupCodes = await auth0MFAService.generateBackupCodes();
      await loadMFAStatus(); // Refresh status
      return backupCodes;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate backup codes';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const getAvailableFactors = async (): Promise<string[]> => {
    try {
      setError(null);
      return await auth0MFAService.getAvailableFactors();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get available factors';
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const clearError = () => {
    setError(null);
  };

  return {
    mfaStatus,
    loading,
    error,
    loadMFAStatus,
    initiateTOTPEnrollment,
    verifyTOTPEnrollment,
    initiateSMSEnrollment,
    verifySMSEnrollment,
    deleteMFAFactor,
    generateBackupCodes,
    getAvailableFactors,
    clearError,
  };
}
