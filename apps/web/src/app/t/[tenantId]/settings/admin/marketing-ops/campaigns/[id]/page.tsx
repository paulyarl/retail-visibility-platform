import CampaignDetailPage from '@/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedCampaignDetail({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string; id: string }>;
  searchParams: Promise<{ tab?: string; focus?: string }>;
}) {
  const { tenantId, id } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <CampaignDetailPage params={Promise.resolve({ id })} searchParams={searchParams} />
    </>
  );
}
