'use client';

import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';

export interface TenantBehaviorAccessResult {
  canEdit: boolean;
  loading: boolean;
  tenantRole: string | null;
  isPlatformAdmin: boolean;
}

export function useTenantBehaviorAccess(tenantId: string): TenantBehaviorAccessResult {
  const { hasAccess, loading, tenantRole, isPlatformAdmin } = useAccessControl(
    tenantId,
    AccessPresets.CAN_MANAGE_TENANT_SETTINGS
  );

  return {
    canEdit: hasAccess,
    loading,
    tenantRole,
    isPlatformAdmin,
  };
}
