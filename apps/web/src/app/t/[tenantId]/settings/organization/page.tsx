import SetTenantId from '@/components/client/SetTenantId';
import OrganizationDashboard from '@/components/organization/OrganizationDashboard';
import { OrgGuard } from '@/components/organization/OrgGuard';

export default async function TenantScopedOrgSettings({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <OrgGuard tenantId={tenantId} requireAdmin={false}>
        <OrganizationDashboard tenantId={tenantId} />
      </OrgGuard>
    </>
  );
}
