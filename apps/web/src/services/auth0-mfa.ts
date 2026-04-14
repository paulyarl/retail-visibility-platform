/**
 * Auth0 MFA Service - Frontend
 * Bridges custom MFA UI with Auth0 MFA backend
 * Extends AuthenticatedApiSingleton for platform consistency
 */

import { AuthenticatedApiSingleton } from '@/providers/base/AuthenticatedApiSingleton';
import { ApiResponse } from '@/types/security';

export interface Auth0MFAStatus {
  enabled: boolean;
  methods: {
    totp?: boolean;
    sms?: boolean;
    email?: boolean;
    push?: boolean;
    webauthn?: boolean;
  };
  phone?: string;
  backupCodes?: {
    remaining: number;
    total: number;
  };
}

export interface Auth0TOTPEnrollmentData {
  secret: string;
  qrCode: string;
  manualEntryKey: string;
  message: string;
}

export interface Auth0SMSEnrollmentData {
  factorId: string;
  message: string;
}

export interface Auth0BackupCodesData {
  backupCodes: string[];
  message: string;
}

export interface Auth0AvailableFactors {
  factors: string[];
}

/**
 * Auth0 MFA Service
 * Handles Auth0-based MFA operations using platform's singleton architecture
 */
export class Auth0MFAService extends AuthenticatedApiSingleton {
  private static instance: Auth0MFAService;
  protected cacheTTL: number = 5 * 60 * 1000; // 5 minutes for MFA status

  private constructor() {
    super('Auth0MFA');
  }

  static getInstance(): Auth0MFAService {
    if (!Auth0MFAService.instance) {
      Auth0MFAService.instance = new Auth0MFAService();
    }
    return Auth0MFAService.instance;
  }

  /**
   * Get MFA status for the current user
   */
  async getMFAStatus(): Promise<Auth0MFAStatus> {
    const result = await this.makeDefaultRequest<Auth0MFAStatus>(
      '/api/auth0-mfa/status',
      { method: 'GET' },
      'auth0-mfa-status'
    );
    
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to get MFA status';
      throw new Error(errorMessage);
    }
    
    return result.data!;
  }

  /**
   * Initiate TOTP enrollment
   */
  async initiateTOTPEnrollment(): Promise<Auth0TOTPEnrollmentData> {
    const result = await this.makeDefaultRequest<Auth0TOTPEnrollmentData>(
      '/api/auth0-mfa/totp/enroll',
      { method: 'POST' },
      'auth0-mfa-totp-enroll'
    );
    
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to setup TOTP';
      throw new Error(errorMessage);
    }
    
    return result.data!;
  }

  /**
   * Verify TOTP enrollment
   */
  async verifyTOTPEnrollment(factorId: string, code: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<any>(
      '/api/auth0-mfa/totp/verify',
      { 
        method: 'POST',
        body: JSON.stringify({ factorId, code }),
        headers: { 'Content-Type': 'application/json' }
      },
      'auth0-mfa-totp-verify'
    );
    
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to verify TOTP enrollment';
      throw new Error(errorMessage);
    }
    
    return true;
  }

  /**
   * Initiate SMS enrollment
   */
  async initiateSMSEnrollment(phoneNumber: string): Promise<Auth0SMSEnrollmentData> {
    const result = await this.makeDefaultRequest<Auth0SMSEnrollmentData>(
      '/api/auth0-mfa/sms/enroll',
      { 
        method: 'POST',
        body: JSON.stringify({ phoneNumber }),
        headers: { 'Content-Type': 'application/json' }
      },
      'auth0-mfa-sms-enroll'
    );
    
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to setup SMS';
      throw new Error(errorMessage);
    }
    
    return result.data!;
  }

  /**
   * Verify SMS enrollment
   */
  async verifySMSEnrollment(factorId: string, code: string): Promise<boolean> {
    const result = await this.makeDefaultRequest<any>(
      '/api/auth0-mfa/sms/verify',
      { 
        method: 'POST',
        body: JSON.stringify({ factorId, code }),
        headers: { 'Content-Type': 'application/json' }
      },
      'auth0-mfa-sms-verify'
    );
    
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to verify SMS enrollment';
      throw new Error(errorMessage);
    }
    
    return true;
  }

  /**
   * Delete an MFA factor
   */
  async deleteMFAFactor(factorId: string): Promise<void> {
    const result = await this.makeDefaultRequest<any>(
      `/api/auth0-mfa/factor/${factorId}`,
      { method: 'DELETE' },
      `auth0-mfa-factor-${factorId}`
    );
    
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to remove MFA factor';
      throw new Error(errorMessage);
    }
  }

  /**
   * Generate backup codes
   */
  async generateBackupCodes(): Promise<string[]> {
    const result = await this.makeDefaultRequest<Auth0BackupCodesData>(
      '/api/auth0-mfa/backup-codes/generate',
      { method: 'POST' },
      'auth0-mfa-backup-codes'
    );
    
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to generate backup codes';
      throw new Error(errorMessage);
    }
    
    return result.data!.backupCodes;
  }

  /**
   * Get available MFA factors for enrollment
   */
  async getAvailableFactors(): Promise<string[]> {
    const result = await this.makeDefaultRequest<Auth0AvailableFactors>(
      '/api/auth0-mfa/factors/available',
      { method: 'GET' },
      'auth0-mfa-factors'
    );
    
    if (!result.success) {
      const errorMessage = typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to get available factors';
      throw new Error(errorMessage);
    }
    
    return result.data!.factors;
  }

  /**
   * Cache patterns for MFA data
   */
  public getServiceCachePatterns(): string[] {
    return [
      'auth0-mfa-status',
      'auth0-mfa-factors',
      'auth0-mfa-enrollment',
      'auth0-mfa-backup-codes',
    ];
  }

  /**
   * Invalidate MFA-related cache
   */
  public invalidateMFACache(): void {
    this.invalidateCache();
  }
}

// Export singleton instance
export const auth0MFAService = Auth0MFAService.getInstance();
