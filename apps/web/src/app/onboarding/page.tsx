"use client";

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import OnboardingWizard from '@/components/onboarding/OnboardingWizard';
import { Spinner } from '@/components/ui';

export default function OnboardingPage() {
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
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Spinner size="lg" className="text-primary-600 mb-4" />
          <p className="text-neutral-600">Loading onboarding...</p>
        </div>
      </div>
    );
  }

  return (
    <OnboardingWizard
      tenantId={tenantId!}
      onComplete={handleComplete}
    />
  );
}
