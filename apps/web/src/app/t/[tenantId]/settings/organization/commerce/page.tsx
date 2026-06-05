import TenantScopedOrgCommerceSettings from '@/app/t/[tenantId]/settings/organization/commerce/TenantScopedOrgCommerceSettings';

export default async function OrganizationCommerceSettingsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  return <TenantScopedOrgCommerceSettings params={params} />;
}
