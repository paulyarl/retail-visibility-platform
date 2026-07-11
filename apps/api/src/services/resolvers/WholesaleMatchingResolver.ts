/**
 * Wholesale Matching Resolver
 *
 * Resolves effective wholesale matching state from tier features + merchant preferences.
 * Tier gating: free=none, growth=search, scale=full.
 */

import type {
  EffectiveWholesaleMatching,
  WholesaleMatchingTier,
  WholesaleMatchingMerchantSettings,
} from './types';

export function resolveWholesaleMatching(
  features: Record<string, boolean>,
  merchantPrefs: WholesaleMatchingMerchantSettings | null
): EffectiveWholesaleMatching {
  const disabled = !!features.wholesale_matching_disabled;
  const flexible = !!features.wholesale_matching_flexible;

  // Determine tier level from features
  // full: wholesale_matching_full OR flexible
  // search: wholesale_matching_search OR wholesale_matching_full OR flexible
  // none: nothing enabled (or disabled)
  let tier: WholesaleMatchingTier = 'none';
  if (!disabled) {
    if (flexible || !!features.wholesale_matching_full) {
      tier = 'full';
    } else if (!!features.wholesale_matching_search) {
      tier = 'search';
    }
  }

  const enabled = !disabled && tier !== 'none';

  // Merchant preference soft toggle (default: enabled if tier allows)
  const prefEnabled = merchantPrefs?.wholesale_matching_enabled !== false;
  const effectiveEnabled = enabled && prefEnabled;

  return {
    enabled: effectiveEnabled,
    tier: effectiveEnabled ? tier : 'none',
    can_check_supplier_match: effectiveEnabled,
    can_search_faire: effectiveEnabled && (tier === 'search' || tier === 'full'),
    can_build_affiliate_link: effectiveEnabled && tier === 'full',
    can_view_brand_partners: effectiveEnabled,
    is_flexible: flexible,
  };
}
