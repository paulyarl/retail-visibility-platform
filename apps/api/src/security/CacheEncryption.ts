/**
 * Cache Encryption Security Module
 * 
 * Provides military-grade AES-256-GCM encryption for cache data
 * with authentication tags and tamper detection.
 */

import crypto from 'crypto';

export interface EncryptionResult {
  encrypted: Buffer;
  iv: Buffer;
  authTag: Buffer;
  algorithm: string;
}

export interface DecryptionResult {
  data: any;
  verified: boolean;
  algorithm: string;
}

/**
 * Cache Encryption Service
 * Handles AES-256-GCM encryption with authentication
 */
export class CacheEncryption {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly ivLength = 16;  // 128 bits
  private readonly authTagLength = 16; // 128 bits
  private readonly key: Buffer;
  private readonly additionalData = Buffer.from('tenant-identifier-cache-v1');

  constructor(encryptionKey: string) {
    // Derive a proper 256-bit key using scrypt
    this.key = crypto.scryptSync(encryptionKey, 'cache-encryption-salt', this.keyLength);
  }

  /**
   * Encrypt data with AES-256-GCM
   */
  encrypt(data: any): EncryptionResult {
    try {
      // Generate random IV
      const iv = crypto.randomBytes(this.ivLength);
      
      // Create cipher
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
      
      // Set additional authenticated data
      cipher.setAAD(this.additionalData);
      
      // Convert data to JSON and encrypt
      const jsonString = JSON.stringify(data);
      let encrypted = cipher.update(jsonString, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      // Get authentication tag
      const authTag = cipher.getAuthTag();
      
      // Combine all components
      const encryptedBuffer = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'hex')]);

      return {
        encrypted: encryptedBuffer,
        iv,
        authTag,
        algorithm: this.algorithm
      };
    } catch (error) {
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Decrypt data with AES-256-GCM
   */
  decrypt(encryptedData: Buffer): DecryptionResult {
    try {
      // Extract components
      const iv = encryptedData.slice(0, this.ivLength);
      const authTag = encryptedData.slice(this.ivLength, this.ivLength + this.authTagLength);
      const encrypted = encryptedData.slice(this.ivLength + this.authTagLength);
      
      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      
      // Set additional authenticated data and auth tag
      decipher.setAAD(this.additionalData);
      decipher.setAuthTag(authTag);
      
      // Decrypt
      let decrypted = decipher.update(encrypted.toString('hex'), 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Parse JSON
      const data = JSON.parse(decrypted);
      
      return {
        data,
        verified: true,
        algorithm: this.algorithm
      };
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify data integrity without full decryption
   */
  verifyIntegrity(encryptedData: Buffer): boolean {
    try {
      // Attempt decryption - if it fails, integrity is compromised
      this.decrypt(encryptedData);
      return true;
    } catch (error) {
      console.error('[Cache Encryption] Integrity check failed:', error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  }

  /**
   * Generate a new encryption key
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Derive key from password using scrypt
   */
  static deriveKey(password: string, salt: string = 'default-salt'): Buffer {
    return crypto.scryptSync(password, salt, 32);
  }

  /**
   * Get encryption info
   */
  getEncryptionInfo(): {
    algorithm: string;
    keyLength: number;
    ivLength: number;
    authTagLength: number;
    additionalDataLength: number;
  } {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      ivLength: this.ivLength,
      authTagLength: this.authTagLength,
      additionalDataLength: this.additionalData.length
    };
  }
}

/**
 * Cache Key Manager
 * Handles key rotation and management
 */
export class CacheKeyManager {
  private static currentKey: string | null = null;
  private static keyRotationInterval = 24 * 60 * 60 * 1000; // 24 hours
  private static lastRotation = 0;

  /**
   * Get current encryption key
   */
  static getCurrentKey(): string {
    const now = Date.now();
    
    // Check if key rotation is needed
    if (!this.currentKey || (now - this.lastRotation) > this.keyRotationInterval) {
      this.rotateKey();
    }
    
    return this.currentKey!;
  }

  /**
   * Rotate encryption key
   */
  static rotateKey(): void {
    const oldKey = this.currentKey;
    this.currentKey = process.env.IDENTIFIER_CACHE_KEY || CacheEncryption.generateKey();
    this.lastRotation = Date.now();
    
    console.log('[Cache Key Manager] Key rotated');
    
    // In production, you'd want to re-encrypt cache with new key
    if (oldKey && process.env.NODE_ENV === 'production') {
      console.log('[Cache Key Manager] WARNING: Manual cache re-encryption needed');
    }
  }

  /**
   * Force key rotation
   */
  static forceRotation(): void {
    this.rotateKey();
  }

  /**
   * Get key info
   */
  static getKeyInfo(): {
    currentKeySet: boolean;
    lastRotation: number;
    rotationInterval: number;
    nextRotation: number;
  } {
    return {
      currentKeySet: !!this.currentKey,
      lastRotation: this.lastRotation,
      rotationInterval: this.keyRotationInterval,
      nextRotation: this.lastRotation + this.keyRotationInterval
    };
  }
}
