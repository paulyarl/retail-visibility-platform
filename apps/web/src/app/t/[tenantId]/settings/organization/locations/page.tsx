import SetTenantId from '@/components/client/SetTenantId';
import { OrgGuard } from '@/components/organization/OrgGuard';
import OrgLocationsClient from './OrgLocationsClient';

export default async function OrgLocationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ organizationId?: string }>;
}) {
  const { tenantId } = await params;
  const { organizationId } = await searchParams;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <OrgGuard tenantId={tenantId} requireAdmin={true} organizationId={organizationId}>
        <OrgLocationsClient organizationId={organizationId} />
      </OrgGuard>
    </>
  );
}
