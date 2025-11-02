import AdminSettingsPage from '@/app/(platform)/settings/admin/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedAdminSettings({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <AdminSettingsPage />
    </>
  );
}
