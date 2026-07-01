'use client';

import { ReactNode } from 'react';
import { useTenantBehaviorAccess } from '@/hooks/tenant-access/useTenantBehaviorAccess';

interface TenantBehaviorGuardProps {
  tenantId: string;
  children: ReactNode;
  fallback?: ReactNode;
  showDisabled?: boolean;
}

export function TenantBehaviorGuard({
  tenantId,
  children,
  fallback = null,
  showDisabled = false,
}: TenantBehaviorGuardProps) {
  const { canEdit, loading } = useTenantBehaviorAccess(tenantId);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500" />
        <span>Checking permissions…</span>
      </div>
    );
  }

  if (canEdit) {
    return <>{children}</>;
  }

  if (showDisabled) {
    return (
      <div className="relative group inline-block">
        <div className="opacity-50 pointer-events-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-neutral-900 text-white text-xs px-3 py-2 rounded shadow-lg max-w-xs">
            Tenant administrator access required to modify this setting.
          </div>
        </div>
      </div>
    );
  }

  return <>{fallback}</>;
}
