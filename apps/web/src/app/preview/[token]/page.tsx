'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import GalleryClient from './GalleryClient';
import MultiGalleryPage from './MultiGalleryPage';

function PreviewRouter() {
  const searchParams = useSearchParams();
  const isMultiGallery = searchParams.get('prospect') === 'true';
  return isMultiGallery ? <MultiGalleryPage /> : <GalleryClient />;
}

export default function DiagnosticGalleryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Loading...</p>
        </div>
      }
    >
      <PreviewRouter />
    </Suspense>
  );
}
