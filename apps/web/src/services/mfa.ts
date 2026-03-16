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
import { securitySingletonService } from './SecuritySingletonService';
// import { securitySingletonService } from '@/services/SecuritySingletonService';

/**
 * Get MFA status for the current user
 */
export async function getMFAStatus(): Promise<MFAStatus> {
  return await securitySingletonService.getMFAStatus();
}

/**
 * Setup MFA - generates secret and QR code
 */
export async function setupMFA(): Promise<MFASetupData> {
  return await securitySingletonService.setupMFA();
}

/**
 * Verify MFA setup with verification code
 */
export async function verifyMFASetup(data: MFASetupFormData): Promise<boolean> {
  return await securitySingletonService.verifyMFASetup(data);
}

/**
 * Verify MFA token during login
 */
export async function verifyMFALogin(token: string, userId: string): Promise<MFAVerificationResult> {
  return await securitySingletonService.verifyMFALogin(token, userId);
}

/**
 * Disable MFA for the current user
 */
export async function disableMFA(): Promise<void> {
  await securitySingletonService.disableMFA();
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(verificationCode: string): Promise<string[]> {
  return await securitySingletonService.regenerateBackupCodes(verificationCode);
}
