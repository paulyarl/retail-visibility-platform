'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import IntakePageClient from './IntakePageClient';

export default function RecoveryIntakePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <IntakePageClient />
    </Suspense>
  );
}
