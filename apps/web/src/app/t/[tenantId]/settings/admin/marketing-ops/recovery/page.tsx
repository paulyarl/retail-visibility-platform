import RecoveryListPage from '@/app/(platform)/settings/admin/marketing-ops/recovery/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedRecovery({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <RecoveryListPage />
    </>
  );
}
