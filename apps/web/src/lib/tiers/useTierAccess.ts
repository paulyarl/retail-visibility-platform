/**
 * Tier Access Control Hook
 * 
 * @deprecated This hook is deprecated as of Phase 2. Use useTenantAccess instead.
 * 
 * MIGRATION GUIDE:
 * OLD: const { hasFeature } = useTierAccess(tenant.subscriptionTier);
 * NEW: const { hasFeature } = useTenantAccess(tenantId);
 * 
 * The new hook provides the same interface but with better performance,
 * role-based access control, and modular architecture.
 * 
 * This hook will be removed in Phase 3.
 */

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  checkTierFeature,
  getTierFeatures,
  calculateUpgradeRequirements,
  getTierDisplayName,
  getTierPricing,
} from './tier-features';

export interface TierAccessResult {
  /** Current tier */
  tier: string;
  
  /** Tier display name */
  tierDisplay: string;
  
  /** Current tier pricing */
  tierPrice: number;
  
  /** Check if current tier has access to a feature */
  hasFeature: (feature: string) => boolean;
  
  /** Get all features available to current tier */
  getFeatures: () => string[];
  
  /** Calculate upgrade requirements for a feature */
  requiresUpgrade: (feature: string) => {
    required: boolean;
    targetTier?: string;
    targetTierDisplay?: string;
    targetPrice?: number;
    currentPrice?: number;
    upgradeCost?: number;
  };
  
  /** Check if multiple features are all available */
  hasAllFeatures: (features: string[]) => boolean;
  
  /** Check if any of the features are available */
  hasAnyFeature: (features: string[]) => boolean;
}

/**
 * Hook to access tier-based feature permissions
 * 
 * @param tenantTier - The tenant's subscription tier (e.g., 'starter', 'professional')
 * @returns Object with tier access utilities
 * 
 * NOTE: 'trial' is not a tier - it's a subscription status. Pass the actual tier (e.g., 'starter')
 * NOTE: Platform admins and support bypass all tier restrictions
 */
export function useTierAccess(tenantTier: string | null | undefined): TierAccessResult {
  // DEPRECATION WARNING
  console.warn(
    '[useTierAccess] DEPRECATED: This hook will be removed in Phase 3. ' +
    'Use useTenantAccess from @/hooks/tenant-access instead. ' +
    'Migration: useTierAccess(tier) → useTenantAccess(tenantId)'
  );
  
  const tier = tenantTier || 'starter';
  const { user } = useAuth();
  
  // Check if user is platform admin or support
  const isPlatformAdmin = user?.role === 'PLATFORM_ADMIN' || user?.role === 'PLATFORM_SUPPORT';
  
  return useMemo(() => {
    const tierDisplay = getTierDisplayName(tier);
    const tierPrice = getTierPricing(tier);
    
    return {
      tier,
      tierDisplay,
      tierPrice,
      
      // Platform admins bypass all tier checks
      hasFeature: (feature: string) => isPlatformAdmin || checkTierFeature(tier, feature),
      
      getFeatures: () => getTierFeatures(tier),
      
      requiresUpgrade: (feature: string) => calculateUpgradeRequirements(tier, feature),
      
      // Platform admins bypass all tier checks
      hasAllFeatures: (features: string[]) => 
        isPlatformAdmin || features.every(feature => checkTierFeature(tier, feature)),
      
      // Platform admins bypass all tier checks
      hasAnyFeature: (features: string[]) => 
        isPlatformAdmin || features.some(feature => checkTierFeature(tier, feature)),
    };
  }, [tier, isPlatformAdmin]);
}
