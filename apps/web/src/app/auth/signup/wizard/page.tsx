"use client";

import { useState, useEffect } from 'react';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { onboardingStateService } from '@/services/OnboardingStateService';

/**
 * Auth0-Connected Signup Wizard
 * 
 * Multi-step signup process:
 * 1. Platform Benefits Overview
 * 2. Basic Information Collection
 * 3. Account Creation with Auth0
 * 4. Redirect to Onboarding
 */
export default function SignupWizardPage() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    businessName: '',
    email: '',
    phone: '',
    businessType: '',
    numberOfLocations: '1',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [checkingExistingUser, setCheckingExistingUser] = useState(false);
  const router = useRouter();
  const { settings, loading: settingsLoading } = usePlatformSettings();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();

  // Restore form data from onboarding state service (persists across Auth0 redirect)
  useEffect(() => {
    const existingState = onboardingStateService.getPhase1();
    // console.log('[SignupWizard] Restoring from onboardingStateService:', existingState);
    if (existingState) {
      setFormData(prev => ({
        ...prev,
        firstName: existingState.firstName || prev.firstName,
        lastName: existingState.lastName || prev.lastName,
        businessName: existingState.businessName || prev.businessName,
        businessType: existingState.businessType || prev.businessType,
        phone: existingState.phone || prev.phone,
        email: existingState.email || prev.email,
      }));
    }
  }, []);

  // Check for existing authenticated user before showing data collection
  useEffect(() => {
    // Only check when moving to step 5 (data collection)
    if (step !== 5) return;
    // Skip if still loading auth state
    if (authLoading) return;
    
    const checkExistingUser = async () => {
      if (isAuthenticated && user) {
        // console.log('[SignupWizard] Existing authenticated user detected:', user.email);
        setCheckingExistingUser(true);
        
        // Check if user has tenants
        const hasTenants = user.tenants && user.tenants.length > 0;
        
        if (hasTenants) {
          // User has tenants - redirect to their dashboard
          const tenantId = user.tenants[0]?.id;
          // console.log('[SignupWizard] User has tenants, redirecting to dashboard:', tenantId);
          router.replace(`/t/${tenantId}/dashboard`);
        } else if (user.onboardingCompleted) {
          // User completed onboarding but has no tenants - redirect to dashboard
          // console.log('[SignupWizard] User completed onboarding, redirecting to dashboard');
          router.replace('/dashboard');
        } else {
          // User needs onboarding - redirect to onboarding
          // console.log('[SignupWizard] User needs onboarding, redirecting');
          router.replace('/onboarding');
        }
      }
    };
    
    checkExistingUser();
  }, [step, isAuthenticated, user, authLoading, router]);

  // Total steps: 4 benefit steps + 1 data collection = 5 total
  const totalSteps = 5;

  const benefitSteps = [
    {
      icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
      title: "Your Products, Visible Everywhere",
      description: "Get your inventory discovered by local shoppers through your own Storefront page and our Store Directory. Every product you carry becomes searchable and visible to customers nearby.",
      highlight: "Free Storefront page + Directory listing included"
    },
    {
      icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4",
      title: "POS Integration Made Simple",
      description: "Connect your existing point-of-sale system and watch your inventory sync automatically. Support for Clover, Square, and other popular POS platforms. No manual updates needed.",
      highlight: "Works with Clover, Square & more"
    },
    {
      icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zM9 5a2 2 0 012-2h2a2 2 0 012 2v6a2 2 0 01-2 2H11a2 2 0 01-2-2V5z",
      title: "Real-Time Inventory Visibility",
      description: "Customers see exactly what you have in stock right now. When something sells in-store, it's instantly updated online. No more disappointed shoppers finding out you're sold out.",
      highlight: "Inventory syncs in real-time"
    },
    {
      icon: "M13 10V3L4 14h7v7l9-11h-7z",
      title: "Go Live in Minutes",
      description: "Connect your POS, customize your Storefront, and start reaching local customers the same day. No technical expertise required. We handle the complexity so you can focus on your business.",
      highlight: "Average setup time: 15 minutes"
    }
  ];

  const businessTypes = [
    { value: 'retail', label: 'Retail Store' },
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'pharmacy', label: 'Pharmacy' },
    { value: 'grocery', label: 'Grocery Store' },
    { value: 'convenience', label: 'Convenience Store' },
    { value: 'other', label: 'Other' }
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleNext = () => {
    if (step < totalSteps) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Save form data to onboarding state service (localStorage persists across Auth0 redirect)
      // console.log('[SignupWizard] Saving formData to onboardingStateService:', formData);
      onboardingStateService.savePhase1({
        firstName: formData.firstName,
        lastName: formData.lastName,
        businessName: formData.businessName,
        businessType: formData.businessType,
        phone: formData.phone,
        email: formData.email,
      });
      
      // Verify it was saved
      const saved = onboardingStateService.getPhase1();
      // console.log('[SignupWizard] Verified saved data:', saved);

      // Redirect to Auth0 signup
      // Auth0 will handle account creation and authentication
      // After successful auth, user will be redirected back to /auth/callback then to onboarding
      const returnTo = encodeURIComponent('/onboarding');
      window.location.href = `/auth/login?screen_hint=signup&returnTo=${returnTo}`;
    } catch (error) {
      console.error('Signup error:', error);
      alert(error instanceof Error ? error.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    // Benefit steps 1-4
    if (step >= 1 && step <= 4) {
      const benefit = benefitSteps[step - 1];
      return (
        <div>
          {/* Platform Logo */}
          <div className="text-center mb-8">
            {settings?.logoUrl ? (
              <div>
                <Image
                  src={settings.logoUrl}
                  alt={settings.platformName || 'Platform Logo'}
                  width={400}
                  height={60}
                  className="max-h-8 w-auto object-contain mx-auto mb-6"
                  onError={(e) => {
                    console.error('[SignupWizard] Logo failed to load:', settings.logoUrl);
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'flex';
                  }}
                />
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-xl mb-6 shadow-lg mx-auto" style={{display: 'none'}}>
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
            ) : (
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-xl mb-6 shadow-lg mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            )}
          </div>

          <div className="text-center">
            <div className="mb-8">
             
              <h2 className="text-3xl font-bold text-neutral-900 mb-4">{benefit.title}</h2>
              <p className="text-xl text-neutral-600 mb-6 max-w-2xl mx-auto">{benefit.description}</p>
              
              {benefit.highlight && (
                <div className="bg-primary-50 border-l-4 border-primary-600 p-4 mb-8 inline-block">
                  <p className="text-primary-800 font-semibold">{benefit.highlight}</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={handleBack}
                className="px-6 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                disabled={step === 1}
              >
                Back
              </button>
              
              <div className="text-sm text-neutral-500">
                Step {step} of {totalSteps}
              </div>
              
              <button
                onClick={handleNext}
                className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Data collection step (step 5)
    if (step === 5) {
      // Show loading state while checking for existing user
      if (checkingExistingUser || authLoading) {
        return (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-neutral-600">Checking your account...</p>
          </div>
        );
      }
      
      return (
        <div>
          {/* Platform Logo */}
          <div className="text-center mb-8">
            {settings?.logoUrl ? (
              <Image
                src={settings.logoUrl}
                alt={settings.platformName || 'Platform Logo'}
                width={240}
                height={60}
                className="max-h-8 w-auto object-contain mx-auto mb-6"
              />
            ) : (
              <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-xl mb-6 shadow-lg mx-auto">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
            )}
          </div>
          
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Ready to get started?</h2>
          <p className="text-neutral-600 mb-6">
            Tell us about your business and we'll have you up and running in minutes.
          </p>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="block text-sm font-medium text-neutral-700 mb-1">
                  First Name *
                </label>
                <input
                  id="firstName"
                  name="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Your first name"
                  required
                />
              </div>
              <div>
                <label htmlFor="lastName" className="block text-sm font-medium text-neutral-700 mb-1">
                  Last Name *
                </label>
                <input
                  id="lastName"
                  name="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Your last name"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="businessName" className="block text-sm font-medium text-neutral-700 mb-1">
                Business Name *
              </label>
              <input
                id="businessName"
                name="businessName"
                type="text"
                value={formData.businessName}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Your business name"
                required
              />
            </div>

            <div>
              <label htmlFor="businessType" className="block text-sm font-medium text-neutral-700 mb-1">
                Business Type *
              </label>
              <select
                id="businessType"
                name="businessType"
                value={formData.businessType}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="">Select business type</option>
                {businessTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="numberOfLocations" className="block text-sm font-medium text-neutral-700 mb-1">
                Number of Locations *
              </label>
              <select
                id="numberOfLocations"
                name="numberOfLocations"
                value={formData.numberOfLocations}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                required
              >
                <option value="1">1 location</option>
                <option value="2-5">2-5 locations</option>
                <option value="6-20">6-20 locations</option>
                <option value="21+">21+ locations</option>
              </select>
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-neutral-700 mb-1">
                Email Address *
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-neutral-700 mb-1">
                Phone Number
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="(555) 123-4567"
              />
            </div>

            <div className="bg-primary-50 rounded-xl p-4">
              <h4 className="font-semibold text-primary-900 mb-2">Start Your Free Trial</h4>
              <p className="text-primary-700 text-sm mb-2">
                No credit card required. Full access to all features for 14 days.
              </p>
              <div className="text-xs text-primary-600">
                After your trial, choose from Starter, Professional, or Enterprise plans.
              </div>
            </div>

            <div className="flex justify-between pt-4">
              <button
                type="button"
                onClick={handleBack}
                className="px-6 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating Account...' : 'Create Account & Start Trial'}
              </button>
            </div>
          </form>
        </div>
      );
    }

    // Success step (after form submission)
    return (
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">Welcome aboard!</h2>
        <p className="text-neutral-600 mb-6">
          Your account is being created. You'll be redirected to complete your setup.
        </p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-neutral-50 flex items-center justify-center">
      <div className="max-w-2xl w-full mx-4">
        {/* Show loading state while settings are being fetched */}
        {settingsLoading ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-neutral-600">Loading...</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              {settings?.logoUrl ? (
                <Image
                  src={settings.logoUrl}
                  alt={settings.platformName || 'Platform Logo'}
                  width={400}
                  height={100}
                  className="max-h-16 w-auto object-contain mx-auto mb-4"
                />
              ) : (
                <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4 shadow-lg mx-auto">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              )}
            </div>

            {/* Progress Steps */}
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 4, 5].map((stepNumber) => (
                  <div key={stepNumber} className="flex items-center">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                      step >= stepNumber 
                        ? 'bg-primary-600 text-white' 
                        : 'bg-neutral-200 text-neutral-500'
                    }`}>
                      {stepNumber}
                    </div>
                    {stepNumber < 5 && (
                      <div className={`w-6 h-0.5 ml-2 ${
                        step > stepNumber ? 'bg-primary-600' : 'bg-neutral-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-8">
              {renderStep()}
            </div>

            <div className="mt-6 text-center">
              <p className="text-sm text-neutral-600">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-primary-600 hover:text-primary-700 font-medium">
                  Sign in
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
