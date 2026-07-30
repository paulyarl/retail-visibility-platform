import DeliverableTemplatesPage from '@/app/(platform)/settings/admin/marketing-ops/deliverable-templates/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedDeliverableTemplates({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <DeliverableTemplatesPage />
    </>
  );
}
