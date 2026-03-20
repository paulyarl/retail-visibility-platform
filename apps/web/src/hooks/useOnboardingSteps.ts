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

  // Save progress to localStorage when step changes
  useEffect(() => {
    const saveProgress = async () => {
      if (!forced && Object.keys(businessData).length > 0) {
        await onboardingStorageService.save(tenantId, {
          currentStep,
          businessData,
        });
      }
    };

    saveProgress().catch((error) => {
      console.error('[useOnboardingSteps] Failed to save progress:', error);
    });
  }, [currentStep, tenantId, forced]);

  // Save data to localStorage when businessData changes (debounced)
  useEffect(() => {
    // Clear previous timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Debounce save to avoid rapid successive saves
    saveTimeoutRef.current = setTimeout(async () => {
      if (!forced && Object.keys(businessData).length > 0) {
        await onboardingStorageService.save(tenantId, {
          currentStep,
          businessData,
        });
      }
    }, 500); // 500ms debounce

    // Cleanup
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [businessData, tenantId, forced]);

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
