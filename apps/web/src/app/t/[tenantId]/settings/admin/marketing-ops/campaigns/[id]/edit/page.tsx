import EditCampaignPage from '@/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/edit/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedEditCampaign({ params }: { params: Promise<{ tenantId: string; id: string }> }) {
  const { tenantId, id } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <EditCampaignPage params={Promise.resolve({ id })} />
    </>
  );
}
