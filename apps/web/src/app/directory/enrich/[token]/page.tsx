'use client';

import { Suspense } from 'react';
import DirectoryEnrichmentClient from './DirectoryEnrichmentClient';

export default function DirectoryEnrichmentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <DirectoryEnrichmentClient />
    </Suspense>
  );
}
