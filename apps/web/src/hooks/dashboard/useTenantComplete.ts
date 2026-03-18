import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { tenantInfoService } from '@/services/TenantInfoService';
import { tenantManagementService } from '@/services/TenantManagementService';
import { organizationService } from '@/services/OrganizationService';
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

// Consolidated response from /api/tenants/:id/complete
interface TenantCompleteResponse {
  tenant: {
    id: string;
    name: string;
    organizationId: string | null;
    subscriptionTier: string;
    subscriptionStatus: string;
    locationStatus: string;
    subdomain: string | null;
    createdAt: string;
    statusInfo: any;
    stats: {
      productCount: number;
      userCount: number;
    };
    slug: string | null;
  };
  tier: {
    tier: string;
    status: string;
    // Additional tier fields would be populated by proper tier resolution
  } | null;
  usage: {
    products: number;
    locations: number;
    users: number;
    apiCalls: number;
    storageGB: number;    
    totalItems: number;
    activeItems: number;
    categories: number;
    orders: number;
  } | null;
  _timestamp: string;
}

export interface TenantUsage {
  products: number;
  locations: number;
  users: number;
  apiCalls: number;
  storageGB: number;
  totalItems: number;
  activeItems: number;
  categories: number;
  orders: number;
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

export interface UseTenantCompleteReturn {
  // Original tenant data (from /api/tenants/:id)
  tenant: TenantCompleteResponse['tenant'] | null;

  // Resolved tier data (from /api/tenants/:id/tier + resolution logic)
  tier: ResolvedTier | null;

  // Usage data (from /api/tenants/:id/usage)
  usage: TenantUsage | null;

  // Organization tenants (from /api/organizations/:tenantId)
  organizationTenants: Array<{
    id: string;
    name: string;
    subscription_status: string;
    subscription_tier: string;
  }>;

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
 * Advanced hook that fetches complete tenant data in a single consolidated API call
 * Replaces useTenantTier + separate tenant info calls
 * Reduces 3 API calls to 1 consolidated call
 * 
 * @param tenantId - The tenant ID to fetch data for
 * @param loadSecondary - If false, only loads critical tenant data (defer tier/usage)
 */
export function useTenantComplete(tenantId: string | null, loadSecondary: boolean = true): UseTenantCompleteReturn {
  const { user } = useAuth();
  const authUser = user;

  // Primary query - critical tenant data only (fast, essential)
  const { data: tenantData, isLoading: tenantLoading, refetch: refetchTenant } = useQuery({
    queryKey: ['tenant', 'info', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      try {
        const data = await tenantInfoService.getCompleteTenantInfo(tenantId);
        return data;
      } catch (error) {
        console.warn('[useTenantComplete] Tenant info fetch failed:', error);
        throw error;
      }
    },
    staleTime: 30 * 1000, // 30 seconds for tenant info
    gcTime: 5 * 60 * 1000,
    enabled: !!tenantId && !!authUser,
    retry: 1, // Reduced from 2
    retryDelay: 1000,
    throwOnError: false,
  });

  // Secondary query - tier data (deferred)
  const { data: tierData, isLoading: tierLoading } = useQuery({
    queryKey: ['tenant', 'tier', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      try {
        return tenantInfoService.getTenantTier(tenantId);
      } catch (error) {
        console.warn('[useTenantComplete] Tier fetch failed, returning null:', error);
        return null; // Return null on error instead of throwing
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    enabled: loadSecondary && !!tenantId && !!authUser && !!tenantData, // Only if primary succeeded
    retry: 0, // No retry for secondary
    throwOnError: false,
  });

  // Secondary query - usage data (deferred)
  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['tenant', 'usage', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      try {
        return tenantManagementService.getTenantUsage(tenantId);
      } catch (error) {
        console.warn('[useTenantComplete] Usage fetch failed, returning null:', error);
        return null;
      }
    },
    staleTime: 30 * 1000,
    gcTime: 2 * 60 * 1000,
    enabled: loadSecondary && !!tenantId && !!authUser && !!tenantData,
    retry: 0,
    throwOnError: false,
  });

  // Organization query - fetch organization with tenants
  const organizationId = tenantData?.tenant?.organization_id;
  const { data: organizationData, isLoading: organizationLoading } = useQuery({
    queryKey: ['tenant', 'organization', tenantId, organizationId],
    queryFn: async () => {
      if (!tenantId || !organizationId) return null;
      try {
        // Use tenantInfoService which handles auth properly
        const result = await tenantInfoService.getOrganization(tenantId);
        return result?.data || null;
      } catch (error) {
        console.warn('[useTenantComplete] Organization fetch failed, returning null:', error);
        return null;
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    enabled: loadSecondary && !!tenantId && !!authUser && !!organizationId,
    retry: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Combined loading state
  const isLoading = tenantLoading || (loadSecondary && (tierLoading || usageLoading || organizationLoading));
  
  // Clear cache function for debugging
  const clearCacheAndRefresh = async () => {
    console.log('[useTenantComplete] Refreshing data...');
    await refetchTenant();
  };

  // Build tenant from primary query
  const tenant = tenantData?.tenant ? {
    id: tenantData.tenant.id || tenantId!,
    name: tenantData.tenant.name || 'Unknown',
    organizationId: tenantData.tenant.organization_id || null,
    subscriptionTier: tenantData.tenant.subscription_tier || 'basic',
    subscriptionStatus: tenantData.tenant.subscription_status || 'active',
    locationStatus: tenantData.tenant.location_status || 'active',
    subdomain: null,
    createdAt: tenantData.tenant.created_at || new Date().toISOString(),
    statusInfo: tenantData.tenant.statusInfo || null,
    stats: {
      productCount: usageData?.items || 0,
      userCount: 0
    },
    slug: tenantData.tenant.slug || null
  } : null;

  // Build resolved tier from secondary query
  const rawTier = tierData;
  const rawUsage = usageData;

  // Transform usage data to expected format
  const usage: TenantUsage | null = rawUsage ? {
    products: (rawUsage as any).data?.usage?.activeItems || (rawUsage as any).data?.usage?.totalItems || (rawUsage as any).currentItems || (rawUsage as any).items || 0,
    locations: (rawUsage as any).data?.usage?.locations || 0,
    users: (rawUsage as any).data?.usage?.users || 0,
    apiCalls: 0,
    storageGB: (rawUsage as any).data?.usage?.storage || 0,
    totalItems: (rawUsage as any).data?.usage?.totalItems || (rawUsage as any).data?.usage?.activeItems || (rawUsage as any).currentItems || (rawUsage as any).items || 0,
    activeItems: (rawUsage as any).data?.usage?.activeItems || (rawUsage as any).data?.usage?.totalItems || (rawUsage as any).currentItems || (rawUsage as any).items || 0,
    categories: (rawUsage as any).data?.usage?.categories || 0,
    orders: (rawUsage as any).data?.usage?.orders || 0
  } : null;

  // Build resolved tier from secondary query data
  const tier: ResolvedTier | null = useMemo(() => {
    if (!rawTier || !tenant) return null;

    try {
      // Extract raw tier data from API response
      const rawTierData = rawTier as any;
      
      // Build tenant tier from raw data
      const tenantTier: TierInfo = {
        id: rawTierData.tenantTier?.tier_key || rawTierData.tier || 'starter',
        name: rawTierData.tenantTier?.display_name || rawTierData.name || rawTierData.tier || 'Starter',
        level: mapTierLevel(rawTierData.tenantTier?.tier_key || rawTierData.tier || 'starter'),
        source: 'tenant',
        features: rawTierData.tenantTier?.features?.map((f: any) => ({
          id: f.feature_key,
          name: f.feature_name,
          enabled: f.is_enabled,
          category: 'general' as const,
        })) || [],
        limits: {
          maxProducts: rawTierData.tenantTier?.max_skus || getTierLimit(rawTierData.tier || 'starter', 'products'),
          maxLocations: rawTierData.tenantTier?.max_locations || getTierLimit(rawTierData.tier || 'starter', 'locations'),
          maxUsers: getTierLimit(rawTierData.tier || 'starter', 'users'),
        }
      };

      // Build organization tier if available
      const orgTier: TierInfo | undefined = rawTierData.organizationTier ? {
        id: rawTierData.organizationTier.tier_key,
        name: rawTierData.organizationTier.display_name,
        level: mapTierLevel(rawTierData.organizationTier.tier_key),
        source: 'organization',
        features: rawTierData.organizationTier.features?.map((f: any) => ({
          id: f.feature_key,
          name: f.feature_name,
          enabled: f.is_enabled,
          category: 'general' as const,
        })) || [],
        limits: {
          maxProducts: rawTierData.organizationTier.max_skus,
          maxLocations: rawTierData.organizationTier.max_locations,
          maxUsers: 999,
        }
      } : undefined;

      // Determine effective tier (org overrides tenant for chains)
      const effectiveTier = orgTier || tenantTier;
      const isChain = !!rawTierData.isChain && !!orgTier;

      return {
        effective: effectiveTier,
        tenant: tenantTier,
        organization: orgTier,
        organizationName: rawTierData.organizationName,
        organizationId: rawTierData.organizationId,
        isChain,
        canUpgrade: true,
        upgradeOptions: getUpgradeOptions(effectiveTier.level)
      };
    } catch (err) {
      console.warn('[useTenantComplete] Error resolving tier:', err);
      return null;
    }
  }, [rawTier, tenant]);

  const loading = isLoading;
  const queryError = null; // Error handling per-query would need individual error states

  // Helper functions (copied from useTenantTier for backward compatibility)
  const hasTierFeature = (featureId: string): boolean => {
    if (!tier) return false;
    return hasFeature(tier, featureId);
  };

  const getTierFeatures = (category: TierFeature['category']): TierFeature[] => {
    if (!tier) return [];
    return getFeaturesByCategory(tier, category);
  };

  const checkLimitReached = (limitType: keyof TenantUsage): boolean => {
    if (!tier || !usage) return false;
    const limitKey = `max${limitType.charAt(0).toUpperCase()}${limitType.slice(1)}` as keyof typeof tier.effective.limits;
    return isLimitReached(tier, limitKey, usage[limitType]);
  };

  const getUsagePercent = (limitType: keyof TenantUsage): number => {
    if (!tier || !usage) return 0;
    const limitKey = `max${limitType.charAt(0).toUpperCase()}${limitType.slice(1)}` as keyof typeof tier.effective.limits;
    return getUsagePercentage(tier, limitKey, usage[limitType]);
  };

  const getBadge = (featureId: string): TierBadge | null => {
    // Simplified badge logic - in production you'd want the full feature mapping
    if (!tier || hasTierFeature(featureId)) return null;

    return {
      text: 'UPGRADE',
      tooltip: 'Upgrade to access this feature',
      colorClass: 'bg-gray-600'
    };
  };

  // Permission checking functions (simplified for this example)
  const canAccess = (featureId: string, permissionType: PermissionType): boolean => {
    return hasTierFeature(featureId); // Simplified - no role-based checks in this version
  };

  const getAccessDeniedReason = (featureId: string, permissionType: PermissionType, actionLabel?: string): string | null => {
    if (canAccess(featureId, permissionType)) return null;
    return 'This feature is not included in your subscription tier';
  };

  const getFeatureBadgeWithPermission = (featureId: string, permissionType: PermissionType, actionLabel?: string): TierBadge | null => {
    if (canAccess(featureId, permissionType)) return null;
    return getBadge(featureId);
  };

  return {
    tenant,
    tier,
    usage,
    organizationTenants: organizationData?.tenants?.map((t: any) => ({
      id: t.id,
      name: t.name,
      subscription_status: t.subscription_status,
      subscription_tier: t.subscription_tier,
    })) || [],
    loading,
    error: queryError,
    refresh: clearCacheAndRefresh,

    // Level 1: Legacy tier-only checks
    hasFeature: hasTierFeature,
    getFeaturesByCategory: getTierFeatures,
    isLimitReached: checkLimitReached,
    getUsagePercentage: getUsagePercent,
    getFeatureBadge: getBadge,

    // Level 2: Multi-level permission checks
    canAccess,
    getAccessDeniedReason,
    getFeatureBadgeWithPermission,
  };
}

// Helper functions (simplified versions for this consolidated hook)
function mapTierLevel(tierId: string): TierInfo['level'] {
  switch (tierId) {
    case 'google_only': return 'starter';
    case 'starter': return 'starter';
    case 'professional': return 'pro';
    case 'enterprise': return 'enterprise';
    case 'organization': return 'enterprise';
    default: return 'starter';
  }
}

function getTierLimit(tierId: string, type: 'products' | 'locations' | 'users'): number {
  // Simplified tier limits - in production you'd have a proper tier configuration
  const limits: Record<string, Record<string, number>> = {
    'free': { products: 10, locations: 1, users: 1 },
    'starter': { products: 100, locations: 1, users: 5 },
    'professional': { products: 1000, locations: 3, users: 10 },
    'enterprise': { products: 10000, locations: 10, users: 50 },
  };
  return limits[tierId]?.[type] || limits['free'][type];
}

function getUpgradeOptions(currentLevel: TierInfo['level']): string[] {
  // Simplified upgrade options
  switch (currentLevel) {
    case 'starter': return ['professional', 'enterprise'];
    case 'pro': return ['enterprise'];
    default: return ['starter', 'professional', 'enterprise'];
  }
}
