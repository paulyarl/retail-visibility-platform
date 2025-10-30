import SubscriptionSettingsPage from '@/app/settings/subscription/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedSubscriptionSettings({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <SubscriptionSettingsPage />
    </>
  );
}
