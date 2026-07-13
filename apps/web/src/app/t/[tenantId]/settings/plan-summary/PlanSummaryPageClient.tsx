'use client';

import { useAllCapabilities, useMerchantGates } from '@/hooks/tenant-access/useCapabilityAccess';
import PlanSummaryPanel from '@/components/settings/PlanSummaryPanel';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

interface PlanSummaryPageClientProps {
  tenantId: string;
}

export default function PlanSummaryPageClient({ tenantId }: PlanSummaryPageClientProps) {
  const allCaps = useAllCapabilities(tenantId);
  const { gates } = useMerchantGates(tenantId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/t/${tenantId}/dashboard`}
          className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">Plan Summary</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Complete overview of your subscription plan, capability status, and feature effectiveness.
        </p>
      </div>

      <PlanSummaryPanel
        capabilities={allCaps.data}
        loading={allCaps.loading}
        tenantId={tenantId}
        merchantGates={gates}
      />
    </div>
  );
}
