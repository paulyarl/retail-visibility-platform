/**
 * Social Posting Resolver
 *
 * Spec: docs/LocalBiz/SOCIAL_POSTING_SUITE_SPEC.md §5
 * Canonical two-gate model:
 *   Hard gate: social_posting_* feature keys (tier / BSaaS / admin grant)
 *   Soft gate: tenant_social_posting_settings merchant toggles
 */

import type { EffectiveSocialPosting, SocialPostingMerchantSettings } from './types';

export function resolveSocialPosting(
  features: Record<string, boolean>,
  merchantPrefs: SocialPostingMerchantSettings | null
): EffectiveSocialPosting {
  const flexible = !!features.social_posting_flexible;
  const moduleOn = flexible || !!features.social_posting_enabled;

  // Hard gate
  const canPostFacebook = moduleOn && (flexible || !!features.social_posting_meta);
  const canPostInstagram = moduleOn && (flexible || !!features.social_posting_instagram);
  const canPostThreads = moduleOn && (flexible || !!features.social_posting_threads);
  const canUseScheduler = moduleOn && (flexible || !!features.social_posting_scheduler);

  // Soft gate — merchant toggles default ON
  const metaOn = merchantPrefs?.social_posting_meta_on !== false;
  const igOn = merchantPrefs?.social_posting_ig_on !== false;
  const threadsOn = merchantPrefs?.social_posting_threads_on !== false;
  const masterOn = merchantPrefs?.social_posting_enabled !== false;

  const facebookEnabled = canPostFacebook && masterOn && metaOn;
  const instagramEnabled = canPostInstagram && masterOn && igOn;
  const threadsEnabled = canPostThreads && masterOn && threadsOn;

  return {
    enabled: moduleOn && (canPostFacebook || canPostInstagram || canPostThreads),
    is_flexible: flexible,
    can_post_facebook: canPostFacebook,
    can_post_instagram: canPostInstagram,
    can_post_threads: canPostThreads,
    can_use_scheduler: canUseScheduler,
    facebook_enabled: facebookEnabled,
    instagram_enabled: instagramEnabled,
    threads_enabled: threadsEnabled,
    merchant_preferences: {
      social_posting_enabled: masterOn,
      social_posting_meta_on: metaOn,
      social_posting_ig_on: igOn,
      social_posting_threads_on: threadsOn,
    },
    features: {},
  };
}
