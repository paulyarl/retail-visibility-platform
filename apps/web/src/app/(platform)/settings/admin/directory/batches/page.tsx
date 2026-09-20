import { Suspense } from 'react';
import { MarketingOpsNavShell } from '@/components/marketing-ops/MarketingOpsPageShell';
import BatchOperationsClient from './BatchOperationsClient';

export default function BatchOperationsPage() {
  return (
    <MarketingOpsNavShell>
      <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading...</div>}>
        <BatchOperationsClient />
      </Suspense>
    </MarketingOpsNavShell>
  );
}
