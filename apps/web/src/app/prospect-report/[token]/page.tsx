import { Suspense } from 'react';
import ProspectReportClient from './ProspectReportClient';

export const dynamic = 'force-dynamic';

export default function ProspectReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Loading report...</p>
        </div>
      }
    >
      <ProspectReportClient />
    </Suspense>
  );
}
