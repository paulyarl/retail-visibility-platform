/**
 * Social Commerce Options Resolver
 *
 * Resolves effective social commerce options state from tier features
 * and merchant preferences.
 */

import type {
  EffectiveSocialCommerceOptions,
  SocialCommerceMetaType,
  SocialCommerceTikTokType,
  SocialCommerceExperienceType,
  SocialCommerceOptionsMerchantSettings,
} from './types';

export function resolveSocialCommerceOptions(
  features: Record<string, boolean>,
  merchantSettings: SocialCommerceOptionsMerchantSettings | null
): EffectiveSocialCommerceOptions {
  const cleanFeatures: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(features)) {
    cleanFeatures[key.trim()] = val;
  }
  const feat = cleanFeatures;

  const disabled = !!feat.social_commerce_disabled;
  const enabled = !disabled && !!feat.social_commerce_enabled;
  const flexible = !!feat.social_commerce_flexible;

  // Meta Commerce group
  const metaGroupEnabled = flexible || !!feat.social_commerce_meta_enabled;

  const allowedMeta: SocialCommerceMetaType[] = [];
  if (flexible || metaGroupEnabled) {
    if (flexible || feat.social_commerce_meta_catalog) allowedMeta.push('social_commerce_meta_catalog');
    if (flexible || feat.social_commerce_meta_shop) allowedMeta.push('social_commerce_meta_shop');
    if (flexible || feat.social_commerce_meta_pixel) allowedMeta.push('social_commerce_meta_pixel');
    if (flexible && allowedMeta.length === 0) {
      allowedMeta.push('social_commerce_meta_catalog', 'social_commerce_meta_shop', 'social_commerce_meta_pixel');
    }
  }

  // TikTok Commerce group
  const tiktokGroupEnabled = flexible || !!feat.social_commerce_tiktok_enabled;

  const allowedTikTok: SocialCommerceTikTokType[] = [];
  if (flexible || tiktokGroupEnabled) {
    if (flexible || feat.social_commerce_tiktok_catalog) allowedTikTok.push('social_commerce_tiktok_catalog');
    if (flexible || feat.social_commerce_tiktok_shop) allowedTikTok.push('social_commerce_tiktok_shop');
    if (flexible || feat.social_commerce_tiktok_pixel) allowedTikTok.push('social_commerce_tiktok_pixel');
    if (flexible && allowedTikTok.length === 0) {
      allowedTikTok.push('social_commerce_tiktok_catalog', 'social_commerce_tiktok_shop', 'social_commerce_tiktok_pixel');
    }
  }

  // Social Experience group
  const experienceGroupEnabled = flexible ||
    !!feat.social_commerce_share_buttons ||
    !!feat.social_commerce_social_proof ||
    !!feat.social_commerce_abandoned_cart;

  const allowedExperience: SocialCommerceExperienceType[] = [];
  if (flexible) {
    allowedExperience.push('social_commerce_share_buttons', 'social_commerce_social_proof', 'social_commerce_abandoned_cart');
  } else {
    if (feat.social_commerce_share_buttons) allowedExperience.push('social_commerce_share_buttons');
    if (feat.social_commerce_social_proof) allowedExperience.push('social_commerce_social_proof');
    if (feat.social_commerce_abandoned_cart) allowedExperience.push('social_commerce_abandoned_cart');
  }

  // Merchant preferences (soft toggles, default to false for opt-in features)
  const prefs = {
    social_commerce_enabled: merchantSettings?.social_commerce_enabled !== false,
    social_commerce_meta_enabled: !!merchantSettings?.social_commerce_meta_enabled,
    social_commerce_meta_catalog: !!merchantSettings?.social_commerce_meta_catalog,
    social_commerce_meta_shop: !!merchantSettings?.social_commerce_meta_shop,
    social_commerce_meta_pixel: !!merchantSettings?.social_commerce_meta_pixel,
    social_commerce_tiktok_enabled: !!merchantSettings?.social_commerce_tiktok_enabled,
    social_commerce_tiktok_catalog: !!merchantSettings?.social_commerce_tiktok_catalog,
    social_commerce_tiktok_shop: !!merchantSettings?.social_commerce_tiktok_shop,
    social_commerce_tiktok_pixel: !!merchantSettings?.social_commerce_tiktok_pixel,
    social_commerce_share_buttons: !!merchantSettings?.social_commerce_share_buttons,
    social_commerce_social_proof: !!merchantSettings?.social_commerce_social_proof,
    social_commerce_abandoned_cart: !!merchantSettings?.social_commerce_abandoned_cart,
  };

  const mainOn = enabled && prefs.social_commerce_enabled;

  // Effective flags = main gate AND tier allows AND merchant enabled
  const effectiveMeta = mainOn ? allowedMeta.filter(t => prefs[t]) : [];
  const effectiveTikTok = mainOn ? allowedTikTok.filter(t => prefs[t]) : [];
  const effectiveExperience = mainOn ? allowedExperience.filter(t => prefs[t]) : [];

  const allTypes = [...effectiveMeta, ...effectiveTikTok, ...effectiveExperience];

  return {
    enabled: mainOn,
    is_flexible: flexible,
    meta_enabled: mainOn && metaGroupEnabled && prefs.social_commerce_meta_enabled,
    allowed_meta_types: allowedMeta,
    tiktok_enabled: mainOn && tiktokGroupEnabled && prefs.social_commerce_tiktok_enabled,
    allowed_tiktok_types: allowedTikTok,
    experience_enabled: mainOn && experienceGroupEnabled,
    allowed_experience_types: allowedExperience,
    can_use_meta_catalog: mainOn && effectiveMeta.includes('social_commerce_meta_catalog'),
    can_use_meta_shop: mainOn && effectiveMeta.includes('social_commerce_meta_shop'),
    can_use_meta_pixel: mainOn && effectiveMeta.includes('social_commerce_meta_pixel'),
    can_use_tiktok_catalog: mainOn && effectiveTikTok.includes('social_commerce_tiktok_catalog'),
    can_use_tiktok_shop: mainOn && effectiveTikTok.includes('social_commerce_tiktok_shop'),
    can_use_tiktok_pixel: mainOn && effectiveTikTok.includes('social_commerce_tiktok_pixel'),
    can_use_share_buttons: mainOn && effectiveExperience.includes('social_commerce_share_buttons'),
    can_use_social_proof: mainOn && effectiveExperience.includes('social_commerce_social_proof'),
    can_use_abandoned_cart: mainOn && effectiveExperience.includes('social_commerce_abandoned_cart'),
    social_commerce_available: mainOn && allTypes.length > 0,
    merchant_preferences: prefs,
  };
}
