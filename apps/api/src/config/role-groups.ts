/**
 * Centralized role and group definitions
 * IS_ prefix clearly distinguishes groups from roles
 * 
 * Roles: What a user IS (their identity/position)
 * Groups: What roles CAN access (IS_ prefix = "roles that ARE...")
 */

export const USER_ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  SUPPORT: 'SUPPORT',
  MEMBER: 'MEMBER',
  VIEWER: 'VIEWER',
  TENANT_ADMIN: 'TENANT_ADMIN',
  TENANT_OWNER: 'TENANT_OWNER',
  TENANT_MANAGER: 'TENANT_MANAGER',
  TENANT_USER: 'TENANT_USER',
  TENANT_VIEWER: 'TENANT_VIEWER',
  TENANT_MEMBER: 'TENANT_MEMBER',
  TENANT_SUPPORT: 'TENANT_SUPPORT',
  PLATFORM_ADMIN: 'PLATFORM_ADMIN',
  PLATFORM_SUPPORT: 'PLATFORM_SUPPORT',
  PLATFORM_VIEWER: 'PLATFORM_VIEWER',
  USER: 'USER'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const ROLE_GROUPS = {
  // Tenant administrators can manage users, settings, and basic operations
  IS_TENANT_ADMIN: [
    USER_ROLES.OWNER, 
    USER_ROLES.TENANT_ADMIN, 
    USER_ROLES.TENANT_OWNER, 
    USER_ROLES.PLATFORM_ADMIN, 
    USER_ROLES.PLATFORM_SUPPORT, 
    USER_ROLES.ADMIN
  ],
  
  // Tenant owners can manage billing, subscription, and critical settings
  IS_TENANT_OWNER: [
    USER_ROLES.OWNER, 
    USER_ROLES.TENANT_ADMIN, 
    USER_ROLES.TENANT_OWNER, 
    USER_ROLES.PLATFORM_ADMIN, 
    USER_ROLES.ADMIN
  ],
  
  // Tenant managers can manage operations and analytics
  IS_TENANT_MANAGER: [
    USER_ROLES.OWNER, 
    USER_ROLES.TENANT_ADMIN, 
    USER_ROLES.TENANT_OWNER, 
    USER_ROLES.PLATFORM_ADMIN, 
    USER_ROLES.ADMIN, 
    USER_ROLES.PLATFORM_SUPPORT
  ],
  
  // Tenant users can access basic features and data
  IS_TENANT_USER: [
    USER_ROLES.OWNER, 
    USER_ROLES.TENANT_ADMIN, 
    USER_ROLES.TENANT_OWNER, 
    USER_ROLES.ADMIN, 
    USER_ROLES.PLATFORM_ADMIN, 
    USER_ROLES.USER
  ],
  
  // Platform administrators have full system access
  IS_PLATFORM_ADMIN: [
    USER_ROLES.PLATFORM_ADMIN, 
    USER_ROLES.ADMIN
  ],
  
  // Platform support can assist with troubleshooting
  IS_PLATFORM_SUPPORT: [
    USER_ROLES.PLATFORM_ADMIN, 
    USER_ROLES.PLATFORM_SUPPORT, 
    USER_ROLES.ADMIN
  ]
} as const;

// Permission groups for granular access control (CAN_ prefix)
// Maximum flexibility - just set permission and platform handles security
export const PERMISSION_GROUPS = {
  // Tenant management permissions
  CAN_MANAGE_TENANT_USERS: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  
  CAN_MANAGE_TENANT_BILLING: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  
  CAN_MANAGE_TENANT_SETTINGS: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  
  CAN_MANAGE_TENANT_ANALYTICS: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.TENANT_MANAGER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  
  CAN_MANAGE_TENANT_INVENTORY: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.TENANT_MANAGER,
    USER_ROLES.TENANT_USER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  
  CAN_EXPORT_TENANT_DATA: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  
  // Platform permissions
  CAN_ADMIN_PLATFORM: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  
  CAN_SUPPORT_PLATFORM: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN
  ],
  
  CAN_VIEW_PLATFORM_LOGS: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN
  ],
  
  CAN_MANAGE_PLATFORM_USERS: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  
  CAN_ACCESS_SYSTEM_TOOLS: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN
  ],
  
  // Data permissions
  CAN_VIEW_SENSITIVE_DATA: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  
  CAN_DELETE_DATA: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN
  ],
  
  CAN_BULK_OPERATIONS: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.TENANT_MANAGER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  
  // Organization permissions
  CAN_VIEW_ORGANIZATION: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.TENANT_OWNER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN,
  ],
  
  CAN_MANAGE_ORGANIZATION: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.TENANT_OWNER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  
  CAN_PROPAGATE_ITEMS: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.TENANT_OWNER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN,
  ],
  
  CAN_MANAGE_MEMBERS: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  
  CAN_TRANSFER_OWNERSHIP: [
    USER_ROLES.OWNER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  
  CAN_DELETE_ORGANIZATION: [
    USER_ROLES.OWNER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  
  CAN_SUPPORT_TENANTS: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN,
  ],
  
  CAN_TROUBLESHOOT: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN,
  ],
  
  // CRM permissions
  CAN_VIEW_CRM: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.PLATFORM_VIEWER,
    USER_ROLES.ADMIN,
  ],
  
  CAN_MANAGE_CRM_SALES: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  
  CAN_MANAGE_CRM_SUPPORT: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN,
  ],
  
  CAN_MANAGE_CRM_OPS: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
} as const;

export type RoleGroup = keyof typeof ROLE_GROUPS;
export type Role = UserRole;
export type PermissionGroup = keyof typeof PERMISSION_GROUPS;

/**
 * Check if a role belongs to a specific role group
 */
export function isRoleInGroup(role: UserRole, group: RoleGroup): boolean {
  const roles = ROLE_GROUPS[group] as readonly UserRole[];
  return roles.includes(role);
}

/**
 * Check if a role has a specific permission
 */
export function hasPermission(role: UserRole, permission: PermissionGroup): boolean {
  const roles = PERMISSION_GROUPS[permission] as readonly UserRole[];
  return roles.includes(role);
}

/**
 * Get all roles in a group
 */
export function getRolesInGroup(group: RoleGroup): UserRole[] {
  return [...ROLE_GROUPS[group]];
}

/**
 * Get all roles that have a permission
 */
export function getRolesWithPermission(permission: PermissionGroup): UserRole[] {
  return [...PERMISSION_GROUPS[permission]];
}

/**
 * Get all available role groups
 */
export function getAllRoleGroups(): Record<RoleGroup, readonly UserRole[]> {
  return ROLE_GROUPS;
}

/**
 * Get all available permissions
 */
export function getAllPermissions(): Record<PermissionGroup, readonly UserRole[]> {
  return PERMISSION_GROUPS;
}

/**
 * Validate role group name
 */
export function isValidRoleGroup(group: string): group is RoleGroup {
  return group in ROLE_GROUPS;
}

/**
 * Validate permission name
 */
export function isValidPermission(permission: string): permission is PermissionGroup {
  return permission in PERMISSION_GROUPS;
}

/**
 * Validate role name
 */
export function isValidRole(role: string): role is UserRole {
  return Object.values(USER_ROLES).includes(role as UserRole);
}

/**
 * Get all role groups a user belongs to based on their role
 * @param userRole - The user's role
 * @returns Array of role groups the user belongs to
 */
export function getUserRoleGroups(userRole: UserRole): RoleGroup[] {
  const userGroups: RoleGroup[] = [];
  
  for (const groupName of Object.keys(ROLE_GROUPS) as RoleGroup[]) {
    if (isRoleInGroup(userRole, groupName)) {
      userGroups.push(groupName);
    }
  }
  
  return userGroups;
}

/**
 * Get all permissions a user has based on their role
 * @param userRole - The user's role
 * @returns Array of permissions the user has
 */
export function getUserPermissions(userRole: UserRole): PermissionGroup[] {
  const userPermissions: PermissionGroup[] = [];
  
  for (const permissionName of Object.keys(PERMISSION_GROUPS) as PermissionGroup[]) {
    if (hasPermission(userRole, permissionName)) {
      userPermissions.push(permissionName);
    }
  }
  
  return userPermissions;
}
