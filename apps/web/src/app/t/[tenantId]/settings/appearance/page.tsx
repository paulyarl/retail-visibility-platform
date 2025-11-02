import AppearanceSettingsPage from '@/app/(platform)/settings/appearance/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedAppearanceSettings({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <AppearanceSettingsPage />
    </>
  );
}
