import NewCampaignPage from '@/app/(platform)/settings/admin/marketing-ops/campaigns/new/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedNewCampaign({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <NewCampaignPage />
    </>
  );
}
