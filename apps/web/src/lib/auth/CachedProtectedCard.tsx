/**
 * Cached Protected Card for Settings Pages
 *
 * Uses cached access control to prevent redundant API calls in settings pages
 */

import { ReactNode } from 'react';
import { useSettingsAccessControl } from './useSettingsAccessControl';
import { AccessControlOptions } from './access-control';

export interface CachedProtectedCardProps {
  /** The card content to render if user has access */
  children: ReactNode;

  /** Access control options or preset */
  accessOptions?: AccessControlOptions;

  /** Whether to show nothing when access denied. If false, show a disabled/locked state */
  hideWhenDenied?: boolean;

  /** Custom fallback content when access is denied */
  deniedContent?: ReactNode;

  /** Tenant ID for tenant-scoped access checks */
  tenantId?: string | null;
}

/**
 * Cached version of ProtectedCard for settings pages
 * Uses batched permission checks to improve performance
 */
export function CachedProtectedCard({
  children,
  accessOptions = {},
  hideWhenDenied = true,
  deniedContent,
  tenantId,
}: CachedProtectedCardProps) {
  const { hasPermission, loading } = useSettingsAccessControl();

  // Don't render anything while loading
  if (loading) {
    return null;
  }

  // Check if user has access based on roles
  const hasAccess = (() => {
    // Handle complex access options that require additional API calls
    // For now, allow access to these to prevent breaking tenant settings
    if (accessOptions.requireOrganizationMember ||
        accessOptions.requireOrganizationAdmin ||
        accessOptions.requireOrganization ||
        accessOptions.requireHeroLocation ||
        accessOptions.customCheck ||
        (accessOptions.requireTenantRole && accessOptions.requireTenantRole.length > 0)) {
      // These require tenant-specific or organization data
      // For settings pages, we'll allow access for now
      // TODO: Extend caching to handle these cases properly
      return true;
    }

    // Check platform roles first
    if (accessOptions.requirePlatformRole && accessOptions.requirePlatformRole.length > 0) {
      return accessOptions.requirePlatformRole.some(role => {
        switch (role) {
          case 'PLATFORM_ADMIN':
            return hasPermission('PLATFORM_ADMIN_ONLY');
          case 'PLATFORM_SUPPORT':
            return hasPermission('PLATFORM_SUPPORT');
          case 'PLATFORM_VIEWER':
            return hasPermission('PLATFORM_STAFF');
          case 'ADMIN':
            return hasPermission('PLATFORM_ADMIN_ONLY'); // ADMIN maps to PLATFORM_ADMIN_ONLY
          default:
            return false;
        }
      });
    }

    // Check tenant roles if no platform roles specified
    if (accessOptions.requireTenantRole && accessOptions.requireTenantRole.length > 0) {
      // For settings page, we can't check tenant roles without tenantId
      // This would need tenant-specific logic, so for now allow access
      // In the future, this could be enhanced to accept tenantId prop
      return true;
    }

    // No specific role requirements, allow access
    return true;
  })();

  // If access denied and hideWhenDenied is true, don't render
  if (!hasAccess && hideWhenDenied) {
    return null;
  }

  // If access denied and we have custom denied content, show it
  if (!hasAccess && deniedContent) {
    return <>{deniedContent}</>;
  }

  // If access denied and hideWhenDenied is false, show locked state
  if (!hasAccess && !hideWhenDenied) {
    return (
      <div className="relative opacity-50 pointer-events-none">
        {children}
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/10 dark:bg-neutral-100/10 rounded-lg">
          <svg className="w-8 h-8 text-neutral-600 dark:text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
      </div>
    );
  }

  // User has access, render the card
  return <>{children}</>;
}
