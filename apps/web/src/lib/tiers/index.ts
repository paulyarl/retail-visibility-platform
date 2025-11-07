/**
 * Tier-Based Feature Access Control
 * 
 * Centralized exports for tier access utilities
 */

// Core tier feature definitions and utilities
export {
  TIER_FEATURES,
  TIER_HIERARCHY,
  FEATURE_TIER_MAP,
  TIER_DISPLAY_NAMES,
  FEATURE_DISPLAY_NAMES,
  TIER_PRICING,
  checkTierFeature,
  getRequiredTier,
  getTierDisplayName,
  getTierPricing,
  getTierFeatures,
  calculateUpgradeRequirements,
} from './tier-features';

// React hook for tier access
export { useTierAccess, type TierAccessResult } from './useTierAccess';
