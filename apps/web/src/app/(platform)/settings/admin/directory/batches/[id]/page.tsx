import { Suspense } from 'react';
import { MarketingOpsNavShell } from '@/components/marketing-ops/MarketingOpsPageShell';
import BatchDetailClient from './BatchDetailClient';

export default function BatchDetailPage() {
  return (
    <MarketingOpsNavShell>
      <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading...</div>}>
        <BatchDetailClient />
      </Suspense>
    </MarketingOpsNavShell>
  );
}
