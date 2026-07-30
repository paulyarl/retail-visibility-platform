import DemoStorefrontPage from '@/app/(platform)/settings/admin/marketing-ops/campaigns/[id]/demo/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedDemoStorefront({ params }: { params: Promise<{ tenantId: string; id: string }> }) {
  const { tenantId, id } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <DemoStorefrontPage params={Promise.resolve({ id })} />
    </>
  );
}
