"use client";

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Spinner } from '@/components/ui';

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tenantId = searchParams.get('tenantId');

  useEffect(() => {
    if (tenantId) {
      router.replace(`/t/${tenantId}/onboarding`);
    } else {
      router.replace('/tenants');
    }
  }, [tenantId, router]);

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" className="text-primary-600 mb-4" />
        <p className="text-neutral-600 dark:text-neutral-400">Redirecting…</p>
      </div>
    </div>
  );
}
