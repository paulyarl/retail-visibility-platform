import FeatureStorePage from '@/app/(platform)/settings/feature-store/page';
import SetTenantId from '@/components/client/SetTenantId';
import { TenantGuard } from '@/components/tenant/TenantGuard';

export default async function TenantScopedFeatureStore({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <TenantGuard tenantId={tenantId}>
      <SetTenantId tenantId={tenantId} />
      <FeatureStorePage tenantId={tenantId} />
    </TenantGuard>
  );
}
