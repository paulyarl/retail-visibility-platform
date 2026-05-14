import { Button } from '@mantine/core';
import SetTenantId from '@/components/client/SetTenantId';
import Link from 'next/link';

export default async function TenantScopedOrgSettings({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  return (
    <>
      {tenantId ? <SetTenantId tenantId={tenantId} /> : null}
      
      {/* Commerce Settings Link */}
      <div className="mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-blue-900">Organization Commerce Settings</h3>
                <p className="text-sm text-blue-700">Configure payment options and order settings for all locations in your organization</p>
              </div>
            </div>
            <Link href={`/t/${tenantId}/settings/organization/commerce`}>
              <Button variant="gradient" style={{ color: 'white' }} size="sm">
                Configure Commerce
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Organization Dashboard */}
      <div className="text-center py-12">
        <h2 className="text-2xl font-semibold text-neutral-900 mb-4">Organization Dashboard</h2>
        <p className="text-neutral-600 mb-6">
          Full organization management dashboard will be displayed here
        </p>
        <div className="bg-neutral-100 rounded-lg p-8 max-w-md mx-auto">
          <p className="text-sm text-neutral-500">
            Organization management features are being integrated. Use the commerce settings link above to configure organization-wide payment options.
          </p>
        </div>
      </div>
    </>
  );
}
