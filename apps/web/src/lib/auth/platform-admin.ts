/**
 * Centralized Platform Admin Utilities
 * 
 * Single source of truth for platform admin detection and bypass logic.
 * Replaces scattered admin checks across the codebase.
 * 
 * EMERGENCY: Created to fix mixed results where platform admins were incorrectly rejected.
 */

export interface User {
  id?: string;
  userId?: string;
  role?: string;
  email?: string;
  [key: string]: any;
}

/**
 * Check if user is a platform administrator
 * Platform admins have full access to all features and tenants
 */
export function isPlatformAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'PLATFORM_ADMIN';
}

/**
 * Check if user is platform support
 * Platform support has elevated access but with some restrictions
 */
export function isPlatformSupport(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'PLATFORM_SUPPORT';
}

/**
 * Check if user is platform viewer
 * Platform viewers have read-only access across all tenants
 */
export function isPlatformViewer(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'PLATFORM_VIEWER';
}

/**
 * Check if user can bypass tier restrictions
 * Platform admins and support can access all features regardless of subscription tier
 */
export function canBypassTierRestrictions(user: User | null | undefined): boolean {
  return isPlatformAdmin(user) || isPlatformSupport(user);
}

/**
 * Check if user is a tenant admin
 * Tenant admins have support-level access but only for their assigned tenants
 */
export function isTenantAdmin(user: User | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'TENANT_ADMIN';
}

/**
 * Check if user can bypass role restrictions
 * Platform admins can perform any action on any tenant
 * Platform support has elevated permissions but not full admin access
 */
export function canBypassRoleRestrictions(user: User | null | undefined): boolean {
  return isPlatformAdmin(user) || isPlatformSupport(user);
}

/**
 * Check if user has tenant support capabilities
 * This includes platform support (all tenants) and tenant admin (assigned tenants)
 */
export function hasTenantSupportAccess(user: User | null | undefined): boolean {
  return isPlatformAdmin(user) || isPlatformSupport(user) || isTenantAdmin(user);
}

/**
 * Check if user can perform support actions on a specific tenant
 * Platform users can access all tenants, tenant admins only their assigned ones
 */
export function canSupportTenant(user: User | null | undefined, tenantId?: string): boolean {
  if (!user) return false;
  
  // Platform users have access to all tenants
  if (isPlatformAdmin(user) || isPlatformSupport(user)) {
    return true;
  }
  
  // Tenant admins need to be assigned to the specific tenant
  if (isTenantAdmin(user)) {
    // This would need tenant assignment logic - for now return true if they have the role
    return true; // TODO: Implement tenant assignment checking
  }
  
  return false;
}

/**
 * Check if user can access all tenants
 * Platform users can access any tenant without explicit membership
 */
export function canAccessAllTenants(user: User | null | undefined): boolean {
  return isPlatformAdmin(user) || isPlatformSupport(user) || isPlatformViewer(user);
}

/**
 * Get user's effective access level
 * Returns the highest level of access the user has
 */
export function getUserAccessLevel(user: User | null | undefined): 'admin' | 'support' | 'viewer' | 'tenant' | 'none' {
  if (!user) return 'none';
  
  if (isPlatformAdmin(user)) return 'admin';
  if (isPlatformSupport(user)) return 'support';
  if (isPlatformViewer(user)) return 'viewer';
  
  return 'tenant';  // Regular tenant user
}

/**
 * Check if user can perform administrative actions
 * Used for features like user management, tenant creation, etc.
 */
export function canPerformAdminActions(user: User | null | undefined): boolean {
  return isPlatformAdmin(user);
}

/**
 * Check if user can perform support actions
 * Used for debugging, troubleshooting, and customer support features
 */
export function canPerformSupportActions(user: User | null | undefined): boolean {
  return isPlatformAdmin(user) || isPlatformSupport(user);
}

/**
 * Get platform role display name
 * Returns user-friendly name for the platform role
 */
export function getPlatformRoleDisplayName(user: User | null | undefined): string | null {
  if (!user) return null;
  
  switch (user.role) {
    case 'PLATFORM_ADMIN':
      return 'Platform Administrator';
    case 'PLATFORM_SUPPORT':
      return 'Platform Support';
    case 'PLATFORM_VIEWER':
      return 'Platform Viewer';
    default:
      return null;
  }
}

/**
 * Check if user should see platform-specific UI elements
 * Platform users see additional navigation, tools, and information
 */
export function shouldShowPlatformUI(user: User | null | undefined): boolean {
  return canAccessAllTenants(user);
}

/**
 * EMERGENCY: Force admin bypass for critical features
 * Temporary function to ensure platform admins always have access
 * TODO: Remove after Phase 1 consolidation is complete
 */
export function forceAdminBypass(user: User | null | undefined, featureId: string): boolean {
  if (!isPlatformAdmin(user)) return false;
  
  // Critical features that must always work for platform admins
  const criticalFeatures = [
    'barcode_scan',
    'quick_start_wizard',
    'propagation_products',
    'propagation_categories',
    'gbp_integration',
    'storefront',
    'api_access'
  ];
  
  return criticalFeatures.includes(featureId);
}
