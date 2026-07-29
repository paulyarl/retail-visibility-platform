import CampaignsPage from '@/app/(platform)/settings/admin/marketing-ops/campaigns/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedCampaigns({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <CampaignsPage />
    </>
  );
}
