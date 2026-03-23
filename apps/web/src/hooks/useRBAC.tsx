/**
 * React Hooks for RBAC — file-based, AuthContext-driven.
 *
 * All hooks derive state from AuthContext (user.role) + src/config/rbac.ts.
 * Zero API calls. Zero database dependency. Works when port 4000 is down.
 */

import React, { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserRoleGroups,
  getUserPermissions,
  getAccessLevel,
  ROLE_GROUPS,
} from '../config/rbac';

/**
 * Hook for user access data — replaces the async RBACService.getUserAccess() pattern.
 * Returns synchronously once AuthContext has loaded.
 */
export function useUserAccess() {
  const { user, isLoading } = useAuth();

  const userRole    = user?.role ?? 'USER';
  const groups      = useMemo(() => getUserRoleGroups(userRole),  [userRole]);
  const permissions = useMemo(() => getUserPermissions(userRole), [userRole]);
  const accessLevel = useMemo(() => getAccessLevel(userRole),     [userRole]);

  return {
    loading: isLoading,
    error: null,
    userRole,
    groups,
    permissions,
    summary: {
      totalGroups:      groups.length,
      totalPermissions: permissions.length,
      accessLevel,
    },
  };
}

/**
 * Hook for role group definitions — returns the full static ROLE_GROUPS map.
 * No fetch needed; data is always available from the static config.
 */
export function useRoleGroups() {
  const roleGroups: Record<string, readonly string[]> = ROLE_GROUPS;
  return {
    roleGroups,
    loading: false,
    error: null,
  };
}

/**
 * Hook for feature flags based on user permissions.
 * Provides easy boolean checks for all permissions and role groups.
 */
export function useFeatureFlags() {
  const { loading, permissions, groups, userRole } = useUserAccess();

  return {
    loading,
    error: null,

    // Tenant management permissions
    canManageUsers:    permissions.includes('CAN_MANAGE_TENANT_USERS'),
    canManageBilling:  permissions.includes('CAN_MANAGE_TENANT_BILLING'),
    canManageSettings: permissions.includes('CAN_MANAGE_TENANT_SETTINGS'),
    canManageAnalytics: permissions.includes('CAN_MANAGE_TENANT_ANALYTICS'),
    canManageInventory: permissions.includes('CAN_MANAGE_TENANT_INVENTORY'),
    canExportData:     permissions.includes('CAN_EXPORT_TENANT_DATA'),

    // Platform permissions
    canAdminPlatform:      permissions.includes('CAN_ADMIN_PLATFORM'),
    canSupportPlatform:    permissions.includes('CAN_SUPPORT_PLATFORM'),
    canViewLogs:           permissions.includes('CAN_VIEW_PLATFORM_LOGS'),
    canManagePlatformUsers: permissions.includes('CAN_MANAGE_PLATFORM_USERS'),
    canAccessSystemTools:  permissions.includes('CAN_ACCESS_SYSTEM_TOOLS'),

    // Data permissions
    canViewSensitiveData: permissions.includes('CAN_VIEW_SENSITIVE_DATA'),
    canDeleteData:        permissions.includes('CAN_DELETE_DATA'),
    canBulkOperations:    permissions.includes('CAN_BULK_OPERATIONS'),

    // Role group checks
    isTenantAdmin:    groups.includes('IS_TENANT_ADMIN'),
    isTenantOwner:    groups.includes('IS_TENANT_OWNER'),
    isTenantManager:  groups.includes('IS_TENANT_MANAGER'),
    isTenantUser:     groups.includes('IS_TENANT_USER'),
    isPlatformAdmin:  groups.includes('IS_PLATFORM_ADMIN'),
    isPlatformSupport: groups.includes('IS_PLATFORM_SUPPORT'),

    // Convenience methods
    hasPermission: (permission: string) => permissions.includes(permission),
    hasGroup:      (group: string)      => groups.includes(group),

    // Raw data
    permissions,
    groups,
    userRole,
  };
}

/**
 * Hook for synchronous permission validation against the static config.
 * Both methods are now synchronous (no async needed).
 */
export function usePermissionValidator() {
  const { groups, permissions } = useUserAccess();

  const validateRoleAgainstGroup = (userRole: string, requiredGroup: string): boolean => {
    const roleList = ROLE_GROUPS[requiredGroup];
    return roleList ? roleList.includes(userRole) : false;
  };

  const hasPermission = (_userRole: string, permission: string): boolean => {
    return permissions.includes(permission);
  };

  return {
    validating: false,
    validateRoleAgainstGroup,
    hasPermission,
  };
}

/**
 * Higher-order component for permission-based rendering.
 */
export function withPermissionCheck<P extends object>(
  Component: React.ComponentType<P>,
  permission: string,
  fallback?: React.ComponentType | React.ReactElement
) {
  return function PermissionWrapper(props: P) {
    const { hasPermission, loading } = useFeatureFlags();
    if (loading) return <div>Loading...</div>;
    if (!hasPermission(permission)) {
      if (fallback) {
        return typeof fallback === 'function'
          ? React.createElement(fallback as React.ComponentType)
          : fallback;
      }
      return null;
    }
    return <Component {...props} />;
  };
}

/**
 * Higher-order component for role group-based rendering.
 */
export function withRoleGroupCheck<P extends object>(
  Component: React.ComponentType<P>,
  roleGroup: string,
  fallback?: React.ComponentType | React.ReactElement
) {
  return function RoleGroupWrapper(props: P) {
    const { hasGroup, loading } = useFeatureFlags();
    if (loading) return <div>Loading...</div>;
    if (!hasGroup(roleGroup)) {
      if (fallback) {
        return typeof fallback === 'function'
          ? React.createElement(fallback as React.ComponentType)
          : fallback;
      }
      return null;
    }
    return <Component {...props} />;
  };
}
