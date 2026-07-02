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
  const enabled = !!features.directory_promotion_enabled;
  const flexible = !!features.directory_promotion_flexible;

  // Fail-open: when no tier config exists at all, allow all tiers.
  // This matches the SQL gate behavior where unconfigured tiers skip gating.
  const hasAnyConfig = Object.keys(features).some(k => k.startsWith('directory_promotion_'));

  const allowedTiers: PromotionTier[] = [];

  if (!hasAnyConfig || flexible || enabled) {
    for (const t of ALL_TIERS) {
      if (!hasAnyConfig || flexible || features[`directory_promotion_tier_${t}`]) {
        allowedTiers.push(t);
      }
    }
  }

  const isEnabled = !hasAnyConfig || enabled;

  return {
    enabled: isEnabled,
    allowed_tiers: allowedTiers,
    is_flexible: flexible,
  };
}
