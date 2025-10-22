"use client";

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { Spinner } from '@/components/ui';
import PageHeader, { Icons } from '@/components/PageHeader';

function OnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenantId');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) {
      // No tenant ID provided, redirect to tenants page
      router.push('/tenants');
    } else {
      setLoading(false);
    }
  }, [tenantId, router]);

  const handleComplete = async (profile: any) => {
    console.log('Onboarding complete for tenant:', tenantId);
    console.log('Business profile data:', profile);
    
    // TODO: Save business profile to API
    // await fetch(`/api/tenant/${tenantId}/profile`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify(profile)
    // });
    
    // Store tenant ID in localStorage for future use
    if (typeof window !== 'undefined') {
      localStorage.setItem('tenantId', tenantId!);
    }
    
    // Redirect to tenant settings page
    router.push('/settings/tenant');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="text-primary-600 mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
      <PageHeader
        title="Onboarding"
        description="Set up your store in a few steps"
        icon={Icons.Tenants}
        backLink={{ href: '/tenants', label: 'Back to Tenants' }}
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <OnboardingWizard
          tenantId={tenantId!}
          onComplete={handleComplete}
        />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
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
