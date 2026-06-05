/**
 * Role-based access control middleware
 * Uses centralized role groups with IS_ prefix for clear distinction
 * IS_ prefix = "roles that ARE..." (e.g., IS_TENANT_ADMIN = roles that ARE tenant admins)
 */

import { Request, Response, NextFunction } from 'express';
import { ROLE_GROUPS, PERMISSION_GROUPS, RoleGroup, PermissionGroup, isRoleInGroup, hasPermission, isValidRole } from '../config/role-groups';

/**
 * Middleware to require users to be in a specific role group
 * @param groupName - The role group required for access (IS_ prefix)
 * @returns Express middleware function
 */
export function requireRoleGroup(groupName: RoleGroup) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get user role from authenticated request
      const userRole = req.user?.role;
      
      if (!userRole) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User role not found in request'
        });
      }

      // Validate user role
      if (!isValidRole(userRole)) {
        return res.status(401).json({
          error: 'Invalid user role',
          message: `User role "${userRole}" is not recognized`
        });
      }

      // Check if user role is in the required group
      if (!isRoleInGroup(userRole, groupName)) {
        const allowedRoles = ROLE_GROUPS[groupName];
        
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: `Access denied. Required role group: ${groupName}`,
          details: {
            requiredGroup: groupName,
            userRole,
            allowedRoles,
            accessLevel: getAccessLevelDescription(groupName)
          }
        });
      }

      // User has required permissions
      next();
    } catch (error) {
      console.error('[Role Validation] Error checking permissions:', error);
      return res.status(500).json({
        error: 'Permission check failed',
        message: 'Unable to verify user permissions'
      });
    }
  };
}

/**
 * Middleware to require any of the specified role groups
 * @param groupNames - Array of role groups, any of which grants access
 * @returns Express middleware function
 */
export function requireAnyRoleGroup(groupNames: RoleGroup[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const userRole = req.user?.role;
      
      if (!userRole) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User role not found in request'
        });
      }

      // Validate user role
      if (!isValidRole(userRole)) {
        return res.status(401).json({
          error: 'Invalid user role',
          message: `User role "${userRole}" is not recognized`
        });
      }

      // Check if user role is in any of the required groups
      const hasPermission = groupNames.some(groupName => 
        isRoleInGroup(userRole, groupName)
      );

      if (!hasPermission) {
        const allowedRoles = groupNames.flatMap(groupName => ROLE_GROUPS[groupName]);
        const uniqueRoles = [...new Set(allowedRoles)];
        
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: `Access denied. Required one of role groups: ${groupNames.join(', ')}`,
          details: {
            requiredGroups: groupNames,
            userRole,
            allowedRoles: uniqueRoles,
            accessLevel: 'Multiple role groups required'
          }
        });
      }

      next();
    } catch (error) {
      console.error('[Role Validation] Error checking permissions:', error);
      return res.status(500).json({
        error: 'Permission check failed',
        message: 'Unable to verify user permissions'
      });
    }
  };
}

/**
 * Middleware to require all of the specified role groups
 * @param groupNames - Array of role groups, all of which are required
 * @returns Express middleware function
 */
export function requireAllRoleGroups(groupNames: RoleGroup[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const userRole = req.user?.role;
      
      if (!userRole) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User role not found in request'
        });
      }

      // Validate user role
      if (!isValidRole(userRole)) {
        return res.status(401).json({
          error: 'Invalid user role',
          message: `User role "${userRole}" is not recognized`
        });
      }

      // Check if user role is in all of the required groups
      const hasAllPermissions = groupNames.every(groupName => 
        isRoleInGroup(userRole, groupName)
      );

      if (!hasAllPermissions) {
        const missingGroups = groupNames.filter(groupName => 
          !isRoleInGroup(userRole, groupName)
        );
        
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: `Access denied. Missing required role groups: ${missingGroups.join(', ')}`,
          details: {
            requiredGroups: groupNames,
            userRole,
            missingGroups,
            accessLevel: 'Multiple role groups required'
          }
        });
      }

      next();
    } catch (error) {
      console.error('[Role Validation] Error checking permissions:', error);
      return res.status(500).json({
        error: 'Permission check failed',
        message: 'Unable to verify user permissions'
      });
    }
  };
}

/**
 * Get human-readable description of access level
 */
function getAccessLevelDescription(groupName: RoleGroup): string {
  const descriptions = {
    IS_TENANT_ADMIN: 'Tenant administration (users, settings, operations)',
    IS_TENANT_OWNER: 'Tenant ownership (billing, subscription, critical settings)',
    IS_TENANT_MANAGER: 'Tenant management (operations, analytics)',
    IS_TENANT_USER: 'Basic tenant access (features, data)',
    IS_PLATFORM_ADMIN: 'Platform administration (full system access)',
    IS_PLATFORM_SUPPORT: 'Platform support (troubleshooting, assistance)'
  };
  
  return descriptions[groupName] || 'Unknown access level';
}

/**
 * Helper function to check if user has specific role group access
 * Can be used in route handlers for additional logic
 */
export function hasRoleGroupAccess(userRole: string, groupName: RoleGroup): boolean {
  if (!isValidRole(userRole)) return false;
  return isRoleInGroup(userRole, groupName);
}

/**
 * Get all role groups a user belongs to
 */
export function getUserRoleGroups(userRole: string): RoleGroup[] {
  if (!isValidRole(userRole)) return [];
  
  const userGroups: RoleGroup[] = [];
  
  for (const groupName of Object.keys(ROLE_GROUPS) as RoleGroup[]) {
    if (isRoleInGroup(userRole, groupName)) {
      userGroups.push(groupName);
    }
  }
  
  return userGroups;
}

/**
 * Middleware to require users to have a specific permission
 * Maximum flexibility - just set permission and platform handles security
 * @param permission - The permission required for access (CAN_ prefix)
 * @returns Express middleware function
 */
export function requirePermission(permission: PermissionGroup) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get user role from authenticated request
      const userRole = req.user?.role;
      
      if (!userRole) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'User role not found in request'
        });
      }

      // Validate user role
      if (!isValidRole(userRole)) {
        return res.status(401).json({
          error: 'Invalid user role',
          message: `User role "${userRole}" is not recognized`
        });
      }

      // Check if user has the required permission
      if (!hasPermission(userRole, permission)) {
        const allowedRoles = PERMISSION_GROUPS[permission];
        
        return res.status(403).json({
          error: 'Insufficient permissions',
          message: `Access denied. Required permission: ${permission}`,
          details: {
            requiredPermission: permission,
            userRole,
            allowedRoles,
            accessLevel: getPermissionDescription(permission)
          }
        });
      }

      // User has required permission
      next();
    } catch (error) {
      console.error('[Permission Validation] Error checking permissions:', error);
      return res.status(500).json({
        error: 'Permission check failed',
        message: 'Unable to verify user permissions'
      });
    }
  };
}

/**
 * Get human-readable description of permission
 */
function getPermissionDescription(permission: PermissionGroup): string {
  const descriptions: Record<PermissionGroup, string> = {
    CAN_MANAGE_TENANT_USERS: 'Tenant user management (add, edit, remove users)',
    CAN_MANAGE_TENANT_BILLING: 'Tenant billing management (subscription, payments, invoices)',
    CAN_MANAGE_TENANT_SETTINGS: 'Tenant settings management (configuration, preferences)',
    CAN_MANAGE_TENANT_ANALYTICS: 'Tenant analytics access (reports, insights, metrics)',
    CAN_MANAGE_TENANT_INVENTORY: 'Tenant inventory management (products, stock, categories)',
    CAN_EXPORT_TENANT_DATA: 'Tenant data export (reports, analytics, inventory data)',
    CAN_ADMIN_PLATFORM: 'Platform administration (full system control)',
    CAN_SUPPORT_PLATFORM: 'Platform support (troubleshooting, assistance, diagnostics)',
    CAN_VIEW_PLATFORM_LOGS: 'Platform logs access (system logs, error logs, audit trails)',
    CAN_MANAGE_PLATFORM_USERS: 'Platform user management (admin accounts, permissions)',
    CAN_ACCESS_SYSTEM_TOOLS: 'System tools access (diagnostics, maintenance, utilities)',
    CAN_VIEW_SENSITIVE_DATA: 'Sensitive data access (confidential information, PII)',
    CAN_DELETE_DATA: 'Data deletion permissions (permanent removal, cleanup)',
    CAN_BULK_OPERATIONS: 'Bulk operations (mass import, export, delete operations)',
    // Organization permissions
    CAN_VIEW_ORGANIZATION: 'View organization details and tenants',
    CAN_MANAGE_ORGANIZATION: 'Manage organization settings and configuration',
    CAN_PROPAGATE_ITEMS: 'Propagate items across organization tenants',
    CAN_MANAGE_MEMBERS: 'Manage organization members and roles',
    CAN_TRANSFER_OWNERSHIP: 'Transfer organization ownership',
    CAN_DELETE_ORGANIZATION: 'Delete organization and all associated data',
    CAN_SUPPORT_TENANTS: 'Provide support for organization tenants',
    CAN_TROUBLESHOOT: 'Access troubleshooting tools and diagnostics'
  };
  
  return descriptions[permission] || 'Unknown permission';
}

/**
 * Helper function to check if user has specific permission access
 * Can be used in route handlers for additional logic
 */
export function hasPermissionAccess(userRole: string, permission: PermissionGroup): boolean {
  if (!isValidRole(userRole)) return false;
  return hasPermission(userRole, permission);
}

/**
 * Get all permissions a user has
 */
export function getUserPermissions(userRole: string): PermissionGroup[] {
  if (!isValidRole(userRole)) return [];
  
  const userPermissions: PermissionGroup[] = [];
  
  for (const permissionName of Object.keys(PERMISSION_GROUPS) as PermissionGroup[]) {
    if (hasPermission(userRole, permissionName)) {
      userPermissions.push(permissionName);
    }
  }
  
  return userPermissions;
}
