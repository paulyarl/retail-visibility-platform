import SetTenantId from '@/components/client/SetTenantId';
import { OrgGuard } from '@/components/organization/OrgGuard';
import OrgLocationsClient from './OrgLocationsClient';

export default async function OrgLocationsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <OrgGuard tenantId={tenantId} requireAdmin={true}>
        <OrgLocationsClient />
      </OrgGuard>
    </>
  );
}
