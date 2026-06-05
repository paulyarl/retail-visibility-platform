import { useState } from 'react';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { onboardingDataService } from '@/services/onboardingDataService';
import { onboardingStorageService } from '@/services/onboardingStorageService';

interface UseOnboardingSaveOptions {
  tenantId: string;
  onSuccess?: (savedProfile: Partial<BusinessProfile>) => void;
}

interface UseOnboardingSaveReturn {
  save: (data: Partial<BusinessProfile>) => Promise<Partial<BusinessProfile>>;
  saving: boolean;
  error: string | null;
  success: boolean;
  savedProfile: Partial<BusinessProfile> | null;
}

/**
 * Hook for saving onboarding data
 * Handles API submission and error states
 */
export function useOnboardingSave({
  tenantId,
  onSuccess,
}: UseOnboardingSaveOptions): UseOnboardingSaveReturn {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [savedProfile, setSavedProfile] = useState<Partial<BusinessProfile> | null>(null);

  const save = async (data: Partial<BusinessProfile>): Promise<Partial<BusinessProfile>> => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const savedData = await onboardingDataService.saveProfile(tenantId, data);
      
      setSavedProfile(savedData);
      
      // Clear saved progress after successful save
      onboardingStorageService.clear(tenantId);
      
      setSuccess(true);
      
      if (onSuccess) {
        onSuccess(savedData);
      }
      
      return savedData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save business profile';
      setError(errorMessage);
      // Don't re-throw - handle gracefully to avoid Next.js error overlay
      // Return empty object to allow UI to continue functioning
      return {};
    } finally {
      setSaving(false);
    }
  };

  return {
    save,
    saving,
    error,
    success,
    savedProfile,
  };
}
