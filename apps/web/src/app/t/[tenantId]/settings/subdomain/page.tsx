import SubdomainSettings from '@/components/tenant/SubdomainSettings';
import CustomDomainSettings from '@/components/tenant/CustomDomainSettings';
import { Button } from '@mantine/core';
import SetTenantId from '@/components/client/SetTenantId';

export default async function SubdomainSettingsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Storefront Domains</h1>
          <p className="mt-2 text-lg text-gray-600">
            Your storefront address — a platform subdomain, a domain you own, or both.
          </p>
        </div>
        <div className="space-y-8">
          <SubdomainSettings tenantId={tenantId} />
          <CustomDomainSettings tenantId={tenantId} />
        </div>
      </div>
    </>
  );
}
