import { useState } from 'react';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { onboardingDataService } from '@/services/onboardingDataService';
import { onboardingStorageService } from '@/services/onboardingStorageService';

interface UseOnboardingSaveOptions {
  tenantId: string;
  onSuccess?: () => void;
}

interface UseOnboardingSaveReturn {
  save: (data: Partial<BusinessProfile>) => Promise<void>;
  saving: boolean;
  error: string | null;
  success: boolean;
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

  const save = async (data: Partial<BusinessProfile>) => {
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await onboardingDataService.saveProfile(tenantId, data);
      
      // Clear saved progress after successful save
      onboardingStorageService.clear(tenantId);
      
      setSuccess(true);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save business profile';
      setError(errorMessage);
      throw err;
    } finally {
      setSaving(false);
    }
  };

  return {
    save,
    saving,
    error,
    success,
  };
}
