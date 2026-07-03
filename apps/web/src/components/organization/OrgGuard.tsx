'use client';

import { ReactNode } from 'react';
import { useOrgBehaviorAccess } from '@/hooks/tenant-access/useOrgBehaviorAccess';
import AccessDenied from '@/components/AccessDenied';

interface OrgGuardProps {
  tenantId: string | null;
  children: ReactNode;
  requireAdmin?: boolean;
}

export function OrgGuard({ tenantId, children, requireAdmin = true }: OrgGuardProps) {
  const { isOrgAdmin, isOrgMember, loading, isPlatformAdmin, organizationId } = useOrgBehaviorAccess(tenantId);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  const hasAccess = isPlatformAdmin || (requireAdmin ? isOrgAdmin : isOrgMember);

  if (!hasAccess) {
    return (
      <AccessDenied
        pageTitle="Organization Admin Access Required"
        pageDescription="Permission required to manage organization settings"
        title="Organization Administrator Access Required"
        message={
          requireAdmin
            ? "This area is restricted to organization owners and administrators. You must be an admin of the hero (primary) location to manage organization-wide settings."
            : "You must be a member of this organization to access this area."
        }
        userRole={isPlatformAdmin ? 'Platform Admin' : 'User'}
        backLink={tenantId ? { href: `/t/${tenantId}/dashboard`, label: 'Back to Dashboard' } : undefined}
      />
    );
  }

  return <>{children}</>;
}
