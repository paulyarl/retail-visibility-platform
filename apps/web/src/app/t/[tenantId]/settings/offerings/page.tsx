import OfferingsSettingsPage from '@/app/(platform)/settings/offerings/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedOfferingsSettings({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <OfferingsSettingsPage />
    </>
  );
}
