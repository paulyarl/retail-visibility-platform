import SubdomainSettings from '@/components/tenant/SubdomainSettings';
import SetTenantId from '@/components/client/SetTenantId';

export default async function SubdomainSettingsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Custom Subdomain</h1>
          <p className="mt-2 text-lg text-gray-600">
            Set up a custom subdomain for Google Merchant Center compliance and improved product visibility.
          </p>
        </div>
        <SubdomainSettings tenantId={tenantId} />
      </div>
    </>
  );
}
