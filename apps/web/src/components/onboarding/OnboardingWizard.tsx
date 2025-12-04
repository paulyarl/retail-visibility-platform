"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, AnimatedCard, Alert } from '@/components/ui';
import ProgressSteps, { Step } from './ProgressSteps';
import StoreIdentityStep from './StoreIdentityStep';
import { BusinessProfile } from '@/lib/validation/businessProfile';
import { isFeatureEnabled } from '@/lib/featureFlags';
import { ContextBadges } from '@/components/ContextBadges';
import { useOnboardingData } from '@/hooks/useOnboardingData';
import { useOnboardingSteps } from '@/hooks/useOnboardingSteps';
import { useOnboardingSave } from '@/hooks/useOnboardingSave';

interface OnboardingWizardProps {
  tenantId: string;
  initialStep?: number;
  onComplete?: (profile: Partial<BusinessProfile>) => void;
}

const steps: Step[] = [
  {
    id: 'account',
    title: 'Account',
    description: 'Create your account',
  },
  {
    id: 'store',
    title: 'Store Identity',
    description: 'Business information',
  },
  {
    id: 'complete',
    title: 'Complete',
    description: 'All set!',
  },
];

export default function OnboardingWizard({ 
  tenantId,
  initialStep = 1,
  onComplete 
}: OnboardingWizardProps) {
  const router = useRouter();
  const search = useSearchParams();
  
  // Parse URL params
  const forceParam = search?.get('force');
  const forced = forceParam === '1' || forceParam === 'true';
  
  // Load onboarding data
  const { 
    data: businessData, 
    setData: setBusinessData, 
    loading, 
    error: loadError,
    initialStep: loadedStep,
  } = useOnboardingData({ 
    tenantId, 
    forced, 
    initialStep 
  });
  
  // Manage step navigation
  const { 
    currentStep, 
    goNext, 
    goBack, 
    setStep 
  } = useOnboardingSteps({ 
    tenantId, 
    initialStep: loadedStep, 
    businessData, 
    forced 
  });
  
  // Handle saving
  const { 
    save, 
    saving, 
    error: saveError 
  } = useOnboardingSave({ 
    tenantId,
    onSuccess: () => setStep(2),
  });
  
  // Validation state
  const [isValid, setIsValid] = useState(false);
  
  // Feature flags
  const [ffCategory, setFfCategory] = useState(false);
  
  useEffect(() => {
    try {
      const on = isFeatureEnabled('FF_CATEGORY_MANAGEMENT_PAGE' as any, tenantId as any);
      setFfCategory(!!on);
    } catch {
      setFfCategory(false);
    }
  }, [tenantId]);
  
  // Combined error state
  const error = loadError || saveError;
  
  // Handlers
  const handleNext = async () => {
    if (currentStep === 1) {
      await save(businessData);
    } else if (currentStep === 2) {
      handleComplete();
    }
  };
  
  const handleComplete = () => {
    if (onComplete) {
      onComplete(businessData);
    } else {
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
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4" />
          <p className="text-neutral-600">Loading your onboarding...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 flex items-center justify-center p-4">
      {/* Context Badges */}
      <div className="absolute top-4 left-4 right-4 z-10">
        <ContextBadges 
          tenant={{ id: tenantId, name: '' }}
          contextLabel="Onboarding"
          showBorder={false}
        />
      </div>
      
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
            {currentStep === 1 && (
              <motion.div
                key="store-identity"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <StoreIdentityStep
                  initialData={businessData}
                  onDataChange={setBusinessData}
                  onValidationChange={setIsValid}
                />
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div
                key="complete"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                className="text-center py-12"
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
                <p className="text-neutral-600 mb-8 max-w-md mx-auto">
                  Your business profile has been created. You can now start managing your inventory and syncing with Google Merchant Center.
                </p>

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
              {currentStep === 1 && (
                <Button variant="ghost" onClick={handleSkip}>
                  Skip for now
                </Button>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {currentStep > 0 && currentStep < 2 && (
                <Button variant="secondary" onClick={goBack} disabled={saving}>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </Button>
              )}
              
              {currentStep === 1 && (
                <Button 
                  onClick={handleNext} 
                  disabled={!isValid || saving}
                  loading={saving}
                >
                  {saving ? 'Saving...' : 'Continue'}
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Button>
              )}
              
              {currentStep === 2 && (
                <Button onClick={handleNext}>
                  Go to Dashboard
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Button>
              )}
            </div>
          </div>
          
          {currentStep === 2 && (
            <div className="mt-8">
              {/* Primary Actions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <Button onClick={() => router.push(`/t/${tenantId}/dashboard`)}>
                  Go to Tenant Dashboard
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Button>
                <Button variant="primary" onClick={() => router.push(`/t/${tenantId}/quick-start`)}>
                  🚀 Quick Start (Recommended)
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
      </div>
    </div>
  );
}
