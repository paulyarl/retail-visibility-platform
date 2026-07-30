'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import PayPageClient from './PayPageClient';

export default function MarketingPayPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><p className="text-gray-500">Loading...</p></div>}>
      <PayPageClient />
    </Suspense>
  );
}
