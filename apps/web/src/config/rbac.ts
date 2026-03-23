/**
 * Web-side RBAC configuration — mirrors apps/api/src/config/role-groups.ts
 *
 * This file is the single source of truth for RBAC on the web server (port 3000).
 * It is intentionally kept in sync with the API-side config manually so that
 * the three Next.js RBAC API routes (/api/auth/role-groups, /api/auth/user-access,
 * /api/auth/user-permissions) can compute correct access data using ONLY the
 * Auth0 session — no database or external API call required.
 *
 * UPDATE THIS FILE whenever apps/api/src/config/role-groups.ts changes.
 */

export const USER_ROLES = {
  OWNER:            'OWNER',
  TENANT_ADMIN:     'TENANT_ADMIN',
  TENANT_OWNER:     'TENANT_OWNER',
  TENANT_MANAGER:   'TENANT_MANAGER',
  TENANT_USER:      'TENANT_USER',
  PLATFORM_ADMIN:   'PLATFORM_ADMIN',
  PLATFORM_SUPPORT: 'PLATFORM_SUPPORT',
  ADMIN:            'ADMIN',
  USER:             'USER',
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const ROLE_GROUPS: Record<string, readonly string[]> = {
  IS_TENANT_ADMIN: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.TENANT_OWNER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN,
  ],
  IS_TENANT_OWNER: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.TENANT_OWNER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  IS_TENANT_MANAGER: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.TENANT_OWNER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
  ],
  IS_TENANT_USER: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.TENANT_OWNER,
    USER_ROLES.ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.USER,
  ],
  IS_PLATFORM_ADMIN: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  IS_PLATFORM_SUPPORT: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN,
  ],
} as const;

export const PERMISSION_GROUPS: Record<string, readonly string[]> = {
  // Tenant permissions
  CAN_MANAGE_TENANT_USERS: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  CAN_MANAGE_TENANT_BILLING: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  CAN_MANAGE_TENANT_SETTINGS: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  CAN_MANAGE_TENANT_ANALYTICS: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.TENANT_MANAGER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  CAN_MANAGE_TENANT_INVENTORY: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.TENANT_MANAGER,
    USER_ROLES.TENANT_USER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  CAN_EXPORT_TENANT_DATA: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  // Platform permissions
  CAN_ADMIN_PLATFORM: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  CAN_SUPPORT_PLATFORM: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN,
  ],
  CAN_VIEW_PLATFORM_LOGS: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN,
  ],
  CAN_MANAGE_PLATFORM_USERS: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  CAN_ACCESS_SYSTEM_TOOLS: [
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.PLATFORM_SUPPORT,
    USER_ROLES.ADMIN,
  ],
  // Data permissions
  CAN_VIEW_SENSITIVE_DATA: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  CAN_DELETE_DATA: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
  CAN_BULK_OPERATIONS: [
    USER_ROLES.OWNER,
    USER_ROLES.TENANT_ADMIN,
    USER_ROLES.TENANT_MANAGER,
    USER_ROLES.PLATFORM_ADMIN,
    USER_ROLES.ADMIN,
  ],
} as const;

/**
 * Compute which role groups a role belongs to.
 */
export function getUserRoleGroups(userRole: string): string[] {
  return Object.entries(ROLE_GROUPS)
    .filter(([, roles]) => roles.includes(userRole))
    .map(([group]) => group);
}

/**
 * Compute which permissions a role has.
 */
export function getUserPermissions(userRole: string): string[] {
  return Object.entries(PERMISSION_GROUPS)
    .filter(([, roles]) => roles.includes(userRole))
    .map(([permission]) => permission);
}

/**
 * Derive an access level label from a role for the summary field.
 */
export function getAccessLevel(userRole: string): string {
  if (userRole === USER_ROLES.PLATFORM_ADMIN || userRole === USER_ROLES.ADMIN) return 'PLATFORM_ADMIN';
  if (userRole === USER_ROLES.PLATFORM_SUPPORT) return 'PLATFORM_SUPPORT';
  if (userRole === USER_ROLES.OWNER || userRole === USER_ROLES.TENANT_OWNER || userRole === USER_ROLES.TENANT_ADMIN) return 'TENANT_ADMIN';
  if (userRole === USER_ROLES.TENANT_MANAGER) return 'TENANT_MANAGER';
  if (userRole === USER_ROLES.TENANT_USER) return 'TENANT_USER';
  return 'USER';
}
