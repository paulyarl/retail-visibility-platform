/**
 * GBP Category Settings Layout with Tier Gating
 * 
 * Wraps the GBP Category page with tier-based access control.
 * Requires 'gbp_integration' feature (Professional tier or higher).
 */

'use client';

import { useParams } from 'next/navigation';
import { TierGate } from '@/components/tier/TierGate';
import { useEffect, useState } from 'react';
import { tenantInfoService } from '@/services/TenantInfoService';
import { clientLogger } from '@/lib/client-logger';




export default function GBPCategoryLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const tenantId = params.tenantId as string;
  const [tier, setTier] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch tenant tier
    const fetchTier = async () => {
      try {
        const data = await tenantInfoService.getTenantInfo(tenantId);
        if (data) {
          // API may return snake_case or camelCase depending on endpoint
          setTier(data.subscriptionTier || data.subscription_tier || 'trial');
        }
      } catch (err) {
        clientLogger.error('Failed to fetch tenant tier:', { detail: err });
        setTier('trial'); // Default to trial on error
      } finally {
        setLoading(false);
      }
    };

    fetchTier();
  }, [tenantId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <TierGate 
      feature="gbp_integration" 
      tier={tier} 
      tenantId={tenantId}
    >
      {children}
    </TierGate>
  );
}
