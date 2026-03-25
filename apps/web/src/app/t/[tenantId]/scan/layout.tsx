/**
 * Scan Products Layout with Tier Gating
 * 
 * Wraps the Scan Products page with tier-based access control.
 * Requires 'barcode_scan' feature (Professional tier or higher).
 * 
 * MIGRATED: Now uses useTenantAccess for dynamic database tier data.
 */

'use client';

import { useParams } from 'next/navigation';
import { TierGate } from '@/components/tier/TierGate';
import { useTenantAccess } from '@/hooks/tenant-access/useTenantAccess';

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const tenantId = params.tenantId as string;
  
  // Use new hook for dynamic tier data from database
  const { tier, loading, hasFeature } = useTenantAccess(tenantId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // Check feature access directly from hook (includes platform admin bypass)
  if (hasFeature('barcode_scan')) {
    return <>{children}</>;
  }

  // Show tier gate for upgrade prompt
  return (
    <TierGate 
      feature="barcode_scan" 
      tier={tier?.effective?.id || 'starter'} 
      tenantId={tenantId}
    >
      {children}
    </TierGate>
  );
}
