import OrganizationPage from '@/app/(platform)/settings/organization/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedOrgSettings({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <OrganizationPage />
    </>
  );
}
