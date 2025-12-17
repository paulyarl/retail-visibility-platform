import { useState, useEffect } from 'react';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { onboardingDataService } from '@/services/onboardingDataService';
import { onboardingStorageService } from '@/services/onboardingStorageService';

interface UseOnboardingDataOptions {
  tenantId: string;
  forced?: boolean;
  initialStep?: number;
}

interface UseOnboardingDataReturn {
  data: Partial<BusinessProfile>;
  setData: (data: Partial<BusinessProfile>) => void;
  loading: boolean;
  error: string | null;
  initialStep: number;
}

/**
 * Hook for managing onboarding data
 * Handles fetching from API, merging with localStorage, and persistence
 */
export function useOnboardingData({
  tenantId,
  forced = false,
  initialStep = 1,
}: UseOnboardingDataOptions): UseOnboardingDataReturn {
  const [data, setData] = useState<Partial<BusinessProfile>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(initialStep);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch from API
        const apiData = await onboardingDataService.fetchTenantData(tenantId);

        // Load from localStorage (unless forced)
        const savedProgress = !forced ? await onboardingStorageService.load(tenantId) : null;
        const localData = savedProgress?.businessData || {};
        const savedStep = savedProgress?.currentStep || initialStep;

        // Merge: API data as base, localStorage overrides
        const merged = { ...apiData, ...localData };

        // Sanitize and normalize
        const sanitized = onboardingDataService.sanitizeData(merged);
        const normalized = onboardingDataService.normalizeData(sanitized);

        console.log('[useOnboardingData] API data:', apiData);
        console.log('[useOnboardingData] localStorage data:', localData);
        console.log('[useOnboardingData] Merged data:', normalized);

        setData(normalized);
        setStep(savedStep);
      } catch (err) {
        console.error('[useOnboardingData] Failed to load data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load onboarding data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [tenantId, forced, initialStep]);

  return {
    data,
    setData,
    loading,
    error,
    initialStep: step,
  };
}
