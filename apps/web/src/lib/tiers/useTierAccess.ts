/**
 * Tier Access Control Hook
 * 
 * Provides centralized tier-based feature access control for React components.
 * Similar to useAccessControl for role-based access, but for subscription tiers.
 * 
 * Usage:
 * ```tsx
 * const { hasFeature, requiresUpgrade } = useTierAccess(tenant.subscriptionTier);
 * 
 * if (!hasFeature('storefront')) {
 *   return <UpgradePrompt />;
 * }
 * ```
 */

import { useMemo } from 'react';
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
 */
export function useTierAccess(tenantTier: string | null | undefined): TierAccessResult {
  const tier = tenantTier || 'trial';
  
  return useMemo(() => {
    const tierDisplay = getTierDisplayName(tier);
    const tierPrice = getTierPricing(tier);
    
    return {
      tier,
      tierDisplay,
      tierPrice,
      
      hasFeature: (feature: string) => checkTierFeature(tier, feature),
      
      getFeatures: () => getTierFeatures(tier),
      
      requiresUpgrade: (feature: string) => calculateUpgradeRequirements(tier, feature),
      
      hasAllFeatures: (features: string[]) => 
        features.every(feature => checkTierFeature(tier, feature)),
      
      hasAnyFeature: (features: string[]) => 
        features.some(feature => checkTierFeature(tier, feature)),
    };
  }, [tier]);
}
