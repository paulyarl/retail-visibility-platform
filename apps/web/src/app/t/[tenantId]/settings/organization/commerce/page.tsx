import TenantScopedOrgCommerceSettings from '@/app/t/[tenantId]/settings/organization/commerce/TenantScopedOrgCommerceSettings';
import { OrgGuard } from '@/components/organization/OrgGuard';

export default async function OrganizationCommerceSettingsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <OrgGuard tenantId={tenantId} requireAdmin={false}>
      <TenantScopedOrgCommerceSettings params={params} />
    </OrgGuard>
  );
}
