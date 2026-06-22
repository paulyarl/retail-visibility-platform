'use client';

import { ReactNode } from 'react';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';

export function AdminGuard({ children }: { children: ReactNode }) {
  const { hasAccess, loading, isPlatformAdmin } = useAccessControl(
    null,
    AccessPresets.PLATFORM_ADMIN_ONLY
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <AccessDenied
        pageTitle="Admin Access Required"
        pageDescription="Platform administrator permission required"
        title="Platform Administrator Access Required"
        message="This area is restricted to platform administrators. If you believe you should have access, contact your platform administrator."
        userRole={isPlatformAdmin ? 'Platform Admin' : 'User'}
        backLink={{ href: '/settings', label: 'Back to Settings' }}
      />
    );
  }

  return <>{children}</>;
}
