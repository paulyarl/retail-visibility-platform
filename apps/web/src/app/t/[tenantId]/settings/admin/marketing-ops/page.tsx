import MarketingOpsDashboardPage from '@/app/(platform)/settings/admin/marketing-ops/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedMarketingOps({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <MarketingOpsDashboardPage />
    </>
  );
}
