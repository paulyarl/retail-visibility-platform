/**
 * Encryption utilities for secure localStorage caching
 * Uses Web Crypto API with AES-GCM encryption
 */

export class CacheEncryption {
  private static readonly ALGORITHM = 'AES-GCM';
  private static readonly KEY_LENGTH = 256;
  private static readonly IV_LENGTH = 12; // 96 bits for GCM

  /**
   * Derive encryption key from salt and optional user-specific data
   */
  private static async deriveKey(salt: Uint8Array, userData?: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(`cache-encryption-key${userData || ''}`),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(salt),
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: this.ALGORITHM,
        length: this.KEY_LENGTH
      },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Generate a random salt for key derivation
   */
  private static generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(16));
  }

  /**
   * Generate a random IV for encryption
   */
  private static generateIv(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
  }

  /**
   * Encrypt data using AES-GCM
   */
  static async encrypt(data: string, userId?: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const salt = this.generateSalt();
      const iv = this.generateIv();
      const key = await this.deriveKey(salt, userId);

      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.ALGORITHM,
          iv: new Uint8Array(iv)
        },
        key,
        encoder.encode(data)
      );

      // Combine salt + iv + encrypted data
      const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encrypted), salt.length + iv.length);

      // Return as base64 string
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.warn('[CacheEncryption] Encryption failed:', error);
      // Fallback to plain data if encryption fails (for development/debugging)
      return btoa(data);
    }
  }

  /**
   * Decrypt data using AES-GCM
   */
  static async decrypt(encryptedData: string, userId?: string): Promise<string> {
    try {
      const combined = new Uint8Array(
        atob(encryptedData).split('').map(c => c.charCodeAt(0))
      );

      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 16 + this.IV_LENGTH);
      const encrypted = combined.slice(16 + this.IV_LENGTH);

      const key = await this.deriveKey(salt, userId);

      const decrypted = await crypto.subtle.decrypt(
        {
          name: this.ALGORITHM,
          iv: new Uint8Array(iv)
        },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.warn('[CacheEncryption] Decryption failed:', error);
      // Fallback to plain data if decryption fails (handles unencrypted legacy data)
      return encryptedData;
    }
  }
}
