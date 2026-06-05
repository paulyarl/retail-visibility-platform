import { Suspense } from 'react';
import DirectoryClient from './DirectoryClient';

export const dynamic = 'force-dynamic';

export default function DirectoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-neutral-600 dark:text-neutral-400">Loading directory...</p>
        </div>
      </div>
    }>
      <DirectoryClient />
    </Suspense>
  );
}
