/**
 * Directory Promotion Resolver
 *
 * Resolves effective directory promotion state from tier features.
 * Determines which promotion tiers (basic, premium, featured) are available
 * based on the tenant's subscription plan.
 */

import type {
  EffectiveDirectoryPromotion,
  PromotionTier,
} from './types';

const ALL_TIERS: PromotionTier[] = ['basic', 'premium', 'featured'];

export function resolveDirectoryPromotion(
  features: Record<string, boolean>,
): EffectiveDirectoryPromotion {
  const disabled = !!features.directory_promotion_disabled;
  const flexible = !!features.directory_promotion_flexible;

  // Check if any individual promotion tier feature is enabled (implicit enable)
  const hasAnyPromotionFeature = ALL_TIERS.some(t => !!features[`directory_promotion_tier_${t}`]);
  const enabled = !disabled && (!!features.directory_promotion_enabled || hasAnyPromotionFeature);

  const allowedTiers: PromotionTier[] = [];

  if (flexible || enabled) {
    for (const t of ALL_TIERS) {
      if (flexible || features[`directory_promotion_tier_${t}`]) {
        allowedTiers.push(t);
      }
    }
  }

  const isEnabled = enabled;

  return {
    enabled: isEnabled,
    allowed_tiers: allowedTiers,
    is_flexible: flexible,
  };
}
