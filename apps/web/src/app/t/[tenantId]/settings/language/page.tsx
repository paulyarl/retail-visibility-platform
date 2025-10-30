import LanguageSettingsPage from '@/app/settings/language/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedLanguageSettings({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <LanguageSettingsPage />
    </>
  );
}
