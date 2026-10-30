import { Suspense } from 'react';
import MarketingOpsPageShell from '@/components/marketing-ops/MarketingOpsPageShell';
import SearchDemandClient from './SearchDemandClient';

export default function SearchDemandPage() {
  return (
    <MarketingOpsPageShell
      title="Search Demand"
      subtitle="Google Search Console demand → seed signals, audits and seek batches (click to queue)"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Admin' },
        { label: 'Marketing Ops', href: '/settings/admin/marketing-ops' },
        { label: 'Search Demand' },
      ]}
    >
      <Suspense fallback={<div className="py-12 text-center text-gray-500">Loading…</div>}>
        <SearchDemandClient />
      </Suspense>
    </MarketingOpsPageShell>
  );
}
