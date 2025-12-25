/**
 * MFA API Service
 * Phase 3: Multi-Factor Authentication
 */

import {
  MFAStatus,
  MFASetupData,
  MFAVerificationResult,
  ApiResponse,
  MFASetupFormData,
} from '@/types/security';
import { api } from '@/lib/api';

/**
 * Get MFA status for the current user
 */
export async function getMFAStatus(): Promise<MFAStatus> {
  const response = await api.get('/api/auth/mfa/status');

  if (!response.ok) {
    throw new Error('Failed to get MFA status');
  }

  const result: ApiResponse<MFAStatus> = await response.json();
  if (!result.data) {
    throw new Error('No data returned from MFA status');
  }
  return result.data;
}

/**
 * Setup MFA - generates secret and QR code
 */
export async function setupMFA(): Promise<MFASetupData> {
  const response = await api.post('/api/auth/mfa/setup');

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to setup MFA');
  }

  const result: ApiResponse<MFASetupData> = await response.json();
  if (!result.data) {
    throw new Error('No data returned from MFA setup');
  }
  return result.data;
}

/**
 * Verify MFA setup with verification code
 */
export async function verifyMFASetup(data: MFASetupFormData): Promise<boolean> {
  const response = await api.post('/api/auth/mfa/verify', { token: data.verificationCode });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to verify MFA setup');
  }

  const result: ApiResponse<{ verified: boolean }> = await response.json();
  return result.data?.verified || false;
}

/**
 * Verify MFA token during login
 */
export async function verifyMFALogin(token: string, userId: string): Promise<MFAVerificationResult> {
  const response = await api.post('/api/auth/mfa/verify-login', { token, userId });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to verify MFA login');
  }

  const result: ApiResponse<MFAVerificationResult> = await response.json();
  if (!result.data) {
    throw new Error('No data returned from MFA login verification');
  }
  return result.data;
}

/**
 * Disable MFA for the current user
 */
export async function disableMFA(): Promise<void> {
  const response = await api.post('/api/auth/mfa/disable');

  if (!response.ok) {
    throw new Error('Failed to disable MFA');
  }
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(verificationCode: string): Promise<string[]> {
  const response = await api.post('/api/auth/mfa/regenerate-backup', { token: verificationCode });

  if (!response.ok) {
    throw new Error('Failed to regenerate backup codes');
  }

  const result: ApiResponse<{ backupCodes: string[] }> = await response.json();
  return result.data?.backupCodes || [];
}
