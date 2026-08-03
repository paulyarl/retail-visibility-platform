import ProspectQueuePage from '@/app/(platform)/settings/admin/marketing-ops/queue/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedProspectQueue({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <ProspectQueuePage />
    </>
  );
}
