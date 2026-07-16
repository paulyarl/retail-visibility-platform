'use client';

import { useState, useEffect } from 'react';
import TenantShell from './TenantShell';
import { TenantOption } from './TenantSwitcher';
import { publicTenantInfoService } from '@/services/PublicTenantInfoService';
import { clientLogger } from '@/lib/client-logger';

interface ClientTenantShellProps {
  tenantId: string;
  initialTenantName?: string;
  initialTenantLogoUrl?: string;
  nav: { label: string; href: string }[];
  tenants: TenantOption[];
  children: React.ReactNode;
}

export default function ClientTenantShell({ 
  tenantId, 
  initialTenantName, 
  initialTenantLogoUrl,
  nav, 
  tenants, 
  children 
}: ClientTenantShellProps) {
  const [tenantName, setTenantName] = useState(initialTenantName || tenantId);
  const [tenantLogoUrl, setTenantLogoUrl] = useState(initialTenantLogoUrl);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTenantData = async () => {
      try {
        const tenantData = await publicTenantInfoService.getTenantInfo(tenantId);
        
        if (tenantData) {
          setTenantName(tenantData.name || tenantId);
          setTenantLogoUrl(tenantData.metadata?.logo_url);
        }
      } catch (error) {
        clientLogger.warn('Failed to fetch tenant data:', { detail: error });
        // Keep the fallback values
      } finally {
        setLoading(false);
      }
    };

    fetchTenantData();
  }, [tenantId]);

  return (
    <TenantShell
      tenantId={tenantId}
      tenantName={tenantName}
      tenantLogoUrl={tenantLogoUrl}
      nav={nav}
      tenants={tenants}
    >
      {children}
    </TenantShell>
  );
}
