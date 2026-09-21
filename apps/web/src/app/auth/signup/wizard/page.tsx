"use client";

import { useState, useEffect } from 'react';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { onboardingStateService } from '@/services/OnboardingStateService';
import { getUTMParamsFromUrl, storeUTMParams } from '@/lib/utm';
import { tenantManagementService } from '@/services/TenantManagementService';
import { clientLogger } from '@/lib/client-logger';

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
    preferredTier: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [checkingExistingUser, setCheckingExistingUser] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [existingUserData, setExistingUserData] = useState<any>(null);
  const router = useRouter();
  const { settings, loading: settingsLoading } = usePlatformSettings();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();

  // Restore form data from onboarding state service (persists across Auth0 redirect)
  useEffect(() => {
    const existingState = onboardingStateService.getPhase1();
    // console.log('[SignupWizard] Restoring from onboardingStateService:', existingState);
    
    // Check if there's a tier parameter in the URL
    let urlTier = '';
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tierParam = params.get('tier');
      if (tierParam) {
        urlTier = tierParam;
      }
    }

    // Capture UTM / ref attribution from the URL and store it for signup completion
    const utmParams = getUTMParamsFromUrl();
    storeUTMParams(utmParams);
    const attribution = {
      referral: utmParams.ref,
      utmSource: utmParams.utm_source,
      utmMedium: utmParams.utm_medium,
      utmCampaign: utmParams.utm_campaign,
      utmContent: utmParams.utm_content,
      utmTerm: utmParams.utm_term,
    };
    onboardingStateService.savePhase1(attribution);

    if (existingState) {
      setFormData(prev => ({
        ...prev,
        firstName: existingState.firstName || prev.firstName,
        lastName: existingState.lastName || prev.lastName,
        businessName: existingState.businessName || prev.businessName,
        businessType: existingState.businessType || prev.businessType,
        phone: existingState.phone || prev.phone,
        email: existingState.email || prev.email,
        preferredTier: urlTier || existingState.preferredTier || prev.preferredTier,
      }));
    } else if (urlTier) {
      setFormData(prev => ({
        ...prev,
        preferredTier: urlTier,
      }));
    }
  }, []);

  // Check for existing authenticated user before showing data collection
  useEffect(() => {
    // Only check when moving to the final step (data collection)
    if (step !== totalSteps) return;
    // Skip if still loading auth state
    if (authLoading) return;
    
    const checkExistingUser = async () => {
      if (isAuthenticated && user) {
        // console.log('[SignupWizard] Existing authenticated user detected:', user.email);
        setCheckingExistingUser(true);
        
        // Check if user has tenants
        const hasTenants = user.tenants && user.tenants.length > 0;
        
        if (hasTenants) {
          // User has tenants - fetch their data and show review form
          const tenantId = user.tenants[0]?.id;
          // console.log('[SignupWizard] User has tenants, fetching data for review:', tenantId);
          
          try {
            // Fetch existing tenant data using service
            const tenantData = await tenantManagementService.getTenant(tenantId);
            if (tenantData) {
              setExistingUserData(tenantData);
              
              // Pre-populate form with existing data
              setFormData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                businessName: tenantData.business_name || '',
                email: user.email || '',
                phone: tenantData.phone_number || user.phone || '',
                businessType: tenantData.business_type || '',
                numberOfLocations: String(tenantData.metadata?.numberOfLocations || '1'),
                preferredTier: tenantData.metadata?.tier || '',
              });
              
              setShowReviewForm(true);
            }
          } catch (error) {
            clientLogger.error('Failed to fetch tenant data:', { detail: error });
            // Fallback to dashboard if fetch fails
            router.replace(`/t/${tenantId}/dashboard`);
          }
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

  // Total steps: 8 benefit steps + 1 data collection = 9 total
  const totalSteps = 9;

  const benefitSteps = [
    {
      image: '/images/wizard/step-01-mission.png',
      iconImage: '/images/wizard/icon-01-mission.png',
      title: "Big-Box Retailers Built This for Themselves. Now It's Yours.",
      description: "Big-box chains built real-time shelf visibility for themselves. Independent retailers were left with static pins on a map while shoppers were routed to Amazon or national chains. VisibleShelf brings your physical inventory online: start free with your directory listing, connect your POS when you're ready. No IT team required.",
      highlight: "Make your shelves visible • Drive in-store foot traffic • Free to start"
    },
    {
      image: '/images/wizard/step-08-get-started.png',
      iconImage: '/images/wizard/icon-08-get-started.png',
      title: "Directory — You May Already Be Listed",
      description: "Your physical store may already have a place page built from public records. Claim it free in 60 seconds to verify your hours, phone, and address so nearby shoppers find you accurately. Plus, get 5 free product slots to showcase your signature items immediately. Upgrade to Starter ($19/mo) when you want enhanced brand layouts, photos, and your store story.",
      highlight: "Free to claim • 5 free shelf slots • Zero risk"
    },
    {
      image: '/images/wizard/step-02-discovery.png',
      iconImage: '/images/wizard/icon-02-discovery.png',
      title: "Discovery — Get Found on Google",
      description: "When shoppers search for specific items nearby — from specialty flours to hard-to-find provisions — search engines show your physical store as the in-stock destination. Real-time POS inventory sync means no spreadsheets and no manual updates. Turn local item searches into in-store shoppers.",
      highlight: "Item-level Google search • 'In-Stock Nearby' signals • Real-time POS sync"
    },
    {
      image: '/images/wizard/step-03-storefront.png',
      iconImage: '/images/wizard/icon-03-storefront.png',
      title: "Storefront — Own Your Digital Presence",
      description: "Shoppers finding your store online get a branded, mobile-friendly digital storefront. They can browse your aisles, check current prices, view store hours, and see your full inventory from their phones before walking through your door. Your brand, your prices, your customers.",
      highlight: "Mobile storefront • Full aisle browsing • Drives store visits"
    },
    {
      image: '/images/wizard/step-04-commitment.png',
      iconImage: '/images/wizard/icon-04-commitment.png',
      title: "Commitment — Turn Online Search into Foot Traffic",
      description: "Shoppers browse online, but they buy inside your store. Let customers reserve high-demand items with a small deposit (10–15%) so their store visit is committed. When they arrive at your counter, close the sale at your POS. Zero abandoned holds, zero wasted prep, and guaranteed foot traffic.",
      highlight: "Deposit-backed reservations • Guaranteed foot traffic • POS-synced"
    },
    {
      image: '/images/wizard/step-05-ecommerce.png',
      iconImage: '/images/wizard/icon-05-ecommerce.png',
      title: "Storefront Checkout — In-Store Pickup & Direct Orders",
      description: "Enable 1-click online checkout for customers who want to pay in full and pick up at your counter, or support local fulfillment. Your store register is the fulfillment hub: customers buy online, walk in to pick up their bag, and you pay 0% marketplace commission — no DoorDash 30% cut.",
      highlight: "1-Click checkout • Counter pickup • 0% marketplace commission"
    },
    {
      image: '/images/wizard/step-06-omnichannel.png',
      iconImage: '/images/wizard/icon-06-omnichannel.png',
      title: "Omnichannel — Physical + Online, Unified",
      description: "Give your shoppers total flexibility: pay in full for fast curbside pickup, place a deposit to reserve an item on the shelf, or order for local delivery. One unified inventory synced across your store and your digital storefront. Every way to buy, anchored to your physical location.",
      highlight: "Counter pickup + deposit reserve + unified inventory"
    },
    {
      image: '/images/wizard/step-07-enterprise.png',
      iconImage: '/images/wizard/icon-07-enterprise.png',
      title: "Enterprise — Complete Business Solution",
      description: "For multi-location retailers, franchise grocers, and regional store networks. Centralize inventory visibility across all physical locations, unified billing, cross-store search, and enterprise-grade foot-traffic analytics. White-label options for regional co-ops and retail groups.",
      highlight: "Multi-location network • Centralized inventory • Enterprise analytics"
    }
  ];

  const businessTypes = [
    { value: 'retail', label: 'Retail Store' },
    { value: 'grocery', label: 'Grocery Store' },
    { value: 'convenience', label: 'Convenience Store' },
    { value: 'restaurant', label: 'Restaurant / Food Service' },
    { value: 'pharmacy', label: 'Pharmacy' },
    { value: 'other', label: 'Other Retail Business' }
  ];

  const tierOptions = [
    {
      value: 'directory_presence',
      label: 'Directory Presence (Free)',
      description: 'Claim your listing, verify store hours & phone, and activate 5 free shelf slots'
    },
    {
      value: 'presence',
      label: 'Starter ($19/mo)',
      description: 'Enhance your listing with custom branding, store story, photo gallery, and richer layouts'
    },
    { 
      value: 'discovery', 
      label: 'Discovery ($29/mo)',
      description: 'Get found on Google with item-level search indexing and real-time POS sync (75 products)'
    },
    { 
      value: 'storefront', 
      label: 'Storefront ($59/mo)',
      description: 'Branded digital storefront with mobile browsing and customer contact (200 products)'
    },
    { 
      value: 'commitment', 
      label: 'Commitment ($79/mo)',
      description: 'Deposit-backed reservations that turn online item search into committed walk-in foot traffic'
    },
    { 
      value: 'ecommerce', 
      label: 'Storefront Checkout ($99/mo)',
      description: 'Full online checkout for in-store counter pickup and local orders with 0% marketplace commission'
    },
    { 
      value: 'omnichannel', 
      label: 'Omnichannel ($149/mo)',
      description: 'Unified commerce: counter pickup, deposit reservations, and real-time in-store inventory sync'
    },
    { 
      value: 'enterprise', 
      label: 'Enterprise ($499/mo)',
      description: 'Multi-location store network with centralized inventory, API access, and dedicated onboarding'
    }
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
      if (showReviewForm && existingUserData) {
        // Update existing user data
        // console.log('[SignupWizard] Updating existing user data:', formData);
        
        try {
          // Use service to update tenant
          const updatedTenant = await tenantManagementService.updateTenant(existingUserData.id, {
            business_name: formData.businessName,
            business_type: formData.businessType,
            phone_number: formData.phone,
            metadata: {
              tier: formData.preferredTier,
              numberOfLocations: formData.numberOfLocations,
            },
          });

          if (updatedTenant) {
            // Save updated data to onboarding state service
            onboardingStateService.savePhase1({
              firstName: formData.firstName,
              lastName: formData.lastName,
              businessName: formData.businessName,
              businessType: formData.businessType,
              phone: formData.phone,
              email: formData.email,
              preferredTier: formData.preferredTier,
            });
            
            // Redirect to dashboard
            router.replace(`/t/${existingUserData.id}/dashboard`);
          } else {
            throw new Error('Failed to update tenant data');
          }
        } catch (error) {
          clientLogger.error('Update error:', { detail: error });
          alert(error instanceof Error ? error.message : 'Update failed. Please try again.');
        }
      } else {
        // New user signup flow
        // Save form data to onboarding state service (localStorage persists across Auth0 redirect)
        // console.log('[SignupWizard] Saving formData to onboardingStateService:', formData);
        onboardingStateService.savePhase1({
          firstName: formData.firstName,
          lastName: formData.lastName,
          businessName: formData.businessName,
          businessType: formData.businessType,
          phone: formData.phone,
          email: formData.email,
          preferredTier: formData.preferredTier,
        });
        
        // Verify it was saved
        const saved = onboardingStateService.getPhase1();
        // console.log('[SignupWizard] Verified saved data:', saved);

        // Redirect to Auth0 signup
        // Auth0 will handle account creation and authentication
        // After successful auth, user will be redirected back to /auth/callback then to onboarding
        const returnTo = encodeURIComponent('/onboarding');
        window.location.href = `/auth/login?screen_hint=signup&returnTo=${returnTo}`;
      }
    } catch (error) {
      clientLogger.error('Submit error:', { detail: error });
      alert(error instanceof Error ? error.message : 'Operation failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    // Benefit steps 1-8
    if (step >= 1 && step <= 8) {
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
                    clientLogger.error('[SignupWizard] Logo failed to load:', { detail: settings.logoUrl });
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
              {/* Step artwork */}
              {benefit.image && (
                <div className="relative w-full aspect-video mb-6 rounded-xl overflow-hidden bg-neutral-100">
                  <Image
                    src={benefit.image}
                    alt={benefit.title}
                    fill
                    sizes="(max-width: 768px) 90vw, 608px"
                    className="object-contain"
                    priority={step <= 2}
                  />
                </div>
              )}

              {/* Step icon */}
              {benefit.iconImage && (
                <div className="flex justify-center mb-4">
                  <Image
                    src={benefit.iconImage}
                    alt=""
                    width={64}
                    height={64}
                    className="w-16 h-16 object-contain"
                  />
                </div>
              )}

              <h2 className="text-3xl font-bold text-neutral-900 mb-4">{benefit.title}</h2>
              <p className="text-xl text-neutral-600 mb-6 max-w-2xl mx-auto">{benefit.description}</p>

              {benefit.highlight && (
                <div className="bg-primary-50 border-l-4 border-primary-600 p-4 mb-8 inline-block">
                  <p className="text-primary-800 font-semibold">{benefit.highlight}</p>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center flex-wrap gap-3">
              <button
                onClick={handleBack}
                className="px-6 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 text-sm font-medium transition-colors"
                disabled={step === 1}
              >
                Back
              </button>
              
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => setStep(totalSteps)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium underline"
                >
                  Skip to Signup
                </button>
                <span className="text-sm text-neutral-500">
                  Step {step} of {totalSteps}
                </span>
              </div>
              
              <button
                onClick={handleNext}
                className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 text-sm font-medium transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Data collection step (step 9)
    if (step === 9) {
      // Show loading state while checking for existing user
      if (checkingExistingUser || authLoading) {
        return (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-neutral-600">Checking your account...</p>
          </div>
        );
      }
      
      // Show review form for existing users
      if (showReviewForm && existingUserData) {
        return (
          <div>
            <h3 className="text-xl font-semibold text-neutral-900 mb-6">
              Welcome back, {user?.firstName || 'there'}.
            </h3>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h4 className="font-semibold text-blue-900 mb-2">Review Your Information</h4>
              <p className="text-blue-700 text-sm">
                We found your existing business information. You can review and update it below, or continue to your dashboard.
              </p>
            </div>
            
            <form id="reviewForm" onSubmit={handleSubmit} className="space-y-6">
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

              <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
                <h4 className="font-semibold text-neutral-900 mb-3">Which tier fits your goals?</h4>
                <p className="text-sm text-neutral-600 mb-4">
                  Based on the slides you just saw, where do you want to start?
                </p>
                <div>
                  <label htmlFor="preferredTier" className="block text-sm font-medium text-neutral-700 mb-2">
                    Choose your starting tier *
                  </label>
                  <select
                    id="preferredTier"
                    name="preferredTier"
                    value={formData.preferredTier}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    required
                  >
                    <option value="">Select your preferred tier</option>
                    {tierOptions.map(tier => (
                      <option key={tier.value} value={tier.value}>
                        {tier.label}
                      </option>
                    ))}
                  </select>
                  {formData.preferredTier && (
                    <p className="text-xs text-neutral-500 mt-2">
                      {tierOptions.find(t => t.value === formData.preferredTier)?.description}
                    </p>
                  )}
                </div>
              </div>
            </form>
            
            <div className="mt-6 flex justify-between">
              <button
                type="button"
                onClick={() => router.replace(`/t/${existingUserData.id}/dashboard`)}
                className="px-6 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Skip to Dashboard
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-6 py-2 border border-neutral-300 text-neutral-700 rounded-lg hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                >
                  Back
                </button>
                <button
                  type="submit"
                  form="reviewForm"
                  disabled={isLoading}
                  className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Updating...' : 'Update Information'}
                </button>
              </div>
            </div>
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
          
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Claim your store & bring your shelves online</h2>
          <p className="text-neutral-600 mb-6">
            Tell us about your physical retail store to activate your presence. Start free — no credit card required.
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

            <div className="bg-neutral-50 rounded-xl p-4 border border-neutral-200">
              <h4 className="font-semibold text-neutral-900 mb-1">Which tier fits your store goals?</h4>
              <p className="text-sm text-neutral-600 mb-4">
                Start with a free claimed directory listing or select an upgraded visibility tier.
              </p>
              <div>
                <label htmlFor="preferredTier" className="block text-sm font-medium text-neutral-700 mb-2">
                  Choose your starting tier *
                </label>
                <select
                  id="preferredTier"
                  name="preferredTier"
                  value={formData.preferredTier}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  required
                >
                  <option value="">Select your preferred tier</option>
                  {tierOptions.map(tier => (
                    <option key={tier.value} value={tier.value}>
                      {tier.label}
                    </option>
                  ))}
                </select>
                {formData.preferredTier && (
                  <p className="text-xs text-neutral-500 mt-2">
                    {tierOptions.find(t => t.value === formData.preferredTier)?.description}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-primary-50 rounded-xl p-4 border border-primary-100">
              <h4 className="font-semibold text-primary-900 mb-2">Your Store, Your Inventory, Your Customers</h4>
              <p className="text-primary-700 text-sm mb-2">
                A claimed directory listing with 5 free shelf slots is completely free forever. Paid tiers include a 14-day trial with no credit card required.
              </p>
              <div className="text-xs text-primary-600 font-medium">
                Zero delivery logistics • 0% commission on in-store sales • Switch tiers or cancel anytime.
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
                {isLoading ? 'Creating Account...' : 'Create Account'}
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
        <h2 className="text-2xl font-bold text-neutral-900 mb-2">Welcome aboard.</h2>
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
              <div className="flex items-center space-x-1 sm:space-x-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((stepNumber) => (
                  <div key={stepNumber} className="flex items-center">
                    <button
                      type="button"
                      onClick={() => setStep(stepNumber)}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                        step === stepNumber
                          ? 'bg-primary-600 text-white ring-2 ring-primary-300 ring-offset-1 shadow-sm'
                          : step > stepNumber
                          ? 'bg-primary-600 text-white'
                          : 'bg-neutral-200 text-neutral-500 hover:bg-neutral-300'
                      }`}
                      title={stepNumber === 9 ? 'Step 9: Complete Signup' : `Step ${stepNumber}: ${benefitSteps[stepNumber - 1]?.title}`}
                    >
                      {stepNumber === 9 ? '★' : stepNumber}
                    </button>
                    {stepNumber < 9 && (
                      <div className={`w-3 sm:w-5 h-0.5 ml-1 sm:ml-2 ${
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
                <a href="/auth/login" className="text-primary-600 hover:text-primary-700 font-medium">
                  Sign in
                </a>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
