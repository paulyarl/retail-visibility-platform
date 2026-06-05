import TenantSettings from '@/components/settings/TenantSettings';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedSettings({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <TenantSettings tenantId={tenantId} />
    </>
  );
}
