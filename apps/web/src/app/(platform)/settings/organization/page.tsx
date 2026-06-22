'use client';

import OrganizationDashboard from '@/components/organization/OrganizationDashboard';

export default function OrganizationPage() {
  const tenantId = typeof window !== 'undefined' ? localStorage.getItem('tenantId') : null;
  return <OrganizationDashboard tenantId={tenantId} />;
}
