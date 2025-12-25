/**
 * MFA (Multi-Factor Authentication) Service - Phase 3
 * Implements TOTP-based MFA with backup codes and secure secret storage
 */

import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { prisma } from '../prisma';
import { logger } from '../logger';

export interface MFASetupResponse {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface MFAVerificationResult {
  success: boolean;
  message: string;
  requiresSetup?: boolean;
}

export class MFAService {
  private readonly ENCRYPTION_KEY: string;
  private readonly ALGORITHM = 'aes-256-gcm';

  constructor() {
    // In production, this should come from environment variables
    this.ENCRYPTION_KEY = process.env.MFA_ENCRYPTION_KEY || 'a1b2c3d4e5f678901234567890123456789012345678901234567890123456789012';
    if (this.ENCRYPTION_KEY.length !== 64) {
      throw new Error('MFA_ENCRYPTION_KEY must be exactly 64 characters (32 bytes in hex)');
    }
  }

  /**
   * Encrypt sensitive MFA data
   */
  private encrypt(text: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv) as any;

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive MFA data
   */
  private decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-gcm';
    const key = Buffer.from(this.ENCRYPTION_KEY, 'hex');
    const parts = encryptedText.split(':');
    if (parts.length !== 3) throw new Error('Invalid encrypted data format');

    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];

    const decipher = crypto.createDecipheriv(algorithm, key, iv) as any;
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Generate backup codes for MFA recovery
   */
  private generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  /**
   * Setup MFA for a user - generates secret and QR code
   */
  async setupMFA(userId: string): Promise<MFASetupResponse> {
    try {
      // Check if user already has MFA enabled
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { mfa_enabled: true, email: true }
      });

      if (!user) {
        throw new Error('User not found');
      }

      if (user.mfa_enabled) {
        throw new Error('MFA is already enabled for this user');
      }

      // Generate TOTP secret
      const secret = speakeasy.generateSecret({
        name: `VisibleShelf (${user.email})`,
        issuer: 'VisibleShelf'
      });

      // Generate backup codes
      const backupCodes = this.generateBackupCodes();

      // Encrypt the secret and each backup code individually
      const encryptedSecret = this.encrypt(secret.base32);
      const encryptedBackupCodes: string[] = backupCodes.map(code => this.encrypt(code));

      // Update user with MFA data (but don't enable yet)
      await prisma.users.update({
        where: { id: userId },
        data: {
          mfa_secret: encryptedSecret,
          mfa_backup_codes: encryptedBackupCodes,
          mfa_method: 'TOTP'
        }
      });

      // Generate QR code URL
      const qrCodeUrl = speakeasy.otpauthURL({
        secret: secret.ascii,
        label: encodeURIComponent(`VisibleShelf (${user.email})`),
        issuer: 'VisibleShelf',
        encoding: 'base32'
      });

      logger.info('MFA setup initiated', undefined, { userId });

      return {
        secret: secret.base32,
        qrCodeUrl,
        backupCodes
      };

    } catch (error) {
      logger.error('MFA setup failed', undefined, { userId, error: error as any });
      throw error;
    }
  }

  /**
   * Verify MFA setup with initial TOTP code
   */
  async verifyMFASetup(userId: string, token: string): Promise<boolean> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { mfa_secret: true, mfa_enabled: true }
      });

      if (!user || !user.mfa_secret) {
        throw new Error('MFA setup not initiated');
      }

      if (user.mfa_enabled) {
        throw new Error('MFA is already enabled');
      }

      // Decrypt the secret
      const decryptedSecret = this.decrypt(user.mfa_secret);

      // Verify the token
      const verified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token,
        window: 2 // Allow 2 time windows (30 seconds each)
      });

      if (verified) {
        // Enable MFA for the user
        await prisma.users.update({
          where: { id: userId },
          data: {
            mfa_enabled: true,
            mfa_verified_at: new Date()
          }
        });

        logger.info('MFA setup verified and enabled', undefined, { userId });
      }

      return verified;

    } catch (error) {
      logger.error('MFA setup verification failed', undefined, { userId, error: error as any });
      throw error;
    }
  }

  /**
   * Verify MFA token during login
   */
  async verifyMFAToken(userId: string, token: string): Promise<MFAVerificationResult> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          mfa_enabled: true,
          mfa_secret: true,
          mfa_backup_codes: true,
          mfa_method: true
        }
      });

      if (!user) {
        return { success: false, message: 'User not found' };
      }

      if (!user.mfa_enabled || !user.mfa_secret) {
        return { success: false, message: 'MFA not enabled', requiresSetup: true };
      }

      // Decrypt the secret
      const decryptedSecret = this.decrypt(user.mfa_secret);

      // First try TOTP verification
      const totpVerified = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token,
        window: 2
      });

      if (totpVerified) {
        await prisma.users.update({
          where: { id: userId },
          data: { mfa_verified_at: new Date() }
        });

        logger.info('MFA token verified', undefined, { userId });
        return { success: true, message: 'MFA verified successfully' };
      }

      // If TOTP failed, check backup codes
      if (user.mfa_backup_codes && Array.isArray(user.mfa_backup_codes)) {
        // Find and decrypt the matching backup code
        for (let i = 0; i < user.mfa_backup_codes.length; i++) {
          try {
            const decryptedCode = this.decrypt(user.mfa_backup_codes[i]);
            if (decryptedCode === token) {
              // Remove the used backup code from the array
              const updatedEncryptedCodes = [...user.mfa_backup_codes];
              updatedEncryptedCodes.splice(i, 1);

              await prisma.users.update({
                where: { id: userId },
                data: {
                  mfa_backup_codes: updatedEncryptedCodes.length > 0 ? updatedEncryptedCodes : [],
                  mfa_verified_at: new Date()
                }
              });

              logger.info('MFA backup code used', undefined, { userId });
              return { success: true, message: 'Backup code accepted. Please set up MFA again.' };
            }
          } catch (error) {
            // Skip invalid encrypted codes
            continue;
          }
        }
      }

      return { success: false, message: 'Invalid MFA token' };

    } catch (error) {
      logger.error('MFA token verification failed', undefined, { userId, error: error as any });
      return { success: false, message: 'MFA verification error' };
    }
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(userId: string): Promise<void> {
    try {
      await prisma.users.update({
        where: { id: userId },
        data: {
          mfa_enabled: false,
          mfa_secret: null,
          mfa_backup_codes: [],
          mfa_method: null,
          mfa_verified_at: null
        }
      });

      logger.info('MFA disabled', undefined, { userId });

    } catch (error) {
      logger.error('MFA disable failed', undefined, { userId, error: error as any });
      throw error;
    }
  }

  /**
   * Get MFA status for a user
   */
  async getMFAStatus(userId: string): Promise<{
    enabled: boolean;
    method: string | null;
    verifiedAt: Date | null;
    backupCodesRemaining: number;
  }> {
    try {
      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: {
          mfa_enabled: true,
          mfa_method: true,
          mfa_verified_at: true,
          mfa_backup_codes: true
        }
      });

      if (!user) {
        throw new Error('User not found');
      }

      let backupCodesRemaining = 0;
      if (user.mfa_backup_codes && Array.isArray(user.mfa_backup_codes)) {
        // Count how many backup codes can be successfully decrypted
        for (const encryptedCode of user.mfa_backup_codes) {
          try {
            this.decrypt(encryptedCode);
            backupCodesRemaining++;
          } catch (error) {
            // Skip invalid encrypted codes
            continue;
          }
        }
      }

      return {
        enabled: user.mfa_enabled ?? false, // Default to false if null
        method: user.mfa_method,
        verifiedAt: user.mfa_verified_at,
        backupCodesRemaining
      };

    } catch (error) {
      logger.error('Failed to get MFA status', undefined, { userId, error: error as any });
      throw error;
    }
  }

  /**
   * Generate QR code as data URL for frontend display
   */
  async generateQRCode(qrCodeUrl: string): Promise<string> {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrCodeUrl);
      return qrCodeDataURL;
    } catch (error) {
      logger.error('QR code generation failed', undefined, { error: error as any });
      throw error;
    }
  }
}

// Create singleton instance
export const mfaService = new MFAService();
