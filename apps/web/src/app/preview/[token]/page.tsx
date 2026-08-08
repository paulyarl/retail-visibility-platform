'use client';

import { Suspense } from 'react';
import GalleryClient from './GalleryClient';

export default function DiagnosticGalleryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <GalleryClient />
    </Suspense>
  );
}
