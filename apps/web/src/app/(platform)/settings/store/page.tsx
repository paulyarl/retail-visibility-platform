'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import AppStoreClient from '@/app/t/[tenantId]/settings/store/AppStoreClient';
import SetTenantId from '@/components/client/SetTenantId';

export const dynamic = 'force-dynamic';

export default function PlatformStorePage() {
  const searchParams = useSearchParams();
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const urlTenantId = searchParams?.get('tenantId');
    const id = urlTenantId || (typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null);
    setTenantId(id);
    setReady(true);
  }, [searchParams]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-gray-600">No store selected. Please select a store from your dashboard first.</p>
          <a href="/settings" className="text-blue-600 hover:underline">Back to Settings</a>
        </div>
      </div>
    );
  }

  const tab = searchParams?.get('tab') || 'plans';

  return (
    <>
      <SetTenantId tenantId={tenantId} />
      <AppStoreClient tenantId={tenantId} initialTab={tab} />
    </>
  );
}
