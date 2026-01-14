import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_KEY = process.env.PAYMENT_CREDENTIAL_ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  console.warn('[Credential Encryption] PAYMENT_CREDENTIAL_ENCRYPTION_KEY not set - encryption disabled');
}

if (ENCRYPTION_KEY && ENCRYPTION_KEY.length !== 64) {
  throw new Error('PAYMENT_CREDENTIAL_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
}

const KEY = ENCRYPTION_KEY ? Buffer.from(ENCRYPTION_KEY, 'hex') : null;

export function encryptCredential(plaintext: string): string {
  if (!KEY) {
    throw new Error('Encryption key not configured');
  }

  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  // Format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decryptCredential(encrypted: string): string {
  // For testing: if encryption key not configured, assume base64 encoding
  if (!KEY) {
    try {
      return Buffer.from(encrypted, 'base64').toString('utf8');
    } catch (error) {
      throw new Error('Encryption key not configured and credential is not base64 encoded');
    }
  }

  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    // Fallback: try base64 decoding for test credentials
    try {
      return Buffer.from(encrypted, 'base64').toString('utf8');
    } catch (error) {
      throw new Error('Invalid encrypted credential format');
    }
  }
  
  const [ivHex, authTagHex, encryptedData] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function generateEncryptionKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(':');
  return parts.length === 3 && parts.every(part => /^[0-9a-f]+$/i.test(part));
}
