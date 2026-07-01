"use client";

/**
 * useRBAC — React hook for RBAC-based navigation and UI visibility.
 *
 * Derives all access state directly from AuthContext (user.role) combined with
 * the static role/permission definitions in src/config/rbac.ts.
 *
 * ✓ Zero API calls — no fetch to /api/auth/user-access or port 4000
 * ✓ Zero database dependency — works when the API server is unavailable
 * ✓ Synchronous — ready instantly once AuthContext has loaded the user
 * ✓ Authoritative — computed from the same config file as the API server
 *
 * Usage:
 *   const { ready, hasPermission, hasGroup, isRole, filterNavItems } = useRBAC();
 */

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getUserRoleGroups, getUserPermissions } from '@/config/rbac';

// ─── NavItem visibility type extension ────────────────────────────────────────

/**
 * Fields that can be added to any NavItem to gate visibility via RBAC.
 * All fields are optional — omitting them means "show to everyone".
 *
 * - requiredPermission: user must have this permission string (e.g. 'CAN_ADMIN_PLATFORM')
 * - requiredGroup:      user must be in this role group (e.g. 'IS_PLATFORM_ADMIN')
 * - requiredRole:       user's role must match exactly (e.g. 'PLATFORM_ADMIN')
 * - anyRole:            user's role must be one of these values
 */
export interface RBACNavGates {
  requiredPermission?: string;
  requiredGroup?: string;
  requiredRole?: string;
  anyRole?: string[];
  requiredOrgAdmin?: boolean;
}

// ─── Hook return type ─────────────────────────────────────────────────────────

export interface UseRBACResult {
  /** True once AuthContext has finished loading the user (mirrors auth.isLoading) */
  ready: boolean;
  /** The user's role string, e.g. 'PLATFORM_ADMIN' */
  userRole: string;
  /** All role groups the user belongs to, computed from static config */
  groups: string[];
  /** All permissions the user has, computed from static config */
  permissions: string[];
  /** True if user has the given permission string */
  hasPermission: (permission: string) => boolean;
  /** True if user belongs to the given role group (e.g. IS_PLATFORM_ADMIN) */
  hasGroup: (group: string) => boolean;
  /** True if user's role exactly matches */
  isRole: (role: string) => boolean;
  /** True if user's role is one of the provided values */
  isAnyRole: (roles: string[]) => boolean;
  /** True if user is in IS_PLATFORM_ADMIN group */
  isPlatformAdmin: boolean;
  /** True if user is in IS_TENANT_ADMIN group */
  isTenantAdmin: boolean;
  /**
   * Filter a nav items array, removing entries the current user cannot see.
   * Items without any RBAC gates are always included.
   * Children are filtered recursively; a parent with all children filtered out is also removed.
   * Before AuthContext loads (ready=false), returns items unfiltered to avoid flash.
   */
  filterNavItems: <T extends RBACNavGates>(items: T[]) => T[];
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRBAC(): UseRBACResult {
  const { user, isLoading } = useAuth();

  // Compute role, groups, and permissions synchronously from the user object.
  // Falls back to 'USER' with empty arrays when not authenticated.
  const userRole   = user?.role ?? 'USER';
  const groups     = useMemo(() => getUserRoleGroups(userRole),  [userRole]);
  const permissions = useMemo(() => getUserPermissions(userRole), [userRole]);

  const ready = !isLoading;

  const hasPermission = useMemo(
    () => (permission: string) => permissions.includes(permission),
    [permissions],
  );

  const hasGroup = useMemo(
    () => (group: string) => groups.includes(group),
    [groups],
  );

  const isRole = useMemo(
    () => (role: string) => userRole === role,
    [userRole],
  );

  const isAnyRole = useMemo(
    () => (roles: string[]) => roles.includes(userRole),
    [userRole],
  );

  const isPlatformAdmin = groups.includes('IS_PLATFORM_ADMIN');
  const isTenantAdmin   = groups.includes('IS_TENANT_ADMIN');

  const canSeeItem = useMemo(() => (item: RBACNavGates): boolean => {
    if (item.requiredPermission && !permissions.includes(item.requiredPermission)) return false;
    if (item.requiredGroup      && !groups.includes(item.requiredGroup))           return false;
    if (item.requiredRole       && userRole !== item.requiredRole)                  return false;
    if (item.anyRole            && !item.anyRole.includes(userRole))               return false;
    return true;
  }, [permissions, groups, userRole]);

  const filterNavItems = useMemo(() => <T extends RBACNavGates>(items: T[]): T[] => {
    if (!ready) return items; // fail-open: don't flash empty nav while auth loads
    return filterNavItemsInner(items, canSeeItem);
  }, [ready, canSeeItem]);

  return {
    ready,
    userRole,
    groups,
    permissions,
    hasPermission,
    hasGroup,
    isRole,
    isAnyRole,
    isPlatformAdmin,
    isTenantAdmin,
    filterNavItems,
  };
}

// ─── Internal recursive helper (avoids hook-in-loop) ─────────────────────────

function filterNavItemsInner<T extends RBACNavGates>(
  items: T[],
  canSee: (item: RBACNavGates) => boolean,
): T[] {
  return items.reduce<T[]>((acc, item) => {
    if (!canSee(item)) return acc;
    const anyItem = item as any;
    if (anyItem.children?.length) {
      const filteredChildren = filterNavItemsInner(anyItem.children, canSee);
      if (filteredChildren.length === 0 && anyItem.children.length > 0) {
        if (!anyItem.href) return acc;
      }
      acc.push({ ...item, children: filteredChildren } as T);
    } else {
      acc.push(item);
    }
    return acc;
  }, []);
}
