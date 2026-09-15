import { Suspense } from 'react';
import SeedReportClient from './SeedReportClient';

export const dynamic = 'force-dynamic';

export default function SeedReportPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <p className="text-gray-500">Loading report...</p>
        </div>
      }
    >
      <SeedReportClient />
    </Suspense>
  );
}
