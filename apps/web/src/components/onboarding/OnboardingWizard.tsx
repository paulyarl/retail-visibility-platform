"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, AnimatedCard, Alert } from '@/components/ui';
import ProgressSteps, { Step } from './ProgressSteps';
import StoreIdentityStep from './StoreIdentityStep';
import BusinessHoursStep from './BusinessHoursStep';
import BrandingSocialStep from './BrandingSocialStep';
import AdditionalSettingsStep from './AdditionalSettingsStep';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { ContextBadges } from '@/components/ContextBadges';
import { useOnboardingData } from '@/hooks/useOnboardingData';
import { useOnboardingSteps } from '@/hooks/useOnboardingSteps';
import { useOnboardingSave } from '@/hooks/useOnboardingSave';
import { trackBehaviorClient } from '@/utils/behaviorTracking';
import { onboardingStateService } from '@/services/OnboardingStateService';
import { trialService } from '@/services/TrialService';
import TrialSetupModal from './TrialSetupModal';

interface OnboardingWizardProps {
  tenantId: string;
  initialStep?: number;
  onComplete?: (profile: Partial<BusinessProfile>) => void;
  skipAccountStep?: boolean; // When coming from phase 1
}

// Full steps (includes account step for standalone use)
const fullSteps: Step[] = [
  { id: 'account', title: 'Account', description: 'Create your account' },
  { id: 'store', title: 'Store Identity', description: 'Business information' },
  { id: 'hours', title: 'Business Hours', description: 'Operating hours' },
  { id: 'branding', title: 'Branding & Social', description: 'Logo and social links' },
  { id: 'settings', title: 'Additional Settings', description: 'SEO and map settings' },
  { id: 'complete', title: 'Complete', description: 'All set!' },
];

// Phase 2 steps (skips account step)
const phase2Steps: Step[] = fullSteps.slice(1);



export default function OnboardingWizard({ 
  tenantId,
  initialStep = 1,
  onComplete,
  skipAccountStep: propSkipAccountStep,
}: OnboardingWizardProps) {
  const router = useRouter();
  const search = useSearchParams();
  const [showTrialModal, setShowTrialModal] = useState(false);
  
  // Parse URL params
  const forceParam = search?.get('force');
  const forced = forceParam === '1' || forceParam === 'true';
  const fromPhase1 = search?.get('fromPhase1') === 'true';
  
  // Determine if we should skip account step
  const isComingFromPhase1 = fromPhase1 || onboardingStateService.isComingFromPhase1();
  const skipAccountStep = propSkipAccountStep || isComingFromPhase1;

  // Check if tenant can start trial (not already subscribed)
  const [canStartTrial, setCanStartTrial] = useState(true);
  const [tenantSubscription, setTenantSubscription] = useState<any>(null);
  
  // Use appropriate steps array
  const steps = skipAccountStep ? phase2Steps : fullSteps;
  
  // Adjust initial step (if skipping account, start at 0 which maps to 'store')
  const effectiveInitialStep = skipAccountStep ? Math.max(0, initialStep - 1) : initialStep;
  
  // Load initial data
  const { 
    data: businessData, 
    setData: setBusinessData, 
    loading: dataLoading, 
    error: dataError 
  } = useOnboardingData({ 
    tenantId, 
    forced, 
    initialStep: initialStep || 1, 
    phase1Data: skipAccountStep ? (onboardingStateService.getPhase1DataForPhase2() as Partial<BusinessProfile>) : undefined,
  });
  
  // Check tenant subscription status
  useEffect(() => {
    const checkSubscription = async () => {
      try {
        const data = await trialService.getTrialStatus(tenantId);
        setTenantSubscription(data);
        setCanStartTrial(data.canStartTrial);
      } catch (error) {
        console.error('Failed to check subscription status:', error);
        // Default to showing trial option if we can't check
        setCanStartTrial(true);
      }
    };

    if (tenantId) {
      checkSubscription();
    }
  }, [tenantId]);

  // Manage step navigation with localStorage persistence
  const { 
    currentStep, 
    setStep, 
    goBack, 
    goNext 
  } = useOnboardingSteps({ 
    tenantId, 
    initialStep: effectiveInitialStep, 
    businessData,
    forced 
  });
  
  const currentStepId = steps[currentStep]?.id;
  
  // Handle saving
  const { 
    save, 
    saving, 
    error: saveError,
    savedProfile
  } = useOnboardingSave({ 
    tenantId,
    onSuccess: () => {}, // Don't auto-advance, let user navigate
  });
  
  // Validation state - default to true so optional steps can proceed
  const [isValid, setIsValid] = useState(true);
  
  // Reset validation when step changes (optional steps default to valid)
  useEffect(() => {
    setIsValid(true);
    // console.log('[OnboardingWizard] Step changed to:', currentStep);
    // console.log('[OnboardingWizard] Current businessData:', businessData);
  }, [currentStep]);
  
  // Feature flags
  const ffCategory = useFeatureFlag('FF_CATEGORY_MANAGEMENT_PAGE');
  
  // Track onboarding flow start
  useEffect(() => {
    if (tenantId) {
      trackBehaviorClient({
        entityType: 'onboarding',
        entityId: `onboarding_${tenantId}`,
        entityName: 'Tenant Onboarding',
        pageType: 'onboarding_flow',
        context: {
          tenantId,
          currentStep: currentStep,
          totalSteps: steps.length
        }
      });
    }
  }, [tenantId, currentStep]);
  
  // Combined error state
  const error = dataError || saveError;
  
  // Handlers
  const handleNext = async () => {
    if (currentStepId && currentStepId !== 'complete') {
      // Save data at each step, capture response for next step
      const savedData = await save(businessData);
      
      // Only proceed if save was successful (savedData has content)
      if (savedData && Object.keys(savedData).length > 0) {
        // Update businessData with the server response so next step has accurate data
        setBusinessData(savedData);
        goNext();
      }
      // If save failed, the error state will be set and the Alert will show
      // User can try again or fix the issue
    } else if (currentStepId === 'complete') {
      handleComplete();
    }
  };

  const handleBack = () => {
    // Save current data before going back so it's preserved
    // This ensures data is in localStorage when the previous step remounts
    goBack();
  };
  
  const handleComplete = () => {
    if (onComplete) {
      onComplete(businessData);
    } else {
      // Check if tenant can start trial before showing modal
      if (canStartTrial) {
        setShowTrialModal(true);
      } else {
        // Direct to dashboard if already has trial/subscription
        router.push(`/t/${tenantId}/dashboard`);
      }
    }
  };

  const handleStartTrial = async (selectedTier: string) => {
    try {
      // Call trial setup API through service
      const result = await trialService.activateTrial(tenantId, {
        trialTier: selectedTier as any,
      });
      
      console.log('Trial activated:', result);
      
      // Redirect to dashboard with success message
      router.push(`/t/${tenantId}/dashboard?trialActivated=true`);
    } catch (error) {
      console.error('Trial setup error:', error);
      // Still redirect to dashboard
      router.push(`/t/${tenantId}/dashboard`);
    }
  };
  
  const handleSkip = () => {
    if (onComplete) {
      onComplete(businessData);
    } else {
      router.push('/tenants');
    }
  };
  
  // Show loading state
  if (dataLoading) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4" />
          <p className="text-neutral-600">Loading your onboarding...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      <div className="relative w-full max-w-3xl">
        {/* Logo/Brand */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">
            Welcome to Visible Shelf
          </h1>
          <p className="text-neutral-600">
            Let's set up your store in just a few steps
          </p>
        </motion.div>

        {/* Progress Steps */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8"
        >
          <ProgressSteps steps={steps} currentStep={currentStep} />
        </motion.div>

        {/* Main Card */}
        <AnimatedCard delay={0.3} hover={false} className="p-8">
          {error && (
            <Alert variant="error" title="Error" onClose={() => {}} className="mb-6">
              {error}
            </Alert>
          )}

          <AnimatePresence mode="wait">
            {currentStepId === 'store' && (
              <motion.div
                key="store-identity"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <StoreIdentityStep
                  tenantId={tenantId}
                  initialData={businessData}
                  onDataChange={setBusinessData}
                  onValidationChange={setIsValid}
                />
              </motion.div>
            )}

            {currentStepId === 'hours' && (
              <motion.div
                key="business-hours"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <BusinessHoursStep
                  tenantId={tenantId}
                  initialData={businessData}
                  onDataChange={setBusinessData}
                  onValidationChange={setIsValid}
                />
              </motion.div>
            )}

            {currentStepId === 'branding' && (
              <motion.div
                key="branding-social"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <BrandingSocialStep
                  tenantId={tenantId}
                  initialData={businessData}
                  onDataChange={setBusinessData}
                  onValidationChange={setIsValid}
                />
              </motion.div>
            )}

            {currentStepId === 'settings' && (
              <motion.div
                key="additional-settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <AdditionalSettingsStep
                  tenantId={tenantId}
                  initialData={businessData}
                  onDataChange={setBusinessData}
                  onValidationChange={setIsValid}
                />
              </motion.div>
            )}

            {currentStepId === 'complete' && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                  className="inline-flex items-center justify-center w-24 h-24 bg-success rounded-full mb-6"
                >
                  <svg className="w-12 h-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </motion.div>
                
                <h2 className="text-3xl font-bold text-neutral-900 mb-3">
                  You're all set!
                </h2>
                <p className="text-neutral-600 mb-6 max-w-md mx-auto">
                  Your business profile has been created. You can now start managing your inventory and syncing with Google Merchant Center.
                </p>

                {/* Profile Summary Card */}
                {savedProfile && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 max-w-md mx-auto mb-6 text-left"
                  >
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Profile Summary
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-neutral-500 uppercase tracking-wide">Tenant ID</p>
                          <p className="text-sm font-mono font-medium text-neutral-900">{tenantId}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-neutral-500 uppercase tracking-wide">Slug</p>
                          <p className="text-sm font-mono font-medium text-green-600">
                            {savedProfile.slug || 'Not set'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-neutral-500 uppercase tracking-wide">Business Name</p>
                          <p className="text-sm font-medium text-neutral-900 truncate">{savedProfile.business_name || 'Not set'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-neutral-500 uppercase tracking-wide">Location</p>
                          <p className="text-sm font-medium text-neutral-900">
                            {[savedProfile.city, savedProfile.state].filter(Boolean).join(', ') || 'Not set'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Trial Promotion Card */}
                {canStartTrial && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-6 max-w-md mx-auto mb-6"
                  >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <svg className="w-6 h-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-amber-900">Start Your Free Trial</h3>
                      <p className="text-sm text-amber-700">Unlock premium features for 14 days</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm text-amber-800">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Up to 2000 SKUs</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Multiple locations</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Advanced analytics</span>
                    </div>
                  </div>
                  <Button 
                    onClick={() => setShowTrialModal(true)} 
                    className="w-full mt-4 bg-amber-600 hover:bg-amber-700 text-white border-amber-600"
                  >
                    Start Free Trial
                  </Button>
                  </motion.div>
                )}

                {/* Subscription Status for Existing Subscribers */}
                {!canStartTrial && tenantSubscription && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className={`rounded-xl p-6 max-w-md mx-auto mb-6 border ${
                      tenantSubscription.hasActiveTrial 
                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                        : 'bg-gradient-to-r from-orange-50 to-red-50 border-orange-200'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${
                        tenantSubscription.hasActiveTrial ? 'bg-green-100' : 'bg-orange-100'
                      }`}>
                        <svg className={`w-6 h-6 ${
                          tenantSubscription.hasActiveTrial ? 'text-green-600' : 'text-orange-600'
                        }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          {tenantSubscription.hasActiveTrial ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          )}
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-lg font-semibold ${
                          tenantSubscription.hasActiveTrial ? 'text-green-900' : 'text-orange-900'
                        }`}>
                          {tenantSubscription.hasActiveTrial ? 'Premium Plan Active' : 'Subscription Expired'}
                        </h3>
                        <p className={`text-sm ${
                          tenantSubscription.hasActiveTrial ? 'text-green-700' : 'text-orange-700'
                        }`}>
                          {tenantSubscription.trialTier ? 'Trial in progress' : 'Subscription active'}
                        </p>
                      </div>
                    </div>
                    <div className={`text-sm mb-4 ${
                      tenantSubscription.hasActiveTrial ? 'text-green-800' : 'text-orange-800'
                    }`}>
                      {tenantSubscription.trialEndsAt && (
                        <p>Trial ends: {new Date(tenantSubscription.trialEndsAt).toLocaleDateString()}</p>
                      )}
                      <p>Status: {tenantSubscription.subscriptionStatus}</p>
                    </div>
                    
                    {/* Renewal Action for Expired Trials */}
                    {!tenantSubscription.hasActiveTrial && (
                      <Button 
                        onClick={() => router.push(`/t/${tenantId}/settings/billing`)}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                        Renew Subscription
                      </Button>
                    )}
                  </motion.div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-sm text-neutral-600">
                    <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Business profile created</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-neutral-600">
                    <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>SEO information configured</span>
                  </div>
                  <div className="flex items-center justify-center gap-2 text-sm text-neutral-600">
                    <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Ready to add inventory</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-neutral-200">
            <div>
              {currentStepId !== 'complete' && (
                <Button variant="ghost" onClick={handleSkip}>
                  Skip for now
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {currentStepId !== 'store' && currentStepId !== 'complete' && (
                <Button variant="secondary" onClick={handleBack} disabled={saving}>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </Button>
              )}
              
              {currentStepId !== 'complete' && (
                <Button 
                  onClick={handleNext} 
                  disabled={!isValid || saving}
                  loading={saving} style={{color: 'white'}}
                >
                  {saving ? 'Saving...' : currentStepId === 'settings' ? 'Complete Setup' : 'Continue'}
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              )}

              {currentStepId === 'complete' && (
                <Button onClick={handleNext}>
                  Go to Dashboard
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Button>
              )}
              
              {/* Saving Status Indicator */}
              {saving && (
                <div className="flex items-center text-sm text-gray-500 ml-3">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-gray-500 mr-2"></div>
                  Saving progress...
                </div>
              )}
            </div>
          </div>
          
          {currentStepId === 'complete' && (
            <div className="mt-8">
              {/* Primary Actions */}
              <div className={`grid gap-3 mb-4 ${canStartTrial ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'}`}>
                {canStartTrial && (
                  <Button variant="secondary" onClick={() => setShowTrialModal(true)} className="bg-amber-600 hover:bg-amber-700 text-white border-amber-600">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                    Start Free Trial
                  </Button>
                )}
                <Button onClick={() => router.push(`/t/${tenantId}/dashboard`)}>
                  Go to Tenant Dashboard
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Button>
                <Button variant="primary" onClick={() => router.push(`/t/${tenantId}/quick-start`)}>
                  Quick Start (Recommended)
                </Button>
              </div>
              
              {/* Secondary Actions - Responsive Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                <Button variant="secondary" onClick={() => router.push(`/t/${tenantId}/settings/tenant`)}>
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Profile
                </Button>
                <Button variant="secondary" size="sm" onClick={() => router.push('/')}>
                  Platform
                </Button>
                <Button variant="secondary" size="sm" onClick={() => router.push(`/t/${tenantId}/settings/branding`)}>
                  🎨 Branding
                </Button>
                <Button variant="secondary" size="sm" onClick={() => router.push(`/t/${tenantId}/profile-completeness`)}>
                  Profile
                </Button>
                {ffCategory && (
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/t/${tenantId}/categories`)}>
                    Categories
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => router.push(`/t/${tenantId}/items`)}>
                  Products
                </Button>
                <Button variant="secondary" size="sm" onClick={() => router.push(`/t/${tenantId}/settings/hours`)}>
                  Hours
                </Button>
                <Button variant="secondary" size="sm" onClick={() => router.push(`/t/${tenantId}/settings`)}>
                  Settings
                </Button>
                <Button variant="secondary" size="sm" onClick={() => router.push(`/tenant/${tenantId}`)}>
                  Storefront
                </Button>
              </div>
            </div>
          )}
        </AnimatedCard>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-6 text-sm text-neutral-600"
        >
          <p>
            Need help?{' '}
            <a 
              href="/settings/contact" 
              className="text-primary-600 hover:text-primary-700 font-medium underline"
            >
              Contact support
            </a>
          </p>
        </motion.div>

        {/* Trial Setup Modal */}
        <TrialSetupModal
          isOpen={showTrialModal}
          onClose={() => setShowTrialModal(false)}
          onStartTrial={handleStartTrial}
          tenantId={tenantId}
        />
      </div>
    </div>
  );
}
