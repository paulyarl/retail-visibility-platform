"use client";

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@mantine/core';
import { Spinner, AnimatedCard, Input } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    businessName: '',
    businessType: '',
    phone: '',
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Pre-fill form with user data
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        firstName: user.firstName || prev.firstName,
        lastName: user.lastName || prev.lastName,
      }));
    }
  }, [user]);

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
    try {
      const response = await fetch('/api/auth/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setCurrentStep(ONBOARDING_STEPS.length - 1); // Show complete step
        // Redirect after 2 seconds
        setTimeout(() => {
          const tenantId = searchParams.get('tenantId');
          if (tenantId) {
            router.replace(`/t/${tenantId}/onboarding`);
          } else {
            router.replace('/tenants');
          }
        }, 2000);
      }
    } catch (error) {
      console.error('Onboarding failed:', error);
    } finally {
      setIsSubmitting(false);
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
      <div className="w-full max-w-lg">
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
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-neutral-600">Redirecting you to your dashboard...</p>
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
            </AnimatedCard>
          </motion.div>
        </AnimatePresence>
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
