'use client';

import { ReactNode } from 'react';
import Link from 'next/link';
import { useOrgBehaviorAccess } from '@/hooks/tenant-access/useOrgBehaviorAccess';
import { useAuth } from '@/contexts/AuthContext';
import AccessDenied from '@/components/AccessDenied';
import { Building2 } from 'lucide-react';

interface OrgGuardProps {
  tenantId: string | null;
  children: ReactNode;
  requireAdmin?: boolean;
}

export function OrgGuard({ tenantId, children, requireAdmin = true }: OrgGuardProps) {
  const { isOrgAdmin, isOrgMember, loading, isPlatformAdmin, organizationId } = useOrgBehaviorAccess(tenantId);
  const { user: authUser, isLoading: authLoading } = useAuth();
  const userIsPlatformAdmin = isPlatformAdmin || authUser?.role === 'PLATFORM_ADMIN' || authUser?.role === 'ADMIN';

  if (loading || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  const hasAccess = userIsPlatformAdmin || (requireAdmin ? isOrgAdmin : isOrgMember);

  if (!hasAccess && !organizationId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center">
          <Building2 className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Organization</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            This location is not part of an organization. Create or join an organization to manage organization-wide settings.
          </p>
          {tenantId && (
            <Link href={`/t/${tenantId}/settings/organization`} className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors mt-4">
              <Building2 className="w-5 h-5" />
              Create or Join Organization
            </Link>
          )}
        </div>
      </div>
    );
  }

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
        userRole={userIsPlatformAdmin ? 'Platform Admin' : 'User'}
        backLink={tenantId ? { href: `/t/${tenantId}/dashboard`, label: 'Back to Dashboard' } : undefined}
      />
    );
  }

  return <>{children}</>;
}
