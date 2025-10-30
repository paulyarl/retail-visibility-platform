import ContactSettingsPage from '@/app/settings/contact/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedContactSettings({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <ContactSettingsPage />
    </>
  );
}
