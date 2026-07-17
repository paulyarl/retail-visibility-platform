import { Suspense } from 'react';
import DirectoryHealthClient from './DirectoryHealthClient';

export default async function DirectoryHealthPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Suspense fallback={
        <div className="animate-pulse space-y-6">
          <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      }>
        <DirectoryHealthClient tenantId={tenantId} />
      </Suspense>
    </div>
  );
}
