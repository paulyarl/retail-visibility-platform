import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
  
  const [tier, setTier] = useState<ResolvedTier | null>(null);
  const [usage, setUsage] = useState<TenantUsage | null>(null);
  const [tierLoading, setTierLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Derive user-related state from AuthContext
  const { canSupport, userRole, userData } = useMemo(() => {
    if (!authUser) {
      return { canSupport: false, userRole: null as UserTenantRole | null, userData: null };
    }
    
    const hasSupportAccess = canBypassTierRestrictions(authUser);
    const isPlatformViewer = authUser.role === 'PLATFORM_VIEWER';
    
    let role: UserTenantRole | null = null;
    if (hasSupportAccess) {
      role = 'OWNER'; // Platform admins bypass
    } else if (tenantId && authUser.tenants) {
      const userTenant = authUser.tenants.find((t: any) => t.id === tenantId);
      if (userTenant) {
        role = userTenant.role as UserTenantRole;
      } else if (isPlatformViewer) {
        role = 'VIEWER';
      }
    } else if (isPlatformViewer) {
      role = 'VIEWER';
    }
    
    return { canSupport: hasSupportAccess, userRole: role, userData: authUser };
  }, [authUser, tenantId]);

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

  const fetchTierData = async () => {
    if (!tenantId) {
      setTierLoading(false);
      return;
    }

    try {
      setTierLoading(true);
      setError(null);

      // User data is now from AuthContext - no need to fetch /auth/me

      // Use public tier endpoint if no auth, otherwise use authenticated endpoint
      const tierEndpoint = authUser 
        ? `/api/tenants/${tenantId}/tier`
        : `/api/tenants/${tenantId}/tier/public`;

      // Fetch tenant and organization tier data in parallel (Next.js API routes)
      // Skip usage endpoint if not authenticated (storefront doesn't need it)
      const requests = [api.get(tierEndpoint)];
      if (authUser) {
        requests.push(api.get(`/api/tenants/${tenantId}/usage`));
      }
      
      const [tenantResponse, usageResponse] = await Promise.all(requests);

      let organizationTier: TierInfo | null = null;
      let tenantTier: TierInfo | null = null;
      let isChain = false;

      // Process tenant tier response
      if (tenantResponse.ok) {
        const tierData = await tenantResponse.json();
        
        organizationTier = tierData.organizationTier ? mapApiTierToTierInfo(tierData.organizationTier) : null;
        tenantTier = tierData.tenantTier ? mapApiTierToTierInfo(tierData.tenantTier) : null;
        isChain = tierData.isChain || false;
      }

      // Process usage response (only if authenticated)
      let usageData: TenantUsage = {
        products: 0,
        locations: 0,
        users: 0,
        apiCalls: 0,
        storageGB: 0
      };

      if (usageResponse && usageResponse.ok) {
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
      console.log('[useTenantTier] Resolved tier:', resolvedTier);
      console.log('[useTenantTier] Effective tier:', resolvedTier?.effective);
      console.log('[useTenantTier] Effective tier id:', resolvedTier?.effective?.id);

      setTier(resolvedTier);
      setUsage(usageData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tier data';
      setError(errorMessage);
      console.error('[useTenantTier] Error:', err);
    } finally {
      setTierLoading(false);
    }
  };

  // Auto-fetch when tenantId changes (works with or without auth)
  useEffect(() => {
    fetchTierData();
  }, [tenantId, authUser]);

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
  const loading = authLoading || tierLoading;

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
