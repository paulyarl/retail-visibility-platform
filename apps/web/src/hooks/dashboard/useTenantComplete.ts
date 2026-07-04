import React, { useMemo, useCallback, useEffect } from 'react';
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useServerTenant } from '@/components/tenant/ServerResolvedContextProvider';
import { tenantInfoService } from '@/services/TenantInfoService';
import { tenantManagementService } from '@/services/TenantManagementService';
import { organizationService } from '@/services/OrganizationService';
import { tenantPublicService } from '@/services/TenantPublicService';
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
    hasPublishedDirectory: boolean;
    hasProduct: boolean;
    googleProductCount: number;
    // Additional fields needed by subscription page
    service_level?: string;
    grace_ends_at?: string;
    effectiveExpiresAt?: string;
    effectiveExpiresType?: 'trial' | 'manual' | 'subscription';
    effectiveExpiresSource?: string;
    reopening_date?: string;
    subscriptionEndsAt?: string;
    // Location fields
    city?: string | null;
    state?: string | null;
    countryCode?: string | null;
    bannerUrl?: string | null;
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
  isLoading: boolean; // Alias for loading
  primaryLoading: boolean; // true only while primary tenant fetch is in-flight
  secondaryLoading: boolean; // true while tier/usage/org are in-flight
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
  const serverTenant = useServerTenant();
  const queryClient = useQueryClient();

  // Seed React Query cache with server-resolved tenant info before the query fires
  // IMPORTANT: The queryFn returns getCompleteTenantInfo() which wraps the tenant
  // inside { tenant: ..., businessProfile: ..., ... }. The server-resolved tenantInfo
  // is the raw tenant object, so we must wrap it in the same shape to avoid a shape
  // mismatch that would cause rawProfile extraction to fail and tenant to be null.
  const hasSeededRef = React.useRef(false);
  useEffect(() => {
    if (serverTenant?.tenantInfo && tenantId && !hasSeededRef.current) {
      hasSeededRef.current = true;
      queryClient.setQueryData(['tenant', 'info', tenantId], {
        tenant: serverTenant.tenantInfo,
        businessProfile: null,
        businessHours: null,
        paymentGateways: [],
      });
    }
  }, [serverTenant, tenantId, queryClient]);

  // Primary query - critical tenant data only (fast, essential)
  const { data: tenantData, isLoading: tenantLoading, refetch: refetchTenant } = useQuery({
    queryKey: ['tenant', 'info', tenantId],
    queryFn: async () => {
      if (!tenantId) throw new Error('Tenant ID is required');
      try {
        const data = await tenantInfoService.getCompleteTenantInfo(tenantId);
        // console.log(`[useTenantComplete] Tenant info fetched:`, data);
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

    // Fetch public profile for location data (city, state, country)
  const { data: publicProfileData } = useQuery({
    queryKey: ['tenant', 'public-profile', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      try {
        return tenantPublicService.getPublicTenantProfile(tenantId);
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    enabled: !!tenantId,
    retry: 0,
  });

  // Batch secondary queries so their loading state updates happen in one React commit
  const organizationId = tenantData?.tenant?.organization_id;
  const secondaryQueries = useQueries({
    queries: [
      {
        queryKey: ['tenant', 'tier', tenantId],
        queryFn: async () => {
          if (!tenantId) throw new Error('Tenant ID is required');
          try {
            return tenantInfoService.getTenantTier(tenantId);
          } catch (error) {
            console.warn('[useTenantComplete] Tier fetch failed, returning null:', error);
            return null;
          }
        },
        staleTime: 5 * 60 * 1000,
        gcTime: 15 * 60 * 1000,
        enabled: loadSecondary && !!tenantId && !!authUser && !!tenantData,
        retry: 0,
        throwOnError: false,
      },
      {
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
      },
      {
        queryKey: ['tenant', 'organization', tenantId, organizationId],
        queryFn: async () => {
          if (!tenantId || !organizationId) return null;
          try {
            const result = await tenantInfoService.getOrganization(tenantId);
            return result?.data || null;
          } catch (error) {
            console.warn('[useTenantComplete] Organization fetch failed, returning null:', error);
            return null;
          }
        },
        staleTime: 10 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        enabled: loadSecondary && !!tenantId && !!authUser && !!organizationId,
        retry: 0,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        refetchOnReconnect: false,
      },
    ],
  });

  const tierData = secondaryQueries[0]?.data ?? null;
  const usageData = secondaryQueries[1]?.data ?? null;
  const organizationData = secondaryQueries[2]?.data ?? null;
  const secondaryLoading = secondaryQueries.some(q => q.isLoading);

  // Combined loading state
  const isLoading = tenantLoading || (loadSecondary && secondaryLoading);
  const primaryLoading = tenantLoading;
  
  // Clear cache function for debugging
  const clearCacheAndRefresh = useCallback(async () => {
    await refetchTenant();
  }, [refetchTenant]);

  // Build tenant from primary query
  // The API returns data.profile (not data.tenant) from /complete endpoint
  // Fallback to tenantData itself if it looks like a raw tenant object (has id but no .tenant/.profile)
  const rawProfile = (tenantData as any)?.profile || tenantData?.tenant || ((tenantData as any)?.id && !(tenantData as any)?.tenant && !(tenantData as any)?.businessProfile ? (tenantData as any) : null);
  const businessProfile = tenantData?.businessProfile;
  
  const tenant = useMemo(() => rawProfile ? {
    id: rawProfile.id || tenantId!,
    name: rawProfile.name || 'Unknown',
    organizationId: rawProfile.organization_id || rawProfile.organizationId || null,
    subscriptionTier: rawProfile.subscription_tier || rawProfile.subscriptionTier || 'basic',
    subscriptionStatus: rawProfile.subscription_status || rawProfile.subscriptionStatus || 'active',
    locationStatus: rawProfile.location_status || rawProfile.locationStatus || 'active',
    subdomain: null,
    createdAt: rawProfile.created_at || rawProfile.createdAt || new Date().toISOString(),
    statusInfo: rawProfile.statusInfo || null,
    stats: {
      productCount: usageData?.items || 0,
      userCount: 0
    },
    slug: rawProfile.slug || null,
    hasPublishedDirectory: rawProfile.hasPublishedDirectory || false,
    googleProductCount:  usageData?.items|| 0,
    hasProduct: rawProfile.hasProduct || false,
    // Additional subscription fields
    service_level: rawProfile.service_level || rawProfile.serviceLevel || null,
    grace_ends_at: rawProfile.grace_ends_at || rawProfile.graceEndsAt || null,
    effectiveExpiresAt: rawProfile.effective_expires_at || rawProfile.effectiveExpiresAt || null,
    effectiveExpiresType: rawProfile.effective_expires_type || rawProfile.effectiveExpiresType || null,
    effectiveExpiresSource: rawProfile.effective_expires_source || rawProfile.effectiveExpiresSource || null,
    reopening_date: rawProfile.reopening_date || rawProfile.reopeningDate || null,
    subscriptionEndsAt: rawProfile.subscription_ends_at || rawProfile.subscriptionEndsAt || null,
    // Location fields - use publicProfileData as primary source (from tenant_business_profiles_list)
    city: publicProfileData?.city || businessProfile?.city || rawProfile.city || null,
    state: publicProfileData?.address?.state || businessProfile?.state || rawProfile.state || null,
    countryCode: publicProfileData?.country_code || businessProfile?.country_code || rawProfile.country_code || rawProfile.countryCode || null,
    bannerUrl: publicProfileData?.banner || businessProfile?.banner || rawProfile.banner || null,
  } : null, [rawProfile, businessProfile, publicProfileData, usageData, tenantId]);

  // Build resolved tier from secondary query
  const rawTier = tierData;
  const rawUsage = usageData;
  // console.log('[useTenantComplete] Raw usage data:', rawUsage);

  // Transform usage data to expected format
  const usage: TenantUsage | null = useMemo(() => rawUsage ? {
    products: (rawUsage as any).data?.usage?.activeItems || (rawUsage as any).data?.usage?.totalItems || (rawUsage as any).currentItems || (rawUsage as any).items || 0,
    locations: (rawUsage as any).data?.usage?.locations || 0,
    users: (rawUsage as any).data?.usage?.users || 0,
    apiCalls: 0,
    storageGB: (rawUsage as any).data?.usage?.storage || 0,
    totalItems: (rawUsage as any).data?.usage?.totalItems || (rawUsage as any).data?.usage?.activeItems || (rawUsage as any).currentItems || (rawUsage as any).items || 0,
    activeItems: (rawUsage as any).data?.usage?.activeItems || (rawUsage as any).data?.usage?.totalItems || (rawUsage as any).currentItems || (rawUsage as any).items || 0,
    categories: (rawUsage as any).data?.usage?.categories || 0,
    orders: (rawUsage as any).data?.usage?.orders || 0
  } : null, [rawUsage]);
  // console.log('[useTenantComplete] Transformed usage data:', usage);

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
        },
        price: rawTierData.tenantTier?.price_monthly ?? rawTierData.tenantTier?.price,
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
        },
        price: rawTierData.organizationTier.price_monthly ?? rawTierData.organizationTier.price,
      } : undefined;

      // Determine effective tier (org overrides tenant for chains)
      const effectiveTier = orgTier || tenantTier;
      const isChain = !!rawTierData.isChain && !!orgTier;

      // console.log(`[useTenantComplete] Tenant:`, tenant);
      // console.log(`[useTenantComplete] Usage:`, usage);
      // console.log(`[useTenantComplete] Tenant tier:`, tenantTier);
      // console.log(`[useTenantComplete] Organization tier:`, orgTier);
      // console.log(`[useTenantComplete] Effective tier:`, effectiveTier);

      // Only allow upgrades for discovery and storefront tiers
      // Higher tiers (commitment, professional, enterprise) are comprehensive
      const canUpgrade = effectiveTier.level === 'discovery' || effectiveTier.level === 'storefront';

      return {
        effective: effectiveTier,
        tenant: tenantTier,
        organization: orgTier,
        organizationName: rawTierData.organizationName,
        organizationId: rawTierData.organizationId,
        isChain,
        canUpgrade,
        upgradeOptions: getUpgradeOptions(effectiveTier.level),
        rawTierData,
      };
    } catch (err) {
      console.warn('[useTenantComplete] Error resolving tier:', err);
      return null;
    }
  }, [rawTier, tenant]);

  const loading = isLoading;
  const queryError = null; // Error handling per-query would need individual error states

  // Helper functions (copied from useTenantTier for backward compatibility)
  const hasTierFeature = useCallback((featureId: string): boolean => {
    if (!tier) return false;
    return hasFeature(tier, featureId);
  }, [tier]);

  const getTierFeatures = useCallback((category: TierFeature['category']): TierFeature[] => {
    if (!tier) return [];
    return getFeaturesByCategory(tier, category);
  }, [tier]);

  const checkLimitReached = useCallback((limitType: keyof TenantUsage): boolean => {
    if (!tier || !usage) return false;
    const limitKey = `max${limitType.charAt(0).toUpperCase()}${limitType.slice(1)}` as keyof typeof tier.effective.limits;
    return isLimitReached(tier, limitKey, usage[limitType]);
  }, [tier, usage]);

  const getUsagePercent = useCallback((limitType: keyof TenantUsage): number => {
    if (!tier || !usage) return 0;
    const limitKey = `max${limitType.charAt(0).toUpperCase()}${limitType.slice(1)}` as keyof typeof tier.effective.limits;
    return getUsagePercentage(tier, limitKey, usage[limitType]);
  }, [tier, usage]);

  const getBadge = useCallback((featureId: string): TierBadge | null => {
    if (!tier || hasTierFeature(featureId)) return null;
    return {
      text: 'UPGRADE',
      tooltip: 'Upgrade to access this feature',
      colorClass: 'bg-gray-600'
    };
  }, [tier, hasTierFeature]);

  const canAccess = useCallback((featureId: string, permissionType: PermissionType): boolean => {
    return hasTierFeature(featureId);
  }, [hasTierFeature]);

  const getAccessDeniedReason = useCallback((featureId: string, permissionType: PermissionType, actionLabel?: string): string | null => {
    if (canAccess(featureId, permissionType)) return null;
    return 'This feature is not included in your subscription tier';
  }, [canAccess]);

  const getFeatureBadgeWithPermission = useCallback((featureId: string, permissionType: PermissionType, actionLabel?: string): TierBadge | null => {
    if (canAccess(featureId, permissionType)) return null;
    return getBadge(featureId);
  }, [canAccess, getBadge]);

  const organizationTenants = useMemo(() =>
    organizationData?.tenants?.map((t: any) => ({
      id: t.id,
      name: t.name,
      subscription_status: t.subscription_status,
      subscription_tier: t.subscription_tier,
    })) || [],
    [organizationData]
  );

  return useMemo(() => ({
    tenant,
    tier,
    usage,
    organizationTenants,
    loading,
    isLoading: loading,
    primaryLoading,
    secondaryLoading: loadSecondary && secondaryLoading,
    error: queryError,
    refresh: clearCacheAndRefresh,

    hasFeature: hasTierFeature,
    getFeaturesByCategory: getTierFeatures,
    isLimitReached: checkLimitReached,
    getUsagePercentage: getUsagePercent,
    getFeatureBadge: getBadge,

    canAccess,
    getAccessDeniedReason,
    getFeatureBadgeWithPermission,
  }), [
    tenant, tier, usage, organizationTenants, loading, primaryLoading, secondaryLoading, queryError,
    clearCacheAndRefresh, hasTierFeature, getTierFeatures, checkLimitReached,
    getUsagePercent, getBadge, canAccess, getAccessDeniedReason, getFeatureBadgeWithPermission,
  ]);
}

// Helper functions (simplified versions for this consolidated hook)
function mapTierLevel(tierId: string): TierInfo['level'] {
  switch (tierId) {
    case 'google_only': return 'discovery';
    case 'discovery': return 'discovery';
    case 'storefront': return 'storefront';
    case 'commitment': return 'commitment';
    case 'omnichannel': return 'omnichannel';
    case 'starter': return 'discovery';
    case 'professional': return 'professional';
    case 'enterprise': return 'enterprise';
    case 'organization': return 'enterprise';
    case 'chain_starter': return 'chain_starter';
    default: return 'discovery';
  }
}

function getTierLimit(tierId: string, type: 'products' | 'locations' | 'users'): number {
  // Simplified tier limits - in production you'd have a proper tier configuration
  const limits: Record<string, Record<string, number>> = {
    'free': { products: 50, locations: 1, users: 2 },
    'starter': { products: 100, locations: 1, users: 5 },
    'discovery': { products: 100, locations: 1, users: 5 },
    'storefront': { products: 250, locations: 1, users: 5 },
    'commitment': { products: 500, locations: 1, users: 5 },
    'professional': { products: 750, locations: 2, users: 10 },
    'chain_starter': { products: 1000, locations: 1, users: 5 },
    'chain_professional': { products: 1000, locations: 3, users: 10 },
    'enterprise': { products: 10000, locations: 2, users: 50 },
    'chain_enterprise': { products: 10000, locations: 10, users: 50 },
  };
  return limits[tierId]?.[type] || limits['free'][type];
}

function getUpgradeOptions(currentLevel: TierInfo['level']): string[] {
  // Simplified upgrade options
  switch (currentLevel) {
    case 'google_only': return ['storefront', 'commitment', 'omnichannel', 'professional', 'enterprise'];
    case 'starter': return ['storefront', 'commitment', 'omnichannel', 'professional', 'enterprise'];
    case 'discovery': return ['storefront', 'commitment', 'omnichannel', 'professional', 'enterprise'];
    case 'storefront': return ['commitment', 'omnichannel', 'professional', 'enterprise'];
    case 'commitment': return [ 'omnichannel','professional', 'enterprise'];
    case 'omnichannel': return ['professional', 'enterprise'];
    case 'professional': return ['enterprise'];
    default: return ['discovery', 'storefront', 'commitment', 'professional', 'enterprise'];
  }
}
