/**
 * GBP Management Resolver
 *
 * Resolves effective GBP Management state from tier features + merchant preferences.
 * Implements the canonical two-gate model:
 *   Hard gate: features.gbp_directory_reviews / gbp_directory_content (tier/purchase/grant)
 *   Soft gate: merchantPreferences.gbp_reviews_display / gbp_content_display
 *
 * Per capability-data-flow-rules.md R33:
 *   - canShowReviews / canShowContent are tier-level (hard gate only)
 *   - reviewsEnabled / contentEnabled are the effective state (hard AND soft gate)
 */

export interface GbpManagementMerchantSettings {
  gbp_reviews_display?: boolean | null;
  gbp_content_display?: boolean | null;
}

export interface EffectiveGbpManagement {
  enabled: boolean;
  is_flexible: boolean;
  // Hard gate (tier-level — R33: NOT gated by merchant prefs)
  can_show_reviews: boolean;
  can_show_content: boolean;
  can_use_ai_response: boolean;
  can_use_posts_scheduler: boolean;
  // Effective state (hard gate AND soft gate)
  reviews_enabled: boolean;
  content_enabled: boolean;
  // Merchant preferences (soft gate raw values)
  merchant_preferences: {
    gbp_reviews_display: boolean;
    gbp_content_display: boolean;
  };
  features: Record<string, boolean>;
}

export function resolveGbpManagement(
  features: Record<string, boolean>,
  merchantPrefs: GbpManagementMerchantSettings | null
): EffectiveGbpManagement {
  const flexible = !!features.gbp_management_flexible;

  // Hard gate (R33: tier-level fields, never gated by merchant prefs)
  const canShowReviews = flexible || !!features.gbp_directory_reviews;
  const canShowContent = flexible || !!features.gbp_directory_content;
  const canUseAiResponse = flexible || !!features.gbp_ai_response;
  const canUsePostsScheduler = flexible || !!features.gbp_posts_scheduler;

  // Soft gate (merchant-gated fields: tier AND merchant)
  const reviewsDisplayEnabled = merchantPrefs?.gbp_reviews_display !== false;
  const contentDisplayEnabled = merchantPrefs?.gbp_content_display !== false;

  // Effective state
  const reviewsEnabled = canShowReviews && reviewsDisplayEnabled;
  const contentEnabled = canShowContent && contentDisplayEnabled;

  return {
    enabled: canShowReviews || canShowContent || canUseAiResponse || canUsePostsScheduler,
    is_flexible: flexible,
    can_show_reviews: canShowReviews,
    can_show_content: canShowContent,
    can_use_ai_response: canUseAiResponse,
    can_use_posts_scheduler: canUsePostsScheduler,
    reviews_enabled: reviewsEnabled,
    content_enabled: contentEnabled,
    merchant_preferences: {
      gbp_reviews_display: reviewsDisplayEnabled,
      gbp_content_display: contentDisplayEnabled,
    },
    features: {},
  };
}
