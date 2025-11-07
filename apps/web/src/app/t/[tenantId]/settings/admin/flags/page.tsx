'use client';

import { useParams } from 'next/navigation';
import AdminTenantFlags from "@/components/admin/AdminTenantFlags";
import PageHeader, { Icons } from '@/components/PageHeader';
import { Card, CardHeader, CardTitle, CardContent, Spinner } from '@/components/ui';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';

export default function AdminTenantFlagsPage() {
  const params = useParams();
  const tenantId = params.tenantId as string;
  
  // Centralized access control - Platform Admin ONLY
  const { hasAccess, loading: accessLoading } = useAccessControl(
    tenantId,
    AccessPresets.PLATFORM_ADMIN_ONLY
  );

  // Access control checks
  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        title="Platform Admin Access Required"
        message="Only platform administrators can manage feature flags. This is a system-level setting that affects platform functionality."
        backLink={{ href: `/t/${tenantId}/settings`, label: 'Back to Settings' }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <PageHeader
        title="Tenant Feature Flags"
        description="Control feature rollout for this location. Tenant overrides take precedence over platform settings."
        icon={Icons.Settings}
        backLink={{
          href: `/t/${tenantId}/settings`,
          label: 'Back to Settings'
        }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminTenantFlags tenantId={tenantId} />

        <Card className="mt-8 border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-900">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Tenant-Scoped Flags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800">
              Flags marked "Platform Override Allowed" can be customized per tenant. Tenant-specific settings override platform defaults.
              Use the "Live" status to see what's actually active, and check the info icon for full source details.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
