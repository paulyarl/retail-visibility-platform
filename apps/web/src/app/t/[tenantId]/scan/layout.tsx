/**
 * Scan Products Layout with Capability Gating
 * 
 * Wraps the Scan Products page with capability-based access control.
 * Uses the barcode_scan_options capability type to determine access.
 * 
 * MIGRATED: Now uses useBarcodeScanCapability for capability-based gating.
 */

'use client';

import { useParams } from 'next/navigation';
import { TierGate } from '@/components/tier/TierGate';
import { useTenantAccess } from '@/hooks/tenant-access/useTenantAccess';
import { useBarcodeScanCapability } from '@/hooks/tenant-access/useCapabilityAccess';

export default function ScanLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const tenantId = params.tenantId as string;
  
  // Use hooks for dynamic tier data and capability-based access
  const { tier, loading: tierLoading } = useTenantAccess(tenantId);
  const barcodeCap = useBarcodeScanCapability(tenantId, { forTenant: true });

  const loading = tierLoading || barcodeCap.loading;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-600"></div>
      </div>
    );
  }

  // Check capability-based access (barcode_enabled and at least one mode available)
  if (barcodeCap.data?.enabled && barcodeCap.data.scanAvailable) {
    return <>{children}</>;
  }

  // Show tier gate for upgrade prompt
  return (
    <TierGate 
      feature="barcode_scan" 
      tier={tier?.effective?.id || 'discovery'} 
      tenantId={tenantId}
    >
      {children}
    </TierGate>
  );
}
