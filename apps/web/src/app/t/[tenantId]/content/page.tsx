import { Suspense } from 'react';
import ContentHubClient from '@/components/content/ContentHubClient';

export default async function ContentHubPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;

  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-20 bg-gray-200 rounded" />
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              <div className="h-44 bg-gray-200 rounded-2xl" />
              <div className="h-44 bg-gray-200 rounded-2xl" />
              <div className="h-44 bg-gray-200 rounded-2xl" />
            </div>
          </div>
        </div>
      }
    >
      <ContentHubClient tenantId={tenantId} />
    </Suspense>
  );
}
