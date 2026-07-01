'use client';

import OrganizationDashboard from '@/components/organization/OrganizationDashboard';
import { OrgGuard } from '@/components/organization/OrgGuard';

export default function OrganizationPage() {
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
  return (
    <OrgGuard tenantId={tenantId} requireAdmin={false}>
      <OrganizationDashboard tenantId={tenantId} />
    </OrgGuard>
  );
}
