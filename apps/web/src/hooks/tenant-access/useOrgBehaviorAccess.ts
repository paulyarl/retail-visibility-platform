'use client';

import { useAccessControl, AccessPresets } from '@/lib/auth/useAccessControl';
import type { OrganizationData } from '@/lib/auth/access-control';

export interface OrgBehaviorAccessResult {
  isOrgAdmin: boolean;
  isOrgMember: boolean;
  loading: boolean;
  orgData: OrganizationData | null;
  organizationId: string | null;
  isPlatformAdmin: boolean;
}

export function useOrgBehaviorAccess(tenantId: string | null): OrgBehaviorAccessResult {
  const { isOrgAdmin, isOrgMember, loading, organizationData, isPlatformAdmin } = useAccessControl(
    tenantId,
    AccessPresets.ORGANIZATION_ADMIN,
    true
  );

  return {
    isOrgAdmin,
    isOrgMember,
    loading,
    orgData: organizationData,
    organizationId: organizationData?.id ?? null,
    isPlatformAdmin,
  };
}
