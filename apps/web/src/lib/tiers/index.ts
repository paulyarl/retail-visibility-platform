/**
 * Tier-Based Feature Access Control
 * 
 * Centralized exports for tier access utilities
 */

// Core tier feature definitions and utilities (hardcoded fallbacks)
export {
  TIER_FEATURES,
  TIER_HIERARCHY,
  FEATURE_TIER_MAP,
  TIER_DISPLAY_NAMES,
  FEATURE_DISPLAY_NAMES,
  TIER_PRICING,
  TIER_FEATURE_LIMITS,
  checkTierFeature,
  getRequiredTier,
  getTierDisplayName,
  getTierPricing,
  getTierFeatures,
  getFeatureLimits,
  calculateUpgradeRequirements,
} from './tier-features';

// DB-driven tier config hook (preferred over hardcoded imports)
export { useTierConfig, type TierConfigResult } from './useTierConfig';

// React hook for tier access
export { useTierAccess, type TierAccessResult } from './useTierAccess';
