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
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM

    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      dataBuffer
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Return as base64
    return btoa(String.fromCharCode(...combined));
  }

  /**
   * Decrypt data using AES-GCM
   */
  private async decryptData(encryptedData: string, key: CryptoKey): Promise<string> {
    try {
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
      throw new Error('Failed to decrypt onboarding data');
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
