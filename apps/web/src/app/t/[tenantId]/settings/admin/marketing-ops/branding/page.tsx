import BrandingPage from '@/app/(platform)/settings/admin/marketing-ops/branding/page';
import SetTenantId from '@/components/client/SetTenantId';

export default async function TenantScopedBranding({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <BrandingPage />
    </>
  );
}
