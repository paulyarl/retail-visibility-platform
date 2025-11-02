import SettingsPage from '@/app/(platform)/settings/page';
import SetTenantId from '@/components/client/SetTenantId';
import Link from 'next/link';

export default async function TenantScopedSettings({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <SettingsPage hideAdmin tenantId={tenantId} />
    </>
  );
}
