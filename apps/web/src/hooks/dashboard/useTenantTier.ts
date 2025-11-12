import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { 
  resolveTier, 
  ResolvedTier, 
  TierInfo,
  hasFeature,
  getFeaturesByCategory,
  isLimitReached,
  getUsagePercentage,
  TierFeature
} from '@/lib/tiers/tier-resolver';

export interface TenantUsage {
  products: number;
  locations: number;
  users: number;
  apiCalls: number;
  storageGB: number;
}

export interface TierBadge {
  text: string;
  tooltip: string;
  colorClass: string;
}

// Permission types for Level 2 role checks
export type PermissionType = 'canView' | 'canEdit' | 'canManage' | 'canSupport' | 'canAdmin';

// User roles on tenant
export type UserTenantRole = 'OWNER' | 'ADMIN' | 'SUPPORT' | 'MEMBER' | 'MANAGER' | 'VIEWER';

export interface UseTenantTierReturn {
  tier: ResolvedTier | null;
  usage: TenantUsage | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  // Level 1: Tier-only checks (legacy, for backward compatibility)
  hasFeature: (featureId: string) => boolean;
  getFeaturesByCategory: (category: TierFeature['category']) => TierFeature[];
  isLimitReached: (limitType: keyof TenantUsage) => boolean;
  getUsagePercentage: (limitType: keyof TenantUsage) => number;
  getFeatureBadge: (featureId: string) => TierBadge | null;
  // Level 2: Multi-level permission checks
  canAccess: (featureId: string, permissionType: PermissionType) => boolean;
  getAccessDeniedReason: (featureId: string, permissionType: PermissionType, actionLabel?: string) => string | null;
  getFeatureBadgeWithPermission: (featureId: string, permissionType: PermissionType, actionLabel?: string) => TierBadge | null;
}

/**
 * Centralized hook for tenant tier and feature access
 * Handles both individual tenants and chain organizations
 * Resolves effective tier from organization and tenant levels
 */
export function useTenantTier(tenantId: string | null): UseTenantTierReturn {
  const [tier, setTier] = useState<ResolvedTier | null>(null);
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canSupport, setCanSupport] = useState(false);
  const [userRole, setUserRole] = useState<UserTenantRole | null>(null);

  const fetchTierData = async () => {
    if (!tenantId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Check user's platform role and tenant role
      const userResponse = await api.get('auth/me');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        
        // Level 0: Platform support bypass (full access)
        const hasSupportAccess =
          userData.user?.role === 'PLATFORM_ADMIN' ||
          userData.user?.role === 'PLATFORM_SUPPORT';
        setCanSupport(hasSupportAccess);
        
        // Platform viewer gets read-only access to all tenants
        const isPlatformViewer = userData.user?.role === 'PLATFORM_VIEWER';
        
        // Get user's role on this specific tenant
        // Platform admins bypass role checks, so skip this call
        if (!hasSupportAccess && userData.user?.id && tenantId) {
          try {
            const userTenantResponse = await api.get(`api/users/${userData.user.id}/tenants/${tenantId}`);
            if (userTenantResponse.ok) {
              const userTenantData = await userTenantResponse.json();
              setUserRole(userTenantData.role as UserTenantRole);
            } else if (isPlatformViewer) {
              // Platform viewers act as VIEWER role on any tenant
              setUserRole('VIEWER');
            }
          } catch (err) {
            console.warn('[useTenantTier] Failed to fetch user tenant role:', err);
            if (isPlatformViewer) {
              // Fallback: Platform viewers act as VIEWER role
              setUserRole('VIEWER');
            }
          }
        }
        
        // Platform admins and support bypass tier checks, but still fetch tier data for display
        // The bypass happens in canAccess() and checkFeature() functions
      }

      // Fetch tenant and organization tier data in parallel (Next.js API routes)
      const [tenantResponse, usageResponse] = await Promise.all([
        api.get(`/api/tenants/${tenantId}/tier`),
        api.get(`/api/tenants/${tenantId}/usage`)
      ]);

      let organizationTier: TierInfo | null = null;
      let tenantTier: TierInfo | null = null;
      let isChain = false;

      // Process tenant tier response
      if (tenantResponse.ok) {
        const tierData = await tenantResponse.json();
        
        organizationTier = tierData.organizationTier || null;
        tenantTier = tierData.tenantTier || null;
        isChain = tierData.isChain || false;
      }

      // Process usage response
      let usageData: TenantUsage = {
        products: 0,
        locations: 0,
        users: 0,
        apiCalls: 0,
        storageGB: 0
      };

      if (usageResponse.ok) {
        const usage = await usageResponse.json();
        usageData = {
          products: usage.products || 0,
          locations: usage.locations || 0,
          users: usage.users || 0,
          apiCalls: usage.apiCalls || 0,
          storageGB: usage.storageGB || 0
        };
      }

      // Resolve effective tier using middleware
      const resolvedTier = resolveTier(organizationTier, tenantTier, isChain);

      setTier(resolvedTier);
      setUsage(usageData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tier data';
      setError(errorMessage);
      console.error('[useTenantTier] Error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when tenantId changes
  useEffect(() => {
    fetchTierData();
  }, [tenantId]);

  // Helper function wrappers
  const checkFeature = (featureId: string): boolean => {
    // Platform admins and support have access to all features
    if (canSupport) return true;
    if (!tier) return false;
    return hasFeature(tier, featureId);
  };

  const getFeatures = (category: TierFeature['category']): TierFeature[] => {
    if (!tier) return [];
    return getFeaturesByCategory(tier, category);
  };

  const checkLimitReached = (limitType: keyof TenantUsage): boolean => {
    // Platform admins and support bypass all limits
    if (canSupport) return false;
    if (!tier || !usage) return false;
    // Map usage keys to limit keys
    const limitKey = `max${limitType.charAt(0).toUpperCase()}${limitType.slice(1)}` as keyof typeof tier.effective.limits;
    return isLimitReached(tier, limitKey, usage[limitType]);
  };

  const getUsage = (limitType: keyof TenantUsage): number => {
    if (!tier || !usage) return 0;
    // Map usage keys to limit keys
    const limitKey = `max${limitType.charAt(0).toUpperCase()}${limitType.slice(1)}` as keyof typeof tier.effective.limits;
    return getUsagePercentage(tier, limitKey, usage[limitType]);
  };

  const getBadge = (featureId: string): TierBadge | null => {
    // Platform admins and support never see badges (all features unlocked)
    if (canSupport) return null;
    // If feature is available, no badge needed
    if (checkFeature(featureId)) return null;

    // Feature mapping to required tiers and badge info
    const featureTierMap: Record<string, { tier: string; badge: string; tooltip: string; color: string }> = {
      // Organization tier features
      'propagation': { 
        tier: 'organization', 
        badge: 'ORG', 
        tooltip: 'Requires Organization tier - Upgrade to propagate to all locations',
        color: 'bg-gradient-to-r from-blue-600 to-cyan-600'
      },
      
      // Professional tier features
      'barcode_scan': { 
        tier: 'professional', 
        badge: 'PRO+', 
        tooltip: 'Requires Professional tier or higher - Upgrade for barcode scanning',
        color: 'bg-gradient-to-r from-purple-600 to-pink-600'
      },
      'quick_start_wizard_full': { 
        tier: 'professional', 
        badge: 'PRO+', 
        tooltip: 'Requires Professional tier or higher - Upgrade for full Quick Start wizard',
        color: 'bg-gradient-to-r from-purple-600 to-pink-600'
      },
      
      // Starter tier features
      'storefront': { 
        tier: 'starter', 
        badge: 'STARTER+', 
        tooltip: 'Requires Starter tier or higher - Upgrade for public storefront',
        color: 'bg-blue-600'
      },
      'category_quick_start': { 
        tier: 'starter', 
        badge: 'STARTER+', 
        tooltip: 'Requires Starter tier or higher - Upgrade for category quick start',
        color: 'bg-blue-600'
      },
    };

    const featureInfo = featureTierMap[featureId];
    if (!featureInfo) {
      // Default badge for unknown features
      return {
        text: 'UPGRADE',
        tooltip: 'Upgrade to access this feature',
        colorClass: 'bg-gray-600'
      };
    }

    return {
      text: featureInfo.badge,
      tooltip: featureInfo.tooltip,
      colorClass: featureInfo.color
    };
  };

  /**
   * Level 2: Role-based permission mapping
   * Maps user roles to what they can do
   * 
   * Hierarchy (most to least permissions):
   * OWNER > ADMIN > SUPPORT = MANAGER > MEMBER > VIEWER
   */
  const getRolePermissions = (role: UserTenantRole | null): Set<PermissionType> => {
    if (!role) return new Set();
    
    const rolePermissions: Record<UserTenantRole, PermissionType[]> = {
      // OWNER - Full control including billing + can delete
      'OWNER': ['canView', 'canEdit', 'canManage', 'canSupport', 'canAdmin'],
      
      // ADMIN - Full operational control, no billing, can delete
      'ADMIN': ['canView', 'canEdit', 'canManage', 'canSupport'],
      
      // SUPPORT - Can manage operations but cannot delete tenant/items
      // Can set visibility, status, manage operations
      'SUPPORT': ['canView', 'canEdit', 'canManage', 'canSupport'],
      
      // MANAGER - Trusted authority, can manage operations but not users
      // Has elevated permissions: can do bulk operations, quick starts, etc.
      'MANAGER': ['canView', 'canEdit', 'canManage', 'canSupport'],
      
      // MEMBER - Regular staff, can view and edit but not manage
      'MEMBER': ['canView', 'canEdit'],
      
      // VIEWER - Read-only access
      'VIEWER': ['canView'],
    };
    
    return new Set(rolePermissions[role] || []);
  };

  /**
   * Multi-Level Permission Check
   * Level 1: Check if tenant tier includes feature (RED = stop)
   * Level 2: Check if user role allows permission type (GREEN from L1 required)
   */
  const canAccess = (featureId: string, permissionType: PermissionType): boolean => {
    // Level 0: Platform support bypass
    if (canSupport) return true;
    
    // Level 1: Tier check (does tenant subscription include this?)
    const hasTierAccess = checkFeature(featureId);
    if (!hasTierAccess) {
      return false; // RED - don't even check role
    }
    
    // Level 2: Role check (does user's role allow this action?)
    const permissions = getRolePermissions(userRole);
    return permissions.has(permissionType);
  };

  /**
   * Get human-readable reason why access is denied
   * Returns null if access is granted
   * @param actionLabel - Optional context-aware action (e.g., "scan", "propagate", "upload")
   */
  const getAccessDeniedReason = (featureId: string, permissionType: PermissionType, actionLabel?: string): string | null => {
    // Level 0: Platform support bypass
    if (canSupport) return null;
    
    // Level 1: Tier check
    const hasTierAccess = checkFeature(featureId);
    if (!hasTierAccess) {
      const badge = getBadge(featureId);
      return badge?.tooltip || 'This feature is not included in your subscription tier';
    }
    
    // Level 2: Role check
    const permissions = getRolePermissions(userRole);
    if (!permissions.has(permissionType)) {
      // Use custom action label if provided, otherwise use default
      let action: string;
      if (actionLabel) {
        action = actionLabel;
      } else {
        const permissionLabels: Record<PermissionType, string> = {
          'canView': 'view',
          'canEdit': 'edit',
          'canManage': 'manage',
          'canSupport': 'perform this action',
          'canAdmin': 'access admin features',
        };
        action = permissionLabels[permissionType] || 'access';
      }
      
      const roleName = userRole || 'your role';
      return `Your role (${roleName}) does not have permission to ${action}`;
    }
    
    return null; // Access granted
  };

  /**
   * Get badge with dynamic tooltip based on permission check
   * Uses getAccessDeniedReason for smart, context-aware tooltips
   * @param actionLabel - Optional context-aware action (e.g., "scan", "propagate", "upload")
   */
  const getFeatureBadgeWithPermission = (featureId: string, permissionType: PermissionType, actionLabel?: string): TierBadge | null => {
    // Platform admins/support never see badges
    if (canSupport) return null;
    
    // If user has access, no badge needed
    if (canAccess(featureId, permissionType)) return null;
    
    // Get the dynamic reason (tier or role issue) with optional action label
    const deniedReason = getAccessDeniedReason(featureId, permissionType, actionLabel);
    if (!deniedReason) return null;
    
    // Get badge text and color from tier check
    const tierBadge = getBadge(featureId);
    if (!tierBadge) {
      // Fallback for role-only issues
      return {
        text: 'RESTRICTED',
        tooltip: deniedReason,
        colorClass: 'bg-amber-600'
      };
    }
    
    // Use tier badge styling with dynamic tooltip
    return {
      text: tierBadge.text,
      tooltip: deniedReason, // ← Dynamic, context-aware tooltip!
      colorClass: tierBadge.colorClass
    };
  };

  return {
    tier,
    usage,
    loading,
    error,
    refresh: fetchTierData,
    // Level 1: Legacy tier-only checks (backward compatibility)
    hasFeature: checkFeature,
    getFeaturesByCategory: getFeatures,
    isLimitReached: checkLimitReached,
    getUsagePercentage: getUsage,
    getFeatureBadge: getBadge,
    // Level 2: Multi-level permission checks
    canAccess,
    getAccessDeniedReason,
    getFeatureBadgeWithPermission,
  };
}
