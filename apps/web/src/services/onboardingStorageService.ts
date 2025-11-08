import { BusinessProfile } from '@/lib/validation/businessProfile';

interface OnboardingProgress {
  currentStep: number;
  businessData: Partial<BusinessProfile>;
}

/**
 * Service for handling onboarding localStorage operations
 * Centralizes all persistence logic
 */
export class OnboardingStorageService {
  private getKey(tenantId: string): string {
    return `onboarding_${tenantId}`;
  }

  /**
   * Load saved onboarding progress from localStorage
   */
  load(tenantId: string): OnboardingProgress | null {
    if (typeof window === 'undefined') return null;

    try {
      const saved = localStorage.getItem(this.getKey(tenantId));
      if (!saved) return null;

      const data = JSON.parse(saved);
      return {
        currentStep: data.currentStep || 1,
        businessData: data.businessData || {},
      };
    } catch (error) {
      console.error('[OnboardingStorageService] Failed to load progress:', error);
      return null;
    }
  }

  /**
   * Save onboarding progress to localStorage
   */
  save(tenantId: string, progress: OnboardingProgress): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(this.getKey(tenantId), JSON.stringify(progress));
    } catch (error) {
      console.error('[OnboardingStorageService] Failed to save progress:', error);
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
