'use client';

import { useState, useEffect } from 'react';
import OrganizationDashboard from '@/components/organization/OrganizationDashboard';
import { OrgGuard } from '@/components/organization/OrgGuard';

export const dynamic = 'force-dynamic';

export default function OrganizationPage() {
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    setTenantId(localStorage.getItem('tenantId'));
  }, []);

  return (
    <OrgGuard tenantId={tenantId} requireAdmin={false}>
      <OrganizationDashboard tenantId={tenantId} />
    </OrgGuard>
  );
}
