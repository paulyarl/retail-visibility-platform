/**
 * React Hooks for RBAC Service Integration
 * Provides easy-to-use hooks for frontend components
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RBACService, RBACUserAccess, RBACRoleGroups } from '../services/RBACService';

/**
 * Hook for fetching and caching user access data
 * Provides complete user access information with platform caching
 */
export function useUserAccess() {
  const [userAccess, setUserAccess] = useState<RBACUserAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserAccess = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const access = await RBACService.getInstance().getUserAccess();
      setUserAccess(access);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user access');
      console.error('[useUserAccess] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserAccess();
  }, [fetchUserAccess]);

  const refresh = useCallback(() => {
    RBACService.getInstance().invalidateCache('user-access');
    return fetchUserAccess();
  }, [fetchUserAccess]);

  return {
    userAccess,
    loading,
    error,
    refresh,
    // Convenience getters
    userRole: userAccess?.userRole || '',
    groups: userAccess?.access.groups || [],
    permissions: userAccess?.access.permissions || [],
    summary: userAccess?.summary || { totalGroups: 0, totalPermissions: 0, accessLevel: 'Unknown' }
  };
}

/**
 * Hook for fetching role groups
 * Useful for admin panels and role management interfaces
 */
export function useRoleGroups() {
  const [roleGroups, setRoleGroups] = useState<RBACRoleGroups | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoleGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const groups = await RBACService.getInstance().getRoleGroups();
      setRoleGroups(groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch role groups');
      console.error('[useRoleGroups] Error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoleGroups();
  }, [fetchRoleGroups]);

  const refresh = useCallback(() => {
    RBACService.getInstance().invalidateCache('role-groups');
    return fetchRoleGroups();
  }, [fetchRoleGroups]);

  return {
    roleGroups,
    loading,
    error,
    refresh
  };
}

/**
 * Hook for feature flags based on user permissions
 * Provides easy boolean checks for common permissions
 */
export function useFeatureFlags() {
  const { userAccess, loading, error } = useUserAccess();

  const permissions = userAccess?.access.permissions || [];
  const groups = userAccess?.access.groups || [];

  return {
    loading,
    error,
    
    // Tenant management permissions
    canManageUsers: permissions.includes('CAN_MANAGE_TENANT_USERS'),
    canManageBilling: permissions.includes('CAN_MANAGE_TENANT_BILLING'),
    canManageSettings: permissions.includes('CAN_MANAGE_TENANT_SETTINGS'),
    canManageAnalytics: permissions.includes('CAN_MANAGE_TENANT_ANALYTICS'),
    canManageInventory: permissions.includes('CAN_MANAGE_TENANT_INVENTORY'),
    canExportData: permissions.includes('CAN_EXPORT_TENANT_DATA'),
    
    // Platform permissions
    canAdminPlatform: permissions.includes('CAN_ADMIN_PLATFORM'),
    canSupportPlatform: permissions.includes('CAN_SUPPORT_PLATFORM'),
    canViewLogs: permissions.includes('CAN_VIEW_PLATFORM_LOGS'),
    canManagePlatformUsers: permissions.includes('CAN_MANAGE_PLATFORM_USERS'),
    canAccessSystemTools: permissions.includes('CAN_ACCESS_SYSTEM_TOOLS'),
    
    // Data permissions
    canViewSensitiveData: permissions.includes('CAN_VIEW_SENSITIVE_DATA'),
    canDeleteData: permissions.includes('CAN_DELETE_DATA'),
    canBulkOperations: permissions.includes('CAN_BULK_OPERATIONS'),
    
    // Role group checks
    isTenantAdmin: groups.includes('IS_TENANT_ADMIN'),
    isTenantOwner: groups.includes('IS_TENANT_OWNER'),
    isTenantManager: groups.includes('IS_TENANT_MANAGER'),
    isTenantUser: groups.includes('IS_TENANT_USER'),
    isPlatformAdmin: groups.includes('IS_PLATFORM_ADMIN'),
    isPlatformSupport: groups.includes('IS_PLATFORM_SUPPORT'),
    
    // Convenience methods
    hasPermission: (permission: string) => permissions.includes(permission),
    hasGroup: (group: string) => groups.includes(group),
    
    // Raw data for advanced usage
    permissions,
    groups,
    userRole: userAccess?.userRole || '',
    summary: userAccess?.summary
  };
}

/**
 * Hook for permission validation
 * Provides async validation methods
 */
export function usePermissionValidator() {
  const [validating, setValidating] = useState(false);

  const validateRoleAgainstGroup = useCallback(async (userRole: string, requiredGroup: string): Promise<boolean> => {
    setValidating(true);
    try {
      return await RBACService.getInstance().validateRoleAgainstGroup(userRole, requiredGroup);
    } finally {
      setValidating(false);
    }
  }, []);

  const hasPermission = useCallback(async (userRole: string, permission: string): Promise<boolean> => {
    setValidating(true);
    try {
      return await RBACService.getInstance().hasPermission(userRole, permission);
    } finally {
      setValidating(false);
    }
  }, []);

  return {
    validating,
    validateRoleAgainstGroup,
    hasPermission
  };
}

/**
 * Hook for RBAC cache management
 * Provides cache statistics and management functions
 */
export function useRBACCache() {
  const [stats, setStats] = useState(RBACService.getInstance().getCacheStats());

  const refreshStats = useCallback(() => {
    setStats(RBACService.getInstance().getCacheStats());
  }, []);

  const invalidateAll = useCallback(() => {
    RBACService.getInstance().invalidateAllCaches();
    refreshStats();
  }, [refreshStats]);

  const preloadAll = useCallback(async () => {
    await RBACService.getInstance().preloadAllData();
    refreshStats();
  }, [refreshStats]);

  return {
    stats,
    refreshStats,
    invalidateAll,
    preloadAll
  };
}

/**
 * Higher-order component for permission-based rendering
 */
export function withPermissionCheck<P extends object>(
  Component: React.ComponentType<P>,
  permission: string,
  fallback?: React.ComponentType | React.ReactElement
) {
  return function PermissionWrapper(props: P) {
    const { hasPermission, loading } = useFeatureFlags();

    if (loading) {
      return <div>Loading...</div>;
    }

    if (!hasPermission(permission)) {
      if (fallback) {
        return typeof fallback === 'function' ? 
          React.createElement(fallback as React.ComponentType) : 
          fallback;
      }
      return null;
    }

    return <Component {...props} />;
  };
}

/**
 * Higher-order component for role group-based rendering
 */
export function withRoleGroupCheck<P extends object>(
  Component: React.ComponentType<P>,
  roleGroup: string,
  fallback?: React.ComponentType | React.ReactElement
) {
  return function RoleGroupWrapper(props: P) {
    const { hasGroup, loading } = useFeatureFlags();

    if (loading) {
      return <div>Loading...</div>;
    }

    if (!hasGroup(roleGroup)) {
      if (fallback) {
        return typeof fallback === 'function' ? 
          React.createElement(fallback as React.ComponentType) : 
          fallback;
      }
      return null;
    }

    return <Component {...props} />;
  };
}
