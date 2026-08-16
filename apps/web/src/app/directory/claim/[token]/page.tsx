'use client';

import { Suspense } from 'react';
import DirectoryClaimClient from './DirectoryClaimClient';

export default function DirectoryClaimPage() {
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
