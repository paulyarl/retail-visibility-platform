/**
 * Tenant Access Hook - New Modular Architecture
 * 
 * Main hook that composes focused hooks for clean, maintainable access control.
 * Replaces the monolithic useTenantTier.ts (430+ lines) with focused components.
 * 
 * This is the new standard for tenant access control in Phase 2.
 */

import { useMemo } from 'react';
import { useTierData } from './useTierData';
import { useUserRole } from './useUserRole';
import { useUsageData } from './useUsageData';
import { useFeatureAccess } from './useFeatureAccess';
import type { TenantAccessResult } from './types';

/**
 * Main tenant access hook - New Phase 2 Architecture
 * 
 * Composes focused hooks to provide comprehensive tenant access control.
 * Replaces the monolithic useTenantTier hook with clean, maintainable architecture.
 * 
 * @param tenantId - The tenant ID to get access context for
 * @returns Comprehensive access control interface
 */
export function useTenantAccess(tenantId: string | null): TenantAccessResult {
  // Compose focused hooks
  const tierData = useTierData(tenantId);
  const userRole = useUserRole(tenantId);
  const usageData = useUsageData(tenantId);
  const featureAccess = useFeatureAccess(tierData.tier, userRole.tenantRole, userRole.platformUser);

  // Compute loading and error states
  const loading = tierData.loading || userRole.loading || usageData.loading;
  const error = tierData.error || userRole.error || usageData.error;

  // Refresh function that refreshes all data
  const refresh = async () => {
    await Promise.all([
      tierData.refresh(),
      usageData.refresh()
      // Note: userRole doesn't have refresh as it's less likely to change
    ]);
  };

  // Memoized result to prevent unnecessary re-renders
  return useMemo(() => ({
    // Loading states
    loading,
    error,
    
    // Tier context
    tier: tierData.tier,
    organization: tierData.organization,
    isChain: tierData.isChain,
    
    // User context
    userRole: userRole.tenantRole,
    platformRole: userRole.platformRole,
    canBypassTier: userRole.canBypassTier,
    canBypassRole: userRole.canBypassRole,
    
    // Feature access methods (from composed hook)
    hasFeature: featureAccess.hasFeature,
    canAccess: featureAccess.canAccess,
    getFeatureBadge: featureAccess.getFeatureBadge,
    getAccessDeniedReason: featureAccess.getAccessDeniedReason,
    
    // Usage and limits
    usage: usageData.usage,
    isLimitReached: usageData.isLimitReached,
    getUsagePercentage: usageData.getUsagePercentage,
    
    // Actions
    refresh
  }), [
    loading,
    error,
    tierData.tier,
    tierData.organization,
    tierData.isChain,
    userRole.tenantRole,
    userRole.platformRole,
    userRole.canBypassTier,
    userRole.canBypassRole,
    featureAccess.hasFeature,
    featureAccess.canAccess,
    featureAccess.getFeatureBadge,
    featureAccess.getAccessDeniedReason,
    usageData.usage,
    usageData.isLimitReached,
    usageData.getUsagePercentage,
    refresh
  ]);
}

/**
 * Legacy compatibility hook
 * 
 * Provides backward compatibility for components still using the old interface.
 * This will be removed in Phase 3 after all components are migrated.
 * 
 * @deprecated Use useTenantAccess instead
 */
export function useTenantTierCompat(tenantId: string | null) {
  console.warn('[useTenantTierCompat] DEPRECATED: Use useTenantAccess instead. This hook will be removed in Phase 3.');
  
  const accessResult = useTenantAccess(tenantId);
  
  // Map new interface to old interface for backward compatibility
  return {
    tier: accessResult.tier,
    usage: accessResult.usage ? {
      products: accessResult.usage.products.current,
      locations: accessResult.usage.locations.current,
      users: accessResult.usage.users.current,
      apiCalls: accessResult.usage.apiCalls.current,
      storageGB: accessResult.usage.storageGB?.current || 0
    } : null,
    loading: accessResult.loading,
    error: accessResult.error,
    refresh: accessResult.refresh,
    
    // Legacy tier-only methods
    hasFeature: accessResult.hasFeature,
    getFeaturesByCategory: () => [], // TODO: Implement if needed
    isLimitReached: accessResult.isLimitReached,
    getUsagePercentage: accessResult.getUsagePercentage,
    getFeatureBadge: (featureId: string) => accessResult.getFeatureBadge(featureId),
    
    // New multi-level methods
    canAccess: accessResult.canAccess,
    getAccessDeniedReason: accessResult.getAccessDeniedReason,
    getFeatureBadgeWithPermission: accessResult.getFeatureBadge
  };
}
