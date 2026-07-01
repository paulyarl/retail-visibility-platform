'use client';

import { ReactNode } from 'react';
import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import AccessDenied from '@/components/AccessDenied';

interface TenantGuardProps {
  tenantId: string;
  children: ReactNode;
}

export function TenantGuard({ tenantId, children }: TenantGuardProps) {
  const { hasAccess, loading, isPlatformAdmin, tenantRole } = useAccessControl(
    tenantId,
    AccessPresets.CAN_MANAGE_TENANT_SETTINGS
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
        pageTitle="Tenant Admin Access Required"
        pageDescription="Permission required to manage tenant settings"
        title="Tenant Administrator Access Required"
        message="This area is restricted to tenant owners and administrators. If you believe you should have access, contact your tenant administrator."
        userRole={isPlatformAdmin ? 'Platform Admin' : tenantRole ?? 'User'}
        backLink={{ href: `/t/${tenantId}/dashboard`, label: 'Back to Dashboard' }}
      />
    );
  }

  return <>{children}</>;
}
