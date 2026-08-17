'use client';

import { Suspense } from 'react';
import DirectoryClaimClient from '@/app/directory/claim/[token]/DirectoryClaimClient';

export default function PlaceClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <DirectoryClaimClient />
    </Suspense>
  );
}
