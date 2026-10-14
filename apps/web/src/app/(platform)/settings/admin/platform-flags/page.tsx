'use client';

import PageHeader, { Icons } from '@/components/PageHeader';
import { Spinner } from '@/components/ui';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';
import AdminPlatformFlags from '@/components/admin/AdminPlatformFlags';

export default function PlatformFlagsPage() {
  const { hasAccess, loading: accessLoading } = useAccessControl(
    null,
    AccessPresets.PLATFORM_ADMIN_ONLY
  );

  if (accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        title="Platform Admin Access Required"
        message="Only platform administrators can manage platform feature flags."
        backLink={{ href: '/settings/admin', label: 'Back to Admin Settings' }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <PageHeader
        title="Platform Feature Flags"
        description="Platform-wide feature rollout defaults. Per-tenant overrides apply on top where the flag allows overrides."
        icon={Icons.Settings}
        backLink={{ href: '/settings/admin', label: 'Back to Admin Settings' }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AdminPlatformFlags />
      </div>
    </div>
  );
}
