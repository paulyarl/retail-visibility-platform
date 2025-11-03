"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, AnimatedCard, Alert } from '@/components/ui';
import ProgressSteps, { Step } from './ProgressSteps';
import StoreIdentityStep from './StoreIdentityStep';
import { BusinessProfile, businessProfileSchema, countries, normalizePhoneInput } from '@/lib/validation/businessProfile';
import { isFeatureEnabled } from '@/lib/featureFlags';
import { api } from '@/lib/api';

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
  initialStep = 1, // Start at Store Identity (account already created)
  onComplete 
}: OnboardingWizardProps) {
  const router = useRouter();
  const search = useSearchParams();
  const stepParam = (search?.get('step') || '').toLowerCase();
  const forceParam = search?.get('force');
  const forced = forceParam === '1' || forceParam === 'true';
  const stepMap: Record<string, number> = { account: 0, store: 1, profile: 1, complete: 2, hours: 1 };
  const requestedStep = stepMap[stepParam] ?? initialStep;
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [businessData, setBusinessData] = useState<Partial<BusinessProfile>>({});
  const [isValid, setIsValid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [ffCategory, setFfCategory] = useState(false);

  // Evaluate feature flag for Categories (client-side)
  useEffect(() => {
    try {
      const on = isFeatureEnabled('FF_CATEGORY_MANAGEMENT_PAGE' as any, tenantId as any);
      setFfCategory(!!on);
    } catch {
      setFfCategory(false);
    }
  }, [tenantId]);

  // Load existing tenant data and saved progress from localStorage (unless forced)
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // First, fetch existing tenant data from API
        let apiData: Partial<BusinessProfile> = {};
        try {
          const response = await api.get(`/api/tenants/${tenantId}`);
          if (response.ok) {
            const tenant = await response.json();

            // Extract business data from existing tenant
            if (tenant.name) {
              apiData.business_name = tenant.name;
              console.log('[OnboardingWizard] Set business_name from tenant.name:', tenant.name);
            }

            // Always attempt to enrich from tenant profile for remaining fields
            try {
              const resp2 = await api.get(`/api/tenant/profile?tenant_id=${tenantId}`);
              if (resp2.ok) {
                const prof = await resp2.json();
                const p = prof?.data || prof || {};
                if (p.business_name && !apiData.business_name) apiData.business_name = p.business_name;
                if (p.address_line1) apiData.address_line1 = p.address_line1;
                if (p.address_line2) apiData.address_line2 = p.address_line2;
                if (p.city) apiData.city = p.city;
                if (p.state) apiData.state = p.state;
                if (p.postal_code) apiData.postal_code = p.postal_code;
                if (p.country_code) apiData.country_code = p.country_code;
                if (p.phone_number || p.phone) apiData.phone_number = normalizePhoneInput(p.phone_number || p.phone);
                if (p.email) apiData.email = p.email;
                if (p.website) apiData.website = p.website;
                if (p.contact_person) apiData.contact_person = p.contact_person;
              }
            } catch (e) {
              // ignore
            }

            // Also enrich from tenant.metadata if present
            if (tenant.metadata) {
              const metadata = tenant.metadata as any;
              if (metadata.business_name) apiData.business_name = metadata.business_name;
              if (metadata.address_line1) apiData.address_line1 = metadata.address_line1;
              if (metadata.address_line2) apiData.address_line2 = metadata.address_line2;
              if (metadata.city) apiData.city = metadata.city;
              if (metadata.state) apiData.state = metadata.state;
              if (metadata.postal_code) apiData.postal_code = metadata.postal_code;
              if (metadata.country_code) apiData.country_code = metadata.country_code;
              if (metadata.phone_number || metadata.phone) apiData.phone_number = normalizePhoneInput(metadata.phone_number || metadata.phone);
              if (metadata.email) apiData.email = metadata.email;
              if (metadata.website) apiData.website = metadata.website;
              if (metadata.contact_person) apiData.contact_person = metadata.contact_person;
            }
          }

        } catch (error) {
          console.error('Failed to fetch tenant data:', error);
        }

        // Then load saved progress from localStorage (should override API data if it exists)
        const saved = !forced ? localStorage.getItem(`onboarding_${tenantId}`) : null;
        let localData: Partial<BusinessProfile> = {};
        let savedStep = forced ? requestedStep : initialStep;
        
        if (saved) {
          try {
            const data = JSON.parse(saved);
            localData = data.businessData || {};
            savedStep = data.currentStep || initialStep;
          } catch (e) {
            console.error('Failed to load onboarding progress:', e);
          }
        }

        // Merge: API data as base, localStorage data overrides (for new/unsaved changes)
        const mergedData = { ...apiData, ...localData };
        // Provide defaults so validation schema receives strings instead of undefined
        const normalizedMerged = {
          business_name: '',
          address_line1: '',
          address_line2: '',
          city: '',
          state: '',
          postal_code: '',
          country_code: 'US',
          phone_number: '',
          email: '',
          website: '',
          contact_person: '',
          ...mergedData,
        } as Partial<BusinessProfile>;
        console.log('[OnboardingWizard] API data:', apiData);
        console.log('[OnboardingWizard] localStorage data:', localData);
        console.log('[OnboardingWizard] Merged data:', normalizedMerged);
        setBusinessData(normalizedMerged);
        setCurrentStep(savedStep);
      } catch (error) {
        console.error('Failed to load initial data:', error);
      }
    };

    loadInitialData();
  }, [tenantId, initialStep, forced, requestedStep]);

  // Save progress to localStorage (skip when in forced mode)
  useEffect(() => {
    if (!forced && Object.keys(businessData).length > 0) {
      localStorage.setItem(`onboarding_${tenantId}`, JSON.stringify({
        currentStep,
        businessData,
      }));
    }
  }, [currentStep, businessData, tenantId, forced]);

  const handleNext = async () => {
    if (currentStep === 1) {
      // Save business profile
      setSaving(true);
      setError(null);

      try {
        const response = await api.post('/api/tenant/profile', {
          tenant_id: tenantId,
          ...businessData,
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({} as any));
          throw new Error((errorData as any)?.error || 'Failed to save business profile');
        }

        setSuccess(true);
        setCurrentStep(2);
        
        // Clear saved progress
        localStorage.removeItem(`onboarding_${tenantId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setSaving(false);
      }
    } else if (currentStep === 2) {
      // Complete onboarding
      if (onComplete) {
        onComplete(businessData);
      } else {
        // Default to tenant-scoped dashboard
        router.push(`/t/${tenantId}/dashboard`);
      }
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    if (onComplete) {
      onComplete(businessData);
    } else {
      router.push('/tenants');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 flex items-center justify-center p-4">
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
            <Alert variant="error" title="Error" onClose={() => setError(null)} className="mb-6">
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
                <Button variant="secondary" onClick={handleBack} disabled={saving}>
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
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button onClick={() => router.push(`/t/${tenantId}/dashboard`)}>
                Go to Tenant Dashboard
                <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Button>
              <Button variant="primary" onClick={() => router.push(`/t/${tenantId}/quick-start`)}>
                🚀 Quick Start - Generate Products (Recommended)
              </Button>
              <Button variant="secondary" onClick={() => router.push('/') }>
                Platform Dashboard
              </Button>
              <Button variant="secondary" onClick={() => router.push(`/t/${tenantId}/profile-completeness`)}>
                Profile Completeness
              </Button>
              {ffCategory && (
                <Button variant="secondary" onClick={() => router.push(`/t/${tenantId}/categories`)}>
                  Categories
                </Button>
              )}
              <Button variant="secondary" onClick={() => router.push(`/t/${tenantId}/items`)}>
                Products
              </Button>
              <Button variant="secondary" onClick={() => router.push(`/t/${tenantId}/settings/hours`)}>
                Hours
              </Button>
              <Button variant="secondary" onClick={() => router.push(`/t/${tenantId}/settings`)}>
                Settings
              </Button>
              <Button variant="secondary" onClick={() => router.push(`/tenant/${tenantId}`)}>
                Storefront
              </Button>
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
