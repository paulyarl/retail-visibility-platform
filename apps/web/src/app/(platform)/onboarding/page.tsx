"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@mantine/core';
import { Spinner, AnimatedCard, Input } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { userManagementService } from '@/services/UserManagementService';
import { onboardingStateService } from '@/services/OnboardingStateService';

const ONBOARDING_STEPS = [
  { id: 'welcome', title: 'Welcome to Visible Shelf!', description: 'Let\'s get your account set up' },
  { id: 'profile', title: 'Your Profile', description: 'Tell us a bit about yourself' },
  { id: 'business', title: 'Your Business', description: 'What type of business do you have?' },
  { id: 'complete', title: 'All Set!', description: 'You\'re ready to start' },
];

const BUSINESS_TYPES = [
  { id: 'retail', label: 'Retail Store', icon: '🏪' },
  { id: 'restaurant', label: 'Restaurant/Food Service', icon: '🍽️' },
  { id: 'service', label: 'Service Business', icon: '🔧' },
  { id: 'ecommerce', label: 'E-commerce', icon: '🛒' },
  { id: 'other', label: 'Other', icon: '📦' },
];

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedProfile, setSavedProfile] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    businessName: '',
    businessType: '',
    phone: '',
  });

  // Note: We don't redirect to /auth/login here because the user just came from 
  // a successful Auth0 login. The session validation might fail due to timing issues,
  // but the user is already authenticated. We show the onboarding page regardless.

  // Initialize/restore phase 1 state
  useEffect(() => {
    // Try to restore existing state
    const existingState = onboardingStateService.getPhase1();
    // console.log('[Onboarding] Restoring from onboardingStateService:', existingState);
    
    if (existingState) {
      // console.log('[Onboarding] Setting formData from existingState');
      setFormData({
        firstName: existingState.firstName || user?.firstName || '',
        lastName: existingState.lastName || user?.lastName || '',
        businessName: existingState.businessName || user?.businessName || '',
        businessType: existingState.businessType || user?.businessType || '',
        phone: existingState.phone || user?.phone || '',
      });
      setHasRestored(true);
    } else {
      // console.log('[Onboarding] No existingState, starting new phase 1');
      // Start new phase 1 - load all available user data
      onboardingStateService.startPhase1();
      if (user) {
        setFormData({
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          businessName: user.businessName || '',
          businessType: user.businessType || '',
          phone: user.phone || '',
        });
      }
      setHasRestored(true);
    }
  }, [user]);

  // Track if we've restored data (to prevent overwriting on mount)
  const [hasRestored, setHasRestored] = useState(false);

  // Save form data to shared state on change (only after restoration)
  useEffect(() => {
    // Don't save on initial mount - wait for restoration to complete
    if (!hasRestored) return;
    
    onboardingStateService.savePhase1({
      firstName: formData.firstName,
      lastName: formData.lastName,
      businessName: formData.businessName,
      businessType: formData.businessType,
      phone: formData.phone,
      email: user?.email,
    });
  }, [formData, user?.email, hasRestored]);

  const handleNext = async () => {
    if (currentStep < ONBOARDING_STEPS.length - 2) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Complete onboarding
      await completeOnboarding();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const completeOnboarding = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await userManagementService.completeOnboarding(formData);

      if (result.success) {
        setSavedProfile(result.user);
        
        // Mark phase 1 complete and prepare for phase 2
        if (result.tenant) {
          setSavedProfile({ ...result.user, tenant: result.tenant });
          onboardingStateService.completePhase1(
            result.tenant.id
          );
        }
        setCurrentStep(ONBOARDING_STEPS.length - 1); // Show complete step
      } else {
        console.error('Onboarding failed:', result.error);
        // Check if it's an authentication error
        if (result.error?.includes('401') || result.error?.includes('Unauthorized') || result.error?.includes('Authentication required')) {
          setError('Authentication failed. Please ensure cookies are enabled and any ad/privacy blockers are disabled for this site, then try again.');
        } else {
          setError(result.error || 'An error occurred. Please try again.');
        }
      }
    } catch (error: any) {
      console.error('Onboarding failed:', error);
      // Check for 401 status
      if (error?.status === 401 || error?.message?.includes('401')) {
        setError('Authentication failed. Please ensure cookies are enabled and any ad/privacy blockers are disabled for this site, then try again.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToTenants = () => {
    const tenantId = searchParams.get('tenantId') || savedProfile?.tenant?.id;
    if (tenantId) {
      router.replace(`/t/${tenantId}/onboarding`);
    } else {
      // Pass onboarding data to /tenants for "Add New Location" modal
      const params = new URLSearchParams();
      if (formData.businessName) params.set('onboarding_name', formData.businessName);
      if (formData.phone) params.set('onboarding_phone', formData.phone);
      if (formData.businessType) params.set('onboarding_business_type', formData.businessType);
      const queryString = params.toString();
      router.replace(`/tenants${queryString ? `?${queryString}` : ''}`);
    }
  };

  const handleContinueToAdvancedProfile = () => {
    const tenantId = savedProfile?.tenant?.id;
    if (tenantId) {
      // Phase 1 already marked complete, just navigate
      router.push(`/t/${tenantId}/onboarding?fromPhase1=true`);
    } else {
      // Pass onboarding data to /tenants for "Add New Location" modal
      const params = new URLSearchParams();
      if (formData.businessName) params.set('onboarding_name', formData.businessName);
      if (formData.phone) params.set('onboarding_phone', formData.phone);
      if (formData.businessType) params.set('onboarding_business_type', formData.businessType);
      const queryString = params.toString();
      router.push(`/tenants${queryString ? `?${queryString}` : ''}`);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="text-primary-600 mb-4" />
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    );
  }

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
            Let's set up your account in just a few steps
          </p>
        </motion.div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {ONBOARDING_STEPS.map((step, index) => (
              <div
                key={step.id}
                className={`h-2 flex-1 mx-1 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-primary-600' : 'bg-neutral-200'
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-neutral-500 text-center">
            Step {currentStep + 1} of {ONBOARDING_STEPS.length}
          </p>
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <AnimatedCard className="p-8">
              <h1 className="text-2xl font-bold text-neutral-900 mb-2">
                {ONBOARDING_STEPS[currentStep].title}
              </h1>
              <p className="text-neutral-600 mb-6">
                {ONBOARDING_STEPS[currentStep].description}
              </p>

              {/* Welcome Step */}
              {currentStep === 0 && (
                <div className="space-y-4">
                  <p className="text-neutral-700">
                    Welcome to Visible Shelf! We'll help you set up your account and get started with managing your products online.
                  </p>
                  <ul className="space-y-2 text-neutral-600">
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Manage products across multiple locations
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Sync with Google Shopping
                    </li>
                    <li className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Create a beautiful storefront
                    </li>
                  </ul>
                </div>
              )}

              {/* Profile Step */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <Input
                    label="First Name"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    placeholder="John"
                  />
                  <Input
                    label="Last Name"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    placeholder="Doe"
                  />
                  <Input
                    label="Phone Number (optional)"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="+1 (555) 000-0000"
                    type="tel"
                  />
                </div>
              )}

              {/* Business Step */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  {/* Error message */}
                  {error && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-1.964-1.333-2.732 0L3.732 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-red-800">{error}</p>
                          {(error.includes('cookies') || error.includes('blockers')) && (
                            <p className="text-xs text-red-600 mt-1">
                              Tip: Check your browser settings to allow cookies and disable privacy/ad blockers for localhost or visibleshelf.store
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  <Input
                    label="Business Name"
                    value={formData.businessName}
                    onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
                    placeholder="My Awesome Store"
                  />
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-2">
                      Business Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {BUSINESS_TYPES.map((type) => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, businessType: type.id }))}
                          className={`p-3 rounded-lg border-2 text-left transition-colors ${
                            formData.businessType === type.id
                              ? 'border-primary-600 bg-primary-50'
                              : 'border-neutral-200 hover:border-neutral-300'
                          }`}
                        >
                          <span className="text-2xl">{type.icon}</span>
                          <p className="text-sm font-medium text-neutral-900 mt-1">{type.label}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Complete Step */}
              {currentStep === 3 && (
                <div className="text-center py-4">
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
                    Your account has been set up. Now let's create your first store location.
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
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        Profile Summary
                      </h3>

                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-neutral-500 uppercase tracking-wide">Name</p>
                            <p className="text-sm font-medium text-neutral-900">{formData.firstName} {formData.lastName}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-neutral-500 uppercase tracking-wide">Business</p>
                            <p className="text-sm font-medium text-neutral-900">{formData.businessName}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-neutral-500 uppercase tracking-wide">Type</p>
                            <p className="text-sm font-medium text-neutral-900">
                              {BUSINESS_TYPES.find(t => t.id === formData.businessType)?.label || 'Not set'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div className="space-y-3 mb-6">
                    <div className="flex items-center justify-center gap-2 text-sm text-neutral-600">
                      <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Account created</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-neutral-600">
                      <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Profile configured</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm text-neutral-600">
                      <svg className="w-5 h-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Ready to create your first store</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation */}
              {currentStep < 3 && (
                <div className="flex justify-between mt-8 pt-6 border-t border-neutral-200">
                  <Button
                    variant="subtle"
                    onClick={handleBack}
                    disabled={currentStep === 0}
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleNext}
                    loading={isSubmitting}
                    disabled={currentStep === 2 && !formData.businessName}
                  >
                    {currentStep === 2 ? 'Complete Setup' : 'Continue'}
                  </Button>
                </div>
              )}

              {/* Complete Step Actions */}
              {currentStep === 3 && (
                <div className="mt-8 pt-6 border-t border-neutral-200">
                  {/* Back button for last-minute changes */}
                  <div className="flex justify-start mb-4">
                    <Button variant="subtle" onClick={handleBack}>
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back to Edit
                    </Button>
                  </div>

                  {/* Tenant Selection/Creation */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4 text-center">
                      {user?.tenants && user.tenants.length > 0 
                        ? 'Select a Store to Manage' 
                        : 'Create Your First Store'}
                    </h3>
                    
                    {/* Existing Tenants */}
                    {user?.tenants && user.tenants.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {user.tenants.map((tenant) => (
                          <button
                            key={tenant.id}
                            onClick={() => {
                              onboardingStateService.completePhase1(tenant.id);
                              router.push(`/t/${tenant.id}/onboarding?fromPhase1=true`);
                            }}
                            className="w-full p-4 bg-white border border-neutral-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-left flex items-center justify-between group"
                          >
                            <div>
                              <p className="font-medium text-neutral-900">{tenant.name}</p>
                              <p className="text-xs text-neutral-500 capitalize">{tenant.role.toLowerCase()}</p>
                            </div>
                            <svg className="w-5 h-5 text-neutral-400 group-hover:text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Create New Tenant */}
                    <div className="p-4 bg-gradient-to-r from-primary-50 to-blue-50 rounded-lg border border-primary-200">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="flex-shrink-0 w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                          <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900">
                            {user?.tenants && user.tenants.length > 0 ? 'Create Another Store' : 'Create Your Store'}
                          </p>
                          <p className="text-xs text-neutral-600">
                            {formData.businessName || 'New Store'}
                          </p>
                        </div>
                      </div>
                      
                      <Button 
                        onClick={handleContinueToAdvancedProfile}
                        className="w-full"
                      >
                        {user?.tenants && user.tenants.length > 0 ? 'Create New Store' : 'Set Up My Store'}
                        <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </Button>
                    </div>
                  </div>

                  {/* Skip for now */}
                  <div className="text-center mb-4">
                    <Button variant="ghost" onClick={() => router.push('/dashboard')}>
                      Skip for now → Dashboard
                    </Button>
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex justify-center gap-4 pt-4 border-t border-neutral-100">
                    <Button variant="subtle" onClick={() => router.push('/settings/account')}>
                      Edit Profile
                    </Button>
                    <Button variant="subtle" onClick={() => router.push('/tenants')}>
                      All Stores
                    </Button>
                  </div>
                </div>
              )}
            </AnimatedCard>
          </motion.div>
        </AnimatePresence>

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

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="text-primary-600 mb-4" />
          <p className="text-neutral-600">Loading...</p>
        </div>
      </div>
    }>
      <OnboardingContent />
    </Suspense>
  );
}
