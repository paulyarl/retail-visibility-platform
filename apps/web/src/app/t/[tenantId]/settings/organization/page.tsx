import SetTenantId from '@/components/client/SetTenantId';
import OrganizationDashboard from '@/components/organization/OrganizationDashboard';

export default async function TenantScopedOrgSettings({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <OrganizationDashboard tenantId={tenantId} />
    </>
  );
}
