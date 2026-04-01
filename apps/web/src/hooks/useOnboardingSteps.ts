import { useState, useEffect, useRef } from 'react';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { onboardingStorageService } from '@/services/onboardingStorageService';

interface UseOnboardingStepsOptions {
  tenantId: string;
  initialStep: number;
  businessData: Partial<BusinessProfile>;
  forced?: boolean;
}

interface UseOnboardingStepsReturn {
  currentStep: number;
  goNext: () => void;
  goBack: () => void;
  setStep: (step: number) => void;
}

/**
 * Hook for managing onboarding step navigation
 * Handles step state and localStorage persistence
 */
export function useOnboardingSteps({
  tenantId,
  initialStep,
  businessData,
  forced = false,
}: UseOnboardingStepsOptions): UseOnboardingStepsReturn {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedDataRef = useRef<string>('');

  // Save progress to localStorage with debouncing
  useEffect(() => {
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Skip if forced mode
    if (forced || Object.keys(businessData).length === 0) {
      return;
    }

    // Serialize full data for comparison (not just keys)
    const dataKey = JSON.stringify({ currentStep, businessData });
    
    // Skip if data hasn't actually changed
    if (dataKey === lastSavedDataRef.current) {
      return;
    }

    // Debounce save to avoid rapid successive saves
    saveTimeoutRef.current = setTimeout(async () => {
      console.log('[useOnboardingSteps] Saving progress:', { currentStep, businessDataKeys: Object.keys(businessData) });
      await onboardingStorageService.save(tenantId, {
        currentStep,
        businessData,
      });
      lastSavedDataRef.current = dataKey;
    }, 500); // 500ms debounce

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [currentStep, businessData, tenantId, forced]);

  const goNext = () => {
    setCurrentStep((prev) => prev + 1);
  };

  const goBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const setStep = (step: number) => {
    setCurrentStep(step);
  };

  return {
    currentStep,
    goNext,
    goBack,
    setStep,
  };
}
