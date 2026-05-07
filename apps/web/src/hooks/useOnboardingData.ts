import { useState, useEffect } from 'react';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { onboardingDataService } from '@/services/onboardingDataService';
import { onboardingStorageService } from '@/services/onboardingStorageService';

interface UseOnboardingDataOptions {
  tenantId: string;
  forced?: boolean;
  initialStep?: number;
  phase1Data?: Partial<BusinessProfile>; // Data from phase 1 to pre-populate
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
  phase1Data,
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

        // Load from localStorage (unless forced or coming from phase 1)
        const isFromPhase1 = typeof window !== 'undefined' && window.location.search.includes('fromPhase1=true');
        const savedProgress = !forced && !isFromPhase1 ? await onboardingStorageService.load(tenantId) : null;
        const localData = savedProgress?.businessData || {};
        const savedStep = savedProgress?.currentStep || initialStep;

        // Merge: API data as base, localStorage overrides, then phase1Data
        const merged = { ...apiData, ...localData, ...phase1Data };

        // Sanitize and normalize
        const sanitized = onboardingDataService.sanitizeData(merged);
        const normalized = onboardingDataService.normalizeData(sanitized);
/* 
        console.log('[useOnboardingData] API data:', apiData);
        console.log('[useOnboardingData] localStorage data:', localData);
        console.log('[useOnboardingData] Phase1 data:', phase1Data);
        console.log('[useOnboardingData] Merged data:', normalized); */

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
  }, [tenantId, forced, initialStep]); // Remove phase1Data from dependencies to prevent loops

  return {
    data,
    setData,
    loading,
    error,
    initialStep: step,
  };
}
