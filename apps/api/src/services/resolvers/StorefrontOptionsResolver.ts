/**
 * Storefront Options Resolver
 *
 * Resolves effective storefront options state from tier features + merchant preferences.
 *
 * QR, Gallery, Hours, and Layouts capabilities have been extracted to their own dedicated
 * resolvers (StorefrontQrResolver, StorefrontGalleryResolver, StorefrontHoursResolver,
 * StorefrontLayoutResolver).
 * This resolver handles only core storefront options: category, recommend, info,
 * advanced, recently viewed, and map/location display.
 */

import type {
  EffectiveStorefrontOptions,
  StorefrontOptionsMerchantSettings,
} from './types';

export type StorefrontOptCategoryType = 'category_store' | 'category_product';
export type StorefrontOptRecommendType = 'recommend_store' | 'recommend_products';
export type StorefrontOptInfoType = 'storefront_social_media' | 'storefront_contact' | 'interactive_maps';
export type StorefrontOptAdvancedType = 'enhanced_seo' | 'storefront_actions';

export function resolveStorefrontOptions(
  features: Record<string, boolean>,
  merchantPrefs: StorefrontOptionsMerchantSettings | null
): EffectiveStorefrontOptions {
  const disabled = !!features.storefront_opt_disabled;
  const enabled = !disabled && !!features.storefront_opt_enabled;
  const flexible = !!features.storefront_opt_flexible;
  const mainOn = enabled;

  // Category — individual features (group gate removed, fallback to old group gate)
  const allowedCategoryTypes: StorefrontOptCategoryType[] = [];
  if (flexible) {
    allowedCategoryTypes.push('category_store', 'category_product');
  } else if (features.storefront_opt_category_store || features.storefront_opt_category_product) {
    if (features.storefront_opt_category_store) allowedCategoryTypes.push('category_store');
    if (features.storefront_opt_category_product) allowedCategoryTypes.push('category_product');
  } else if (features.storefront_opt_category_on || features.storefront_opt_category_enabled) {
    allowedCategoryTypes.push('category_store', 'category_product');
  }

  // Recommend — individual features (group gate removed, fallback to old group gate)
  const allowedRecommendTypes: StorefrontOptRecommendType[] = [];
  if (flexible) {
    allowedRecommendTypes.push('recommend_store', 'recommend_products');
  } else if (features.storefront_opt_recommend_store || features.storefront_opt_recommend_products) {
    if (features.storefront_opt_recommend_store) allowedRecommendTypes.push('recommend_store');
    if (features.storefront_opt_recommend_products) allowedRecommendTypes.push('recommend_products');
  } else if (features.storefront_opt_recommend_on || features.storefront_opt_recommend_enabled) {
    allowedRecommendTypes.push('recommend_store', 'recommend_products');
  }

  // Info — consolidated key (new) with fallback to old group gate + individual keys
  const allowedInfoTypes: StorefrontOptInfoType[] = [];
  if (flexible || features.storefront_opt_info || features.storefront_opt_info_on) {
    allowedInfoTypes.push('storefront_social_media', 'storefront_contact', 'interactive_maps');
  } else if (features.storefront_opt_info_on || features.storefront_opt_info_enabled) {
    allowedInfoTypes.push('storefront_social_media', 'storefront_contact', 'interactive_maps');
  } else {
    if (features.storefront_opt_storefront_social_media) allowedInfoTypes.push('storefront_social_media');
    if (features.storefront_opt_storefront_contact) allowedInfoTypes.push('storefront_contact');
    if (features.storefront_opt_interactive_maps) allowedInfoTypes.push('interactive_maps');
  }

  // Advanced — individual features (group gate removed, fallback to old group gate)
  const allowedAdvancedTypes: StorefrontOptAdvancedType[] = [];
  if (flexible) {
    allowedAdvancedTypes.push('enhanced_seo', 'storefront_actions');
  } else if (features.storefront_opt_enhanced_seo || features.storefront_opt_storefront_actions) {
    if (features.storefront_opt_enhanced_seo) allowedAdvancedTypes.push('enhanced_seo');
    if (features.storefront_opt_storefront_actions) allowedAdvancedTypes.push('storefront_actions');
  } else if (features.storefront_opt_advanced_on || features.storefront_opt_advanced_enabled) {
    allowedAdvancedTypes.push('enhanced_seo', 'storefront_actions');
  }

  const prefs = {
    storefront_opt_enabled: merchantPrefs?.storefront_opt_enabled !== false,
    map_display: merchantPrefs?.map_display !== false,
    location_display: merchantPrefs?.location_display !== false,
    category_store: merchantPrefs?.category_store !== false,
    category_product: merchantPrefs?.category_product !== false,
    recommend_store: merchantPrefs?.recommend_store !== false,
    recommend_products: merchantPrefs?.recommend_products !== false,
    recently_viewed: merchantPrefs?.recently_viewed !== false,
    storefront_social_media: merchantPrefs?.storefront_social_media !== false,
    storefront_contact: merchantPrefs?.storefront_contact !== false,
    interactive_maps: merchantPrefs?.interactive_maps !== false,
    enhanced_seo: merchantPrefs?.enhanced_seo ?? false,
    storefront_actions: merchantPrefs?.storefront_actions ?? false,
  };

  // Effective filters
  const effectiveCategoryTypes = mainOn ? allowedCategoryTypes.filter((t) => prefs[t] !== false) : [];
  const effectiveRecommendTypes = mainOn ? allowedRecommendTypes.filter((t) => prefs[t] !== false) : [];
  const effectiveInfoTypes = mainOn ? allowedInfoTypes.filter((t) => prefs[t] !== false) : [];
  const effectiveAdvancedTypes = mainOn ? allowedAdvancedTypes.filter((t) => prefs[t] !== false) : [];

  const infoTierAllowed = flexible || !!features.storefront_opt_info || !!features.storefront_opt_info_enabled
    || !!features.storefront_opt_storefront_social_media || !!features.storefront_opt_storefront_contact
    || !!features.storefront_opt_interactive_maps || !!features.storefront_opt_map_display || !!features.storefront_opt_location_display;
  const recentlyViewedTierAllowed = flexible || !!features.storefront_opt_recently_viewed;

  return {
    enabled: mainOn,
    is_flexible: flexible,
    category_enabled: mainOn && allowedCategoryTypes.length > 0,
    allowed_category_types: allowedCategoryTypes,
    recommend_enabled: mainOn && allowedRecommendTypes.length > 0,
    allowed_recommend_types: allowedRecommendTypes,
    recently_viewed_enabled: mainOn && recentlyViewedTierAllowed,
    info_enabled: mainOn && allowedInfoTypes.length > 0,
    allowed_info_types: allowedInfoTypes,
    advanced_enabled: mainOn && allowedAdvancedTypes.length > 0,
    allowed_advanced_types: allowedAdvancedTypes,
    can_show_map_display: mainOn && infoTierAllowed && prefs.map_display,
    can_show_location_display: mainOn && infoTierAllowed && prefs.location_display,
    can_use_category_store: mainOn && effectiveCategoryTypes.includes('category_store'),
    can_use_category_product: mainOn && effectiveCategoryTypes.includes('category_product'),
    can_use_recommend_store: mainOn && effectiveRecommendTypes.includes('recommend_store'),
    can_use_recommend_products: mainOn && effectiveRecommendTypes.includes('recommend_products'),
    can_use_recently_viewed: mainOn && recentlyViewedTierAllowed && prefs.recently_viewed,
    can_use_social_media: mainOn && effectiveInfoTypes.includes('storefront_social_media'),
    can_use_contact: mainOn && effectiveInfoTypes.includes('storefront_contact'),
    can_use_interactive_maps: mainOn && effectiveInfoTypes.includes('interactive_maps'),
    can_use_enhanced_seo: mainOn && effectiveAdvancedTypes.includes('enhanced_seo'),
    can_use_storefront_actions: mainOn && effectiveAdvancedTypes.includes('storefront_actions'),
    merchant_preferences: prefs,
  };
}
