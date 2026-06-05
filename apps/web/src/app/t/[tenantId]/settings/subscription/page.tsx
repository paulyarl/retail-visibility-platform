import SubscriptionSettingsPage from '@/app/(platform)/settings/subscription/page';
import { Button } from '@mantine/core';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedSubscriptionSettings({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <SubscriptionSettingsPage tenantId={tenantId} />
    </>
  );
}
