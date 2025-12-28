import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  } | null;
  _timestamp: string;
}

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

export interface UseTenantCompleteReturn {
  // Original tenant data (from /api/tenants/:id)
  tenant: TenantCompleteResponse['tenant'] | null;

  // Resolved tier data (from /api/tenants/:id/tier + resolution logic)
  tier: ResolvedTier | null;

  // Usage data (from /api/tenants/:id/usage)
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
 * Advanced hook that fetches complete tenant data in a single consolidated API call
 * Replaces useTenantTier + separate tenant info calls
 * Reduces 3 API calls to 1 consolidated call
 */
export function useTenantComplete(tenantId: string | null): UseTenantCompleteReturn {
  const { user } = useAuth();
  const authUser = user;

  // Single consolidated query - replaces 3 separate calls
  const { data: completeData, isLoading, error, refetch } = useQuery({
    queryKey: ['tenant', 'complete', tenantId],
    queryFn: async (): Promise<TenantCompleteResponse> => {
      if (!tenantId) {
        throw new Error('Tenant ID is required');
      }

      console.log('[useTenantComplete] Fetching consolidated tenant data for:', tenantId);

      const response = await api.get(`/api/tenants/${encodeURIComponent(tenantId)}/complete`);

      if (!response.ok) {
        throw new Error(`Failed to fetch complete tenant data: ${response.status}`);
      }

      const data = await response.json();
      console.log('[useTenantComplete] Received consolidated data:', {
        tenant: data.tenant?.id,
        hasTier: !!data.tier,
        hasUsage: !!data.usage,
      });

      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes - balanced between fresh data and performance
    gcTime: 15 * 60 * 1000, // 15 minutes cache
    enabled: !!tenantId && !!authUser, // Only run when authenticated and tenantId available
    retry: 2,
  });

  // Extract data from consolidated response
  const tenant = completeData?.tenant || null;
  const rawTier = completeData?.tier || null;
  const rawUsage = completeData?.usage || null;
  const loading = isLoading;
  const queryError = error ? (error instanceof Error ? error.message : String(error)) : null;

  // Build resolved tier from consolidated data
  // This replaces the complex tier resolution logic that was in useTenantTier
  const tier: ResolvedTier | null = useMemo(() => {
    if (!rawTier || !tenant) return null;

    try {
      // Create basic tier info from consolidated response
      const tenantTier: TierInfo = {
        id: rawTier.tier,
        name: rawTier.tier,
        level: mapTierLevel(rawTier.tier),
        source: 'tenant',
        features: [], // Would need to be populated based on tier
        limits: {
          maxProducts: getTierLimit(rawTier.tier, 'products'),
          maxLocations: getTierLimit(rawTier.tier, 'locations'),
          maxUsers: getTierLimit(rawTier.tier, 'users'),
        }
      };

      // For now, assume individual tenant (not chain)
      // In production, you'd check if organization exists and handle chain logic
      return {
        effective: tenantTier,
        tenant: tenantTier,
        isChain: false,
        canUpgrade: true,
        upgradeOptions: getUpgradeOptions(tenantTier.level)
      };
    } catch (err) {
      console.warn('[useTenantComplete] Error resolving tier:', err);
      return null;
    }
  }, [rawTier, tenant]);

  // Transform usage data to expected format
  const usage: TenantUsage | null = rawUsage ? {
    products: rawUsage.products,
    locations: rawUsage.locations,
    users: rawUsage.users,
    apiCalls: rawUsage.apiCalls,
    storageGB: rawUsage.storageGB,
  } : null;

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
    loading,
    error: queryError,
    refresh: async () => { await refetch(); },

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
