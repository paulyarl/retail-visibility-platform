import { BusinessProfile } from '@/lib/validation/businessProfile';

interface OnboardingProgress {
  currentStep: number;
  businessData: Partial<BusinessProfile>;
}

/**
 * Service for handling onboarding localStorage operations with encryption
 * Centralizes all persistence logic with security
 */
export class OnboardingStorageService {
  private getKey(tenantId: string): string {
    return `onboarding_${tenantId}`;
  }

  /**
   * Generate encryption key from tenant ID (deterministic but unique per tenant)
   */
  private async getEncryptionKey(tenantId: string): Promise<CryptoKey> {
    if (typeof window === 'undefined' || !window.crypto?.subtle) {
      throw new Error('Web Crypto API not available');
    }

    // Create a unique key material for each tenant
    const keyMaterial = `onboarding-key-${tenantId}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(keyMaterial);

    // Import as key for HKDF
    const baseKey = await window.crypto.subtle.importKey(
      'raw',
      data,
      { name: 'HKDF' },
      false,
      ['deriveKey']
    );

    // Derive AES-GCM key
    return window.crypto.subtle.deriveKey(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: encoder.encode('onboarding-salt'),
        info: encoder.encode('onboarding-data-key')
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt data using AES-GCM
   */
  private async encryptData(data: string, key: CryptoKey): Promise<string> {
    try {
      // Validate input data
      if (!data || typeof data !== 'string') {
        throw new Error('Invalid data to encrypt: data is null or not a string');
      }

      // Generate a random 12-byte IV (Initialization Vector)
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // Encode the data as UTF-8
      const encoder = new TextEncoder();
      const encodedData = encoder.encode(data);

      // Encrypt the data
      const encrypted = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        encodedData
      );

      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Convert to base64 and validate the result
      const base64Result = btoa(String.fromCharCode(...combined));

      // Double-check that we produced valid base64
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(base64Result) || base64Result.length % 4 !== 0) {
        throw new Error('Generated invalid base64 during encryption');
      }

      return base64Result;
    } catch (error) {
      console.error('[OnboardingStorageService] Encryption failed:', error);
      throw new Error('Failed to encrypt onboarding data');
    }
  }

  /**
   * Decrypt data using AES-GCM
   */
  private async decryptData(encryptedData: string, key: CryptoKey): Promise<string> {
    try {
      // Validate that the data is valid base64 before attempting to decode
      if (!encryptedData || typeof encryptedData !== 'string') {
        throw new Error('Invalid encrypted data: data is null or not a string');
      }

      // Check if the string looks like valid base64
      const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
      if (!base64Regex.test(encryptedData)) {
        throw new Error('Invalid encrypted data: not valid base64 format');
      }

      // Check if length is valid for base64 (should be multiple of 4)
      if (encryptedData.length % 4 !== 0) {
        throw new Error('Invalid encrypted data: base64 length not valid');
      }

      const combined = new Uint8Array(
        atob(encryptedData).split('').map(c => c.charCodeAt(0))
      );

      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('[OnboardingStorageService] Decryption failed:', error);
      throw new Error(`Failed to decrypt onboarding data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load saved onboarding progress from localStorage (encrypted)
   */
  async load(tenantId: string): Promise<OnboardingProgress | null> {
    if (typeof window === 'undefined') return null;

    try {
      const saved = localStorage.getItem(this.getKey(tenantId));
      if (!saved) return null;

      // Try to decrypt the data
      const encryptionKey = await this.getEncryptionKey(tenantId);
      const decryptedJson = await this.decryptData(saved, encryptionKey);
      const data = JSON.parse(decryptedJson);

      return {
        currentStep: data.currentStep || 1,
        businessData: data.businessData || {},
      };
    } catch (error) {
      console.error('[OnboardingStorageService] Failed to load progress:', error);
      // If decryption fails, try to clear corrupted data
      this.clear(tenantId);
      return null;
    }
  }

  /**
   * Save onboarding progress to localStorage (encrypted)
   */
  async save(tenantId: string, progress: OnboardingProgress): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      const encryptionKey = await this.getEncryptionKey(tenantId);
      const jsonData = JSON.stringify(progress);
      const encryptedData = await this.encryptData(jsonData, encryptionKey);

      localStorage.setItem(this.getKey(tenantId), encryptedData);
    } catch (error) {
      console.error('[OnboardingStorageService] Failed to save progress:', error);
      // If encryption fails, don't save (better to lose progress than corrupt data)
    }
  }

  /**
   * Clear saved onboarding progress
   */
  clear(tenantId: string): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(this.getKey(tenantId));
    } catch (error) {
      console.error('[OnboardingStorageService] Failed to clear progress:', error);
    }
  }
}

// Export singleton instance
export const onboardingStorageService = new OnboardingStorageService();
