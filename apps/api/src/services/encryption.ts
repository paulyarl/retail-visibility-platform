/**
 * Encryption Utilities - Phase 3 Advanced Security
 * Provides encryption/decryption for sensitive data and API communications
 */

import crypto from 'crypto';
import { logger } from '../logger';

export interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
}

export class EncryptionService {
  private readonly DEFAULT_CONFIG: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16
  };

  private readonly API_ENCRYPTION_KEY: string;
  private readonly DATA_ENCRYPTION_KEY: string;

  constructor() {
    // In production, these should come from secure environment variables
    this.API_ENCRYPTION_KEY = process.env.API_ENCRYPTION_KEY || 'your-32-char-api-encryption-key-here';
    this.DATA_ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || 'your-32-char-data-encryption-key-here';

    if (this.API_ENCRYPTION_KEY.length !== 32 || this.DATA_ENCRYPTION_KEY.length !== 32) {
      throw new Error('Encryption keys must be exactly 32 characters each');
    }
  }

  /**
   * Encrypt data for API responses (shorter-lived)
   */
  encryptForAPI(data: string): string {
    return this.encrypt(data, this.API_ENCRYPTION_KEY);
  }

  /**
   * Decrypt data from API requests
   */
  decryptFromAPI(encryptedData: string): string {
    return this.decrypt(encryptedData, this.API_ENCRYPTION_KEY);
  }

  /**
   * Encrypt sensitive data for database storage (longer-lived)
   */
  encryptForStorage(data: string): string {
    return this.encrypt(data, this.DATA_ENCRYPTION_KEY);
  }

  /**
   * Decrypt sensitive data from database
   */
  decryptFromStorage(encryptedData: string): string {
    return this.decrypt(encryptedData, this.DATA_ENCRYPTION_KEY);
  }

  /**
   * Core encryption method
   */
  private encrypt(data: string, key: string): string {
    try {
      const iv = crypto.randomBytes(this.DEFAULT_CONFIG.ivLength);
      const cipher = crypto.createCipheriv(this.DEFAULT_CONFIG.algorithm, key, iv) as any;
      cipher.setAutoPadding(true);
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();

      // Format: iv:authTag:encryptedData
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;

    } catch (error) {
      logger.error('Encryption failed', undefined, { error: error as any });
      throw new Error('Encryption failed');
    }
  }

  /**
   * Core decryption method
   */
  private decrypt(encryptedData: string, key: string): string {
    try {
      const parts = encryptedData.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];

      const decipher = crypto.createDecipheriv(this.DEFAULT_CONFIG.algorithm, key, iv) as any;
      decipher.setAuthTag(authTag);
      decipher.setAutoPadding(true);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;

    } catch (error) {
      logger.error('Decryption failed', undefined, { error: error as any });
      throw new Error('Decryption failed');
    }
  }

  /**
   * Generate a secure random key for encryption
   */
  static generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Hash sensitive data (one-way) for comparison
   */
  static hashData(data: string, saltRounds: number = 12): Promise<string> {
    return new Promise((resolve, reject) => {
      const bcrypt = require('bcryptjs');
      bcrypt.hash(data, saltRounds, (err: Error, hash: string) => {
        if (err) reject(err);
        else resolve(hash);
      });
    });
  }

  /**
   * Compare hashed data
   */
  static compareHash(data: string, hash: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const bcrypt = require('bcryptjs');
      bcrypt.compare(data, hash, (err: Error, result: boolean) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  /**
   * Encrypt specific database fields before storage
   */
  async encryptSensitiveFields(data: Record<string, any>, fieldsToEncrypt: string[]): Promise<Record<string, any>> {
    const encryptedData = { ...data };

    for (const field of fieldsToEncrypt) {
      if (encryptedData[field]) {
        encryptedData[field] = this.encryptForStorage(String(encryptedData[field]));
      }
    }

    return encryptedData;
  }

  /**
   * Decrypt specific database fields after retrieval
   */
  async decryptSensitiveFields(data: Record<string, any>, fieldsToDecrypt: string[]): Promise<Record<string, any>> {
    const decryptedData = { ...data };

    for (const field of fieldsToDecrypt) {
      if (decryptedData[field]) {
        try {
          decryptedData[field] = this.decryptFromStorage(String(decryptedData[field]));
        } catch (error) {
          logger.warn(`Failed to decrypt field ${field}`, undefined, { error: error as any });
          // Keep original encrypted value if decryption fails
        }
      }
    }

    return decryptedData;
  }
}

// Create singleton instance
export const encryptionService = new EncryptionService();
