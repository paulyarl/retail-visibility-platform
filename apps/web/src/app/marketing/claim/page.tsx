'use client';

import { Suspense } from 'react';
import ClaimRequestClient from './ClaimRequestClient';

export default function MarketingClaimRequestPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">Loading...</p></div>}>
      <ClaimRequestClient />
    </Suspense>
  );
}
