'use client';

import { useState, useEffect } from 'react';
import TenantShell from './TenantShell';
import { TenantOption } from './TenantSwitcher';
import { api } from '@/lib/api';

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
        const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
        const response = await api.get(`${apiBaseUrl}/api/tenants/${encodeURIComponent(tenantId)}`);
        
        if (response.ok) {
          const tenantData = await response.json();
          setTenantName(tenantData.name || tenantId);
          setTenantLogoUrl(tenantData.metadata?.logo_url);
        }
      } catch (error) {
        console.warn('Failed to fetch tenant data:', error);
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
