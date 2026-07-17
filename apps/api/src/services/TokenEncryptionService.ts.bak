import crypto from 'crypto';

/**
 * Service for encrypting and decrypting OAuth tokens using AES-256-GCM
 * Provides authenticated encryption with additional data integrity checks
 */
export class TokenEncryptionService {
  private algorithm = 'aes-256-gcm';
  private key: Buffer;

  constructor() {
    const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
    
    if (!encryptionKey) {
      throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required');
    }
    
    if (encryptionKey.length !== 64) {
      throw new Error('TOKEN_ENCRYPTION_KEY must be 64 characters (32 bytes in hex format)');
    }
    
    this.key = Buffer.from(encryptionKey, 'hex');
  }

  /**
   * Encrypt a token string
   * @param text - Plain text token to encrypt
   * @returns Encrypted token in format: iv:authTag:encrypted
   */
  encrypt(text: string): string {
    if (!text) {
      throw new Error('Cannot encrypt empty text');
    }

    // Generate random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create cipher (cast to CipherGCM for getAuthTag support)
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv) as crypto.CipherGCM;
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag for integrity verification
    const authTag = cipher.getAuthTag();
    
    // Return format: iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt an encrypted token string
   * @param encryptedText - Encrypted token in format: iv:authTag:encrypted
   * @returns Decrypted plain text token
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) {
      throw new Error('Cannot decrypt empty text');
    }

    // Parse the encrypted format
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted token format. Expected format: iv:authTag:encrypted');
    }
    
    const [ivHex, authTagHex, encrypted] = parts;
    
    // Convert hex strings back to buffers
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Create decipher (cast to DecipherGCM for setAuthTag support)
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);
    
    // Decrypt the text
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Generate a secure encryption key (for setup/testing purposes)
   * @returns 64-character hex string suitable for TOKEN_ENCRYPTION_KEY
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Verify that the encryption service is properly configured
   * @returns true if encryption/decryption works correctly
   */
  verify(): boolean {
    try {
      const testString = 'test_token_' + Date.now();
      const encrypted = this.encrypt(testString);
      const decrypted = this.decrypt(encrypted);
      return testString === decrypted;
    } catch (error) {
      console.error('[TokenEncryption] Verification failed:', error);
      return false;
    }
  }
}
