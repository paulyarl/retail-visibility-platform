import { useState, useEffect, useCallback } from 'react';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { onboardingStorageService } from '@/services/onboardingStorageService';
import { clientLogger } from '@/lib/client-logger';

interface UseOnboardingPersistenceOptions {
  tenantId: string;
  forced?: boolean;
}

interface UseOnboardingPersistenceReturn {
  // Data management
  businessData: Partial<BusinessProfile>;
  updateBusinessData: (updates: Partial<BusinessProfile>) => void;
  setBusinessData: (data: Partial<BusinessProfile>) => void;
  
  // Step management
  currentStep: number;
  goToStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  
  // Persistence control
  saveToStorage: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  clearStorage: () => void;
  
  // State
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

/**
 * Enhanced hook for reliable onboarding data persistence
 * Provides automatic local storage saving/loading with debouncing
 */
export function useOnboardingPersistence({
  tenantId,
  forced = false,
}: UseOnboardingPersistenceOptions): UseOnboardingPersistenceReturn {
  const [businessData, setBusinessDataState] = useState<Partial<BusinessProfile>>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  // Load initial data from localStorage
  const loadFromStorage = useCallback(async () => {
    if (!tenantId || forced) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const savedProgress = await onboardingStorageService.load(tenantId);
      if (savedProgress) {
        // console.log('[useOnboardingPersistence] Loaded from storage:', savedProgress);
        setBusinessDataState(savedProgress.businessData);
        setCurrentStep(savedProgress.currentStep);
      }
    } catch (err) {
      clientLogger.error('[useOnboardingPersistence] Failed to load from storage:', { detail: err });
      setError(err instanceof Error ? err.message : 'Failed to load saved progress');
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, forced]);

  // Save to localStorage with debouncing
  const saveToStorage = useCallback(async () => {
    if (!tenantId || forced || isSaving) return;
    
    try {
      setIsSaving(true);
      setError(null);
      
      await onboardingStorageService.save(tenantId, {
        currentStep,
        businessData,
      });
      
      // console.log('[useOnboardingPersistence] Saved to storage:', { currentStep, businessData });
    } catch (err) {
      clientLogger.error('[useOnboardingPersistence] Failed to save to storage:', { detail: err });
      setError(err instanceof Error ? err.message : 'Failed to save progress');
    } finally {
      setIsSaving(false);
    }
  }, [tenantId, forced, currentStep, businessData, isSaving]);

  // Debounced save function
  const debouncedSave = useCallback(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    const timeout = setTimeout(() => {
      saveToStorage();
    }, 500); // 500ms debounce
    
    setSaveTimeout(timeout);
  }, [saveToStorage]);

  // Update business data
  const updateBusinessData = useCallback((updates: Partial<BusinessProfile>) => {
    const newData = { ...businessData, ...updates };
    setBusinessDataState(newData);
    // console.log('[useOnboardingPersistence] Updated business data:', newData);
  }, [businessData]);

  // Set business data completely
  const setBusinessData = useCallback((data: Partial<BusinessProfile>) => {
    setBusinessDataState(data);
    // console.log('[useOnboardingPersistence] Set business data:', data);
  }, []);

  // Navigation functions
  const goToStep = useCallback((step: number) => {
    const validStep = Math.max(1, Math.min(step, 5)); // Ensure step is between 1-5
    setCurrentStep(validStep);
    // console.log('[useOnboardingPersistence] Navigated to step:', validStep);
  }, []);

  const nextStep = useCallback(() => {
    goToStep(currentStep + 1);
  }, [currentStep, goToStep]);

  const previousStep = useCallback(() => {
    goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  // Clear storage
  const clearStorage = useCallback(() => {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      setSaveTimeout(null);
    }
    
    onboardingStorageService.clear(tenantId);
    // console.log('[useOnboardingPersistence] Cleared storage for tenant:', tenantId);
  }, [tenantId, saveTimeout]);

  // Auto-save when data or step changes
  useEffect(() => {
    debouncedSave();
  }, [businessData, currentStep, debouncedSave]);

  // Load initial data on mount
  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  }, [saveTimeout]);

  return {
    // Data management
    businessData,
    updateBusinessData,
    setBusinessData,
    
    // Step management
    currentStep,
    goToStep,
    nextStep,
    previousStep,
    
    // Persistence control
    saveToStorage,
    loadFromStorage,
    clearStorage,
    
    // State
    isLoading,
    isSaving,
    error,
  };
}
