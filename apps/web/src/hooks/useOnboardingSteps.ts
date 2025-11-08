import { useState, useEffect } from 'react';
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

  // Save progress to localStorage when step or data changes
  useEffect(() => {
    if (!forced && Object.keys(businessData).length > 0) {
      onboardingStorageService.save(tenantId, {
        currentStep,
        businessData,
      });
    }
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
