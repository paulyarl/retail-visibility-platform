"use client";

import { Badge } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";

interface RoleBadgeProps {
  /** Optional tenant ID to show tenant-specific role */
  tenantId?: string;
  /** Show platform role instead of tenant role */
  showPlatformRole?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Role Badge Component
 * 
 * Displays the user's current role with appropriate styling.
 * Can show either platform role or tenant-specific role.
 * 
 * @example
 * // Show platform role
 * <RoleBadge showPlatformRole />
 * 
 * // Show tenant role
 * <RoleBadge tenantId="tenant-123" />
 */
export function RoleBadge({ tenantId, showPlatformRole = false, className }: RoleBadgeProps) {
  const { user } = useAuth();

  if (!user) return null;

  // Determine which role to display
  let role: string | null = null;
  let roleType: 'platform' | 'tenant' = 'platform';

  if (showPlatformRole || !tenantId) {
    // Show platform role
    role = user.role || null;
    roleType = 'platform';
  } else {
    // Show tenant role
    const tenantRole = user.tenants?.find(t => t.id === tenantId);
    role = tenantRole?.role || null;
    roleType = 'tenant';
  }

  if (!role) return null;

  // Determine badge color based on role
  const getBadgeVariant = (role: string): 'default' | 'success' | 'warning' | 'error' | 'info' => {
    // Platform roles
    if (role === 'PLATFORM_ADMIN' || role === 'ADMIN') return 'error';
    if (role === 'PLATFORM_SUPPORT') return 'info';
    if (role === 'PLATFORM_VIEWER') return 'warning';
    
    // Tenant roles
    if (role === 'OWNER') return 'error';
    if (role === 'ADMIN') return 'info';
    if (role === 'MEMBER') return 'success';
    if (role === 'VIEWER') return 'warning';
    
    return 'default';
  };

  // Format role name for display
  const formatRole = (role: string): string => {
    // Remove PLATFORM_ prefix for cleaner display
    if (role.startsWith('PLATFORM_')) {
      return role.replace('PLATFORM_', '');
    }
    return role;
  };

  const variant = getBadgeVariant(role);
  const displayRole = formatRole(role);
  const prefix = roleType === 'platform' ? 'Platform' : 'Tenant';

  return (
    <Badge variant={variant} className={className}>
      <span className="flex items-center gap-1.5">
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <span className="text-xs font-medium">
          {prefix}: {displayRole}
        </span>
      </span>
    </Badge>
  );
}

/**
 * Viewing As Badge
 * 
 * Shows what context the user is viewing the page in.
 * Similar to subscription status badges.
 */
export function ViewingAsBadge({ tenantId, showPlatformRole = false }: RoleBadgeProps) {
  const { user } = useAuth();

  if (!user) return null;

  // Determine viewing context
  let viewingAs: string = 'User';
  let variant: 'default' | 'success' | 'warning' | 'error' | 'info' = 'default';

  const platformRole = user.role as string;
  const isPlatformUser = platformRole === 'PLATFORM_ADMIN' || 
                         platformRole === 'ADMIN' || 
                         platformRole === 'PLATFORM_SUPPORT' || 
                         platformRole === 'PLATFORM_VIEWER';

  if (showPlatformRole || !tenantId) {
    // Viewing as platform user
    if (platformRole === 'PLATFORM_ADMIN' || platformRole === 'ADMIN') {
      viewingAs = 'Platform Admin';
      variant = 'error';
    } else if (platformRole === 'PLATFORM_SUPPORT') {
      viewingAs = 'Platform Support';
      variant = 'info';
    } else if (platformRole === 'PLATFORM_VIEWER') {
      viewingAs = 'Platform Viewer';
      variant = 'warning';
    } else {
      viewingAs = 'Regular User';
      variant = 'default';
    }
  } else {
    // Viewing as tenant user - check tenant role first
    const tenantRole = user.tenants?.find(t => t.id === tenantId);
    const role = tenantRole?.role;
    
    if (role === 'OWNER') {
      viewingAs = 'Tenant Owner';
      variant = 'error';
    } else if (role === 'ADMIN') {
      viewingAs = 'Tenant Admin';
      variant = 'info';
    } else if (role === 'MEMBER') {
      viewingAs = 'Tenant Member';
      variant = 'success';
    } else if (role === 'VIEWER') {
      viewingAs = 'Tenant Viewer';
      variant = 'warning';
    } else if (isPlatformUser) {
      // Fall back to platform role if user has platform access but no tenant role
      if (platformRole === 'PLATFORM_ADMIN' || platformRole === 'ADMIN') {
        viewingAs = 'Platform Admin';
        variant = 'error';
      } else if (platformRole === 'PLATFORM_SUPPORT') {
        viewingAs = 'Platform Support';
        variant = 'info';
      } else if (platformRole === 'PLATFORM_VIEWER') {
        viewingAs = 'Platform Viewer';
        variant = 'warning';
      }
    } else {
      viewingAs = 'No Access';
      variant = 'default';
    }
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-neutral-800 rounded-lg border-2 border-neutral-300 dark:border-neutral-600 shadow-sm">
      <span className="text-xs text-neutral-700 dark:text-neutral-300 font-semibold uppercase tracking-wide">
        Viewing as:
      </span>
      <Badge variant={variant} className="text-xs font-bold">
        {viewingAs}
      </Badge>
    </div>
  );
}
