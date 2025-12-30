import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { CachedTenantService, CachedTenantData } from '@/lib/cache/cached-tenant-service';
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
import { canBypassTierRestrictions, canBypassRoleRestrictions, forceAdminBypass } from '@/lib/auth/platform-admin';

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
  // Use AuthContext instead of fetching /auth/me independently
  const { user: authUser, isLoading: authLoading } = useAuth();
  
  const userData = useMemo(() => authUser || null, [authUser]);
  const userRole = useMemo(() => {
    if (!userData || !tenantId) return null;
    const userTenant = userData.tenants.find(t => t.id === tenantId);
    return userTenant?.role || null;
  }, [userData, tenantId]);
  
  const canSupport = useMemo(() => {
    return canBypassTierRestrictions(userData) || canBypassRoleRestrictions(userData);
  }, [userData]);

  // Helper function to map API tier response to TierInfo format
  const mapApiTierToTierInfo = (apiTier: any): TierInfo => {
    return {
      id: apiTier.tier_key || apiTier.tierKey,
      name: apiTier.display_name || apiTier.displayName || apiTier.name,
      level: mapTierKeyToLevel(apiTier.tier_key || apiTier.tierKey),
      source: 'tenant', // Default to tenant, will be overridden if needed
      features: apiTier.tier_features_list || apiTier.features || [],
      limits: apiTier.limits || {}
    };
  };

  // Helper function to map tier keys to levels
  const mapTierKeyToLevel = (tierKey: string): TierInfo['level'] => {
    switch (tierKey) {
      case 'google_only': return 'starter';
      case 'starter': return 'starter';
      case 'professional': return 'pro';
      case 'enterprise': return 'enterprise';
      case 'organization': return 'enterprise';
      case 'chain_starter': return 'starter';
      case 'chain_professional': return 'pro';
      case 'chain_enterprise': return 'enterprise';
      default: return 'starter';
    }
  };

  // Use CachedTenantService for persistent local storage caching
  const { data: tenantData, isLoading: tenantLoading, error: tenantError, refetch } = useQuery({
    queryKey: ['tenant', tenantId, 'cached-data', !!authUser],
    queryFn: async (): Promise<CachedTenantData | null> => {
      if (!tenantId) return null;

      try {
        const data = await CachedTenantService.getTenantData(tenantId, true);
        return data;
      } catch (error) {
        console.error('[useTenantTier] Failed to fetch tenant data:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - local storage handles longer-term caching
    gcTime: 15 * 60 * 1000, // 15 minutes
    enabled: !!tenantId, // Only run when tenantId is available
  });

  // Extract tier and usage data from cached tenant data
  const tierData = useMemo(() => {
    if (!tenantData) return null;

    // Reconstruct tier data from cached format
    const { tenant, tier: tierInfo } = tenantData;

    let organizationTier: TierInfo | null = null;
    let tenantTier: TierInfo | null = null;
    let isChain = false;

    if (tierInfo.organizationTier) {
      organizationTier = mapApiTierToTierInfo(tierInfo.organizationTier);
    }
    if (tierInfo.tenantTier) {
      tenantTier = mapApiTierToTierInfo(tierInfo.tenantTier);
    }
    isChain = tierInfo.isChain || false;

    const resolvedTier = resolveTier(organizationTier, tenantTier, isChain);

    return {
      tier: resolvedTier,
      isChain
    };
  }, [tenantData]);

  const usageData = useMemo(() => {
    if (!tenantData?.usage) return null;

    return {
      products: tenantData.usage.currentItems || 0,
      locations: tenantData.usage.locations || 1,
      users: tenantData.usage.users || 0,
      apiCalls: tenantData.usage.apiCalls || 0,
      storageGB: tenantData.usage.storageGB || 0
    };
  }, [tenantData]);

  // Extract data from React Query results
  const tier = tierData?.tier || null;
  const usage = usageData || null;
  const loading = authLoading || tenantLoading;
  const error = tenantError ? (tenantError instanceof Error ? tenantError.message : String(tenantError)) : null;

  // EMERGENCY: Feature name mapping to fix frontend/backend conflicts
  const EMERGENCY_FEATURE_MAPPING: Record<string, string> = {
    'barcode_scan': 'product_scanning',  // Map frontend name to backend
    'quick_start_wizard_full': 'quick_start_wizard',  // Normalize variants
    'propagation': 'propagation_products',  // Default propagation to products
  };

  const normalizeFeatureId = (featureId: string): string => {
    return EMERGENCY_FEATURE_MAPPING[featureId] || featureId;
  };

  // Helper function wrappers
  const checkFeature = (featureId: string): boolean => {
    // EMERGENCY: Normalize feature names to match backend
    const normalizedFeatureId = normalizeFeatureId(featureId);
    
    // EMERGENCY: Force bypass for critical features (platform admins)
    if (forceAdminBypass(userData, normalizedFeatureId)) {
      return true;
    }
    
    // Platform admins and support have access to all features
    if (canSupport) return true;
    if (!tier) return false;
    return hasFeature(tier, normalizedFeatureId);
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
    // EMERGENCY: Normalize feature names to match backend
    const normalizedFeatureId = normalizeFeatureId(featureId);
    
    // Platform admins and support never see badges (all features unlocked)
    if (canSupport) return null;
    // If feature is available, no badge needed
    if (checkFeature(featureId)) return null;

    // Feature mapping to required tiers and badge info (using normalized names)
    const featureTierMap: Record<string, { tier: string; badge: string; tooltip: string; color: string }> = {
      // Organization tier features
      'propagation_products': { 
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
      'quick_start_wizard': { 
        tier: 'professional', 
        badge: 'PRO+', 
        tooltip: 'Requires Professional tier or higher - Upgrade for Quick Start wizard',
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

    const featureInfo = featureTierMap[normalizedFeatureId];
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

  // Combined loading state
  // const loading = authLoading || tierLoading;

  return {
    tier,
    usage,
    loading,
    error,
    refresh: async () => { await refetch(); }, // Return Promise<void>
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
